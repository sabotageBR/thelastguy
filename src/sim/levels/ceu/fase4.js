// ceu-4 "Seis Andares de Wafer" — Final estilo queda de ladrilhos (último de pé vence).
import { LevelBuilder } from '../builder.js';
import * as S from '../segments.js';

export const meta = {
  id: 'ceu-4',
  world: 'ceu',
  slot: 4,
  type: 'final',
  name: 'Seis Andares de Wafer',
  objective: 'SEJA O ÚLTIMO DE PÉ!',
  evokes: 'Tile Fall / Hex-A-Gone',
  camera: 'arena',
  cameraBounds: { x0: -64, x1: 544, y0: -490, y1: 80 },
};

// orçamento ≈ 150 ladrilhos × ~1,5 s de apoio: mira 45-90 s com 4 jogadores
const DELAYS = [
  [0, 2.4],
  [40, 1.8],
  [70, 1.2],
  [100, 0.8],
];
const RANDOM = [
  [0, 0],
  [70, 0.5],
  [100, 1],
  [120, 2],
];

export default function build() {
  const b = new LevelBuilder(meta);
  // 6 andares de 30 ladrilhos de 16 px; 72 px entre andares (não dá para subir pulando)
  const layers = [
    { h: 360, kind: 'plank' },
    { h: 288, kind: 'path' },
    { h: 216, kind: 'block' },
    { h: 144, kind: 'wafer' },
    { h: 72, kind: 'plank' },
    { h: 0, kind: 'path' },
  ];
  for (const L of layers) {
    S.crumble(b, 0, L.h, 480, { tileW: 16, depth: 12, respawn: 0, kind: L.kind, delaySchedule: DELAYS, randomSchedule: RANDOM });
  }
  // paredes laterais: só se sai atravessando todos os andares
  b.wall(-16, -60, 16, 400, { kind: 'wall', extra: 0 });
  b.wall(480, -60, 16, 400, { kind: 'wall', extra: 0 });
  b.arenaSpawns(40, 440, 360);
  b.bound(-120, -500, 720, 600);
  b.killY = 90;
  return b.build();
}
