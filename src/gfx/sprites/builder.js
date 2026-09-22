// Composição DOM-free dos quadros do personagem e do atlas por skin.
import { PixelBuffer } from '../pixel/buffer.js';
import { makePalette, shade } from '../pixel/palette.js';
import { P, HEAD, FACES, HAIR, TORSO, PRINTS, SHOE } from './parts.js';
import { HATS, ACCESSORIES } from './hats.js';
import { FRAMES, ATLAS_COLS, CELL } from './poses.js';
import { SKINS, SKIN_TONES } from './skins.js';

const OUTLINE = '#161028';

/** Paleta completa (40 cores) de uma skin. */
export function skinPalette(sk) {
  const c = sk.colors;
  const tone = SKIN_TONES[sk.tone] || SKIN_TONES.S2;
  const hat = c.hat || '#888888';
  const hexes = [];
  hexes[P.outline] = OUTLINE;
  hexes[P.skin] = tone;
  hexes[P.skinShade] = shade(tone, -0.2);
  hexes[P.hair] = c.hair || '#3a2416';
  hexes[P.hairShade] = shade(c.hair || '#3a2416', -0.35);
  hexes[P.hat] = hat;
  hexes[P.hatShade] = shade(hat, -0.25);
  hexes[P.hatLight] = shade(hat, 0.4);
  hexes[P.hatAccent] = c.hatAccent || shade(hat, -0.45);
  hexes[P.shirt] = c.shirt;
  hexes[P.shirtShade] = shade(c.shirt, -0.28);
  hexes[P.pants] = c.pants;
  hexes[P.pantsShade] = shade(c.pants, -0.28);
  hexes[P.shoes] = c.shoes || '#3b2a2a';
  hexes[P.shoeShade] = shade(c.shoes || '#3b2a2a', -0.3);
  hexes[P.eye] = '#10131f';
  hexes[P.accent] = c.accent || '#d42a2a';
  hexes[P.accentShade] = shade(c.accent || '#d42a2a', -0.3);
  hexes[P.blush] = '#f08a8a';
  hexes[P.mouth] = '#6a1a24';
  hexes[P.white] = '#ffffff';
  hexes[P.metal] = '#c8d0dc';
  hexes[P.metalDark] = '#7a8598';
  hexes[P.bone] = '#f4ecd0';
  hexes[P.boneDark] = '#c9b98a';
  hexes[P.gold] = '#fcd223';
  hexes[P.goldDark] = '#c99a12';
  hexes[P.black] = '#1d1d24';
  hexes[P.visor] = '#5ad2f0';
  hexes[P.visorDark] = '#2a6a9a';
  hexes[P.red] = '#e32a31';
  hexes[P.pink] = '#f7a1c4';
  hexes[P.yellow] = '#ffd23f';
  hexes[P.yellowDark] = '#e0a800';
  hexes[P.green] = '#47b84a';
  hexes[P.greenDark] = '#2e7a32';
  hexes[P.orange] = '#f39a1a';
  hexes[P.orangeDark] = '#c06a10';
  hexes[P.lightBlue] = '#bfe6ff';
  return makePalette(hexes);
}

// Remapeamentos para membros de trás (sombreados).
const BACK_MAP = new Uint8Array(64);
for (let i = 0; i < 64; i++) BACK_MAP[i] = i;
BACK_MAP[P.shirt] = P.shirtShade;
BACK_MAP[P.skin] = P.skinShade;
BACK_MAP[P.pants] = P.pantsShade;
BACK_MAP[P.shoes] = P.shoeShade;

/** Desenha uma parte (buffer do tamanho da célula) com contorno onde encosta no corpo. */
function overlayPart(dst, part) {
  const { w, h } = dst;
  const pd = part.d;
  const dd = dst.d;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = y * w + x;
      if (pd[k]) continue;
      if (!dd[k] || dd[k] === P.outline) continue;
      const l = x > 0 && pd[k - 1];
      const r = x < w - 1 && pd[k + 1];
      const u = y > 0 && pd[k - w];
      const dn = y < h - 1 && pd[k + w];
      if (l || r || u || dn) dd[k] = P.outline;
    }
  }
  for (let i = 0; i < pd.length; i++) if (pd[i]) dd[i] = pd[i];
}

function drawArm(b, sx, sy, a, back) {
  const ex = sx + a[0];
  const ey = sy + a[1];
  const hx = ex + a[2];
  const hy = ey + a[3];
  b.line2(sx, sy, ex, ey, back ? P.shirtShade : P.shirt);
  b.line2(ex, ey, hx, hy, back ? P.skinShade : P.skin);
  return [hx, hy];
}

function drawLeg(b, hx, hy, l, back) {
  const kx = hx + l[0];
  const ky = hy + l[1];
  const fx = kx + l[2];
  const fy = ky + l[3];
  const col = back ? P.pantsShade : P.pants;
  b.line2(hx, hy, kx, ky, col);
  b.line2(kx, ky, fx, fy, col);
  b.blit(SHOE, fx - 1, fy + 2, back ? { map: BACK_MAP } : undefined);
}

