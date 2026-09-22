// ceu-2 "Tobogã de Algodão-Doce" — Corrida 16→8 em descida (alvo 80 s).
import { LevelBuilder } from '../builder.js';
import * as S from '../segments.js';

export const meta = {
  id: 'ceu-2',
  world: 'ceu',
  slot: 2,
  type: 'race',
  name: 'Tobogã de Algodão-Doce',
  objective: 'CORRA ATÉ A CHEGADA!',
  evokes: 'Super Slide',
  target: 80,
};

export default function build() {
  const b = new LevelBuilder(meta);
  // 1. largada no alto
  b.startArea(0, 256, 320);
  // 2. trampolins de marshmallow sobre o vazio (quique ≈ 110 px: espaçamento 112)
  S.pads(b, [320, 432, 544, 656], 320, { apex: 104, w: 64, vx: 123 });
  // 3. ladeira descendo com bumpers e dois vãos
  S.flat(b, 736, 800, 320);
  b.ramp(800, 320, 1136, 256);
  S.bumper(b, 896, 301);
  S.bumper(b, 1056, 306 + 40);
  b.noteGap(1136, 256, 1200, 244);
  b.ramp(1200, 244, 1456, 196);
  S.bumper(b, 1304, 224); // fora da zona de pouso do vão
  S.bumper(b, 1376, 211 + 40);
  b.noteGap(1456, 196, 1520, 160);
  S.flat(b, 1520, 1600, 160);
  b.checkpoint(1528, 160);
  // 4. três gangorras
  S.seesaw(b, 1704, 160, 128, 16);
  S.seesaw(b, 1872, 160, 128, 16);
  S.seesaw(b, 2040, 160, 128, 16);
  // 5. hélices de pirulito (sentidos opostos)
  S.flat(b, 2144, 2624, 160, { deco: 'rails' });
  // a ponta passa a 12 px do chão: só bloqueia quando o braço está quase na vertical
  S.rotor(b, 2336, 160, { kind: 'bar', pivot: 100, length: 88, arms: 2, period: 5, dir: 1, tier: 'light' });
  S.rotor(b, 2536, 160, { kind: 'bar', pivot: 100, length: 88, arms: 2, period: 5, dir: -1, phase: 0.25, tier: 'light' });
  b.checkpoint(2560, 160);
  // 6. subida com chicletes rolando
  b.ramp(2624, 160, 3264, 256);
  S.flat(b, 3264, 3296, 256);
  S.roller(b, 3292, 256, { dir: -1, speed: 140, r: 14, interval: 2.0, t0: 1.0, look: 'gum' });
  // 7. Ponte de Wafer que desmorona; embaixo, pista com esteira contra e escada de volta
  S.crumble(b, 3296, 256, 608, { tileW: 16, delay: 0.45, respawn: 3.5, depth: 8, oneWay: true });
  S.conveyor(b, 3296, 128, 480, -50);
  S.hurdles(b, [3420, 3560, 3700], 128, 12);
  S.flat(b, 3776, 3808, 160);
  S.flat(b, 3808, 3840, 192);
  S.flat(b, 3840, 3904, 224);
  S.flat(b, 3904, 3968, 256);
  b.checkpoint(3910, 256);
  // 8. Grande Tobogã: descida com esteiras de impulso, barreiras e bumpers
  b.ramp(3968, 256, 4224, 212, { kind: 'slide', mat: 'slide', conveyor: 60 });
  b.ramp(4224, 212, 4544, 156, { kind: 'slide', mat: 'slide' });
  b.ramp(4544, 156, 4736, 122, { kind: 'slide', mat: 'slide', conveyor: 60 });
  b.ramp(4736, 122, 5136, 52, { kind: 'slide', mat: 'slide' });
  S.hurdles(b, [4128], 228, 12);
  S.hurdles(b, [4384], 184, 12);
  S.hurdles(b, [4640], 139, 12);
  S.bumper(b, 4512, 162 + 40);
  S.bumper(b, 4832, 105);
  // rampinha de salto sobre o vão final
  b.ramp(5136, 52, 5160, 60, { kind: 'slide', mat: 'slide' });
  b.noteGap(5160, 60, 5248, 40, { needsSpeed: true });
  S.flat(b, 5248, 5600, 40, { deco: 'rails' });
  S.finish(b, 5408, 40);
  return b.build();
}
