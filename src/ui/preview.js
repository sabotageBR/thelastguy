// Miniaturas (skins, cabeças) e prévias de mundo reaproveitando os painters do jogo.
import { getAtlas } from '../gfx/sprites/atlas.js';
import { FRAME, ATLAS_COLS, CELL } from '../gfx/sprites/poses.js';
import { THEMES } from '../gfx/themes/index.js';
import { paintSky } from '../gfx/parallax.js';
import { Painter, paintSolid } from '../gfx/tiles.js';

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Quadro inteiro (32×32) de uma skin. */
export function skinThumb(skin, frame = FRAME.idle0, flip = false) {
  const c = canvas(CELL, CELL);
  drawFrame(c.getContext('2d'), skin, frame, 0, 0, flip);
  return c;
}

export function drawFrame(ctx, skin, frame, x, y, flip = false) {
  const a = getAtlas(skin);
  const sx = (frame % ATLAS_COLS) * CELL;
  const sy = Math.floor(frame / ATLAS_COLS) * CELL;
  ctx.imageSmoothingEnabled = false;
  if (flip) {
    ctx.save();
    ctx.translate(x + CELL, y);
    ctx.scale(-1, 1);
    ctx.drawImage(a, sx, sy, CELL, CELL, 0, 0, CELL, CELL);
    ctx.restore();
  } else ctx.drawImage(a, sx, sy, CELL, CELL, x, y, CELL, CELL);
}

/** Recorte da cabeça (para grades de resultado e lobby). */
export function headThumb(skin) {
  const c = canvas(22, 22);
  const a = getAtlas(skin);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(a, 5, 0, 22, 22, 0, 0, 22, 22);
  return c;
}

// Paletas de reserva (se um tema faltar).
const FALLBACK = {
  gelo: { sky: [[0, '#3b5fb0'], [1, '#cfefff']], top: '#f4fbff', top2: '#d2eaf8', front: '#6cc4ee', front2: '#3a8cc8', edge: '#173c66', acc: '#ff5e7e' },
  vulcao: { sky: [[0, '#2a0e22'], [1, '#c4462c']], top: '#54465e', top2: '#463a50', front: '#2b2233', front2: '#1d1624', edge: '#0f0a14', acc: '#ff7a1a' },
  selva: { sky: [[0, '#3cb6e0'], [1, '#d6f5d2']], top: '#7dc243', top2: '#6aae36', front: '#a88e6a', front2: '#7f6a4e', edge: '#33261a', acc: '#ffc83d' },
  espaco: { sky: [[0, '#080826'], [1, '#2b1a5e']], top: '#cbd5e3', top2: '#aeb9cb', front: '#566279', front2: '#3b4459', edge: '#161b2e', acc: '#3df5ff' },
};

const cache = new Map();

/** Prévia 160×100 de um mundo (céu, plataforma, obstáculo e 3 personagens). */
export function worldPreview(worldId, skins = [0, 3, 6]) {
  const key = worldId + skins.join();
  if (cache.has(key)) return cache.get(key);
  const W = 160;
  const H = 100;
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  const theme = THEMES[worldId];
  const fb = FALLBACK[worldId];
  paintSky(ctx, W, H, theme ? theme.sky : fb.sky);
  // fundo de cada mundo: estrelas e planeta / aurora / nuvens (cinzas no vulcão)
  if (worldId === 'espaco') {
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 40; i++) ctx.fillRect((i * 37) % W, (i * 53) % 60, 1, 1);
    ctx.fillStyle = '#7b3cff';
    ctx.beginPath();
    ctx.arc(130, 22, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3df5ff';
    ctx.fillRect(112, 23, 36, 1);
  } else {
    if (worldId === 'gelo') {
      for (let x = 0; x < W; x++) {
        const y = 14 + Math.round(Math.sin(x * 0.07) * 5);
        ctx.fillStyle = x % 5 < 2 ? 'rgba(125,245,201,0.5)' : 'rgba(182,156,255,0.45)';
        ctx.fillRect(x, y, 1, 8);
      }
    }
    ctx.fillStyle = theme && theme.cloud ? theme.cloud[0] : 'rgba(255,255,255,0.9)';
    for (const [x, y, r] of [[20, 20, 8], [30, 18, 10], [42, 22, 7], [110, 30, 9], [122, 27, 11], [134, 31, 7]]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (worldId === 'vulcao') {
    ctx.fillStyle = '#ff5a1f';
    ctx.fillRect(0, 88, W, 12);
    ctx.fillStyle = '#ffd23d';
    for (let x = 0; x < W; x += 8) ctx.fillRect(x, 88, 4, 1);
  }
  const p = new Painter(ctx, 0, 0);
  const th = theme || {
    blocks: { path: { top: fb.top, top2: fb.top2, topLight: fb.top, lip: null, front: fb.front, front2: fb.front2, seam: fb.front2, edge: fb.edge } },
  };
  paintSolid(p, th, { x: 8, y: 70, w: 144, h: 26, kind: 'path' }, {});
  // obstáculo símbolo do mundo
  const rect = (x, y, w, h, col) => {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, w, h);
  };
  if (worldId === 'gelo') {
    // pingentes pendurados numa saliência
    rect(84, 0, 44, 8, '#6cc4ee');
    rect(84, 6, 44, 2, '#3a8cc8');
    for (const x of [90, 104, 118]) for (let k = 0; k < 16; k++) rect(x - Math.round(4 * (1 - k / 16)), 8 + k, Math.max(1, Math.round(8 * (1 - k / 16))), 1, k < 5 ? '#ffffff' : '#bfeaff');
  } else if (worldId === 'vulcao') {
    // jato de fogo
    rect(94, 56, 16, 2, '#3a2a34');
    for (let k = 0; k < 30; k++) rect(97 + Math.round(Math.sin(k * 0.9) * 2), 56 - k, 10 - Math.round(k / 6), 1, k < 8 ? '#fff0a0' : k < 18 ? '#ffd23d' : '#ff7a1a');
  } else if (worldId === 'selva') {
    // cabeça de ídolo com olhos acesos
    rect(89, 30, 24, 28, '#33261a');
    rect(90, 31, 22, 27, '#b8b08a');
    rect(104, 31, 8, 27, '#8a7a5a');
    rect(87, 26, 28, 6, '#33261a');
    rect(88, 27, 26, 4, '#ffc83d');
    rect(93, 38, 5, 3, '#ff3b3b');
    rect(104, 38, 5, 3, '#ff3b3b');
    rect(95, 50, 12, 4, '#1d1d24');
  } else if (worldId === 'espaco') {
    // portão de laser
    rect(96, 16, 10, 6, '#566279');
    rect(96, 60, 10, 6, '#566279');
    rect(99, 22, 4, 38, 'rgba(255,46,77,0.45)');
    rect(100, 22, 2, 38, '#ff2e4d');
  } else if (theme && theme.pink) {
    ctx.fillStyle = theme.pink[4];
    ctx.fillRect(99, 18, 4, 40);
    ctx.fillStyle = theme.purple[3];
    ctx.fillRect(100, 18, 2, 30);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i & 1 ? theme.pink[0] : theme.pink[2];
      ctx.fillRect(88 + i * 5, 46, 5, 14);
    }
  }
  skins.forEach((s, i) => drawFrame(ctx, s, i === 1 ? FRAME.run2 : FRAME.run0, 20 + i * 24, 38 + (i % 2) * 2));
  cache.set(key, c);
  return c;
}
