// vulc-4 "Torre de Magma" — Final estilo Lava Land: torre de 448 × 2400 px e lava subindo
// (parada 10 s; 12 → 18 → 24 → 30 px/s; nunca mais que 360 px abaixo do mais alto).
// Saliências a cada 40 px; acima da linha 20 parte delas desmorona para sempre; barras de fogo
// nas linhas 15, 30 e 45; pedras caindo a partir de 70 s; no topo, câmara com agulha que cai aos 140 s.
import { LevelBuilder } from '../builder.js';
import * as S from '../segments.js';
import { Rng } from '../../../core/rng.js';

export const meta = {
  id: 'vulc-4',
  world: 'vulcao',
  slot: 4,
  type: 'final',
  name: 'Torre de Magma',
  objective: 'SEJA O ÚLTIMO DE PÉ!',
  evokes: 'Lava Land',
  camera: 'vertical',
  cameraBounds: { x0: -80, x1: 528, y0: -2480, y1: 80 },
  introFrom: { x: 224, y: -2380 },
};

const W = 448;
const ROW = 40;
const ROWS = 57; // última linha comum em h 2280
const TOP = 2400;
const REACH = 60; // distância lateral máxima (borda a borda) entre saliências de linhas vizinhas

function gapBetween(a, b) {
  return Math.max(0, a[0] - (b[0] + b[1]), b[0] - (a[0] + a[1]));
}

/** Linhas de saliências (alternando 3 e 2 por linha, com variação), todas alcançáveis de baixo. */
function makeRows(rng) {
  const rows = [];
  for (let r = 1; r <= ROWS; r++) {
    const three = r % 2 === 1;
    const base = three ? [56, 224, 392] : [140, 308]; // centros
    let row;
    for (let tries = 0; tries < 50; tries++) {
      row = base.map((cx) => {
        const w = 48 + rng.int(3) * 16;
        const c = cx + rng.int(33) - 16;
        return [Math.round(Math.max(8, Math.min(W - 8 - w, c - w / 2))), w];
      });
      const below = rows[rows.length - 1];
      if (!below || row.every((a) => below.some((b) => gapBetween(a, b) <= REACH))) break;
    }
    rows.push(row);
  }
  return rows;
}

export default function build() {
  const b = new LevelBuilder(meta);
  const rng = new Rng(0x70ae);
  // chão da largada e paredes da torre
  b.block(0, 0, W, { depth: 60, kind: 'path' });
  b.wall(-24, -60, 24, TOP + 40, { kind: 'wall', extra: 0 });
  b.wall(W, -60, 24, TOP + 40, { kind: 'wall', extra: 0 });
  // tampa lacrada no topo
  b.block(0, TOP + 40, W, { depth: 40, kind: 'wall' });

  const rows = makeRows(rng);
  rows.forEach((row, i) => {
    const r = i + 1;
    const h = r * ROW;
    // uma saliência fixa por linha garante um caminho: o centro nas linhas de 3, uma das duas nas de 2
    const keep = row.length === 3 ? 1 : rng.int(2);
    row.forEach(([x, w], k) => {
      const crumbles = r > 20 && k !== keep && rng.next() < 0.4;
      if (crumbles) S.crumble(b, x, h, w, { tileW: 16, delay: 0.6, respawn: 0, kind: 'wafer', depth: 10, oneWay: true });
      else b.oneway(x, h, w, { kind: r % 3 ? 'plank' : 'obsidian', depth: 10 });
    });
    // barras de fogo (duas pontas) nas linhas 15, 30 e 45
    if (r === 15 || r === 30 || r === 45) S.rotor(b, 224, h, { kind: 'firebar', pivot: 28, length: 84, arms: 2, period: 5.5, dir: r === 30 ? -1 : 1, post: false, tier: 'light', headR: 5 });
  });
  // câmara do topo: 3 saliências que desmoronam e a agulha que desaba aos 140 s
  const hc = (ROWS + 1) * ROW; // 2320
  for (const x of [40, 192, 344]) S.crumble(b, x, hc, 64, { tileW: 16, delay: 1.0, respawn: 0, kind: 'obsidian', depth: 10, oneWay: true });
  S.crumble(b, 208, hc + 40, 32, {
    tileW: 16,
    depth: 10,
    respawn: 0,
    kind: 'obsidian',
    standTrigger: false,
    oneWay: true,
    shrinkSchedule: [
      [0, 32],
      [140, 0],
    ],
  });
  // pedras caindo a partir de 70 s (linha de aviso na coluna)
  b.obstacle('rockfall', {
    x0: 16,
    x1: W - 16,
    top: -TOP,
    bottom: 40,
    start: 70,
    schedule: [
      [0, 2.0],
      [100, 1.4],
    ],
    warn: 0.8,
    speed: 260,
    r: 9,
    tier: 'light',
  });
  // a lava
  b.obstacle('liquid', {
    x: -40,
    w: W + 80,
    y: 40,
    look: 'lava',
    idle: 10,
    band: 360,
    rise: [
      [0, 12],
      [40, 18],
      [70, 24],
      [100, 30],
    ],
  });
  b.arenaSpawns(40, W - 40, 0);
  b.bound(-120, -TOP - 200, W + 240, TOP + 400);
  b.killY = 120;
  return b.build();
}
