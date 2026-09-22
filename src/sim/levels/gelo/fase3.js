// gelo-3 "Guerra de Bolas de Neve" — Sobrevivência estilo Bombardment (8→4, até 90 s).
// Canhões nos fortes dos dois lados atiram em arco (sombra de aviso), bolas gigantes rolam
// pela arena, rajadas de vento lateral; aos 60 s tudo vira gelo e no fim as bordas caem.
import { LevelBuilder } from '../builder.js';
import * as S from '../segments.js';

export const meta = {
  id: 'gelo-3',
  world: 'gelo',
  slot: 3,
  type: 'survival',
  name: 'Guerra de Bolas de Neve',
  objective: 'SOBREVIVA!',
  evokes: 'Bombardment',
  timeLimit: 90,
  camera: 'arena',
  cameraBounds: { x0: -96, x1: 544, y0: -260, y1: 70 },
};

const W = 448;

export default function build() {
  const b = new LevelBuilder(meta);
  // chão: bordas de neve (64 px) e centro de gelo (320 px); aos 60 s tudo congela; aos 75 s as bordas caem
  S.crumble(b, 0, 0, W, {
    tileW: 16,
    depth: 28,
    respawn: 0,
    kind: 'path',
    standTrigger: false,
    shrinkSchedule: [
      [0, W],
      [75, W - 64],
    ],
  });
  const floor = b.obstacles[b.obstacles.length - 1];
  floor.iceRange = [64, W - 64];
  floor.iceAt = 60;

  // fortes de neve com canhões, fora da arena (altos demais para alcançar)
  b.block(-88, 72, 64, { depth: 40, kind: 'block' });
  b.block(W + 24, 72, 64, { depth: 40, kind: 'block' });
  const targets = [];
  for (let x = 24; x <= W - 24; x += 25) targets.push(x);
  const cannon = {
    ground: 0,
    targets,
    shuffle: true,
    clamp: [12, W - 12],
    interval: 2.4,
    schedule: [
      [0, 2.4],
      [15, 1.8],
      [45, 1.4],
      [75, 1.0],
    ],
    spreadSchedule: [
      [0, 1],
      [30, 3],
    ],
    spreadGap: 44,
    warnSchedule: [
      [0, 0.4],
      [30, 0.25],
      [60, 0.15],
    ],
    flight: 0.7,
    r: 8,
    blast: 20,
    tier: 'light',
    start: 2,
  };
  b.obstacle('cannon', { ...cannon, x: -56, y: -96 });
  b.obstacle('cannon', { ...cannon, x: W + 56, y: -96, phase: 0.5 });

  // bolas gigantes rolando dos fortes (crescem com o tempo; alternam os lados)
  const giant = (t0, until, r, interval, offset) => {
    const o = { speed: 120, r, interval, look: 'snow', tier: 'heavy', gameClock: true, maxLife: 7, until };
    S.roller(b, -40, 72, { ...o, dir: 1, t0 });
    S.roller(b, W + 40, 72, { ...o, dir: -1, t0: t0 + offset });
  };
  giant(15, 45, 16, 16, 8);
  giant(45, 75, 20, 12, 6);
  giant(75, 999, 24, 8, 4);
  // roller() usa `r` e `grow`; tamanho fixo por fase
  for (const o of b.obstacles) if (o.type === 'roller') o.grow = o.r;

  // rajadas laterais (2 s a cada 10 s), primeiro para um lado, depois para o outro
  const wind = { x: -8, y: -200, w: W + 16, h: 196, on: 2, off: 8, warn: 0.8, gameClock: true };
  b.obstacle('wind', { ...wind, drift: 40, start: 30, end: 60 });
  b.obstacle('wind', { ...wind, drift: -40, start: 35, end: 60 });
  b.obstacle('wind', { ...wind, drift: 55, start: 60 });
  b.obstacle('wind', { ...wind, drift: -55, start: 65 });

  b.arenaSpawns(40, W - 40, 0);
  b.bound(-120, -320, W + 240, 440);
  b.killY = 110;
  return b.build();
}
