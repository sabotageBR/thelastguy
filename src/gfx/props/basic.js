// Painters dos obstáculos básicos (cores vêm do tema; Céu Doce = mockups).
import { registerPainter } from './index.js';
import { RotSprite, cylinderBuffer, bufferCanvas, HAMMER_HEXES } from './rotcache.js';
import { Painter, paintSolid, TOP_BAND } from '../tiles.js';
import { PixelBuffer } from '../pixel/buffer.js';
import { shade } from '../pixel/palette.js';

const TAU = Math.PI * 2;
const cache = new Map();

function cached(key, make) {
  let v = cache.get(key);
  if (!v) cache.set(key, (v = make()));
  return v;
}

function pinkOf(th) {
  return th.pink || ['#fdc4e6', '#fc4da5', '#ef2b7e', '#c12f8d', '#832162'];
}

function purpleOf(th) {
  return th.purple || ['#e0b0ff', '#c071e7', '#b75bf9', '#8b39eb', '#6724ca', '#3e1582'];
}

/** Linha grossa em pixels (Bresenham com pincel quadrado). */
export function pixLine(ctx, x0, y0, x1, y1, w, color) {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  const o = Math.floor(w / 2);
  ctx.fillStyle = color;
  for (let guard = 0; guard < 2000; guard++) {
    ctx.fillRect(x0 - o, y0 - o, w, w);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

function disc(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  for (let yy = -r; yy <= r; yy++) {
    const hw = Math.floor(Math.sqrt(r * r - yy * yy + r * 0.8));
    ctx.fillRect(Math.round(x) - hw, Math.round(y) + yy, hw * 2 + 1, 1);
  }
}

/** Poste cilíndrico rosa com tampa amarela (como nos mockups). */
function post(ctx, th, x, yTop, yBot, w = 8) {
  const pk = pinkOf(th);
  const X = Math.round(x - w / 2);
  const T = Math.round(yTop);
  const H = Math.round(yBot - yTop);
  ctx.fillStyle = pk[4];
  ctx.fillRect(X - 1, T, w + 2, H);
  ctx.fillStyle = pk[1];
  ctx.fillRect(X, T, w, H);
  ctx.fillStyle = pk[2];
  ctx.fillRect(X + w - 3, T, 3, H);
  ctx.fillStyle = pk[0];
  ctx.fillRect(X + 1, T, 1, H);
  // tampa
  ctx.fillStyle = pk[4];
  ctx.fillRect(X - 2, T - 4, w + 4, 5);
  ctx.fillStyle = th.capYellow || '#fbe23d';
  ctx.fillRect(X - 1, T - 3, w + 2, 3);
  ctx.fillStyle = '#fff6a8';
  ctx.fillRect(X, T - 3, w - 2, 1);
}

function hammerHead(th, len, dia) {
  const pk = pinkOf(th);
  const hx = th.hammer ? [null, pk[4], th.hammer.stripeA, th.hammer.stripeB, pk[1], th.hammer.hi || '#ffe3f2', pk[3], pk[2], pk[1], th.capYellow || '#fbe23d'] : HAMMER_HEXES(pk, th.capYellow || '#fbe23d');
  return cached(`cyl:${th.id}:${len}:${dia}`, () => new RotSprite(cylinderBuffer(len, dia, 6), hx, 64));
}

/** Lâmina de machado de pedra (meia-lua com a borda para longe do pivô). */
function axeSprite(w, h) {
  return cached(`axe:${w}x${h}`, () => {
    const b = new PixelBuffer(w + 2, h + 2);
    for (let y = 0; y < h; y++) {
      const v = y / (h - 1);
      for (let x = 0; x < w; x++) {
        const u = (x + 0.5 - w / 2) / (w / 2);
        const socket = Math.abs(u) < 0.16 && v < 0.42;
        const blade = v >= 0.22 && v <= 1 - 0.55 * u * u && Math.abs(u) <= 1;
        if (!socket && !blade) continue;
        let idx = v < 0.5 ? 3 : 2;
        if (blade && v > 1 - 0.55 * u * u - 0.16) idx = 4; // fio da lâmina
        else if (u > 0.45) idx = 5;
        if (socket && v < 0.42) idx = Math.floor(y / 3) & 1 ? 7 : 6;
        b.set(x + 1, y + 1, idx);
      }
    }
    b.outline(1);
    return new RotSprite(b, [null, '#2a2a2a', '#8a8a8a', '#b0b0b0', '#e8e8e8', '#5a5a5a', '#8a5a2e', '#2a7446'], 64);
  });
}

const LOG_HEXES = [null, '#3a2410', '#8a5a2e', '#a8733c', '#a8733c', '#c28c50', '#6a4420', '#5a3a1a', '#c89058', '#e0b070'];

/** Cabeça do pêndulo conforme a variante: martelo listrado (padrão), machado de pedra ou tronco. */
function pendulumHead(th, o) {
  if (o.kind === 'axe') return axeSprite(o.headW, o.headH);
  if (o.kind === 'log') return cached(`logcyl:${o.headW}:${o.headH}`, () => new RotSprite(cylinderBuffer(o.headW, o.headH, 5), LOG_HEXES, 64));
  return hammerHead(th, o.headW, o.headH);
}

// ------------------------------------------------------------------ pêndulo
registerPainter('pendulum', (ctx, o, th, t, cx, cy, layer) => {
  const pv = o.pose(t, o._rp || (o._rp = {}));
  const px = o.x - cx;
  const py = o.y - cy;
  if (layer === 'back') {
    const gy = (o.def.groundY ?? o.y + o.L + 48) - cy - TOP_BAND;
    const span = Math.round(o.L * 0.55 + 18);
    post(ctx, th, px - span, py - 2, gy, 8);
    post(ctx, th, px + span, py - 2, gy, 8);
    const pk = pinkOf(th);
    ctx.fillStyle = pk[4];
    ctx.fillRect(px - span - 4, py - 7, span * 2 + 8, 8);
    ctx.fillStyle = pk[1];
    ctx.fillRect(px - span - 3, py - 6, span * 2 + 6, 6);
    ctx.fillStyle = pk[0];
    ctx.fillRect(px - span - 3, py - 6, span * 2 + 6, 1);
    return;
  }
  if (layer !== 'span') return;
  const hx = pv.x - cx;
  const hy = pv.y - cy;
  const pu = purpleOf(th);
  pixLine(ctx, px, py, hx, hy, 5, pu[5]);
  pixLine(ctx, px, py, hx, hy, 3, pu[3]);
  const head = pendulumHead(th, o);
  head.draw(ctx, -pv.a, hx, hy);
  disc(ctx, px, py, 4, pinkOf(th)[4]);
  disc(ctx, px, py, 3, th.capYellow || '#fbe23d');
});

// ------------------------------------------------------------------ rotor
function barSprite(th, len, dia, colors) {
  return cached(`bar:${th.id}:${len}:${dia}:${colors.join()}`, () => {
    const b = new PixelBuffer(len + 2, dia + 2);
    for (let y = 0; y < dia; y++) {
      const band = y < dia * 0.3 ? 1 : y > dia * 0.7 ? 2 : 0;
      for (let x = 0; x < len; x++) {
        const s = Math.floor(x / 6) & 1;
        b.set(x + 1, y + 1, 2 + s + band * 2);
      }
    }
    b.outline(1);
    const [a, bb, dark] = colors;
    return new RotSprite(b, [null, dark, a, bb, shade(a, 0.3), shade(bb, 0.3), shade(a, -0.25), shade(bb, -0.2)], 64, 1, (dia + 2) / 2);
  });
}

registerPainter('rotator', (ctx, o, th, t, cx, cy, layer) => {
  const px = o.x - cx;
  const py = o.y - cy;
  const pk = pinkOf(th);
  if (layer === 'back') {
    const gy = (o.def.groundY ?? o.y + 96) - cy - TOP_BAND;
    if (o.def.post !== false) post(ctx, th, px, py + 6, gy, 10);
    return;
  }
  if (layer !== 'span') return;
  const a0 = o.angle(t);
  const pu = purpleOf(th);
  for (let i = 0; i < o.n; i++) {
    const a = a0 + (i * TAU) / o.n;
    const ex = px + Math.cos(a) * o.L;
    const ey = py + Math.sin(a) * o.L;
    if (o.style === 'hammer') {
      pixLine(ctx, px, py, ex, ey, 5, pu[5]);
      pixLine(ctx, px, py, ex, ey, 3, pu[3]);
      hammerHead(th, Math.round(o.r * 2.2), Math.round(o.r * 1.7)).draw(ctx, a + Math.PI / 2, ex, ey);
    } else if (o.style === 'firebar') {
      const n = Math.max(3, Math.round(o.L / 10));
      for (let k = 1; k <= n; k++) {
        const f = k / n;
        const bx = px + Math.cos(a) * o.L * f;
        const by = py + Math.sin(a) * o.L * f;
        const fl = (Math.floor(t * 20 + k) & 1) === 0;
        disc(ctx, bx, by, 5, '#b3261e');
        disc(ctx, bx, by, 4, fl ? '#ff7a1a' : '#ff9a2a');
        disc(ctx, bx, by, 2, '#ffe066');
      }
    } else if (o.style === 'laser') {
      ctx.globalCompositeOperation = 'lighter';
      pixLine(ctx, px, py, ex, ey, 5, 'rgba(255,40,80,0.35)');
      ctx.globalCompositeOperation = 'source-over';
      pixLine(ctx, px, py, ex, ey, 2, '#ff2e4d');
      pixLine(ctx, px, py, ex, ey, 1, '#ffffff');
    } else {
      const cols = o.style === 'log' ? ['#8a5a2e', '#a8733c', '#3a2410'] : [pk[2], pk[0], pk[4]];
      barSprite(th, o.L, 10, cols).draw(ctx, a, px, py);
    }
  }
  // tambor central (rosa com topo amarelo)
  disc(ctx, px, py, o.hub + 1, pk[4]);
  disc(ctx, px, py, o.hub, pk[1]);
  disc(ctx, px, py - 2, Math.max(3, o.hub - 4), th.capYellow || '#fbe23d');
  disc(ctx, px - 2, py - 3, 1, '#fff6a8');
});

// ------------------------------------------------------------------ blocos cinemáticos
function bevelBlock(th, w, h, kind) {
  return cached(`blk:${th.id}:${kind}:${w}x${h}`, () => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h + TOP_BAND;
    const x = c.getContext('2d');
    const pu = kind === 'stamp' ? pinkOf(th).concat(['#401030']) : purpleOf(th);
    const top = pu[1];
    const face = pu[2];
    const dark = pu[3];
    const edge = pu[5] || pu[4];
    // topo (3/4)
    x.fillStyle = edge;
    x.fillRect(0, 0, w, TOP_BAND + h);
    x.fillStyle = top;
    x.fillRect(1, 1, w - 2, TOP_BAND - 1);
    x.fillStyle = pu[0];
    x.fillRect(1, 1, w - 2, 1);
    // frente
    x.fillStyle = face;
    x.fillRect(1, TOP_BAND, w - 2, h - 1);
    x.fillStyle = dark;
    x.fillRect(1, TOP_BAND + h - 5, w - 2, 4);
    x.fillRect(w - 4, TOP_BAND, 3, h - 1);
    x.fillStyle = pu[1];
    x.fillRect(1, TOP_BAND, 2, h - 5);
    x.fillRect(1, TOP_BAND, w - 2, 1);
    if (kind === 'stamp') {
      // estampa de doce: faixas brancas (outros mundos: veios de lava, faixas de perigo...)
      x.fillStyle = th.stampStripe || '#ffffff';
      for (let k = 4; k < w - 4; k += 8) x.fillRect(k, TOP_BAND + 3, 3, h - 9);
    }
    return c;
  });
}

registerPainter('pusher', (ctx, o, th, t, cx, cy, layer) => {
  if (layer !== 'back') return;
  const p = o.posAt(t, o._rp || (o._rp = {}));
  const img = bevelBlock(th, o.w, o.h, o.kind === 'pusher' ? 'purple' : o.kind);
  ctx.drawImage(img, Math.round(p.x) - cx, Math.round(p.y) - cy - TOP_BAND);
});

registerPainter('crusher', (ctx, o, th, t, cx, cy, layer) => {
  if (layer !== 'back') return;
  const st = o.stateAt(t);
  const p = o.posAt(t, o._rp || (o._rp = {}));
  const jx = st.s === 'shake' ? (Math.floor(t * 40) & 1 ? 1 : -1) : 0;
  const img = bevelBlock(th, o.w, o.h, 'stamp');
  // haste
  const pk = pinkOf(th);
  ctx.fillStyle = pk[4];
  ctx.fillRect(Math.round(o.x + o.w / 2 - 3) - cx, o.y - 200 - cy, 6, Math.round(p.y) - o.y + 200);
  ctx.drawImage(img, Math.round(p.x) - cx + jx, Math.round(p.y) - cy - TOP_BAND);
  if (st.s === 'shake' || st.s === 'wait') {
    // aviso: sombra no chão
    const gy = (o.def.groundY ?? o.y + o.h + o.drop) - cy;
    ctx.fillStyle = st.s === 'shake' ? 'rgba(230,40,60,0.45)' : 'rgba(8,24,72,0.22)';
    ctx.fillRect(Math.round(o.x) - cx + 2, gy - 3, o.w - 4, 2);
  }
});

function miniBlock(ctx, th, kind, x, y, w, h, cx, cy) {
  const p = new Painter(ctx, cx, cy);
  paintSolid(p, th, { x: Math.round(x), y: Math.round(y), w, h, kind }, {});
}

registerPainter('mover', (ctx, o, th, t, cx, cy, layer) => {
  if (layer !== 'back') return;
  const p = o.posAt(t, o._rp || (o._rp = {}));
  miniBlock(ctx, th, o.kind === 'mover' ? 'plank' : o.kind, p.x, p.y, o.w, o.h, cx, cy);
});

registerPainter('sinking', (ctx, o, th, t, cx, cy, layer) => {
  if (layer !== 'back' || !o.solid.active) return;
  const s = o.solid;
  miniBlock(ctx, th, o.kind === 'sinking' ? 'wafer' : o.kind, s.x, s.y, o.w, o.h, cx, cy);
});

registerPainter('ferris', (ctx, o, th, t, cx, cy, layer) => {
  if (layer !== 'back') return;
  const px = o.x - cx;
  const py = o.y - cy;
  const pk = pinkOf(th);
  const p = o._rp || (o._rp = {});
  // raios e aro
  for (let i = 0; i < o.n; i++) {
    o.carPos(i, t, p);
    pixLine(ctx, px, py, p.x + o.w / 2 - cx, p.y - cy, 2, pk[3]);
  }
  for (let i = 0; i < o.n; i++) {
    o.carPos(i, t, p);
    miniBlock(ctx, th, o.kind === 'ferris' ? 'plank' : o.kind, p.x, p.y, o.w, 8, cx, cy);
  }
  disc(ctx, px, py, 7, pk[4]);
  disc(ctx, px, py, 6, pk[1]);
  disc(ctx, px, py - 1, 3, th.capYellow || '#fbe23d');
});

// ------------------------------------------------------------------ ladrilhos que caem
// rachadura em zigue-zague sobre a faixa de topo (desenhada aos poucos: aviso do gelo fino)
const CRACK = [
  [0, 6],
  [3, 4],
  [5, 7],
  [8, 5],
  [10, 8],
  [13, 5],
  [16, 6],
];

function drawCrack(ctx, s, x, y, k, glow, tick) {
  const top = y - TOP_BAND;
  const flip = s.tileIdx & 1;
  const n = Math.max(1, Math.round(k * (CRACK.length - 1)));
  if (glow && (tick >> 2) & 1) {
    ctx.fillStyle = 'rgba(220,250,255,0.55)';
    ctx.fillRect(x, top, s.w, TOP_BAND);
  }
  const col = glow ? '#ffffff' : '#1d5a8a';
  for (let i = 0; i < n; i++) {
    const [ax, ay] = CRACK[i];
    const [bx, by] = CRACK[i + 1];
    pixLine(ctx, x + (s.w * ax) / 16, top + (flip ? 12 - ay : ay), x + (s.w * bx) / 16, top + (flip ? 12 - by : by), 1, col);
  }
  if (k > 0.6) pixLine(ctx, x + s.w * 0.5, top + 6, x + s.w * 0.6, top + (flip ? 1 : 11), 1, col);
}

registerPainter('crumble', (ctx, o, th, t, cx, cy, layer) => {
  if (layer !== 'back') return;
  const tick = o.world.tick;
  const crack = o.def.look === 'crack';
  for (const tile of o.tiles) {
    const s = tile.s;
    if (s.x + s.w < cx - 8 || s.x > cx + 1000) continue;
    const kind = s.kind === 'crumble' ? 'wafer' : s.kind;
    if (tile.st === 2) {
      const age = tick - tile.fallT;
      if (age > 30) continue;
      const dy = Math.round(age * age * 0.12);
      ctx.globalAlpha = Math.max(0, 1 - age / 30);
      miniBlock(ctx, th, kind, s.x, s.y + dy, s.w, s.h, cx, cy);
      ctx.globalAlpha = 1;
      continue;
    }
    const jx = tile.st === 1 && (!crack || tile.timer < 20) ? (Math.floor(tick / 2) & 1 ? 1 : -1) : 0;
    // sem emendas entre ladrilhos vizinhos intactos do mesmo tipo
    const i = s.tileIdx;
    const L = o.tiles[i - 1];
    const R = o.tiles[i + 1];
    const adj = {
      left: !!L && L.st === 0 && tile.st === 0 && L.s.kind === s.kind,
      right: !!R && R.st === 0 && tile.st === 0 && R.s.kind === s.kind,
    };
    paintSolid(new Painter(ctx, cx, cy), th, { x: Math.round(s.x + jx), y: s.y, w: s.w, h: s.h, kind }, adj);
    if (tile.st !== 1) continue;
    if (crack) {
      drawCrack(ctx, s, s.x + jx - cx, s.y - cy, 1 - tile.timer / Math.max(1, tile.total), tile.timer < 30, tick);
      continue;
    }
    // rachaduras + tom de alerta
    ctx.fillStyle = 'rgba(230,40,80,0.35)';
    ctx.fillRect(s.x + jx - cx, s.y - TOP_BAND - cy, s.w, TOP_BAND);
    ctx.fillStyle = '#5a2a10';
    const x0 = s.x + jx - cx + 3;
    const y0 = s.y - cy - 8;
    ctx.fillRect(x0, y0, 1, 3);
    ctx.fillRect(x0 + 1, y0 + 3, 1, 2);
    ctx.fillRect(x0 + 5, y0 + 1, 1, 3);
  }
});

// ------------------------------------------------------------------ pilares do rio
registerPainter('pillars', (ctx, o, th, t, cx, cy, layer) => {
  if (layer !== 'back') return;
  const tick = o.world.tick;
  for (const it of o.items) {
    const s = it.s;
    let dy = 0;
    if (it.gone) {
      const age = tick - it.goneT;
      if (age > 40) continue;
      dy = Math.round(age * age * 0.08);
      ctx.globalAlpha = Math.max(0, 1 - age / 40);
    }
    const jx = it.warnT > 0 ? (Math.floor(tick / 2) & 1 ? 1 : -1) : 0;
    const h = Math.min(s.h, o.water - s.y + 8);
    paintSolid(new Painter(ctx, cx, cy), th, { x: s.x + jx, y: s.y + dy, w: s.w, h: Math.max(8, h), kind: o.kind === 'pillars' ? 'block' : o.kind }, {});
    if (it.warnT > 0) {
      ctx.fillStyle = '#33261a';
      const x0 = s.x + jx - cx;
      const y0 = s.y - cy;
      ctx.fillRect(x0 + 10, y0 + 4, 1, 10);
      ctx.fillRect(x0 + 11, y0 + 14, 1, 8);
      ctx.fillRect(x0 + s.w - 14, y0 + 8, 1, 12);
      ctx.fillRect(x0 + s.w - 15, y0 + 20, 1, 6);
    }
    ctx.globalAlpha = 1;
  }
});

// ------------------------------------------------------------------ gangorra
registerPainter('seesaw', (ctx, o, th, t, cx, cy, layer) => {
  if (layer !== 'back') return;
  const r = o.ramp;
  const pk = pinkOf(th);
  // base triangular
  const bx = o.x - cx;
  const by = o.y - cy;
  ctx.fillStyle = th.capYellow || '#fbe23d';
  for (let k = 0; k < 14; k++) ctx.fillRect(bx - k, by + 4 + k, k * 2 + 1, 1);
  ctx.fillStyle = shade(th.capYellow || '#fbe23d', -0.3);
  ctx.fillRect(bx - 13, by + 17, 27, 2);
  // prancha acompanhando a inclinação
  for (let x = r.x0; x <= r.x1; x++) {
    const sy = r.surfaceY(x);
    if (sy !== sy) continue;
    const X = x - cx;
    const Y = sy - cy;
    ctx.fillStyle = pk[4];
    ctx.fillRect(X, Y - 7, 1, 13);
    ctx.fillStyle = ((x >> 3) & 1) ? pk[0] : pk[1];
    ctx.fillRect(X, Y - 6, 1, 5);
    ctx.fillStyle = pk[2];
    ctx.fillRect(X, Y - 1, 1, 5);
  }
  disc(ctx, bx, by + 1, 3, pk[4]);
  disc(ctx, bx, by + 1, 2, th.capYellow || '#fbe23d');
});

// ------------------------------------------------------------------ trampolim / esteira / bumper
registerPainter('pad', (ctx, o, th, t, cx, cy, layer) => {
  if (layer !== 'back') return;
  const age = o.world ? o.world.tick - o.lastBounce : 99;
  const sq = age < 6 ? 3 - Math.floor(age / 2) : 0;
  const x = o.x - cx;
  const y = o.y - cy;
  const w = o.w;
  const on = o.active(t);
  if (o.kind === 'geyser') {
    ctx.fillStyle = '#3a2a34';
    ctx.fillRect(x, y - 4, w, o.h + 4);
    ctx.fillStyle = on ? '#ff9a1a' : '#6b4a3a';
    ctx.fillRect(x + 4, y - 3, w - 8, 3);
    if (on) {
      for (let k = 0; k < 6; k++) {
        const hh = 20 + ((Math.floor(t * 30) + k * 7) % 24);
        ctx.fillStyle = k & 1 ? 'rgba(255,240,200,0.8)' : 'rgba(255,160,60,0.7)';
        ctx.fillRect(x + 6 + k * ((w - 12) / 6), y - 3 - hh, 3, hh);
      }
    }
    return;
  }
  // marshmallow: cilindro branco-rosado com topo elíptico
  const pk = pinkOf(th);
  const top = y - TOP_BAND + 2 + sq;
  ctx.fillStyle = pk[4];
  ctx.fillRect(x, top - 1, w, o.h + TOP_BAND - sq);
  ctx.fillStyle = '#fff4fa';
  ctx.fillRect(x + 1, top, w - 2, TOP_BAND - 3);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x + 3, top + 1, w - 10, 2);
  ctx.fillStyle = pk[0];
  ctx.fillRect(x + 1, top + TOP_BAND - 3, w - 2, o.h + 1 - sq);
  ctx.fillStyle = pk[1];
  ctx.fillRect(x + 1, y + o.h - 3, w - 2, 2);
  // molas
  ctx.fillStyle = '#ffffff';
  for (let k = 6; k < w - 4; k += 10) ctx.fillRect(x + k, y + 1 - sq, 2, o.h - 4);
});

