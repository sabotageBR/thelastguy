import { test } from 'node:test';
import assert from 'node:assert/strict';
import { measureLimits } from '../../src/sim/limits.js';
import { LevelBuilder } from '../../src/sim/levels/builder.js';
import { World } from '../../src/sim/world.js';
import { FreeRules } from '../../src/sim/rules/common.js';
import { makeInput } from '../../src/sim/input.js';
import { ST } from '../../src/sim/character.js';

function near(v, target, tol, label) {
  assert.ok(Math.abs(v - target) <= tol, `${label}: ${v} fora de ${target}±${tol}`);
}

test('limites de pulo (normal) batem com os alvos do plano', () => {
  const L = measureLimits('normal');
  near(L.apex, 60, 5, 'apex');
  near(L.dist, 90, 10, 'alcance');
  near(L.tapApex, 25, 7, 'apex do pulo curto');
  assert.ok(L.diveDist >= L.dist + 25, `mergulho deve somar ≥25 px (${L.diveDist} vs ${L.dist})`);
  assert.ok(L.gapMax >= 88, `vão máximo teórico ${L.gapMax}`);
});

test('limites de pulo (gravidade baixa)', () => {
  const L = measureLimits('lowg');
  near(L.apex, 80, 9, 'apex lowg');
  near(L.dist, 140, 16, 'alcance lowg');
});

function worldWith(build, profile = 'normal') {
  const b = new LevelBuilder({ id: 't', physics: profile, type: 'free' });
  build(b);
  const lvl = b.build();
  return new World(lvl, { seed: 3, roster: [{ slot: 0, human: true }], rules: new FreeRules() });
}

function run(w, ticks, fn) {
  const inp = makeInput();
  for (let i = 0; i < ticks; i++) {
    inp.jump = false;
    fn(inp, i, w.chars[0]);
    w.step([inp]);
  }
}

test('corre, pula um vão de 72 px e aterrissa', () => {
  const w = worldWith((b) => {
    b.block(0, 0, 200);
    b.block(272, 0, 300);
    b.arenaSpawns(20, 30, 0, 1);
  });
  const c = w.chars[0];
  let jumped = false;
  run(w, 200, (inp, i, ch) => {
    inp.move = 1;
    if (!jumped && ch.grounded && ch.x >= 195) {
      inp.jump = true;
      jumped = true;
    }
    inp.jumpHeld = true;
  });
  assert.ok(jumped, 'pulou');
  assert.ok(c.x > 300 && c.alive && c.active, `atravessou (x=${c.x}, state=${c.state})`);
  assert.equal(c.falls, 0);
});

test('sobe e desce rampa de 45°, e cai no vazio volta ao início', () => {
  const w = worldWith((b) => {
    b.block(0, 0, 100);
    b.ramp(100, 0, 160, 60);
    b.block(160, 60, 100);
    b.ramp(260, 60, 380, 0);
    b.block(380, 0, 100);
    b.arenaSpawns(20, 30, 0, 1);
  });
  const c = w.chars[0];
  let maxH = 0;
  run(w, 240, (inp) => {
    inp.move = 1;
    maxH = Math.max(maxH, -c.y);
  });
  assert.ok(maxH >= 59, `subiu a rampa (h=${maxH})`);
  assert.ok(c.x > 400, `chegou ao fim (x=${c.x})`);
  // continua correndo e cai do fim
  run(w, 200, (inp) => {
    inp.move = 1;
  });
  assert.ok(c.falls >= 1, 'caiu no vazio');
});

test('plataforma one-way: atravessa subindo e aterrissa em cima', () => {
  const w = worldWith((b) => {
    b.block(0, 0, 400);
    b.oneway(60, 40, 80);
    b.arenaSpawns(100, 101, 0, 1);
  });
  const c = w.chars[0];
  let pressed = false;
  run(w, 90, (inp) => {
    if (!pressed && c.grounded) {
      inp.jump = true;
      pressed = true;
    }
    inp.jumpHeld = true;
  });
  assert.equal(c.y, -40, `em cima da one-way (y=${c.y})`);
  assert.ok(c.grounded);
});

test('mergulho no ar vira deslize e levanta', () => {
  const w = worldWith((b) => {
    b.block(-100, 0, 1200);
    b.arenaSpawns(20, 21, 0, 1);
  });
  const c = w.chars[0];
  const seen = new Set();
  let step = 0;
  run(w, 150, (inp) => {
    step++;
    inp.move = 1;
    inp.jumpHeld = true;
    if (step === 40) inp.jump = true;
    if (step === 52) inp.jump = true; // segundo toque no ar → mergulho
    seen.add(c.state);
  });
  assert.ok(seen.has(ST.DIVE), 'mergulhou');
  assert.ok(seen.has(ST.SLIDE), 'deslizou');
  assert.ok(seen.has(ST.GETUP), 'levantou');
});
