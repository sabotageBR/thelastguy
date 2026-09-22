// selva-4 "Pilares do Rio" — Final: 6 pilares de pedra sobre o rio (encostar na água = eliminado).
// Pilar ocupado afunda (mais rápido com mais gente) e sobe devagar vazio; pilares desabam por
// agenda; dardos dos dois lados; jangadas de tronco nas margens afundam; a água sobe no fim.
import { LevelBuilder } from '../builder.js';

export const meta = {
  id: 'selva-4',
  world: 'selva',
  slot: 4,
  type: 'final',
  name: 'Pilares do Rio',
  objective: 'SEJA O ÚLTIMO DE PÉ!',
  evokes: 'pula-pula de pilares',
  camera: 'arena',
  cameraBounds: { x0: -150, x1: 598, y0: -260, y1: 90 },
};

const W = 448;
const WATER = 56; // y da superfície (h −56)

export default function build() {
  const b = new LevelBuilder(meta);
  // jangadas de tronco nas margens (desenhadas antes: ficam atrás)
  for (const [cx, ph] of [
    [-64, 0],
    [W + 64, 0.5],
  ]) {
    b.obstacle('sinking', {
      x: cx - 24,
      y: WATER - 8,
      w: 48,
      h: 8,
      amp: 32,
      period: 6,
      phase: ph,
      sink: 12,
      rise: 0,
      maxSink: 12,
      delay: 3,
      delaySchedule: [
        [0, 3],
        [40, 2],
      ],
      gone: true,
      respawn: 6,
      oneWay: true,
      kind: 'plank',
    });
  }
  const tops = [0, 16, 0, 24, 0, 16];
  b.obstacle('pillars', {
    pillars: tops.map((h, i) => ({ x: i * 80, h, w: 48 })),
    water: WATER,
    sink: [
      [0, 6],
      [20, 8],
      [40, 10],
    ],
    drain: [
      [0, 0],
      [100, 12],
    ],
    rise: 4,
    crowd: 0.5,
    collapse: [
      [0, 0],
      [20, 12],
      [70, 8],
    ],
    warn: 2,
    kind: 'block',
  });
  // dardos: de um lado a cada 3 s; a partir de 40 s dos dois lados, em 2 alturas, a cada 2 s
  const dart = { y: 0, speed: 200, range: W + 300, warn: 0.6, gameClock: true, w: 12, h: 4 };
  b.obstacle('darts', { ...dart, x: -140, dir: 1, interval: 3, heights: [14], start: 3, end: 40 });
  b.obstacle('darts', { ...dart, x: -140, dir: 1, interval: 2, heights: [14, 40], start: 40 });
  b.obstacle('darts', { ...dart, x: W + 140, dir: -1, interval: 2, heights: [40, 14], start: 41 });
  // o rio (sobe 2 px/s entre 70 e 100 s)
  b.obstacle('liquid', {
    x: -260,
    w: W + 520,
    y: WATER,
    look: 'water',
    rise: [
      [0, 0],
      [70, 2],
      [100, 0],
    ],
  });
  // largada espalhada pelos pilares
  const spawn = [];
  for (let i = 0; i < 32; i++) {
    const p = i % 6;
    spawn.push({ x: p * 80 + 10 + ((i / 6) | 0) * 5, y: -tops[p], facing: p < 3 ? 1 : -1 });
  }
  b.spawns = spawn;
  b.start = { x: 0, y: 0, spawn };
  b.bound(-160, -320, W + 320, 440);
  b.killY = 90;
  return b.build();
}
