// vulc-2 "Escalada da Cratera" — Corrida 16→8 (alvo 90 s): subida de h 0 até a borda (h 560)
// por degraus com fogo, esteira, chuva de meteoros, roda-gigante, plataformas verticais entre
// esmagadores, bifurcação e a cadeia de gêiseres até a borda da cratera.
import { LevelBuilder } from '../builder.js';
import * as S from '../segments.js';

export const meta = {
  id: 'vulc-2',
  world: 'vulcao',
  slot: 2,
  type: 'race',
  name: 'Escalada da Cratera',
  objective: 'CORRA ATÉ A CHEGADA!',
  evokes: 'subida vulcânica',
  target: 90,
};

const LAVA = 40;
const BASE = 96;

export default function build() {
  const b = new LevelBuilder(meta);
  // pilares que nascem da lava (perto do chão) e saliências de rocha (no alto)
  const rock = (x0, x1, h, o = {}) => S.flat(b, x0, x1, h, { depth: h < 200 ? h + BASE : 56, ...o });
  const gap = (x0, h0, x1, h1, assist) => b.noteGap(x0, h0, x1, h1, assist ? { assist } : {});
  const jets = (xs, h, phase = 0) => b.obstacle('jets', { xs, y: -h, w: 16, height: 64, on: 1.0, off: 1.4, warn: 0.5, step: 0.35, kind: 'fire', phase });
  const firebar = (x, h, dir, phase, pivot = 56) => S.rotor(b, x, h, { kind: 'firebar', pivot, length: 52, arms: 1, period: 3.4, dir, phase, headR: 5 });
  const meteors = (x0, x1, h, every, o = {}) =>
    b.obstacle('bombard', { x0, x1, ground: -h, top: -h - 260, schedule: [[0, every]], warn: [[0, o.warn ?? 1.0]], radius: o.r ?? 24, tier: 'light', look: 'meteor', start: 2 });
  /** Gêiser sobre um pilar, mirando o centro do próximo apoio (aimX, hAlvo). */
  const geyser = (x, h, phase, aimX, aimH) => {
    rock(x, x + 64, h - 12, { depth: 56 });
    b.obstacle('pad', { x, y: -h, w: 64, h: 12, apex: 120, aimX, aimY: -aimH, kind: 'geyser', pulse: { on: 1.2, off: 1.2 }, phase });
  };

  b.obstacle('liquid', { x: -320, w: 6600, y: LAVA, look: 'lava' });
  // 1. largada
  b.startArea(0, 256, 0, { depth: BASE });
  // 2. seis degraus de +40 (vãos de 32–40) até h 240, jatos no 3º e no 5º
  let x = 256;
  let h = 0;
  for (let i = 0; i < 6; i++) {
    const g = i === 0 ? 32 : 40;
    gap(x, h, x + g, h + 40);
    x += g;
    h += 40;
    rock(x, x + (i === 5 ? 64 : 64), h);
    if (i === 2 || i === 4) jets([x + 32], h, i * 0.2);
    x += 64;
  }
  // 3. esteira contra (−70) com 3 barreiras e 2 jatos
  const cv0 = x;
  rock(cv0, cv0 + 408, 216, { depth: BASE });
  S.conveyor(b, cv0, 240, 408, -70);
  S.hurdles(b, [cv0 + 88, cv0 + 208, cv0 + 328], 240, 12);
  jets([cv0 + 148, cv0 + 268], 240, 0.5);
  x = cv0 + 408;
  rock(x, x + 96, 240);
  b.checkpoint(x + 8, 240);
  x += 96;
  // 4. chuva de meteoros (marcador 1 s) sobre dois vãos de 64
  const m0 = x;
  rock(m0, m0 + 208, 240);
  gap(m0 + 208, 240, m0 + 272, 240);
  rock(m0 + 272, m0 + 480, 240);
  gap(m0 + 480, 240, m0 + 544, 240);
  rock(m0 + 544, m0 + 720, 240);
  meteors(m0 + 24, m0 + 700, 240, 1.2);
  x = m0 + 720;
  // 5. roda-gigante (4 cabines, raio 88, 8 s, anti-horária: sobe pelo lado da saída) até h 400;
  //    a cabine passa a 40 px da plataforma de embarque e a 34 px da de saída
  const fx = x + 64;
  b.obstacle('ferris', { x: fx, y: -320, cars: 4, radius: 88, period: 8, dir: -1, w: 48 });
  b.lift(fx - 64, fx + 112, 232, 400, fx + 120);
  rock(fx + 120, fx + 264, 400);
  b.checkpoint(fx + 136, 400);
  x = fx + 264;
  // 6. plataformas verticais (±48, 3 s) alternando com ilhas sob esmagadores
  for (let i = 0; i < 4; i++) {
    gap(x, 400, x + 32, 400);
    S.mover(b, x + 64, 400, { w: 64, amp: 48, period: 3, axis: 'y', phase: i * 0.25, oneWay: true, kind: 'raft' });
    x += 96;
    if (i < 3) {
      gap(x, 400, x + 64, 400);
      rock(x + 64, x + 128, 400);
      S.crushers(b, [x + 96], 400, { w: 48, h: 32, lift: 104, phases: [i * 0.3] });
      x += 128;
    }
  }
  gap(x, 400, x + 64, 400);
  x += 64;
  rock(x, x + 96, 400);
  x += 96;
  // 7. bifurcação — em cima (h 480): saliências de 48 com vãos de 56 e duas barras de fogo;
  //    embaixo (h 320): esteira contra (−60) sob meteoros; quem cai de cima vai para baixo
  const sp0 = x;
  rock(sp0, sp0 + 64, 320);
  S.conveyor(b, sp0 + 64, 320, 576, -60);
  rock(sp0 + 64, sp0 + 640, 296, { depth: 56 });
  meteors(sp0 + 80, sp0 + 620, 320, 1.4);
  rock(sp0 + 640, sp0 + 704, 360);
  rock(sp0 + 704, sp0 + 800, 400);
  let ux = sp0 - 8;
  let uh = 440;
  for (let i = 0; i < 6; i++) {
    b.oneway(ux, uh, 48, { kind: 'obsidian', depth: 12 });
    if (i === 1 || i === 4) firebar(ux + 76, uh, i === 1 ? 1 : -1, 0.3 * i, 48);
    ux += 104;
    uh = 480;
  }
  x = sp0 + 800;
  b.checkpoint(x - 88, 400);
  // 8. cadeia de 4 gêiseres (1,2 s / 1,2 s, defasados 0,6 s) até a borda da cratera
  rock(x, x + 64, 400);
  geyser(x + 64, 400, 0, x + 64 + 224, 440);
  geyser(x + 256, 440, 0.25, x + 256 + 224, 480);
  geyser(x + 448, 480, 0.5, x + 448 + 224, 520);
  geyser(x + 640, 520, 0.75, x + 640 + 240, 560);
  for (let i = 0; i < 4; i++) gap(x + 128 + i * 192, 400 + i * 40, x + 256 + i * 192, 440 + i * 40, 'geyser');
  x += 832;
  // 9. na borda: duas barras de fogo, três barreiras, meteoros leves e a chegada
  rock(x, x + 880, 560, { deco: 'rails' });
  firebar(x + 160, 560, 1, 0);
  firebar(x + 400, 560, -1, 0.5);
  S.hurdles(b, [x + 520, x + 600, x + 680], 560, 12);
  meteors(x + 40, x + 700, 560, 2.0, { r: 20 });
  S.finish(b, x + 760, 560);
  return b.build();
}
