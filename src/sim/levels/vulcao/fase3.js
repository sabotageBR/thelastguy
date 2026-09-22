// vulc-3 "Chuva de Meteoros" — Sobrevivência (8→4, até 90 s): ilha de 28 ladrilhos de basalto
// sobre a lava. Meteoros com marcador vermelho abrem buracos; alguns miram jogadores; linhas de 5
// e meteoros grandes depois; as duas plataformas elevadas (refúgio) desabam aos 60 s.
import { LevelBuilder } from '../builder.js';
import * as S from '../segments.js';

export const meta = {
  id: 'vulc-3',
  world: 'vulcao',
  slot: 3,
  type: 'survival',
  name: 'Chuva de Meteoros',
  objective: 'SOBREVIVA!',
  evokes: 'Bombardment',
  timeLimit: 90,
  camera: 'arena',
  cameraBounds: { x0: -80, x1: 528, y0: -260, y1: 80 },
};

const W = 448;
const LAVA = 40;

export default function build() {
  const b = new LevelBuilder(meta);
  // chão: 28 ladrilhos que os meteoros destroem
  S.crumble(b, 0, 0, W, { tileW: 16, depth: 24, respawn: 0, kind: 'path', standTrigger: false });
  // plataformas elevadas (80 × h 40): refúgio contra meteoros pequenos, desabam aos 60 s
  for (const px of [96, 272]) {
    S.crumble(b, px, 40, 80, {
      tileW: 16,
      depth: 12,
      respawn: 0,
      kind: 'obsidian',
      standTrigger: false,
      shrinkSchedule: [
        [0, 80],
        [60, 0],
      ],
    });
  }
  b.obstacle('bombard', {
    x0: 16,
    x1: W - 16,
    ground: 0,
    top: -300,
    radius: 24,
    bigRadius: 40,
    destroys: true,
    tier: 'light',
    look: 'meteor',
    start: 2,
    schedule: [
      [0, 1.5],
      [15, 1.2],
      [30, 1.0],
      [45, 0.8],
      [75, 0.6],
    ],
    warn: [
      [0, 1.2],
      [60, 0.9],
      [75, 0.8],
    ],
    aimChance: [
      [0, 0],
      [15, 0.3],
    ],
    lines: [
      [0, 0],
      [30, 10],
    ],
    big: [
      [0, 0],
      [45, 6],
    ],
  });
  b.obstacle('liquid', { x: -240, w: W + 480, y: LAVA, look: 'lava' });
  b.arenaSpawns(40, W - 40, 0);
  b.bound(-120, -320, W + 240, 440);
  b.killY = 60;
  return b.build();
}
