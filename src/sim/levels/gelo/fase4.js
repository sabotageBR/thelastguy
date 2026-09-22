// gelo-4 "Lago Rachado" — Final: 28 placas de gelo sobre a água (cair = eliminado).
// Rachaduras marcam as placas que vão quebrar, as bordas derretem para dentro, pinguins
// deslizam de barriga e placas à deriva sob o gelo afundam com o peso.
import { LevelBuilder } from '../builder.js';

export const meta = {
  id: 'gelo-4',
  world: 'gelo',
  slot: 4,
  type: 'final',
  name: 'Lago Rachado',
  objective: 'SEJA O ÚLTIMO DE PÉ!',
  evokes: 'Hex-A-Gone no gelo',
  camera: 'arena',
  cameraBounds: { x0: -80, x1: 528, y0: -240, y1: 70 },
};

const W = 448;

export default function build() {
  const b = new LevelBuilder(meta);
  // placas à deriva 8 px abaixo do gelo (aparecem nos buracos; afundam depois de 3 s ocupadas)
  [96, 224, 352].forEach((cx, i) => {
    b.obstacle('sinking', {
      x: cx - 24,
      y: 8,
      w: 48,
      h: 8,
      amp: 64,
      period: 6,
      phase: i / 3,
      sink: 12,
      rise: 0,
      maxSink: 14,
      delay: 3,
      delaySchedule: [
        [0, 3],
        [30, 2],
      ],
      gone: true,
      respawn: 5,
      oneWay: true,
      kind: 'ice',
      mat: 'ice',
    });
  });
  // 28 placas de gelo: rachadura (aviso) → brilho → quebra para sempre; bordas derretendo
  b.obstacle('crumble', {
    x: 0,
    y: 0,
    n: W / 16,
    tileW: 16,
    depth: 12,
    respawn: 0,
    kind: 'ice',
    mat: 'ice',
    look: 'crack',
    standTrigger: false,
    delaySchedule: [
      [0, 2.0],
      [60, 1.6],
    ],
    randomSchedule: [
      [0, 0.25],
      [30, 0.34],
      [60, 0.5],
      [90, 1.34],
    ],
    shrinkSchedule: [
      [0, 448],
      [30, 416],
      [40, 384],
      [50, 352],
      [60, 320],
      [66, 288],
      [72, 256],
      [78, 224],
      [84, 192],
      [90, 160],
      [96, 128],
      [102, 96],
      [108, 64],
      [114, 32],
    ],
  });
  // pinguins de barriga (dá para pular por cima); a partir de 30 s vêm dos dois lados
  b.obstacle('slider', {
    x0: 0,
    x1: W,
    y: 0,
    speed: 140,
    interval: 6,
    schedule: [
      [0, 6],
      [30, 4],
    ],
    dirs: 'right',
    w: 24,
    h: 14,
    tier: 'bump',
    start: 3,
  });
  b.obstacle('slider', { x0: 0, x1: W, y: 0, speed: 140, interval: 4, dirs: 'left', w: 24, h: 14, tier: 'bump', start: 32 });
  // água gelada: encostar elimina
  b.obstacle('liquid', { x: -240, w: W + 480, y: 24, look: 'water' });

  b.arenaSpawns(40, W - 40, 0);
  b.bound(-120, -300, W + 240, 400);
  b.killY = 40;
  return b.build();
}
