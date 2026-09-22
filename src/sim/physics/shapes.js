// Testes de contato entre formas de perigo e a caixa de dano (AABB) do personagem.
// Todos preenchem `out` = { px, py, nx, ny } (ponto de contato e normal do perigo
// para o personagem) e devolvem true se houver contato.
import { sqrt, clamp, cos, sin, abs } from '../../core/dmath.js';

function normalize(out, dx, dy, fx, fy) {
  const d = sqrt(dx * dx + dy * dy);
  if (d > 1e-6) {
    out.nx = dx / d;
    out.ny = dy / d;
  } else {
    out.nx = fx;
    out.ny = fy;
  }
}

/** Círculo (cx, cy, r) × caixa {x0,y0,x1,y1}. */
export function circleBox(cx, cy, r, b, out) {
  const px = clamp(cx, b.x0, b.x1);
  const py = clamp(cy, b.y0, b.y1);
  const dx = px - cx;
  const dy = py - cy;
  if (dx * dx + dy * dy >= r * r) return false;
  out.px = px;
  out.py = py;
  const bcx = (b.x0 + b.x1) / 2;
  const bcy = (b.y0 + b.y1) / 2;
  normalize(out, bcx - cx, bcy - cy, bcx >= cx ? 1 : -1, -1);
  return true;
}

/** Caixa alinhada (x, y, w, h) × caixa. Normal: centro do perigo → centro do personagem. */
export function aabbBox(x, y, w, h, b, out) {
  if (!(b.x0 < x + w && b.x1 > x && b.y0 < y + h && b.y1 > y)) return false;
  out.px = clamp((b.x0 + b.x1) / 2, x, x + w);
  out.py = clamp((b.y0 + b.y1) / 2, y, y + h);
  const bcx = (b.x0 + b.x1) / 2;
  const bcy = (b.y0 + b.y1) / 2;
  normalize(out, bcx - (x + w / 2), bcy - (y + h / 2), 1, -1);
  return true;
}

// Distância² de ponto a segmento; devolve t do ponto mais próximo em `tmp.t`.
const tmp = { t: 0 };
function pointSegDist2(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((px - x0) * dx + (py - y0) * dy) / len2 : 0;
  t = clamp(t, 0, 1);
  tmp.t = t;
  const qx = x0 + t * dx - px;
  const qy = y0 + t * dy - py;
  return qx * qx + qy * qy;
}

// Segmento corta a caixa? (Liang–Barsky)
function segHitsBox(x0, y0, x1, y1, b) {
  let t0 = 0;
  let t1 = 1;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const p = [-dx, dx, -dy, dy];
  const q = [x0 - b.x0, b.x1 - x0, y0 - b.y0, b.y1 - y0];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const r = q[i] / p[i];
      if (p[i] < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
  }
  return true;
}

/** Cápsula (segmento (x0,y0)-(x1,y1) com raio r) × caixa. */
export function capsuleBox(x0, y0, x1, y1, r, b, out) {
  const bcx = (b.x0 + b.x1) / 2;
  const bcy = (b.y0 + b.y1) / 2;
  let d2;
  if (segHitsBox(x0, y0, x1, y1, b)) d2 = 0;
  else {
    // mínimo entre extremos→caixa e cantos→segmento (exato em 2D)
    const e0x = clamp(x0, b.x0, b.x1) - x0;
    const e0y = clamp(y0, b.y0, b.y1) - y0;
    const e1x = clamp(x1, b.x0, b.x1) - x1;
    const e1y = clamp(y1, b.y0, b.y1) - y1;
    d2 = Math.min(e0x * e0x + e0y * e0y, e1x * e1x + e1y * e1y);
    d2 = Math.min(d2, pointSegDist2(b.x0, b.y0, x0, y0, x1, y1));
    d2 = Math.min(d2, pointSegDist2(b.x1, b.y0, x0, y0, x1, y1));
    d2 = Math.min(d2, pointSegDist2(b.x0, b.y1, x0, y0, x1, y1));
    d2 = Math.min(d2, pointSegDist2(b.x1, b.y1, x0, y0, x1, y1));
  }
  if (d2 >= r * r) return false;
  pointSegDist2(bcx, bcy, x0, y0, x1, y1);
  const qx = x0 + tmp.t * (x1 - x0);
  const qy = y0 + tmp.t * (y1 - y0);
  out.px = qx;
  out.py = qy;
  normalize(out, bcx - qx, bcy - qy, bcx >= qx ? 1 : -1, -1);
  return true;
}

/** Caixa orientada (centro, meias-dimensões, ângulo) × caixa (SAT). */
export function obbBox(cx, cy, hw, hh, ang, b, out) {
  const c = cos(ang);
  const s = sin(ang);
  const bcx = (b.x0 + b.x1) / 2;
  const bcy = (b.y0 + b.y1) / 2;
  const bhw = (b.x1 - b.x0) / 2;
  const bhh = (b.y1 - b.y0) / 2;
  const dx = bcx - cx;
  const dy = bcy - cy;
  // eixos da caixa alinhada
  const ex = abs(c) * hw + abs(s) * hh;
  const ey = abs(s) * hw + abs(c) * hh;
  if (abs(dx) > ex + bhw || abs(dy) > ey + bhh) return false;
  // eixos da caixa orientada
  const ax = abs(dx * c + dy * s);
  const ay = abs(-dx * s + dy * c);
  const pax = bhw * abs(c) + bhh * abs(s);
  const pay = bhw * abs(s) + bhh * abs(c);
  if (ax > hw + pax || ay > hh + pay) return false;
  // ponto de contato: centro do personagem preso no referencial da OBB
  const lx = clamp(dx * c + dy * s, -hw, hw);
  const ly = clamp(-dx * s + dy * c, -hh, hh);
  out.px = cx + lx * c - ly * s;
  out.py = cy + lx * s + ly * c;
  normalize(out, dx, dy, dx >= 0 ? 1 : -1, -1);
  return true;
}
