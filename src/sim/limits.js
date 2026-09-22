// Mede os limites reais de movimento rodando o próprio integrador num chão plano.
// validate.js usa estes números; os testes conferem os alvos de tuning.
import { LevelBuilder } from './levels/builder.js';
import { World } from './world.js';
import { FreeRules } from './rules/common.js';
import { makeInput } from './input.js';
import { ST } from './character.js';
import { TUNING } from './tuning.js';

function flatWorld(profile) {
  const b = new LevelBuilder({ id: 'limits', physics: profile, type: 'free' });
  b.block(-4000, 0, 12000, { depth: 64 });
  b.arenaSpawns(0, 10, 0, 1);
  const lvl = b.build();
  const w = new World(lvl, { seed: 1, roster: [{ slot: 0, name: 'm', human: true }], rules: new FreeRules() });
  return w;
}

function settle(w, inp, ticks) {
  for (let i = 0; i < ticks; i++) w.step([inp]);
}

/** Corre até a velocidade máxima e pula; mode: 'full' | 'tap' | 'dive'. */
function jumpRun(profile, mode) {
  const w = flatWorld(profile);
  const c = w.chars[0];
  const inp = makeInput();
  inp.move = 1;
  settle(w, inp, 90);
  const y0 = c.y;
  const x0 = c.x;
  let minY = c.y;
  let air = 0;
  let dived = false;
  inp.jump = true;
  inp.jumpHeld = true;
  w.step([inp]);
  inp.jump = false;
  if (mode === 'tap') inp.jumpHeld = false;
  let wasRising = true;
  for (let i = 0; i < 400; i++) {
    air++;
    if (mode === 'dive' && !dived && c.vy >= 0 && wasRising) {
      inp.jump = true;
      dived = true;
    }
    wasRising = c.vy < 0;
    w.step([inp]);
    inp.jump = false;
    if (c.y < minY) minY = c.y;
    if (c.grounded) break;
  }
  return { apex: y0 - minY, air, dist: c.x - x0, state: c.state };
}

const cache = new Map();

export function measureLimits(profile = 'normal') {
  if (cache.has(profile)) return cache.get(profile);
  const full = jumpRun(profile, 'full');
  const tap = jumpRun(profile, 'tap');
  const dive = jumpRun(profile, 'dive');
  const slack = TUNING.body.w - 2; // pode sair/chegar com o corpo meio fora da borda
  const r = {
    profile,
    apex: full.apex,
    airTicks: full.air,
    dist: full.dist,
    tapApex: tap.apex,
    tapDist: tap.dist,
    diveDist: dive.dist,
    gapMax: full.dist + slack,
    diveGapMax: dive.dist + slack,
    stepMax: full.apex - 2,
    diveEndState: dive.state === ST.SLIDE || dive.state === ST.GETUP ? 'slide' : dive.state,
  };
  cache.set(profile, r);
  return r;
}

/** Limites de desenho de fase (plano, seção 5), por slot e perfil. */
export function designLimits(slot, profile = 'normal') {
  if (profile === 'lowg') return { gap: 112, step: 80, gapRising: 100 };
  if (slot === 2) return { gap: 80, step: 48, gapRising: 56 };
  if (slot === 3 || slot === 4) return { gap: 64, step: 40, gapRising: 56 };
  return { gap: 72, step: 40, gapRising: 56 };
}
