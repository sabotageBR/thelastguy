// Fase de teste (treino livre): vãos crescentes, degraus, rampas e plataformas one-way.
import { LevelBuilder } from '../builder.js';

export default function build() {
  const b = new LevelBuilder({ id: 'playground', name: 'Treino Livre', world: 'ceu', type: 'free', objective: 'EXPLORE!' });
  b.startArea(0, 240, 0);
  b.block(240, 0, 200, { deco: 'rails' });
  b.block(488, 0, 120); // vão 48
  b.block(672, 0, 120); // vão 64
  b.block(864, 8, 140); // vão 72
  b.checkpoint(900, 8);
  b.block(1004, 8, 100);
  b.block(1104, 40, 100, { kind: 'block' });
  b.block(1204, 80, 120, { kind: 'block' });
  b.ramp(1324, 80, 1484, 0);
  b.block(1484, 0, 300, { deco: 'rails' });
  b.oneway(1560, 40, 64);
  b.oneway(1648, 80, 64);
  b.oneway(1736, 120, 64);
  b.block(1784, 0, 200);
  b.ramp(1984, 0, 2084, 50);
  b.block(2084, 50, 420, { deco: 'rails' });
  b.finishLine(2240, 50);
  b.deco('finishFloor', { x: 2240, y: -50 });
  return b.build();
}
