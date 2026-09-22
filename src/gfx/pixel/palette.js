// Cores: conversão hex → Uint32 (0xAABBGGRR, little-endian para ImageData) e utilidades.

export function hexToRGB(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba32(hex, a = 255) {
  if (!hex) return 0;
  const [r, g, b] = hexToRGB(hex);
  return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

export function shade(hex, k) {
  const [r, g, b] = hexToRGB(hex);
  const f = (v) => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))));
  return '#' + [f(r), f(g), f(b)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function mix(a, b, t) {
  const A = hexToRGB(a);
  const B = hexToRGB(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

/** Monta uma paleta Uint32Array a partir de um array de hex (índice 0 = transparente). */
export function makePalette(hexes) {
  const p = new Uint32Array(Math.max(32, hexes.length));
  for (let i = 0; i < hexes.length; i++) p[i] = hexes[i] ? rgba32(hexes[i]) : 0;
  p[0] = 0;
  return p;
}

/** Matriz de Bayer 4×4 (0..15). */
export const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

export function bayer(x, y) {
  return BAYER4[(y & 3) * 4 + (x & 3)] / 16;
}
