// Buffer de pixels indexados (Uint8) + primitivas de pixel art. DOM-free.

export class PixelBuffer {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.d = new Uint8Array(w * h);
  }

  clear(i = 0) {
    this.d.fill(i);
    return this;
  }

  clone() {
    const b = new PixelBuffer(this.w, this.h);
    b.d.set(this.d);
    return b;
  }

  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.d[y * this.w + x];
  }

  set(x, y, i) {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.d[y * this.w + x] = i;
  }

  rect(x, y, w, h, i) {
    const x0 = Math.max(0, x | 0);
    const y0 = Math.max(0, y | 0);
    const x1 = Math.min(this.w, (x + w) | 0);
    const y1 = Math.min(this.h, (y + h) | 0);
    for (let yy = y0; yy < y1; yy++) this.d.fill(i, yy * this.w + x0, yy * this.w + x1);
  }

  /** Linha de Bresenham. */
  line(x0, y0, x1, y1, i) {
    x0 |= 0;
    y0 |= 0;
    x1 |= 0;
    y1 |= 0;
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, i);
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

  /** Linha de 2 px de espessura (pincel 2×2). */
  line2(x0, y0, x1, y1, i) {
    x0 |= 0;
    y0 |= 0;
    x1 |= 0;
    y1 |= 0;
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, i);
      this.set(x0 + 1, y0, i);
      this.set(x0, y0 + 1, i);
      this.set(x0 + 1, y0 + 1, i);
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

  /** Elipse preenchida (ponto médio simples). */
  ellipse(cx, cy, rx, ry, i) {
    for (let y = -ry; y <= ry; y++) {
      for (let x = -rx; x <= rx; x++) {
        if ((x * x) / ((rx + 0.5) * (rx + 0.5)) + (y * y) / ((ry + 0.5) * (ry + 0.5)) <= 1) this.set(cx + x, cy + y, i);
      }
    }
  }

  /**
   * Copia um template sobre o buffer. Índice 0 é transparente.
   * o: { flipX, map (Uint8Array|array de remapeamento), only (Set de índices) }
   */
  blit(t, x, y, o = {}) {
    const flip = !!o.flipX;
    const map = o.map;
    for (let ty = 0; ty < t.h; ty++) {
      for (let tx = 0; tx < t.w; tx++) {
        let v = t.d[ty * t.w + tx];
        if (!v) continue;
        if (map) v = map[v] ?? v;
        this.set(x + (flip ? t.w - 1 - tx : tx), y + ty, v);
      }
    }
  }

  /** Contorno por dilatação de 4 vizinhos (não cascateia). */
  outline(outIdx, keep = null) {
    const { w, h, d } = this;
    const src = d.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const k = y * w + x;
        if (src[k]) continue;
        const l = x > 0 ? src[k - 1] : 0;
        const r = x < w - 1 ? src[k + 1] : 0;
        const u = y > 0 ? src[k - w] : 0;
        const dn = y < h - 1 ? src[k + w] : 0;
        if ((l && l !== outIdx) || (r && r !== outIdx) || (u && u !== outIdx) || (dn && dn !== outIdx)) {
          if (!keep || keep(x, y)) d[k] = outIdx;
        }
      }
    }
    return this;
  }

  /** Rotação de 90° × q (sentido horário), devolve novo buffer. */
  rot90(q = 1) {
    q = ((q % 4) + 4) % 4;
    if (q === 0) return this.clone();
    const { w, h, d } = this;
    const nw = q % 2 ? h : w;
    const nh = q % 2 ? w : h;
    const b = new PixelBuffer(nw, nh);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = d[y * w + x];
        if (!v) continue;
        let nx;
        let ny;
        if (q === 1) {
          nx = h - 1 - y;
          ny = x;
        } else if (q === 2) {
          nx = w - 1 - x;
          ny = h - 1 - y;
        } else {
          nx = y;
          ny = w - 1 - x;
        }
        b.d[ny * nw + nx] = v;
      }
    }
    return b;
  }

  /** Caixa delimitadora dos pixels não transparentes. */
  bbox() {
    let x0 = this.w;
    let y0 = this.h;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.d[y * this.w + x]) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    return x1 < 0 ? null : { x0, y0, x1, y1 };
  }

  /** Converte para RGBA (Uint32 0xAABBGGRR little-endian) usando a paleta. */
  toRGBA(palette, out = new Uint32Array(this.w * this.h)) {
    const d = this.d;
    for (let i = 0; i < d.length; i++) out[i] = palette[d[i]];
    return out;
  }
}

/**
 * Converte um template ASCII (array de strings) em {w, h, d}.
 * legend: objeto char → índice. '.' e ' ' = transparente.
 */
export function parseTemplate(rows, legend) {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const d = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const r = rows[y];
    for (let x = 0; x < r.length; x++) {
      const ch = r[x];
      if (ch === '.' || ch === ' ') continue;
      const v = legend[ch];
      if (v === undefined) throw new Error(`template: caractere desconhecido '${ch}'`);
      d[y * w + x] = v;
    }
  }
  return { w, h, d };
}
