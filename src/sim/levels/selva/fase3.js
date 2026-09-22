// selva-3 "Roda do Totem" — Sobrevivência (8→4, até 90 s) estilo Jump Club / Over & Under.
// Troncos giram em volta do totem e cruzam todas as faixas de uma vez: tronco BAIXO = pule,
// tronco ALTO = fique no chão. A rotação acelera e passa a inverter (os olhos piscam antes);
// pedras rolam dos lados e as bordas caem.
import { LevelBuilder } from '../builder.js';
import * as S from '../segments.js';

export const meta = {
  id: 'selva-3',
  world: 'selva',
  slot: 3,
  type: 'survival',
  name: 'Roda do Totem',
  objective: 'SOBREVIVA!',
  evokes: 'Jump Club + Over & Under',
  timeLimit: 90,
  camera: 'arena',
  cameraBounds: { x0: -96, x1: 544, y0: -260, y1: 80 },
};

const W = 448;

export default function build() {
  const b = new LevelBuilder(meta);
  // chão de pedra com musgo sobre a ravina; as bordas caem aos 45 s e aos 75 s
  S.crumble(b, 0, 0, W, {
    tileW: 16,
    depth: 28,
    respawn: 0,
    kind: 'path',
    standTrigger: false,
    shrinkSchedule: [
      [0, W],
      [45, W - 64],
      [75, W - 128],
    ],
  });
  b.obstacle('totem', {
    x: W / 2,
    ground: 0,
    reach: W / 2 + 8,
    speed: [
      [0, 45],
      [15, 60],
      [30, 72],
      [60, 90],
      [75, 110],
    ],
    reverse: [
      [0, 0],
      [45, 10],
    ],
    bars: [
      { type: 'low', offset: 0 },
      { type: 'high', offset: Math.PI / 2, from: 15 },
    ],
  });
  // pedras rolando dos dois lados (saem de saliências fora da arena)
  b.block(-88, 40, 64, { depth: 32, kind: 'block' });
  b.block(W + 24, 40, 64, { depth: 32, kind: 'block' });
  const rocks = (t0, until, r, interval, offset) => {
    const o = { speed: 120, r, interval, look: 'rock', tier: 'heavy', gameClock: true, maxLife: 7, until };
    S.roller(b, -40, 40, { ...o, dir: 1, t0 });
    S.roller(b, W + 40, 40, { ...o, dir: -1, t0: t0 + offset });
  };
  rocks(30, 45, 14, 10, 5);
  rocks(45, 60, 14, 8, 4);
  rocks(60, 75, 16, 6, 3);
  rocks(75, 999, 16, 3, 0);
  for (const o of b.obstacles) if (o.type === 'roller') o.grow = o.r;
  // rio lá embaixo (só cenário: cair na ravina já elimina)
  b.obstacle('liquid', { x: -240, w: W + 480, y: 96, look: 'water' });
  b.arenaSpawns(40, W - 40, 0);
  b.bound(-120, -320, W + 240, 440);
  b.killY = 90;
  return b.build();
}