registerPainter('conveyor', (ctx, o, th, t, cx, cy, layer) => {
  if (layer !== 'back') return;
  const x = o.x - cx;
  const y = o.y - cy;
  const w = o.w;
  ctx.fillStyle = '#1d2433';
  ctx.fillRect(x, y - TOP_BAND - 1, w, TOP_BAND + 1 + o.h);
  ctx.fillStyle = '#3a4458';
  ctx.fillRect(x + 1, y - TOP_BAND, w - 2, TOP_BAND - 1);
  // setas se movendo no sentido da esteira
  const off = ((((t * o.speed) % 12) + 12) % 12) | 0;
  ctx.fillStyle = th.capYellow || '#fbe23d';
  const dir = o.speed >= 0 ? 1 : -1;
  for (let k = -12; k < w + 12; k += 12) {
    const ax = x + k + off;
    if (ax < x + 2 || ax > x + w - 6) continue;
    for (let r = 0; r < 4; r++) {
      const dx = dir > 0 ? r : 3 - r;
      ctx.fillRect(ax + dx, y - TOP_BAND + 2 + r, 2, 1);
      ctx.fillRect(ax + dx, y - 3 - r, 2, 1);
    }
  }
  // lateral com roletes
  ctx.fillStyle = '#566279';
  ctx.fillRect(x + 1, y, w - 2, o.h - 2);
  ctx.fillStyle = '#8a95a8';
  for (let k = 4; k < w - 4; k += 8) ctx.fillRect(x + k, y + 3, 3, 3);
});

