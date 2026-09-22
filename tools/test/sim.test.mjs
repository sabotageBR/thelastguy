// Testes da simulação: determinismo, snapshot (ida e volta), colocações do torneio e validação das fases.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLevel, levelIds, levelMeta } from '../../src/sim/levels/catalog.js';
import { World } from '../../src/sim/world.js';
import { RaceRules } from '../../src/sim/rules/race.js';
import { SurvivalRules } from '../../src/sim/rules/survival.js';
import { FinalRules } from '../../src/sim/rules/final.js';
import { makeInput } from '../../src/sim/input.js';
import { BotController } from '../../src/sim/bots/botController.js';
import { assignProfiles } from '../../src/sim/bots/profiles.js';
import { snapshot, restore, hashWorld } from '../../src/sim/snapshot.js';
import { Tournament } from '../../src/sim/tournament.js';
import { validateLevel } from '../../src/sim/levels/validate.js';

function rulesFor(level, n) {
  if (level.type === 'race') return new RaceRules({ quota: Math.max(1, Math.floor(n / 2)), timeLimit: 150 });
  if (level.type === 'survival') return new SurvivalRules({ target: Math.max(1, Math.floor(n / 2)), timeLimit: 90 });
  return new FinalRules({});
}

function makeMatch(id, n, seed) {
  const level = buildLevel(id);
  const roster = Array.from({ length: n }, (_, i) => ({ slot: i, name: `B${i}`, skin: i % 20, lane: i % 4 }));
  const world = new World(level, { seed, roster, rules: rulesFor(level, n) });
  const prof = assignProfiles(seed, roster.map((r) => r.slot), 'normal');
  const bots = roster.map((r) => new BotController(world, r.slot, prof[r.slot]));
  const inputs = roster.map(() => makeInput());
  return { world, bots, inputs };
}

/** Avança com os bots; devolve [hashes a cada `every` ticks] e grava as entradas usadas. */
function run(m, ticks, every, log) {
  const hashes = [];
  for (let k = 1; k <= ticks; k++) {
    for (let i = 0; i < m.bots.length; i++) m.bots[i].write(m.world, i, m.inputs[i]);
    if (log) log.push(m.inputs.map((x) => ({ ...x })));
    m.world.step(m.inputs);
    m.world.events.drain([]);
    if (k % every === 0) hashes.push(hashWorld(m.world));
  }
  return hashes;
}

test('mesma semente → mesmos hashes (determinismo com bots)', () => {
  for (const id of ['ceu-1', 'vulc-1']) {
    const a = run(makeMatch(id, 8, 4242), 600, 100);
    const b = run(makeMatch(id, 8, 4242), 600, 100);
    assert.deepEqual(a, b, id);
    const c = run(makeMatch(id, 8, 777), 600, 100);
    assert.notDeepEqual(a, c, `${id}: sementes diferentes deveriam divergir`);
  }
});

test('snapshot: restaurar num mundo novo e repetir as entradas dá o mesmo estado', () => {
  for (const [id, n] of [
    ['gelo-1', 8],
    ['vulc-1', 8],
    ['gelo-4', 4],
    ['selva-4', 4],
    ['esp-3', 6],
  ]) {
    const A = makeMatch(id, n, 99);
    run(A, 420, 1000);
    const snap = JSON.parse(JSON.stringify(snapshot(A.world))); // precisa sobreviver a JSON
    const log = [];
    const ha = run(A, 360, 60, log);
    const B = makeMatch(id, n, 99);
    restore(B.world, snap);
    const hb = [];
    log.forEach((inputs, k) => {
      B.world.step(inputs);
      B.world.events.drain([]);
      if ((k + 1) % 60 === 0) hb.push(hashWorld(B.world));
    });
    assert.deepEqual(hb, ha, id);
  }
});

test('torneio: colocações formam uma permutação de 1 a 32', () => {
  for (const seed of [1, 2, 3, 99]) {
    for (const mode of ['world', 'quick']) {
      const t = new Tournament({ seed, mode, world: 'selva' });
      t.fastResolve();
      const places = [...t.placement].sort((a, b) => a - b);
      assert.deepEqual(places, Array.from({ length: 32 }, (_, i) => i + 1), `${mode} ${seed}`);
      assert.equal(t.placement[t.winner], 1);
    }
  }
});

test('as 20 fases existem e nenhuma tem vão impossível', () => {
  const ids = levelIds().filter((id) => levelMeta(id).type !== 'free');
  assert.equal(ids.length, 20);
  for (const id of ids) {
    const bad = validateLevel(buildLevel(id)).filter((p) => p.severity === 'impossível');
    assert.equal(bad.length, 0, `${id}: ${bad.map((p) => p.msg).join('; ')}`);
  }
});

test('protocolo: entrada cabe em 2 bytes e volta igual', async () => {
  const { packInput, unpackInput } = await import('../../src/net/protocol.js');
  const out = makeInput();
  for (const inp of [
    { move: -1, jump: true, jumpHeld: true, dive: false, emote: 0 },
    { move: 0.5, jump: false, jumpHeld: true, dive: true, emote: 3 },
    { move: 0, jump: false, jumpHeld: false, dive: false, emote: 4 },
  ]) {
    const bits = packInput(inp);
    assert.ok(bits >= 0 && bits < 65536);
    unpackInput(bits, out);
    assert.ok(Math.abs(out.move - inp.move) < 0.01);
    assert.equal(out.jump, inp.jump);
    assert.equal(out.jumpHeld, inp.jumpHeld);
    assert.equal(out.dive, inp.dive);
    assert.equal(out.emote, inp.emote);
  }
});

test('LocalSession roda a partida igual ao mundo + bots direto', async () => {
  const { LocalSession } = await import('../../src/net/session.js');
  const level = buildLevel('ceu-1');
  const roster = Array.from({ length: 6 }, (_, i) => ({ slot: i, name: `B${i}`, skin: i, lane: i % 4 }));
  const profiles = assignProfiles(5, roster.map((r) => r.slot), 'normal');
  const s = new LocalSession({ level, seed: 5, roster, rules: rulesFor(level, 6), humanSlot: null, profiles });
  s.start();
  for (let i = 0; i < 300; i++) s.advance(1 / 60);
  const m = makeMatch('ceu-1', 6, 5);
  run(m, s.world.tick, 1000);
  assert.equal(hashWorld(s.world), hashWorld(m.world));
});
