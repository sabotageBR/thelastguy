// Painters da geometria estática em 3/4: faixa de topo (12 px acima da linha física)
// + face da frente. Tudo em coordenadas do mundo (padrões ancorados no mundo, sem emendas).
import { bayer } from './pixel/palette.js';

export const TOP_BAND = 12;

/** Pintor de retângulos sobre um contexto com origem (ox, oy) no mundo. */
export class Painter {
  constructor(ctx, ox, oy) {
    this.ctx = ctx;
    this.ox = ox;
    this.oy = oy;
    this.last = null;
  }

  rect(x, y, w, h, color) {
    if (w <= 0 || h <= 0 || !color) return;
    if (color !== this.last) {
      this.ctx.fillStyle = color;
      this.last = color;
    }
    this.ctx.fillRect(x - this.ox, y - this.oy, w, h);
  }

  px(x, y, color) {
    this.rect(x, y, 1, 1, color);
  }
}

const KIND_ALIAS = { start: 'path', ramp: 'path', tile: 'path' };

function blockStyle(theme, kind) {
  return theme.blocks[kind] || theme.blocks[KIND_ALIAS[kind]] || theme.blocks.block;
}

/**
 * Pinta um sólido estático. `adj` = { left, right } indica vizinhos colados no mesmo topo
 * (sem borda lateral nesses lados).
 */
export function paintSolid(p, theme, s, adj = {}) {
  if (s.kind === 'hurdle') return paintHurdle(p, theme, s);
  const st = blockStyle(theme, s.kind);
  const x = s.x;
  const y = s.y;
  const w = s.w;
  const h = s.h;
  const T = TOP_BAND;
  // --- faixa de topo (quadriculado 8×4 ancorado no mundo)
  for (let yy = 0; yy < T; yy += 4) {
    const wy = y - T + yy;
    const ch = Math.floor(wy / 4);
    let cx = x;
    while (cx < x + w) {
      const cell = Math.floor(cx / 8);
      const nx = Math.min(x + w, (cell + 1) * 8);
      p.rect(cx, wy, nx - cx, 4, (cell + ch) & 1 ? st.top : st.top2);
      cx = nx;
    }
  }
  p.rect(x, y - T, w, 1, st.topLight);
  // contorno de cima da faixa
  p.rect(x, y - T - 1, w, 1, st.edge);
  // --- face da frente
  let fy = y;
  const bottom = y + h;
  if (st.lip) {
    const lipH = Math.min(6, h);
    p.rect(x, fy, w, lipH - 1, st.lip);
    p.rect(x, fy + lipH - 1, w, 1, st.lipDark);
    fy += lipH;
  } else {
    p.rect(x, fy, w, 1, st.topLight);
    fy += 1;
  }
  const bodyH = bottom - fy;
  if (bodyH > 0) {
    p.rect(x, fy, w, bodyH, st.front);
    // escurece a parte funda com transição pontilhada
    const deep = fy + 16;
    if (bottom > deep) {
      for (let yy = deep; yy < Math.min(bottom, deep + 4); yy++) {
        for (let xx = x; xx < x + w; xx++) if (bayer(xx, yy) < (yy - deep + 1) / 5) p.px(xx, yy, st.front2);
      }
      if (bottom > deep + 4) p.rect(x, deep + 4, w, bottom - deep - 4, st.front2);
    }
    // emendas verticais dos blocos (a cada 32 px, ancoradas no mundo)
    const first = Math.ceil((x + 1) / 32) * 32;
    for (let sx = first; sx < x + w; sx += 32) p.rect(sx, fy, 1, bodyH - 1, st.seam);
    // emenda horizontal
    if (bodyH > 26) p.rect(x, fy + 24, w, 1, st.seam);
  }
  // bordas
  p.rect(x, bottom - 1, w, 1, st.edge);
  if (!adj.left) p.rect(x, y - T - 1, 1, h + T + 1, st.edge);
  if (!adj.right) p.rect(x + w - 1, y - T - 1, 1, h + T + 1, st.edge);
}

/** Monte de neve (Reino Gelado): meia-elipse branca com sombra azulada. */
function paintMound(p, theme, s) {
  const cx = s.x + s.w / 2;
  const rx = s.w / 2 + 1;
  const ry = s.h + 5;
  const base = s.y + s.h;
  const edge = theme.outline || '#173c66';
  for (let yy = 0; yy <= ry; yy++) {
    const k = yy / ry;
    const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (1 - k) * (1 - k))));
    const y = base - ry + yy;
    p.rect(Math.round(cx - hw) - 1, y, hw * 2 + 2, 1, edge);
    if (hw <= 0) continue;
    p.rect(Math.round(cx - hw), y, hw * 2, 1, yy < 3 ? '#ffffff' : '#f4fbff');
    p.rect(Math.round(cx + hw * 0.35), y, Math.max(1, Math.round(hw * 0.65)), 1, yy < 3 ? '#e8f6ff' : '#cfe6f6');
  }
  p.rect(Math.round(cx - rx * 0.4), base - ry + 2, 2, 1, '#ffffff');
}

