// gelo-2 "Ponte dos Pingentes" — Corrida 16→8 (alvo 85 s): pingentes, ponte que racha,
// vento com martelos, bifurcação, moinho de gelo e a Avalanche (esconda-se nos nichos).
import { LevelBuilder } from '../builder.js';
import * as S from '../segments.js';

export const meta = {
  id: 'gelo-2',
  world: 'gelo',
  slot: 2,
  type: 'race',
  name: 'Ponte dos Pingentes',
  objective: 'CORRA ATÉ A CHEGADA!',
  evokes: 'pingentes + avalanche',
  target: 85,
};

const FLOOR = 64;

export default function build() {
  const b = new LevelBuilder(meta);
  const snow = (x0, x1, h, o = {}) => S.flat(b, x0, x1, h, { depth: h + FLOOR, ...o });
  const ice = (x0, x1, h, o = {}) => S.flat(b, x0, x1, h, { depth: h + FLOOR, kind: 'ice', mat: 'ice', ...o });
  const gap = (x0, h0, x1, h1) => b.noteGap(x0, h0, x1, h1);
  /** Teto de caverna (fundo a `clear` px do chão h) com pingentes nas posições xs. */
  const cave = (x0, x1, h, xs, o = {}) => {
    const clear = 128;
    b.block(x0, h + clear + 40, x1 - x0, { depth: 40, kind: 'block' });
    b.obstacle('icicles', { xs, y: -(h + clear), ground: -h, shake: o.shake ?? 0.8, fall: 0.35, regrow: 2.5, stagger: o.stagger ?? 0.4, hang: o.hang ?? 0.6 });
  };

  // 1. largada
  b.startArea(0, 256, 64, { depth: 64 + FLOOR });
  // 2. caverna com 8 pingentes que tremem e caem (onda de 0,4 s)
  snow(256, 832, 64);
  cave(272, 816, 64, [320, 384, 448, 512, 576, 640, 704, 768]);
  // 3. vãos no gelo 64(0) / 56(+24) / 72(−16) / 72(0)
  gap(832, 64, 896, 64);
  ice(896, 960, 64);
  gap(960, 64, 1016, 88);
  snow(1016, 1096, 88);
  gap(1096, 88, 1168, 72);
  ice(1168, 1224, 72);
  gap(1224, 72, 1296, 72);
  snow(1296, 1440, 72);
  b.checkpoint(1320, 72);
  // 4. ponte de gelo que racha (0,5 s; volta em 3 s) entre postes firmes, com 4 pingentes
  let x = 1440;
  for (let i = 0; i < 6; i++) {
    S.crumble(b, x, 72, 64, { tileW: 16, delay: 0.5, respawn: 3, kind: 'ice', depth: 10, oneWay: true, look: 'crack' });
    gap(x, 72, x + 64, 72);
    x += 64;
    if (i < 5) {
      snow(x, x + 32, 72);
      x += 32;
    }
  }
  cave(1456, 2000, 72, [1552, 1680, 1808, 1936], { shake: 0.7, stagger: 0.9 });
  // 5. rajadas de vento (2 s / 2 s) com três martelos de gelo
  snow(2016, 2760, 72, { deco: 'rails' });
  b.obstacle('wind', { x: 2040, y: -72 - 150, w: 600, h: 160, drift: -60, on: 2, off: 2, warn: 0.5 });
  S.pendulums(b, [2176, 2336, 2496], 72, { period: 2.2, amp: 55, phases: [0, 0.33, 0.66] });
  b.checkpoint(2672, 72);
  // 6. bifurcação — em cima: 5 placas de gelo à deriva (vãos de 64); embaixo, no gelo: empurradores e montes
  ice(2760, 3712, 72);
  S.pushers(b, [2880, 3080, 3280, 3480], 72, { stroke: 56, period: 1.8, mat: 'ice' });
  S.hurdles(b, [2980, 3180, 3380], 72, 12, 16);
  b.oneway(2768, 112, 48);
  b.oneway(2832, 152, 48);
  for (const cx of [2928, 3040, 3152, 3264, 3376]) S.mover(b, cx, 168, { w: 48, amp: 32, period: 2.8, kind: 'ice', oneWay: true });
  b.oneway(3432, 168, 96);
  // 7. moinho de gelo de 3 braços
  ice(3712, 4128, 72);
  S.rotor(b, 3904, 72, { kind: 'bar', pivot: 108, length: 96, arms: 3, period: 7.5, dir: 1, tier: 'light' });
  b.checkpoint(4040, 72);
  // 8. Avalanche: terraços subindo, cada um com um nicho (16 × 28 px) — a bola gigante passa por
  //    cima de quem se esconde; o fosso de 64 px no pé engole as bolas
  gap(4128, 72, 4192, 72);
  let h = 72;
  for (let i = 0; i < 5; i++) {
    const ux = 4192 + i * 192;
    snow(ux, ux + 88, h);
    b.block(ux + 88, h - 28, 16, { depth: h - 28 + FLOOR });
    b.hide(ux + 96);
    snow(ux + 104, ux + 160, h);
    b.ramp(ux + 160, h, ux + 192, h + 26, { depth: h + FLOOR });
    h += 26;
  }
  snow(5152, 5760, h, { deco: 'rails' });
  b.block(5184, h + 72, 96, { depth: 16, kind: 'block' });
  S.roller(b, 5264, h + 72, { dir: -1, speed: 120, r: 11, grow: 15, interval: 2.0, t0: 1.0, giantEvery: 3, giantR: 28, giantTier: 'heavy', look: 'snow', tier: 'light', maxLife: 14 });
  // 9. mais dois pingentes, montes e chegada
  cave(5312, 5424, h, [5344, 5392], { stagger: 1.2 });
  S.hurdles(b, [5232, 5288, 5456], h, 12, 16);
  S.finish(b, 5504, h);
  return b.build();
}
