// esp-2 "Cinturão de Asteroides" — Corrida 16→8 em gravidade baixa (alvo 90 s): anéis de
// asteroides girando, mini buraco negro puxando no pulo, torretas de laser, portas de
// descompressão, bifurcação, atração contrária com satélites e trampolins entre lasers.
import { LevelBuilder } from '../builder.js';
import * as S from '../segments.js';

export const meta = {
  id: 'esp-2',
  world: 'espaco',
  slot: 2,
  type: 'race',
  name: 'Cinturão de Asteroides',
  objective: 'CORRA ATÉ A CHEGADA!',
  evokes: 'pulo de asteroide em asteroide',
  target: 90,
  physics: 'lowg',
};

const D = 40;
const H = 64; // altura base do percurso

export default function build() {
  const b = new LevelBuilder(meta);
  const deck = (x0, x1, h, o = {}) => S.flat(b, x0, x1, h, { depth: D, ...o });
  const rock = (x0, x1, h) => S.flat(b, x0, x1, h, { depth: 32, kind: 'rock' });
  const gap = (x0, h0, x1, h1, assist) => b.noteGap(x0, h0, x1, h1, assist ? { assist } : {});
  const gate = (x, h, span, o = {}) => b.obstacle('laser', { kind: 'gate', x, y0: -(h + span), y1: -h, on: 1.0, off: 1.5, warn: 0.4, ...o });
  /** Anel de asteroides (3 rochas, raio 96, 7 s, horário): embarca à esquerda, desce à direita. */
  const ring = (cx, h) => {
    b.obstacle('ferris', { x: cx, y: -h, cars: 3, radius: 96, period: 7, dir: 1, w: 48, kind: 'rock' });
    b.lift(cx - 136, cx + 136, h, h + 96, cx + 136);
  };

  // 1. largada
  b.startArea(0, 264, H, { depth: D });
  // 2. dois anéis de asteroides (as rochas passam a 8 px das plataformas na altura do caminho)
  ring(392, H);
  gap(264, H, 520, H, 'wheel');
  deck(520, 552, H);
  ring(680, H);
  gap(552, H, 808, H, 'wheel');
  deck(808, 904, H);
  // 3. mini buraco negro sob o caminho: puxa quem está no ar; 5 rochas com vãos de 80–96
  b.obstacle('blackhole', { x: 1224, y: -(H - 224), radius: 260, ground: [[0, 20]], air: [[0, 150]], core: 18 });
  let x = 904;
  for (const g of [80, 88, 96, 88, 80]) {
    gap(x, H, x + g, H);
    x += g;
    rock(x, x + 64, H);
    x += 64;
  }
  gap(x, H, x + 80, H);
  x += 80;
  deck(x, x + 96, H);
  b.checkpoint(x + 16, H);
  x += 96;
  // 4. duas torretas de laser (feixe 160, 5 s): passe quando o feixe estiver no alto; 2 barreiras
  deck(x, x + 640, H, { deco: 'rails' });
  b.obstacle('laser', { kind: 'turret', x: x + 176, y: -(H + 104), len: 150, period: 5, arc: 1.25, base: Math.PI / 2 });
  b.obstacle('laser', { kind: 'turret', x: x + 464, y: -(H + 104), len: 150, period: 5, arc: 1.25, base: Math.PI / 2, phase: 0.5 });
  S.hurdles(b, [x + 320, x + 600], H, 24, 12);
  x += 640;
  // 5. quatro portas de descompressão (fecham 0,6 s, 2,6 s de ciclo, em onda)
  deck(x, x + 544, H);
  b.block(x + 32, H + 136, 480, { depth: 32, kind: 'block' });
  S.crushers(b, [x + 96, x + 224, x + 352, x + 480], H, {
    w: 32,
    h: 24,
    lift: 80,
    phaseStep: 0.25,
    kind: 'door',
    times: { shake: 0.3, drop: 0.15, hold: 0.6, rise: 0.55, wait: 1.0 },
  });
  x += 544;
  deck(x, x + 64, H);
  b.checkpoint(x, H);
  x += 64;
  // 6. bifurcação — em cima (h 232): 4 rochas flutuando (±48, 3,5 s); embaixo: esteira contra e 3 portões
  const sp = x;
  deck(sp, sp + 64, H);
  b.block(sp + 64, H - 24, 768, { depth: 24, kind: 'block' });
  S.conveyor(b, sp + 64, H, 768, -50);
  for (let i = 0; i < 3; i++) gate(sp + 224 + i * 208, H, 120, { phase: i / 3 });
  b.oneway(sp + 8, H + 56, 48, { kind: 'plank', depth: 10 });
  b.oneway(sp + 72, H + 112, 48, { kind: 'plank', depth: 10 });
  for (let i = 0; i < 4; i++) S.mover(b, sp + 216 + i * 144, H + 168, { w: 56, amp: 48, period: 3.5, axis: 'x', oneWay: true, kind: 'rock' });
  b.oneway(sp + 792, H + 168, 72, { kind: 'plank', depth: 10 });
  x = sp + 832;
  deck(x, x + 64, H);
  x += 64;
  // 7. atração contrária (puxa para trás) e dois satélites giratórios (3 painéis)
  deck(x, x + 704, H, { deco: 'rails' });
  b.obstacle('wind', { x, y: -(H + 180), w: 704, h: 180, drift: -25, fx: -200, groundK: 0, kind: 'pull' });
  S.rotor(b, x + 224, H, { kind: 'bar', pivot: 104, length: 86, arms: 3, period: 6, dir: 1, tier: 'light' });
  S.rotor(b, x + 512, H, { kind: 'bar', pivot: 104, length: 86, arms: 3, period: 6, dir: -1, tier: 'light', phase: 0.5 });
  x += 704;
  deck(x, x + 96, H);
  b.checkpoint(x + 16, H);
  x += 96;
  // 8. três trampolins mirados sobre o vazio, com pares de portões de laser no alto (1 s / 1,5 s)
  const p0 = x;
  for (let i = 0; i < 3; i++) {
    const px = p0 + i * 176;
    b.block(px, H - 16, 48, { depth: 24, kind: 'block' });
    S.pads(b, [px + 24], H, { w: 48, apex: 150, aimX: px + 200, aimH: H });
    gate(px + 88, H + 60, 90, { phase: i * 0.3 });
    if (i < 2) gap(px + 48, H, px + 176, H, 'pad');
  }
  x = p0 + 2 * 176 + 48;
  gap(x, H, x + 128, H, 'pad');
  x += 128;
  // 9. chegada
  deck(x, x + 848, H, { deco: 'rails' });
  S.finish(b, x + 560, H);
  return b.build();
}