function drawHead(b, sk, hx, hy, face) {
  const hat = HATS[sk.hat] || null;
  if (hat && hat.back) b.blit(hat.back, hx + hat.dx, hy + hat.dy);
  if (hat && hat.replacesHead) {
    b.blit(hat.over, hx + hat.dx, hy + hat.dy);
  } else {
    b.blit(HEAD, hx, hy);
    const hair = HAIR[sk.hair];
    if (hair && hat?.hidesHair !== 'all') {
      const t = hair.t;
      const cut = hat && hat.hidesHair === 'top' ? 4 - hair.dy : -99;
      for (let ty = 0; ty < t.h; ty++) {
        if (ty < cut) continue;
        for (let tx = 0; tx < t.w; tx++) {
          const v = t.d[ty * t.w + tx];
          if (v) b.set(hx + tx, hy + hair.dy + ty, v);
        }
      }
    }
    b.blit(FACES[face] || FACES.normal, hx, hy);
    if (hat && hat.over) b.blit(hat.over, hx + hat.dx, hy + hat.dy);
  }
  for (const id of sk.acc || []) {
    const a = ACCESSORIES[id];
    if (a && a.at === 'head') b.blit(a.t, hx + a.dx, hy + a.dy);
  }
}

/** Compõe um quadro (32×32) da skin `sk` na pose `p`. */
export function composeFrame(sk, p) {
  const b = new PixelBuffer(CELL, CELL);
  const bob = p.bob || 0;
  const crouch = p.torso === 'crouch';
  const torsoT = crouch ? TORSO.crouch : TORSO.up;
  const ty = (crouch ? 19 : 18) + bob;
  const sY = 19 + bob + (crouch ? 1 : 0);
  const hipY = 25 + bob;
  const hx = 10 + p.head[0];
  const hy = 7 + bob + p.head[1] + (crouch ? 1 : 0);
  const acc = sk.acc || [];

  // atrás de tudo: acessórios das costas
  for (const id of acc) {
    const a = ACCESSORIES[id];
    if (!a) continue;
    if (a.at === 'torso') b.blit(a.t, 12 + a.dx, ty + a.dy);
    if (a.at === 'hip') b.blit(a.t, 13 + a.dx, hipY + a.dy);
  }
  drawArm(b, 12, sY, p.ba, true);
  drawLeg(b, 13, hipY, p.bl, true);
  drawLeg(b, 16, hipY, p.fl, false);
  b.blit(torsoT, 12, ty);
  if (sk.print && PRINTS[sk.print]) b.blit(PRINTS[sk.print], 12, ty);
  for (const id of acc) {
    const a = ACCESSORIES[id];
    if (a && a.at === 'neck') b.blit(a.t, 12 + a.dx, ty + a.dy);
  }
  // cabeça com contorno próprio (separa o queixo do corpo)
  const head = new PixelBuffer(CELL, CELL);
  drawHead(head, sk, hx, hy, p.face);
  overlayPart(b, head);
  // braço da frente com contorno próprio
  const arm = new PixelBuffer(CELL, CELL);
  drawArm(arm, 18, sY, p.fa, false);
  overlayPart(b, arm);

  let out = b;
  if (p.rot) {
    out = b.rot90(p.rot);
    // apoia no chão (linha 30) e centraliza em x = 16
    const bb = out.bbox();
    if (bb) {
      const shifted = new PixelBuffer(CELL, CELL);
      const dx = Math.round(16 - (bb.x0 + bb.x1 + 1) / 2);
      const dy = 30 - bb.y1;
      for (let y = bb.y0; y <= bb.y1; y++)
        for (let x = bb.x0; x <= bb.x1; x++) {
          const v = out.get(x, y);
          if (v) shifted.set(x + dx, y + dy, v);
        }
      out = shifted;
    }
  }
  out.outline(P.outline);
  return out;
}

/** Monta o atlas indexado (ATLAS_COLS × linhas de 32×32) de uma skin. */
export function buildAtlasBuffer(sk) {
  const rows = Math.ceil(FRAMES.length / ATLAS_COLS);
  const atlas = new PixelBuffer(ATLAS_COLS * CELL, rows * CELL);
  FRAMES.forEach(([, p], i) => {
    const f = composeFrame(sk, p);
    const ox = (i % ATLAS_COLS) * CELL;
    const oy = Math.floor(i / ATLAS_COLS) * CELL;
    for (let y = 0; y < CELL; y++)
      for (let x = 0; x < CELL; x++) {
        const v = f.d[y * CELL + x];
        if (v) atlas.d[(oy + y) * atlas.w + ox + x] = v;
      }
  });
  return atlas;
}

export function skinById(idx) {
  return SKINS[idx] || SKINS[0];
}
