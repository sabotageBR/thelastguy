// esp-4 "Colapso da Estação" — Final em gravidade baixa: 7 módulos no chão e 3 flutuando, um
// buraco negro no alto puxa todo mundo (no chão, deriva para o centro; no ar, atração forte).
// Os módulos se soltam em sequência (2 s de faíscas antes) e destroços voam pela arena.
// Vence o último a ser puxado.
import { LevelBuilder } from '../builder.js';

export const meta = {
  id: 'esp-4',
  world: 'espaco',
  slot: 4,
  type: 'final',
  name: 'Colapso da Estação',
  objective: 'SEJA O ÚLTIMO DE PÉ!',
  evokes: 'estação sendo engolida',
  camera: 'arena',
  cameraBounds: { x0: -80, x1: 528, y0: -300, y1: 80 },
  physics: 'lowg',
};

const W = 448;

export default function build() {
  const b = new LevelBuilder(meta);
  // 7 módulos de 64 px: o do centro solta aos 20 s, depois os vizinhos, depois os de fora
  b.obstacle('crumble', {
    x: 0,
    y: 0,
    n: 7,
    tileW: 64,
    depth: 24,
    delay: 2,
    respawn: 0,
    kind: 'path',
    standTrigger: false,
    dropSchedule: [
      [20, [3]],
      [45, [2, 4]],
      [70, [1, 5]],
      [100, [0, 6]],
    ],
  });
  // 3 módulos flutuando (h 72) que caem aos 45 s
  for (const x of [32, 192, 352]) {
    b.obstacle('crumble', { x, y: -72, n: 1, tileW: 64, depth: 12, delay: 2, respawn: 0, kind: 'plank', standTrigger: false, oneWay: true, dropSchedule: [[45, [0]]] });
  }
  b.obstacle('blackhole', {
    x: W / 2,
    y: -200,
    radius: 420,
    ground: [
      [0, 20],
      [20, 35],
      [45, 50],
      [70, 65],
      [100, 80],
    ],
    air: [
      [0, 150],
      [100, 400],
    ],
    core: 20,
  });
  // destroços cruzando a arena rente ao chão (dá para pular)
  b.obstacle('slider', {
    x0: 0,
    x1: W,
    y: 0,
    speed: 150,
    interval: 3,
    schedule: [
      [0, 3],
      [100, 1.5],
    ],
    start: 45,
    dirs: 'alt',
    w: 16,
    h: 12,
    tier: 'bump',
    look: 'debris',
  });
  b.arenaSpawns(24, W - 24, 0);
  b.bound(-120, -320, W + 240, 440);
  b.killY = 80;
  return b.build();
}
