// Portal FINISH (arco de fundo, como na faixa "Exemplo no jogo"), largada e checkpoints.
import { Painter } from '../tiles.js';
import { textPixels, textWidth } from '../pixel/font5x7.js';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Bandeira azul com coroa dourada (w×h), ondulada pela fase `wave` (0..3). */
function crownFlag(p, x, y, fin, wave = 0) {
  // mastro
  p.rect(x, y, 2, 30, '#8a5a0f');
  p.rect(x, y, 1, 30, fin.gold);
  p.rect(x - 1, y - 3, 4, 3, fin.gold);
  // pano (ondulação por coluna)
  for (let i = 0; i < 14; i++) {
    const dy = Math.round(Math.sin((i + wave * 2) * 0.6) * 1);
    p.rect(x + 2 + i, y + 1 + dy, 1, 10, i < 1 ? fin.flagDark : fin.flag);
    p.px(x + 2 + i, y + 11 + dy, fin.flagDark);
  }
  // coroa 7×4
  const cx = x + 5;
  const cy = y + 4;
  p.rect(cx, cy + 1, 7, 3, fin.gold);
  p.px(cx, cy, fin.gold);
  p.px(cx + 3, cy, fin.gold);
  p.px(cx + 6, cy, fin.gold);
  p.px(cx + 3, cy + 2, '#e6313a');
}

/** Pinta o portal FINISH num canvas; âncora (ax, ay) = ponto do chão na linha de chegada. */
export function paintFinishGate(theme, wave = 0) {
  const fin = theme.finish;
  const W = 124;
  const H = 96;
  const c = makeCanvas(W, H);
  const p = new Painter(c.getContext('2d'), 0, 0);
  const ground = H - 2;
  const left = 10;
  const right = W - 16;
  // postes listrados (amarelo/azul)
  for (const px of [left, right]) {
    p.rect(px - 1, 22, 8, ground - 22, '#06408f');
    for (let y = 23; y < ground; y++) {
      const band = Math.floor((y - 23) / 6) & 1;
      p.rect(px, y, 6, 1, band ? fin.postBlue : fin.post);
    }
    p.rect(px, 23, 1, ground - 23, 'rgba(255,255,255,0.35)');
  }
  // faixa superior: pontas quadriculadas + placa vermelha
  const by = 20;
  const bh = 20;
  p.rect(left - 2, by - 1, right - left + 12, bh + 2, '#1d1d24');
  for (let y = 0; y < bh; y += 4) {
    for (let x = 0; x < right - left + 8; x += 4) {
      p.rect(left + x, by + y, 4, 4, ((x + y) / 4) & 1 ? '#1d1d24' : fin.white);
    }
  }
  const text = 'FINISH';
  const tw = textWidth(text);
  const plateW = tw + 12;
  const plateX = Math.round((left + right + 6) / 2 - plateW / 2);
  p.rect(plateX - 1, by - 3, plateW + 2, bh + 6, '#6a1018');
  p.rect(plateX, by - 2, plateW, bh + 4, fin.plate);
  p.rect(plateX, by + bh, plateW, 2, fin.plateDark);
  p.rect(plateX, by - 2, plateW, 1, '#ff6b72');
  textPixels(text, plateX + 6, by + 3, (x, y) => {
    p.px(x, y + 1, fin.plateDark);
    p.px(x, y, fin.white);
  });
  // bandeiras de coroa sobre os postes
  crownFlag(p, left + 2, 0, fin, wave);
  crownFlag(p, right + 2, 0, fin, wave + 1);
  return { canvas: c, ax: Math.round((left + right + 6) / 2), ay: ground };
}

/** Bandeira de checkpoint (mastro + bandeirinha); `on` = já alcançado. */
export function drawCheckpoint(ctx, x, y, on, t) {
  ctx.fillStyle = '#06408f';
  ctx.fillRect(x - 1, y - 30, 3, 30);
  ctx.fillStyle = '#e8eef5';
  ctx.fillRect(x, y - 30, 1, 30);
  const col = on ? '#38b54a' : '#9aa5b8';
  const dark = on ? '#1f7a2e' : '#6a7588';
  for (let i = 0; i < 10; i++) {
    const dy = Math.round(Math.sin(t * 6 + i * 0.7) * (on ? 1 : 0.5));
    ctx.fillStyle = i === 0 ? dark : col;
    ctx.fillRect(x + 2 + i, y - 30 + dy, 1, 7);
    ctx.fillStyle = dark;
    ctx.fillRect(x + 2 + i, y - 23 + dy, 1, 1);
  }
  if (on) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 5, y - 26, 1, 1);
    ctx.fillRect(x + 6, y - 25, 1, 1);
    ctx.fillRect(x + 7, y - 26, 1, 1);
    ctx.fillRect(x + 8, y - 27, 1, 1);
  }
}

/** Barreira da largada: sobe (some) depois do VAI!. */
export function drawStartGate(ctx, x, y, open, theme) {
  const h = 34;
  const lift = Math.round(open * 40);
  ctx.fillStyle = '#06408f';
  ctx.fillRect(x - 2, y - h - 10, 6, h + 10);
  ctx.fillStyle = theme.finish.post;
  ctx.fillRect(x - 1, y - h - 9, 4, h + 8);
  if (open >= 1) return;
  // barra listrada
  const by = y - 16 - lift;
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i & 1 ? theme.hazard[1] : theme.hazard[0];
    ctx.fillRect(x - 1, by + i * 3, 4, 3);
  }
}
