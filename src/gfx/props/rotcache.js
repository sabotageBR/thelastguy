// Sprite rotacionado com amostragem por pixel (vizinho mais próximo), em cache por
// passo de ângulo. Mantém a pixel art nítida em qualquer rotação.
import { PixelBuffer } from '../pixel/buffer.js';
import { makePalette } from '../pixel/palette.js';

const TAU = Math.PI * 2;

export class RotSprite {
  /** buf: PixelBuffer indexado; hexes: paleta (array de hex); pivô = centro do buffer (ou px,py). */
  constructor(buf, hexes, steps = 64, px = null, py = null) {
    this.buf = buf;
    this.pal = makePalette(hexes);
    this.steps = steps;
    this.px = px ?? buf.w / 2;
    this.py = py ?? buf.h / 2;
    const r = Math.ceil(
      Math.max(
        Math.hypot(this.px, this.py),
        Math.hypot(buf.w - this.px, this.py),
        Math.hypot(this.px, buf.h - this.py),
        Math.hypot(buf.w - this.px, buf.h - this.py),
      ),
    );
    this.S = r * 2 + 2;
    this.cache = new Array(steps);
  }

  index(angle) {
    const s = this.steps;
    return ((Math.round(angle / (TAU / s)) % s) + s) % s;
  }

  get(angle) {
    const i = this.index(angle);
    let c = this.cache[i];
    if (!c) c = this.cache[i] = this.render((i * TAU) / this.steps);
    return c;
  }

  render(a) {
    const S = this.S;
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(S, S);
    const out = new Uint32Array(img.data.buffer);
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const { w, h, d } = this.buf;
    const half = S / 2;
    for (let oy = 0; oy < S; oy++) {
      const dy = oy + 0.5 - half;
      for (let ox = 0; ox < S; ox++) {
        const dx = ox + 0.5 - half;
        const u = Math.floor(dx * ca + dy * sa + this.px);
        const v = Math.floor(-dx * sa + dy * ca + this.py);
        if (u < 0 || v < 0 || u >= w || v >= h) continue;
        const idx = d[v * w + u];
        if (idx) out[oy * S + ox] = this.pal[idx];
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  /** Desenha com o pivô em (x, y) na tela. */
  draw(ctx, angle, x, y) {
    const c = this.get(angle);
    ctx.drawImage(c, Math.round(x - this.S / 2), Math.round(y - this.S / 2));
  }
}

/** Buffer não rotacionado → canvas (para sprites estáticos em cache). */
export function bufferCanvas(buf, hexes) {
  const pal = makePalette(hexes);
  const c = document.createElement('canvas');
  c.width = buf.w;
  c.height = buf.h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(buf.w, buf.h);
  buf.toRGBA(pal, new Uint32Array(img.data.buffer));
  ctx.putImageData(img, 0, 0);
  return c;
}

/**
 * Cilindro listrado deitado (eixo horizontal), como a cabeça dos martelos dos mockups.
 * Índices: 1 contorno, 2/3 listras, 4/5 listras claras, 6/7 listras escuras, 8 tampa, 9 tampa clara.
 */
export function cylinderBuffer(len, dia, stripe = 6) {
  const cap = Math.max(3, Math.round(dia / 6));
  const W = len + 2;
  const H = dia + 2;
  const b = new PixelBuffer(W, H);
  const ry = dia / 2;
  for (let y = 0; y < dia; y++) {
    const yy = (y + 0.5 - ry) / ry; // -1..1
    const band = yy < -0.45 ? 1 : yy > 0.5 ? 2 : 0;
    const xin = Math.round(cap * Math.sqrt(Math.max(0, 1 - yy * yy)));
    for (let x = 0; x < len; x++) {
      // tampa da esquerda (elipse) e corpo; tampa da direita desenhada depois
      if (x < cap - xin) continue;
      const s = Math.floor((x + (band === 1 ? 1 : 0)) / stripe) & 1;
      let idx = s ? 3 : 2;
      if (band === 1) idx = s ? 5 : 4;
      if (band === 2) idx = s ? 7 : 6;
      if (x >= len - cap) {
        const cx = x - (len - cap);
        if (cx > cap - (cap - xin)) continue;
      }
      b.set(x + 1, y + 1, idx);
    }
  }
  // tampa da direita: elipse clara com anel
  for (let y = 0; y < dia; y++) {
    const yy = (y + 0.5 - ry) / ry;
    const xin = Math.round(cap * Math.sqrt(Math.max(0, 1 - yy * yy)));
    for (let k = -xin; k <= xin; k++) {
      const x = len - cap + k;
      if (x < 0 || x >= len) continue;
      const inner = Math.abs(yy) < 0.55 && Math.abs(k) < xin - 1;
      b.set(x + 1, y + 1, inner ? 9 : 8);
    }
  }
  b.outline(1);
  return b;
}

export const HAMMER_HEXES = (pink, capYellow) => [null, pink[4], pink[2], pink[0], pink[1], '#ffe3f2', pink[3], pink[2], pink[1], capYellow];
