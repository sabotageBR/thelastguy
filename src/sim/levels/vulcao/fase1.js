// vulc-1 "Trilha da Brasa" — Corrida 32→16 (alvo 75 s): vãos sobre a lava, jatos de fogo,
// barras de fogo, jangadas que afundam, esmagadores de basalto e gêiseres.
import { LevelBuilder } from '../builder.js';
import * as S from '../segments.js';

export const meta = {
  id: 'vulc-1',
  world: 'vulcao',
  slot: 1,
  type: 'race',
  name: 'Trilha da Brasa',
  objective: 'CORRA ATÉ A CHEGADA!',
  evokes: 'corrida sobre a lava',
  target: 75,
};

const LAVA = 40; // superfície da lava (y): encostar = volta ao checkpoint
const BASE = 96; // os pilares de basalto afundam na lava até y = +96

export default function build() {
  const b = new LevelBuilder(meta);
  const rock = (x0, x1, h, o = {}) => S.flat(b, x0, x1, h, { depth: h + BASE, ...o });
  const gap = (x0, h0, x1, h1, assist) => b.noteGap(x0, h0, x1, h1, assist ? { assist } : {});
  const jet = (x, h, phase = 0) => b.obstacle('jets', { xs: [x], y: -h, w: 16, height: 64, on: 1.2, off: 1.2, warn: 0.5, kind: 'fire', phase });
  const firebar = (x, h, dir, phase) => S.rotor(b, x, h, { kind: 'firebar', pivot: 56, length: 52, arms: 1, period: 3.2, dir, phase, headR: 5 });
  /** Respiradouro com gêiser (64 px) sobre um pilar; o jato mira o centro do próximo apoio. */
  const geyser = (x, phase, aimX) => {
    rock(x, x + 64, -12, { depth: BASE - 12 });
    b.obstacle('pad', { x, y: 0, w: 64, h: 12, apex: 120, aimX, kind: 'geyser', pulse: { on: 1.5, off: 1.5 }, phase });
  };

  b.obstacle('liquid', { x: -320, w: 5960, y: LAVA, look: 'lava' });
  // 1. largada
  b.startArea(0, 320, 0, { depth: BASE });
  // 2. vãos sobre a lava: 48 / 56 / 64
  gap(320, 0, 368, 0);
  rock(368, 448, 0);
  gap(448, 0, 504, 0);
  rock(504, 584, 0);
  gap(584, 0, 648, 0);
  // 3. cinco jatos de fogo em onda (1,1 s ligado / 1,3 s desligado, brilho de aviso)
  rock(648, 1248, 0, { deco: 'rails' });
  b.obstacle('jets', { xs: [752, 848, 944, 1040, 1136], y: 0, w: 16, height: 64, on: 1.1, off: 1.3, warn: 0.5, step: 0.3, kind: 'fire' });
  b.checkpoint(1176, 0);
  // 4. três barras de fogo em sentidos alternados
  rock(1248, 1824, 0);
  firebar(1360, 0, 1, 0);
  firebar(1536, 0, -1, 0.33);
  firebar(1712, 0, 1, 0.66);
  // 5. cinco jangadas de basalto que afundam (mais rápido com 3+ pessoas) e sobem vazias
  let x = 1824;
  for (let i = 0; i < 5; i++) {
    gap(x, i ? -24 : 0, x + 48, -24);
    b.obstacle('sinking', { x: x + 48, y: LAVA - 16, w: 64, h: 12, sink: 26, rise: 16, crowd: 0.25, maxSink: 24, delay: 0.2, kind: 'raft' });
    x += 112;
  }
  gap(x, -24, x + 48, 0);
  rock(2432, 2912, 0);
  b.checkpoint(2440, 0);
  // 6. quatro esmagadores de basalto (defasados 0,75 s)
  S.crushers(b, [2560, 2672, 2784, 2864], 0, { w: 48, h: 32, lift: 112, phaseStep: 0.25, times: { shake: 0.4, drop: 0.12, hold: 0.5, rise: 0.9, wait: 0.7 } });
  // 7. gêiseres: poças de 128 px que só se atravessam com o jato (1,5 s ativo / 1,5 s dormente)
  geyser(2912, 0, 3136);
  gap(2976, 0, 3104, 0, 'geyser');
  geyser(3104, 0.33, 3328);
  gap(3168, 0, 3296, 0, 'geyser');
  geyser(3296, 0.66, 3528);
  gap(3360, 0, 3488, 0, 'geyser');
  rock(3488, 3808, 0);
  b.checkpoint(3496, 0);
  // 8. jatos e barras de fogo alternados, subindo três degraus de +16
  jet(3616, 0, 0);
  firebar(3720, 0, -1, 0.5);
  rock(3808, 4064, 16);
  jet(3888, 16, 0.3);
  firebar(3984, 16, 1, 0);
  rock(4064, 4288, 32);
  jet(4160, 32, 0.6);
  rock(4288, 4512, 48);
  jet(4392, 48, 0.2);
  // 9. vãos sobre obsidiana 56(+16) / 64 / 64(−16) / 72(+16)
  gap(4512, 48, 4568, 64);
  rock(4568, 4648, 64, { kind: 'obsidian' });
  gap(4648, 64, 4712, 64);
  rock(4712, 4792, 64, { kind: 'obsidian' });
  gap(4792, 64, 4856, 48);
  rock(4856, 4936, 48, { kind: 'obsidian' });
  gap(4936, 48, 5008, 64);
  // 10. chegada (arco de obsidiana)
  rock(5008, 5344, 64, { deco: 'rails' });
  S.finish(b, 5104, 64);
  return b.build();
}
