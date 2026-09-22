// gelo-1 "Descida Congelada" — Corrida 32→16 (alvo 70 s): gelo, bolas de neve, gelo fino, vento.
import { LevelBuilder } from '../builder.js';
import * as S from '../segments.js';

export const meta = {
  id: 'gelo-1',
  world: 'gelo',
  slot: 1,
  type: 'race',
  name: 'Descida Congelada',
  objective: 'CORRA ATÉ A CHEGADA!',
  evokes: 'Ski Fall + corridas no gelo',
  target: 70,
};

const FLOOR = 64; // os penhascos descem até y = +64 (terreno de montanha)

export default function build() {
  const b = new LevelBuilder(meta);
  const snow = (x0, x1, h, o = {}) => S.flat(b, x0, x1, h, { depth: h + FLOOR, ...o });
  const ice = (x0, x1, h, o = {}) => S.flat(b, x0, x1, h, { depth: h + FLOOR, kind: 'ice', mat: 'ice', ...o });
  const slope = (x0, h0, x1, h1, o = {}) => b.ramp(x0, h0, x1, h1, { depth: Math.min(h0, h1) + FLOOR, ...o });
  const gap = (x0, h0, x1, h1) => b.noteGap(x0, h0, x1, h1);

  // 1. largada na neve, no alto da montanha
  b.startArea(0, 320, 192, { depth: 192 + FLOOR });
  // 2. pista de gelo com 3 montes de neve
  ice(320, 704, 192);
  S.hurdles(b, [424, 536, 648], 192, 12, 16);
  // 3. descida escorregadia com dois vãos perto do pé
  slope(704, 192, 960, 96, { kind: 'ice', mat: 'ice' });
  ice(960, 1024, 96);
  gap(1024, 96, 1080, 96);
  ice(1080, 1160, 96);
  gap(1160, 96, 1224, 96);
  // 4. três martelos de gelo sobre o gelo (fora da zona de pouso)
  ice(1224, 1680, 96);
  S.pendulums(b, [1336, 1480, 1624], 96, { period: 2.6, amp: 50, phases: [0, 0.5, 0] });
  snow(1680, 1800, 96);
  b.checkpoint(1704, 96);
  // 5. cubos de gelo empurradores (topo escorregadio)
  snow(1800, 2248, 96, { deco: 'rails' });
  S.pushers(b, [1848, 1968, 2088, 2208], 96, { stroke: 56, period: 2.2, mat: 'ice' });
  // 6. subida com bolas de neve que crescem; o fosso no pé engole as bolas
  gap(2248, 96, 2288, 96);
  slope(2288, 96, 2768, 192);
  snow(2768, 3000, 192);
  // calha de onde as bolas rolam (alta demais para alcançar)
  b.block(2800, 264, 120, { depth: 16, kind: 'block' });
  S.roller(b, 2904, 264, { dir: -1, speed: 130, r: 10, grow: 18, interval: 2.4, t0: 0.5, look: 'snow', tier: 'light', maxLife: 7 });
  b.checkpoint(2920, 192);
  // 7. Gelo Fino: pares de placas de 32 px que racham (0,6 s) entre ilhas de neve firme —
  //    sem as placas sobra um buraco de 64 px, que ainda dá para pular
  const thin = { tileW: 32, delay: 0.6, respawn: 2.5, kind: 'ice', mat: 'ice', depth: 12, look: 'crack' };
  let x = 3000;
  for (let i = 0; i < 4; i++) {
    S.crumble(b, x, 192, 64, thin);
    gap(x, 192, x + 64, 192);
    snow(x + 64, x + 112, 192);
    x += 112;
  }
  snow(3448, 3592, 192);
  // 8. vento contra em rajadas (1,5 s ligado / 2 s desligado, aviso 0,5 s) com dois vãos de 48
  gap(3592, 192, 3640, 192);
  snow(3640, 3752, 192);
  gap(3752, 192, 3800, 192);
  snow(3800, 4040, 192, { deco: 'rails' });
  b.obstacle('wind', { x: 3456, y: -192 - 150, w: 456, h: 160, drift: -45, on: 1.5, off: 2.0, warn: 0.5 });
  b.checkpoint(3944, 192);
  // 9. grande descida no gelo com 4 bumpers e vãos de 64/72 no fim
  slope(4040, 192, 4680, 0, { kind: 'ice', mat: 'ice' });
  for (const x of [4176, 4320, 4464, 4600]) S.bumper(b, x, 192 - (x - 4040) * 0.3, 12);
  ice(4680, 4744, 0);
  gap(4744, 0, 4808, 0);
  ice(4808, 4888, 0);
  gap(4888, 0, 4960, 0);
  // 10. chegada (arco de gelo)
  snow(4960, 5280, 0, { deco: 'rails' });
  S.finish(b, 5056, 0);
  return b.build();
}
