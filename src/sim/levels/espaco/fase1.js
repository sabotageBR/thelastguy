// esp-1 "Corrida Orbital" — Corrida 32→16 em gravidade baixa (alvo 80 s): vãos longos,
// portões de laser, esteiras e trampolins até o deque, plataformas verticais, feixes que sobem e
// descem, braços de laser giratórios e ventiladores sobre o vazio.
import { LevelBuilder } from '../builder.js';
import * as S from '../segments.js';

export const meta = {
  id: 'esp-1',
  world: 'espaco',
  slot: 1,
  type: 'race',
  name: 'Corrida Orbital',
  objective: 'CORRA ATÉ A CHEGADA!',
  evokes: 'Space Race',
  target: 80,
  physics: 'lowg',
};

const D = 40; // módulos flutuando no espaço

export default function build() {
  const b = new LevelBuilder(meta);
  const deck = (x0, x1, h, o = {}) => S.flat(b, x0, x1, h, { depth: D, ...o });
  const gap = (x0, h0, x1, h1, assist) => b.noteGap(x0, h0, x1, h1, assist ? { assist } : {});
  const gate = (x, h, span, o = {}) => b.obstacle('laser', { kind: 'gate', x, y0: -(h + span), y1: -h, on: 1.2, off: 1.4, warn: 0.4, ...o });

  // 1. largada
  b.startArea(0, 320, 0, { depth: D });
  // 2. vãos longos: 80(+40) / 112(−24) / 72(+48) / 104(+16), módulos de 80
  gap(320, 0, 400, 40);
  deck(400, 480, 40);
  gap(480, 40, 592, 16);
  deck(592, 672, 16);
  gap(672, 16, 744, 64);
  deck(744, 864, 64);
  gap(864, 64, 968, 80);
  deck(968, 992, 80);
  // 3. quatro portões de laser do chão ao teto (teto a 128 px), defasados 0,5 s
  deck(992, 1632, 80, { deco: 'rails' });
  b.block(1056, 80 + 128 + 32, 512, { depth: 32, kind: 'block' });
  for (let i = 0; i < 4; i++) gate(1120 + i * 128, 80, 128, { phase: (i * 0.5) / 2.6 });
  b.checkpoint(1592, 80);
  // 4. esteiras alternadas e trampolins (ápice 180) em escada até o deque em h 240
  b.block(1632, 56, 192, { depth: 24, kind: 'block' });
  S.conveyor(b, 1632, 80, 144, 60);
  // trampolins mirados: caem no meio da próxima plataforma, venha-se com a velocidade que for
  S.pads(b, [1800], 80, { w: 48, apex: 180, aimX: 1960, aimH: 160 });
  gap(1824, 80, 1880, 160);
  deck(1880, 2056, 160 - 24);
  S.conveyor(b, 1880, 160, 128, -60);
  S.pads(b, [2032], 160, { w: 48, apex: 180, aimX: 2176, aimH: 240 });
  gap(2056, 160, 2104, 240);
  deck(2104, 2272, 240);
  // 5. três plataformas verticais (±48, 4 s) com vãos de 88
  let x = 2272;
  for (let i = 0; i < 3; i++) {
    gap(x, 240, x + 88, 240);
    S.mover(b, x + 120, 240, { w: 64, amp: 48, period: 4, axis: 'y', phase: i / 3, oneWay: true, kind: 'plank' });
    x += 152;
  }
  gap(x, 240, x + 80, 240);
  x += 80;
  deck(x, x + 1000, 240, { deco: 'rails' });
  b.checkpoint(x + 16, 240);
  // 6. três feixes curtos (96 px) subindo e descendo entre h 8 e 120 (3 s, defasados ⅓)
  for (let i = 0; i < 3; i++) b.obstacle('laser', { kind: 'sweep', x: x + 96 + i * 160, w: 96, yTop: -(240 + 120), yBot: -(240 + 8), period: 3, phase: i / 3 });
  // 7. dois braços de laser giratórios (pivô a 64, braço 80, 4 s, sentidos opostos)
  S.rotor(b, x + 656, 240, { kind: 'laser', pivot: 64, length: 80, arms: 1, period: 4, dir: 1 });
  S.rotor(b, x + 856, 240, { kind: 'laser', pivot: 64, length: 80, arms: 1, period: 4, dir: -1, phase: 0.5 });
  x += 1000;
  deck(x, x + 64, 240);
  b.checkpoint(x, 240);
  x += 64;
  // 8. três ventiladores levantam você sobre um vazio de 256 px; portões de laser lá no alto
  const v0 = x;
  gap(v0, 240, v0 + 256, 240, 'fan');
  for (let i = 0; i < 3; i++) b.obstacle('wind', { x: v0 + 8 + i * 80, y: -(240 + 200), w: 80, h: 320, fy: -900, kind: 'fan' });
  gate(v0 + 88, 240 + 90, 110, { on: 1.0, off: 1.6 });
  gate(v0 + 168, 240 + 90, 110, { on: 1.0, off: 1.6, phase: 0.5 });
  x = v0 + 256;
  // 9. três barreiras (24 px), um portão e a chegada (portal neon)
  deck(x, x + 1216, 240, { deco: 'rails' });
  S.hurdles(b, [x + 128, x + 288, x + 448], 240, 24, 12);
  gate(x + 608, 240, 128, { on: 1.0, off: 1.5 });
  S.finish(b, x + 960, 240);
  return b.build();
}
