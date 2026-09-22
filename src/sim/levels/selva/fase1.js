// selva-1 "Corredor dos Ídolos" — Corrida 32→16 (alvo 75 s): troncos caídos, machados de pedra,
// ídolos que atiram dardos em 2 alturas (baixo = pule; alto = fique no chão), ponte de corda,
// subida com troncos rolando, espinhos em onda, totem giratório e bifurcação com túnel.
import { LevelBuilder } from '../builder.js';
import * as S from '../segments.js';

export const meta = {
  id: 'selva-1',
  world: 'selva',
  slot: 1,
  type: 'race',
  name: 'Corredor dos Ídolos',
  objective: 'CORRA ATÉ A CHEGADA!',
  evokes: 'templo de Indiana Jones',
  target: 75,
};

const FLOOR = 64;

export default function build() {
  const b = new LevelBuilder(meta);
  const path = (x0, x1, h, o = {}) => S.flat(b, x0, x1, h, { depth: h + FLOOR, ...o });
  const post = (x, h) => S.flat(b, x, x + 24, h, { depth: h + FLOOR, kind: 'block' });
  const gap = (x0, h0, x1, h1) => b.noteGap(x0, h0, x1, h1);
  const idol = (x, h, o = {}) =>
    b.obstacle('darts', { x, y: -h, dir: -1, interval: 1.3, speed: 210, heights: [8, 36], range: 240, warn: 0.5, gameClock: true, start: 1, ...o });
  const axes = (xs, h, o = {}) => S.pendulums(b, xs, h, { kind: 'axe', pivot: 128, length: 104, amp: 52, period: 2.4, headW: 36, headH: 22, ...o });

  // 1. largada
  b.startArea(0, 320, 0, { depth: FLOOR });
  // 2. dois troncos caídos e vãos de 48 / 56 / 64
  path(320, 576, 0);
  S.hurdles(b, [400, 488], 0, 16, 16);
  gap(576, 0, 624, 0);
  path(624, 704, 0);
  gap(704, 0, 760, 0);
  path(760, 840, 0);
  gap(840, 0, 904, 0);
  // 3. três machados de pedra (pivô a 128 px, 2,4 s, defasados)
  path(904, 1440, 0);
  axes([1024, 1184, 1344], 0, { phases: [0, 0.5, 0] });
  b.checkpoint(1408, 0);
  // 4. dois ídolos atirando dardos que alternam as alturas (os olhos/boca brilham antes)
  path(1440, 1936, 0);
  idol(1680, 0, { phase: 0 });
  idol(1872, 0, { phase: 0.5 });
  // 5. ponte de corda: tábuas que caem (0,6 s; voltam em 3 s) entre postes firmes, 2 vãos de 48
  const plank = { tileW: 16, delay: 0.6, respawn: 3, kind: 'plank', depth: 8, oneWay: true };
  let x = 1936;
  for (let i = 0; i < 3; i++) {
    post(x, 0);
    S.crumble(b, x + 24, 0, 64, plank);
    gap(x + 24, 0, x + 88, 0);
    post(x + 88, 0);
    x += 112;
    if (i < 2) {
      gap(x, 0, x + 48, 0);
      x += 48;
    }
  }
  path(x, x + 192, 0);
  b.checkpoint(x + 16, 0);
  x += 192;
  // 6. subida de 96 com troncos rolando (ø24, 1,8 s); o fosso no pé engole os troncos
  gap(x, 0, x + 40, 0);
  b.ramp(x + 40, 0, x + 616, 96, { depth: FLOOR });
  const top0 = x + 616;
  path(top0, top0 + 704, 96);
  b.block(top0 + 24, 168, 96, { depth: 16, kind: 'block' });
  S.roller(b, top0 + 104, 168, { dir: -1, speed: 120, r: 12, interval: 1.8, t0: 0.5, look: 'log', tier: 'light', maxLife: 9 });
  // 7. seis armadilhas de espinhos em onda (0,8 s em cima / 1,2 s embaixo, chacoalham 0,4 s antes)
  const sx = top0 + 184;
  b.obstacle('jets', { xs: [sx, sx + 80, sx + 160, sx + 240, sx + 320, sx + 400], y: -96, w: 32, height: 20, on: 0.8, off: 1.2, warn: 0.4, step: 0.33, kind: 'spikes' });
  b.checkpoint(top0 + 624, 96);
  x = top0 + 704;
  // 8. totem giratório: um tronco baixo gira em volta do totem e cruza todas as faixas — pule na hora
  path(x, x + 448, 96);
  b.obstacle('totem', { x: x + 224, ground: -96, reach: 96, speed: [[0, 84]], bars: [{ type: 'low', offset: 0 }] });
  x += 448;
  // 9. bifurcação — em cima (h 176): três vãos de 72 e um machado; embaixo, túnel com ídolo e espinhos
  const sp = x;
  path(sp, sp + 1056, 96);
  b.oneway(sp + 8, 136, 48, { kind: 'plank', depth: 8 });
  let ux = sp + 64;
  for (let i = 0; i < 4; i++) {
    b.block(ux, 176, i === 3 ? 72 : 128, { depth: 40, kind: 'path' });
    if (i < 3) gap(ux + 128, 176, ux + 200, 176);
    ux += 200;
  }
  axes([sp + 328], 176, { pivot: 120, length: 96, period: 2.4 });
  idol(sp + 448, 96, { heights: [8, 28], range: 200, phase: 0.25 });
  b.obstacle('jets', { xs: [sp + 528, sp + 608], y: -96, w: 32, height: 18, on: 0.8, off: 1.2, warn: 0.4, step: 0.5, kind: 'spikes' });
  // 10. chegada (portão do templo)
  S.finish(b, sp + 896, 96);
  return b.build();
}