registerPainter('bumper', (ctx, o, th, t, cx, cy, layer) => {
  if (layer !== 'span') return;
  const pk = pinkOf(th);
  const x = o.x - cx;
  const y = o.y - cy;
  disc(ctx, x, y, o.r + 1, pk[4]);
  disc(ctx, x, y, o.r, pk[2]);
  disc(ctx, x - 1, y - 1, o.r - 3, pk[1]);
  disc(ctx, x - o.r / 3, y - o.r / 3, 2, '#ffffff');
});

// ------------------------------------------------------------------ rolantes
function ballSprite(th, r, kind) {
  const rr = Math.max(4, Math.round(r));
  return cached(`ball:${th.id}:${kind}:${rr}`, () => {
    const d = rr * 2;
    const b = new PixelBuffer(d + 2, d + 2);
    for (let y = 0; y < d; y++)
      for (let x = 0; x < d; x++) {
        const dx = x + 0.5 - rr;
        const dy = y + 0.5 - rr;
        if (dx * dx + dy * dy > rr * rr) continue;
        let idx;
        if (kind === 'log') idx = Math.abs(dx) < rr * 0.35 && Math.abs(dy) < rr * 0.35 ? 4 : (Math.floor((Math.hypot(dx, dy) / rr) * 3) & 1 ? 2 : 3);
        else idx = Math.floor((dx + dy + rr * 2) / Math.max(3, rr / 2)) & 1 ? 2 : 3;
        if (dx < -rr * 0.2 && dy < -rr * 0.2 && dx * dx + dy * dy < rr * rr * 0.5) idx += 4;
        b.set(x + 1, y + 1, idx);
      }
    b.outline(1);
    const cols =
      kind === 'log'
        ? [null, '#3a2410', '#8a5a2e', '#a8733c', '#d8a86a', '#a8733c', '#c28c50', '#c28c50', '#e8c088']
        : kind === 'snow'
          ? [null, '#5a7a9a', '#f4fbff', '#dcecf8', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff']
          : kind === 'rock'
            ? [null, '#1d1624', '#6b5a5a', '#54465e', '#8a7a7a', '#8a7a7a', '#7a6a6a', '#9a8a8a', '#9a8a8a']
            : [null, pinkOf(th)[4], pinkOf(th)[1], '#ffffff', pinkOf(th)[0], pinkOf(th)[0], '#ffffff', '#ffffff', '#ffffff'];
    return new RotSprite(b, cols, 16);
  });
}

registerPainter('roller', (ctx, o, th, t, cx, cy, layer) => {
  if (layer !== 'span') return;
  const list = o.instances(t);
  const it = o._it || (o._it = {});
  const kind = o.def.look || 'gum';
  for (let i = 0; i < list.length; i++) {
    if (!o.instance(list[i], t, it)) continue;
    const r = Math.round(it.r);
    ballSprite(th, r, it.giant ? o.def.giantLook || kind : kind).draw(ctx, it.angle, it.x - cx, it.y - cy - r);
  }
});

// ------------------------------------------------------------------ paredões (Block Dash)
registerPainter('walls', (ctx, o, th, t, cx, cy, layer) => {
  if (layer !== 'span') return;
  const pk = pinkOf(th);
  const pu = purpleOf(th);
  for (const s of o.pool) {
    if (!s.active) continue;
    const x = Math.round(s.x) - cx;
    const y = Math.round(s.y) - cy;
    if (s.lowWall) {
      const img = bevelBlock(th, s.w, s.h, 'purple');
      ctx.drawImage(img, x, y - TOP_BAND);
    } else {
      // parede alta: listras rosa/branco com base escura (passe por baixo!)
      ctx.fillStyle = pk[4];
      ctx.fillRect(x - 1, y - 1, s.w + 2, s.h + 2);
      for (let k = 0; k < s.h; k += 8) {
        ctx.fillStyle = (k >> 3) & 1 ? pk[0] : pk[2];
        ctx.fillRect(x, y + k, s.w, Math.min(8, s.h - k));
      }
      ctx.fillStyle = pu[4];
      ctx.fillRect(x, y + s.h - 4, s.w, 4);
      ctx.fillStyle = th.capYellow || '#fbe23d';
      ctx.fillRect(x + 2, y + s.h - 3, s.w - 4, 1);
    }
  }
});
