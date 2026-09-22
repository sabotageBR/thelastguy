// ceu-3 "Paredão de Jujuba" — Sobrevivência estilo Block Dash (8→4, até 90 s).
import { LevelBuilder } from '../builder.js';
import * as S from '../segments.js';

export const meta = {
  id: 'ceu-3',
  world: 'ceu',
  slot: 3,
  type: 'survival',
  name: 'Paredão de Jujuba',
  objective: 'SOBREVIVA!',
  evokes: 'Block Dash',
  timeLimit: 90,
  camera: 'arena',
  cameraBounds: { x0: -56, x1: 504, y0: -250, y1: 70 },
};

export default function build() {
  const b = new LevelBuilder(meta);
  // chão de 28 ladrilhos (não caem com o peso; as bordas caem com o tempo)
  S.crumble(b, 0, 0, 448, {
    tileW: 16,
    depth: 28,
    respawn: 0,
    kind: 'path',
    standTrigger: false,
    shrinkSchedule: [
      [0, 448],
      [30, 416],
      [45, 384],
      [60, 320],
      [75, 256],
    ],
  });
  b.obstacle('walls', {
    x0: 0,
    x1: 448,
    y: 0,
    schedule: [
      { t: 0, interval: 3.0, speed: 90, types: { low: 1, high: 1 } },
      { t: 15, interval: 2.6, speed: 110, alternate: true, types: { low: 1, high: 1 } },
      { t: 30, interval: 2.3, speed: 130, types: { low: 1, high: 1, pair: 0.6 } },
      { t: 45, interval: 2.0, speed: 150, double: 0.2, types: { low: 1, high: 1, pair: 0.6 } },
      { t: 60, interval: 1.7, speed: 170, double: 0.4, types: { low: 1, high: 1, pair: 0.6, crossed: 0.5 } },
      { t: 75, interval: 1.4, speed: 190, double: 0.4, types: { low: 1, high: 1, pair: 0.6, crossed: 0.7 } },
    ],
  });
  b.arenaSpawns(40, 408, 0);
  b.deco('arenaBase', { x: 224, y: 0, w: 448 });
  b.bound(-120, -320, 688, 440);
  b.killY = 110;
  return b.build();
}