/** Tronco caído atravessando a pista (Templo da Selva): vemos a seção redonda, com anéis. */
function paintLogHurdle(p, theme, s) {
  const r = Math.max(s.w, s.h) / 2;
  const cx = s.x + s.w / 2;
  const cy = s.y + s.h - r;
  for (let yy = Math.floor(-r - 1); yy <= r; yy++) {
    for (let xx = Math.floor(-r - 1); xx <= r; xx++) {
      const d = Math.hypot(xx + 0.5, yy + 0.5);
      if (d > r + 0.5) continue;
      let col = '#3a2410';
      if (d < r - 0.7) col = d > r - 2.5 ? '#6a4420' : Math.floor(d / 2.2) & 1 ? '#c89058' : '#e0b070';
      p.px(Math.round(cx + xx), Math.round(cy + yy), col);
    }
  }
  p.px(Math.round(cx), Math.round(cy), '#8a5a2e');
}

/** Barreira listrada amarela/branca (diagonais 45°), como nos mockups. */
export function paintHurdle(p, theme, s) {
  if (theme.hurdle === 'mound') return paintMound(p, theme, s);
  if (theme.hurdle === 'log') return paintLogHurdle(p, theme, s);
  const [a, b] = theme.hazard || ['#fcc532', '#fefce3'];
  const edge = '#8a5a0f';
  const top = s.y - 6; // um pouco de "topo" em 3/4
  p.rect(s.x - 1, top - 1, s.w + 2, s.h + 7, edge);
  for (let y = top; y < s.y + s.h - 1; y++) {
    for (let x = s.x; x < s.x + s.w; x++) p.px(x, y, (((x + y) / 3) | 0) & 1 ? a : b);
  }
  p.rect(s.x, top, s.w, 1, '#ffffff');
}

/** Pinta uma rampa com cunha sólida por baixo (coluna a coluna, sem anti-aliasing). */
export function paintRamp(p, theme, r) {
  const st = blockStyle(theme, r.kind);
  const x0 = Math.min(r.x0, r.x1);
  const x1 = Math.max(r.x0, r.x1);
  const base = Math.max(r.y0, r.y1) + (r.depth ?? 48);
  const T = TOP_BAND;
  for (let x = x0; x <= x1; x++) {
    const sy = Math.round(r.y0 + ((x - r.x0) * (r.y1 - r.y0)) / (r.x1 - r.x0));
    // faixa de topo acompanhando a inclinação
    for (let yy = 0; yy < T; yy += 4) {
      const wy = sy - T + yy;
      const cell = Math.floor(x / 8) + Math.floor((wy - sy) / 4);
      p.rect(x, wy, 1, 4, cell & 1 ? st.top : st.top2);
    }
    p.px(x, sy - T, st.topLight);
    p.px(x, sy - T - 1, st.edge);
    // frente
    let fy = sy;
    if (st.lip) {
      p.rect(x, fy, 1, 5, st.lip);
      p.px(x, fy + 5, st.lipDark);
      fy += 6;
    }
    const dh = base - fy;
    if (dh > 0) {
      const deep = fy + 16;
      p.rect(x, fy, 1, Math.min(dh, 16), st.front);
      if (base > deep) p.rect(x, deep, 1, base - deep, st.front2);
      if (x % 32 === 0) p.rect(x, fy, 1, dh - 1, st.seam);
    }
    p.px(x, base - 1, st.edge);
  }
}

/** Grade amarela no fundo da faixa de topo. */
export function paintRails(p, theme, x, y, w) {
  const [light, mid, dark, edge] = theme.rail;
  const top = y - TOP_BAND - 9;
  // tubo horizontal
  p.rect(x + 2, top - 1, w - 4, 1, edge);
  p.rect(x + 2, top, w - 4, 1, light);
  p.rect(x + 2, top + 1, w - 4, 1, mid);
  p.rect(x + 2, top + 2, w - 4, 1, dark);
  p.rect(x + 2, top + 3, w - 4, 1, edge);
  // postes
  for (let px = x + 4; px < x + w - 2; px += 32) {
    p.rect(px - 1, top, 4, 11, edge);
    p.rect(px, top, 2, 10, mid);
    p.rect(px, top, 1, 10, light);
  }
  const last = x + w - 5;
  p.rect(last - 1, top, 4, 11, edge);
  p.rect(last, top, 2, 10, mid);
}

/** Faixa quadriculada no chão (linha de chegada). */
export function paintFinishFloor(p, x, y) {
  for (let yy = 0; yy < TOP_BAND; yy += 3) {
    for (let xx = 0; xx < 12; xx += 3) {
      const on = ((xx / 3 + yy / 3) & 1) === 0;
      p.rect(x - 6 + xx, y - TOP_BAND + yy, 3, 3, on ? '#1d1d24' : '#ffffff');
    }
  }
}
