// selva-2 "Ladeira das Toras" — Corrida 16→8 (alvo 85 s): subida com toras e pedras rolando,
// vitórias-régias que afundam, gangorras sobre o rio, troncos balançando e ídolos, a roda d'água
// sobre a cachoeira e a Perseguição da Pedra num túnel em descida.
import { LevelBuilder } from '../builder.js';
import * as S from '../segments.js';

export const meta = {
  id: 'selva-2',
  world: 'selva',
  slot: 2,
  type: 'race',
  name: 'Ladeira das Toras',
  objective: 'CORRA ATÉ A CHEGADA!',
  evokes: 'Jungle Roll',
  target: 85,
};

const FLOOR = 64;

export default function build() {
  const b = new LevelBuilder(meta);
  const path = (x0, x1, h, o = {}) => S.flat(b, x0, x1, h, { depth: Math.max(40, h + FLOOR), ...o });
  const gap = (x0, h0, x1, h1) => b.noteGap(x0, h0, x1, h1);
  const lily = (x, h, o = {}) => b.obstacle('sinking', { x, y: -h, w: 48, h: 8, sink: o.sink ?? 20, rise: 10, delay: o.delay ?? 0.4, maxSink: 16, kind: 'lily' });
  const idol = (x, h, o = {}) =>
    b.obstacle('darts', { x, y: -h, dir: -1, interval: 1.6, speed: 200, heights: [8, 36], range: 200, warn: 0.5, gameClock: true, start: 1, ...o });

  // 1. largada
  b.startArea(0, 256, 0, { depth: FLOOR });
  // 2. subida de 128 com toras (ø24, 1,6 s) e pedras (ø32, a cada 3) a 140 px/s; dois patamares
  gap(256, 0, 296, 0); // o fosso engole o que desce
  b.ramp(296, 0, 520, 48, { depth: FLOOR });
  path(520, 584, 48);
  b.ramp(584, 48, 808, 96, { depth: FLOOR });
  path(808, 872, 96);
  b.ramp(872, 96, 1032, 128, { depth: FLOOR });
  path(1032, 1168, 128);
  b.block(1072, 200, 96, { depth: 16, kind: 'block' });
  S.roller(b, 1152, 200, { dir: -1, speed: 140, r: 12, interval: 1.6, t0: 1, giantEvery: 3, giantR: 16, giantTier: 'heavy', giantLook: 'rock', look: 'log', tier: 'light', maxLife: 10 });
  b.checkpoint(1088, 128);
  // 3. oito vitórias-régias (48 px, vãos 40–56): afundam 20 px/s depois de 0,4 s
  b.obstacle('liquid', { x: 1168, w: 1440, y: -96, look: 'water' });
  let x = 1168;
  const gaps1 = [40, 48, 56, 40, 48, 56, 40, 48];
  for (let i = 0; i < gaps1.length; i++) {
    gap(x, i ? 104 : 128, x + gaps1[i], 104);
    x += gaps1[i];
    lily(x, 104);
    x += 48;
  }
  // 4. três gangorras (144 px, ±20°) sobre o rio
  gap(x, 104, x + 40, 128);
  x += 40;
  for (let i = 0; i < 3; i++) {
    S.seesaw(b, x + 72, 128, 144, 20);
    x += 144;
    gap(x, 128, x + 40, 128);
    x += 40;
  }
  path(x, x + 640, 128);
  b.checkpoint(x + 16, 128);
  // 5. dois troncos balançando e dois ídolos
  S.pendulums(b, [x + 176, x + 336], 128, { kind: 'log', pivot: 120, length: 96, amp: 55, period: 2.8, headW: 48, headH: 20, phases: [0, 0.5] });
  idol(x + 496, 128, { phase: 0 });
  idol(x + 608, 128, { phase: 0.5 });
  x += 640;
  // 6. roda d'água (4 pás de 48, raio 80, 7 s, horária: sobe pelo lado da chegada da gente)
  //    sobre a cachoeira; as pás passam a 8 px das margens na altura do caminho
  const wx = x + 112;
  b.obstacle('liquid', { x: x - 16, w: 256, y: 0, look: 'water' });
  b.obstacle('ferris', { x: wx, y: -128, cars: 4, radius: 80, period: 7, dir: 1, w: 48, kind: 'plank' });
  b.lift(wx - 112, wx + 112, 128, 208, wx + 112);
  x = wx + 112;
  path(x, x + 160, 128);
  b.checkpoint(x + 16, 128);
  x += 160;
  // 7. Perseguição da Pedra: túnel descendo 192 (h 128 → −64). A pedra (ø64) sai quando alguém
  //    passa da entrada e depois a cada 6 s; 105 px/s no plano, até ~140 na descida; achata por 1,2 s
  const t0 = x;
  const seg = [
    // [comprimento, altura final, obstáculo]
    [96, 128, null],
    [224, 64, 'ramp'],
    [128, 64, 'log'],
    [48, 64, 'gap'],
    [128, 64, null],
    [224, 0, 'ramp'],
    [96, 0, 'log'],
    [48, 0, 'gap'],
    [96, 0, null],
    [224, -64, 'ramp'],
    [96, -64, 'log'],
  ];
  let h = 128;
  for (const [len, h1, kind] of seg) {
    if (kind === 'ramp') b.ramp(x, h, x + len, h1, { depth: Math.max(40, h1 + FLOOR) });
    else if (kind === 'gap') gap(x, h, x + len, h1);
    else path(x, x + len, h1);
    if (kind === 'log') S.hurdles(b, [x + len / 2], h1, 16, 16);
    // teto da caverna (96 px acima do ponto mais alto do trecho)
    if (kind !== 'gap') b.block(x, Math.max(h, h1) + 136, len, { depth: 40, kind: 'block' });
    x += len;
    h = h1;
  }
  S.roller(b, t0 + 24, 128, { dir: 1, speed: 105, r: 32, interval: 6, trigger: t0 + 48, look: 'rock', tier: 'squash', maxLife: 16 });
  // 8. rio com três vitórias-régias lentas e a chegada
  b.obstacle('liquid', { x: x - 16, w: 1200, y: 96, look: 'water' });
  for (const g of [48, 40, 48]) {
    gap(x, h, x + g, -88);
    x += g;
    lily(x, -88, { sink: 10, delay: 0.6 });
    x += 48;
    h = -88;
  }
  gap(x, -88, x + 40, -64);
  x += 40;
  path(x, x + 448, -64, { deco: 'rails' });
  S.finish(b, x + 256, -64);
  b.killY = 160;
  return b.build();
}
