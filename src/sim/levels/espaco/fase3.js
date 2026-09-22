// esp-3 "Varredura Laser" — Sobrevivência estilo Laser Tracer em gravidade baixa (8→4, até 90 s).
// Aqui o laser desintegra: colunas com aviso pontilhado (desvie para o lado), linhas de parede a
// parede BAIXA (pule) ou ALTA (fique no chão), a onda "scanner" com um vão e cercas que fecham.
import { LevelBuilder } from '../builder.js';
import * as S from '../segments.js';

export const meta = {
  id: 'esp-3',
  world: 'espaco',
  slot: 3,
  type: 'survival',
  name: 'Varredura Laser',
  objective: 'SOBREVIVA!',
  evokes: 'Laser Tracer',
  timeLimit: 90,
  camera: 'arena',
  cameraBounds: { x0: -80, x1: 528, y0: -240, y1: 70 },
  physics: 'lowg',
};

const W = 448;
const CEIL = 144;

export default function build() {
  const b = new LevelBuilder(meta);
  S.flat(b, 0, W, 0, { depth: 40, kind: 'path' });
  b.block(0, CEIL + 24, W, { depth: 24, kind: 'block' });
  // paredes laterais (a arena é fechada)
  b.wall(-16, -40, 16, CEIL + 24, { kind: 'wall', extra: 0 });
  b.wall(W, -40, 16, CEIL + 24, { kind: 'wall', extra: 0 });
  b.obstacle('laser', {
    kind: 'arena',
    x0: 0,
    x1: W,
    ground: 0,
    ceil: -CEIL,
    tier: 'kill',
    start: 2,
    columns: [
      [0, { every: 1.6, warn: 1.4, n: 1 }],
      [35, { every: 1.4, warn: 1.2, n: 2 }],
      [50, { every: 2.0, warn: 1.2, n: 2 }],
      [65, { every: 1.4, warn: 1.0, n: 2 }],
      [80, { every: 1.1, warn: 0.9, n: 3 }],
    ],
    lines: [
      [0, { every: 6, warn: 1.1, high: false }],
      [40, { every: 4, warn: 1.0, mix: true }],
      [65, { every: 3, warn: 0.9, mix: true, double: 0.4 }],
      [80, { every: 2.2, warn: 0.8, mix: true, double: 0.5 }],
    ],
    fences: [
      [0, W],
      [50, 352],
      [78, 256],
    ],
    scanner: [
      [0, null],
      [50, { every: 4.5, speed: 190, gap: 48, warn: 0.9 }],
      [65, null],
    ],
  });
  b.arenaSpawns(40, W - 40, 0);
  b.bound(-120, -300, W + 240, 400);
  return b.build();
}
