// Matemática usada pela simulação. Toda trigonometria da sim passa por aqui para
// que possa ser trocada por uma versão polinomial (determinismo entre motores JS)
// sem tocar no resto do código.

export const PI = Math.PI;
export const TAU = Math.PI * 2;

export const sin = Math.sin;
export const cos = Math.cos;
export const atan2 = Math.atan2;
export const sqrt = Math.sqrt;
export const hypot = (x, y) => Math.sqrt(x * x + y * y);
export const abs = Math.abs;
export const floor = Math.floor;
export const round = Math.round;
export const min = Math.min;
export const max = Math.max;

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function sign(v) {
  return v > 0 ? 1 : v < 0 ? -1 : 0;
}

/** Aproxima `v` de `target` no máximo `step`. */
export function approach(v, target, step) {
  if (v < target) return v + step > target ? target : v + step;
  return v - step < target ? target : v - step;
}

/** Módulo sempre positivo. */
export function mod(a, n) {
  return ((a % n) + n) % n;
}

/** Normaliza ângulo para (-PI, PI]. */
export function wrapAngle(a) {
  a = mod(a + PI, TAU) - PI;
  return a === -PI ? PI : a;
}

/** Suavização smoothstep em [0,1]. */
export function smooth(t) {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
}

/** Onda triangular periódica em [0,1] com período 1. */
export function tri(t) {
  const f = mod(t, 1);
  return f < 0.5 ? f * 2 : 2 - f * 2;
}

/** Interpolação linear por partes: pts = [[x0,y0],[x1,y1],...] ordenado por x. */
export function piecewise(pts, x) {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return pts[pts.length - 1][1];
}

/** Degrau: valor do último ponto cujo x <= t. pts = [[t0,v0],[t1,v1],...]. */
export function stepwise(pts, t) {
  let v = pts[0][1];
  for (let i = 0; i < pts.length; i++) {
    if (t >= pts[i][0]) v = pts[i][1];
    else break;
  }
  return v;
}
