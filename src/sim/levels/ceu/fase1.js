// ceu-1 "Martelada nas Nuvens" — o mockup em 2D (Corrida 32→16, alvo 70 s).
import { LevelBuilder } from '../builder.js';
import * as S from '../segments.js';

export const meta = {
  id: 'ceu-1',
  world: 'ceu',
  slot: 1,
  type: 'race',
  name: 'Martelada nas Nuvens',
  objective: 'CORRA ATÉ A CHEGADA!',
  evokes: 'mockups + corridas de martelos',
  target: 70,
};

export default function build() {
  const b = new LevelBuilder(meta);
  // 1. largada
  b.startArea(0, 320, 0);
  // 2. barreiras listradas
  S.flat(b, 320, 640, 0, { deco: 'rails' });
  S.hurdles(b, [400, 480, 560], 0, 12); // última a 80 px do vão (combo justo)
  // 3. vãos 48/56/64 com subida
  S.gaps(b, 640, 0, [48, 56], [0, 16], [72, 64]);
  S.flat(b, 944, 1520, 16, { deco: 'rails' });
  // 4. três martelos-pêndulo defasados
  S.pendulums(b, [1056, 1200, 1344], 16, { period: 2.4, amp: 55, phases: [0, 1 / 3, 2 / 3] });
  b.checkpoint(1440, 16);
  // 5. blocos roxos empurradores
  S.flat(b, 1520, 2000, 16);
  S.pushers(b, [1560, 1680, 1800, 1920], 16, { stroke: 40, period: 2 });
  // 6. Varredor Rosa: tambor com 2 martelos (a cabeça baixa anda para a direita)
  S.flat(b, 2000, 2400, 16, { deco: 'rails' });
  S.rotor(b, 2200, 16, { pivot: 96, length: 84, arms: 2, headR: 14, period: 6, dir: -1 });
  // 7. vãos com subidas/descidas e plataforma móvel sobre o abismo
  S.gaps(b, 2400, 16, [56, 72, 48], [24, -24, 32], [80, 80, 64]);
  S.mover(b, 2888, 48, { w: 64, amp: 40, period: 3 });
  S.flat(b, 2976, 3536, 48, { deco: 'rails' });
  b.checkpoint(2992, 48);
  // 8. Onda Verde: 4 martelos em ritmo
  S.pendulums(b, [3104, 3232, 3360, 3488], 48, { period: 2.0, amp: 55, phaseStep: 0.535 });
  // 9. bifurcação: rota alta (degraus one-way + vãos) ou baixa (empurradores)
  S.flat(b, 3536, 4176, 48);
  S.pushers(b, [3700, 3860, 4020], 48, { stroke: 40, period: 1.8 });
  S.hurdles(b, [3620, 4120], 48, 12);
  b.oneway(3560, 80, 64);
  b.oneway(3648, 112, 64);
  b.oneway(3736, 144, 96);
  b.oneway(3904, 144, 80);
  b.oneway(4056, 144, 96);
  b.checkpoint(4200, 48);
  // 10. Martelões
  S.flat(b, 4176, 5136, 48, { deco: 'rails' });
  S.pendulums(b, [4352, 4544], 48, { pivot: 150, length: 120, headW: 56, headH: 32, period: 3.0, amp: 60, phases: [0, 0.5] });
  // 11. barreiras finais
  S.hurdles(b, [4700, 4780, 4860], 48, 12);
  // 12. chegada
  S.finish(b, 4960, 48);
  return b.build();
}
