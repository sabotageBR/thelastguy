// Pré-renderiza a geometria estática em "ilhas" (canvases do tamanho do conteúdo,
// divididos a cada 512 px). Desenhar a fase vira um punhado de drawImage.
import { Painter, paintSolid, paintRamp, paintRails, paintFinishFloor, TOP_BAND } from './tiles.js';

const CHUNK_W = 512;
const PAD_TOP = TOP_BAND + 14; // faixa de topo + grades

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  return c;
}

function itemBox(it) {
  if (it.type === 'solid') {
    const s = it.s;
    return { x0: s.x, y0: s.y - PAD_TOP, x1: s.x + s.w, y1: s.y + s.h };
  }
  if (it.type === 'ramp') {
    const r = it.r;
    const x0 = Math.min(r.x0, r.x1);
    const x1 = Math.max(r.x0, r.x1) + 1;
    return { x0, y0: Math.min(r.y0, r.y1) - PAD_TOP, x1, y1: Math.max(r.y0, r.y1) + (r.depth ?? 48) };
  }
  return it.box;
}

export class Islands {
  constructor(level, theme) {
    this.chunks = [];
    const items = [];
    const solids = level.solids.filter((s) => !s.dynamic);
    for (const s of solids) items.push({ type: 'solid', s });
    for (const r of level.ramps) items.push({ type: 'ramp', r });
    for (const d of level.decor) {
      if (d.kind === 'finishFloor') items.push({ type: 'deco', d, box: { x0: d.x - 8, y0: d.y - TOP_BAND - 2, x1: d.x + 8, y1: d.y } });
    }
    for (const it of items) it.box = itemBox(it);

    // adjacência (sem borda entre blocos colados no mesmo topo)
    for (const a of solids) {
      a._adj = { left: false, right: false };
      for (const b of solids) {
        if (a === b || a.y !== b.y || a.kind !== b.kind) continue;
        if (b.x + b.w === a.x) a._adj.left = true;
        if (a.x + a.w === b.x) a._adj.right = true;
      }
    }

    // componentes conectados por sobreposição de caixas (union-find)
    const parent = items.map((_, i) => i);
    const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    for (let i = 0; i < items.length; i++) {
      const a = items[i].box;
      for (let j = i + 1; j < items.length; j++) {
        const b = items[j].box;
        if (a.x0 <= b.x1 + 1 && b.x0 <= a.x1 + 1 && a.y0 <= b.y1 + 1 && b.y0 <= a.y1 + 1) {
          parent[find(i)] = find(j);
        }
      }
    }
    const groups = new Map();
    items.forEach((it, i) => {
      const r = find(i);
      if (!groups.has(r)) groups.set(r, []);
      groups.get(r).push(it);
    });

    for (const group of groups.values()) {
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const it of group) {
        x0 = Math.min(x0, it.box.x0);
        y0 = Math.min(y0, it.box.y0);
        x1 = Math.max(x1, it.box.x1);
        y1 = Math.max(y1, it.box.y1);
      }
      for (let cx = x0; cx < x1; cx += CHUNK_W) {
        const cw = Math.min(CHUNK_W, x1 - cx);
        const canvas = makeCanvas(cw, y1 - y0);
        const ctx = canvas.getContext('2d');
        const p = new Painter(ctx, cx, y0);
        // rampas primeiro, depois blocos (blocos cobrem a junção)
        for (const it of group) {
          if (it.box.x1 < cx || it.box.x0 > cx + cw) continue;
          if (it.type === 'ramp') paintRamp(p, theme, it.r);
        }
        for (const it of group) {
          if (it.box.x1 < cx || it.box.x0 > cx + cw) continue;
          if (it.type === 'solid') {
            paintSolid(p, theme, it.s, it.s._adj);
          }
        }
        for (const it of group) {
          if (it.box.x1 < cx || it.box.x0 > cx + cw) continue;
          if (it.type === 'solid' && it.s.deco === 'rails') paintRails(p, theme, it.s.x, it.s.y, it.s.w);
          if (it.type === 'deco' && it.d.kind === 'finishFloor') paintFinishFloor(p, it.d.x, it.d.y);
        }
        this.chunks.push({ x: cx, y: y0, w: cw, h: y1 - y0, canvas });
      }
    }
  }

  draw(ctx, camX, camY, vw, vh) {
    for (const c of this.chunks) {
      if (c.x + c.w < camX || c.x > camX + vw || c.y + c.h < camY || c.y > camY + vh) continue;
      ctx.drawImage(c.canvas, c.x - camX, c.y - camY);
    }
  }

  dispose() {
    for (const c of this.chunks) {
      c.canvas.width = 0;
      c.canvas.height = 0;
    }
    this.chunks = [];
  }
}
