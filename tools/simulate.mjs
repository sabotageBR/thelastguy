#!/usr/bin/env node
// Simulador headless: roda fases só com bots e mede/valida (docs/design/motor.md §7).
// Uso: node tools/simulate.mjs [--level=ceu-1] [--all] [--seeds=5] [--difficulty=normal] [--players=32] [--oracle] [--verbose]
import { buildLevel, levelIds, levelMeta } from '../src/sim/levels/catalog.js';
import { World } from '../src/sim/world.js';
import { RaceRules } from '../src/sim/rules/race.js';
import { SurvivalRules } from '../src/sim/rules/survival.js';
import { FinalRules } from '../src/sim/rules/final.js';
import { makeInput } from '../src/sim/input.js';
import { BotController } from '../src/sim/bots/botController.js';
import { assignProfiles } from '../src/sim/bots/profiles.js';
import { ST, STATE_NAMES as ST_NAMES } from '../src/sim/character.js';

const args = process.argv.slice(2);
const opt = (k, d) => {
  const a = args.find((x) => x.startsWith(`--${k}=`));
  return a ? a.split('=')[1] : args.includes(`--${k}`) ? true : d;
};
const seeds = +opt('seeds', 5);
// jogadores por rodada do torneio (32 → 16 → 8 → 4), a menos que --players seja dado
const playersOpt = opt('players', null);
const PLAYERS_BY_SLOT = { 1: 32, 2: 16, 3: 8, 4: 4 };
let players = 32;
const difficulty = opt('difficulty', 'normal');
const verbose = !!opt('verbose', false);
const oracle = !!opt('oracle', false);
const ids = opt('all', false) ? levelIds().filter((id) => levelMeta(id).type !== 'free') : [opt('level', 'ceu-1')];

function makeRules(level) {
  if (level.type === 'race') return new RaceRules({ quota: Math.min(16, Math.floor(players / 2)), timeLimit: Math.max(150, (level.target || 70) * 2) });
  if (level.type === 'survival') return new SurvivalRules({ target: 4, timeLimit: level.timeLimit ?? 90 });
  if (level.type === 'final') return new FinalRules({});
  throw new Error('tipo sem regras: ' + level.type);
}

function median(a) {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
}
function pct(a, p) {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))];
}

let failures = 0;
for (const id of ids) {
  const level = buildLevel(id);
  players = playersOpt ? +playersOpt : PLAYERS_BY_SLOT[level.slot] || 32;
  const agg = { takeoff: {}, ends: [], quotaT: [], finishT: [], falls: [], hits: [], stuck: 0, nan: 0, msTick: [], fallBuckets: new Map(), winners: [], hitSrc: new Map(), stuckAt: new Map() };
  for (let s = 0; s < seeds; s++) {
    const seed = 1000 + s * 7919;
    const roster = Array.from({ length: players }, (_, i) => ({ slot: i, name: `B${i}`, skin: i % 20, lane: i % 4 }));
    const rules = makeRules(level);
    const w = new World(level, { seed, roster, rules });
    const prof = assignProfiles(seed, roster.map((r) => r.slot), difficulty);
    const bots = roster.map((r) => new BotController(w, r.slot, oracle ? { profile: 'oracle' } : prof[r.slot]));
    const inputs = roster.map(() => makeInput());
    const finishT = new Map();
    const lastGround = [];
    const fallLog = [];
    const takeoff = [];
    const wasGrounded = [];
    w.events.drain([]);
    const t0 = process.hrtime.bigint();
    let ticks = 0;
    const limit = 60 * 240;
    const evs = [];
    while (w.status !== 'over' && ticks < limit) {
      for (let i = 0; i < bots.length; i++) bots[i].write(w, i, inputs[i]);
      w.step(inputs);
      ticks++;
      for (const c of w.chars) {
        if (c.grounded && c.active) lastGround[c.slot] = [c.x, c.y];
        if (wasGrounded[c.slot] && !c.grounded && c.active) takeoff[c.slot] = ST_NAMES[c.state];
        wasGrounded[c.slot] = c.grounded;
      }
      evs.length = 0;
      w.events.drain(evs);
      for (const e of evs) {
        if (e.type === 'qualified' && rules.type === 'race') finishT.set(e.slot, rules.elapsed);
        if (e.type === 'fall') {
          const lg = lastGround[e.slot] || [0, 0];
          fallLog.push(`${oracle ? 'oracle' : prof[e.slot].profile}:${lg[0]},${lg[1]}→${e.x},${e.y}[${takeoff[e.slot] || '?'}]`);
          agg.takeoff[takeoff[e.slot] || '?'] = (agg.takeoff[takeoff[e.slot] || '?'] || 0) + 1;
          const b = Math.floor(lg[0] / 64) * 64;
          agg.fallBuckets.set(b, (agg.fallBuckets.get(b) || 0) + 1);
        }
        if (e.type === 'winner') agg.winners.push(e.slot);
        if (e.type === 'stuckRespawn') {
          const k = Math.floor(e.x / 64) * 64;
          agg.stuckAt.set(k, (agg.stuckAt.get(k) || 0) + 1);
        }
        if (e.type === 'hit') {
          const o = w.obstacles.find((ob) => ob.id === e.src);
          const key = `${o ? o.type : '?'}@${Math.floor(e.x / 64) * 64}`;
          agg.hitSrc.set(key, (agg.hitSrc.get(key) || 0) + 1);
        }
      }
      if (ticks % 600 === 0) for (const c of w.chars) if (!Number.isFinite(c.x) || !Number.isFinite(c.y)) agg.nan++;
    }
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    agg.msTick.push(ms / ticks);
    agg.ends.push({ reason: rules.endReason || 'timeout', t: rules.elapsed });
    if (rules.type === 'race') {
      const times = [...finishT.values()];
      agg.finishT.push(...times);
      if (rules.endReason === 'quota') agg.quotaT.push(rules.elapsed);
    }
    for (const c of w.chars) {
      agg.falls.push(c.falls);
      agg.hits.push(c.hits);
      agg.stuck += c.stuckRespawns;
    }
    if (opt('falls', false)) console.log('  quedas (último chão → morte):', fallLog.slice(0, +opt('falls') > 1 ? +opt('falls') : 40).join(' | '));
    if (verbose) console.log(`  seed ${seed}: ${rules.endReason} em ${rules.elapsed.toFixed(1)}s, qualif ${rules.result ? rules.result.qualified.length : 0}, ${(ms / ticks).toFixed(3)} ms/tick`);
  }
  const meta = levelMeta(id);
  const lines = [`${id} (${meta.type}, alvo ${meta.target ?? '-'}s)`];
  const endCounts = {};
  for (const e of agg.ends) endCounts[e.reason] = (endCounts[e.reason] || 0) + 1;
  lines.push(`  fim: ${JSON.stringify(endCounts)}  tempo mediano ${median(agg.ends.map((e) => e.t)).toFixed(1)}s`);
  if (meta.type === 'race') {
    lines.push(`  cota: mediana ${median(agg.quotaT).toFixed(1)}s | chegada p10 ${pct(agg.finishT, 0.1).toFixed(1)} p50 ${median(agg.finishT).toFixed(1)} p90 ${pct(agg.finishT, 0.9).toFixed(1)}s`);
  }
  if (opt('hits', false)) lines.push('  golpes por origem: ' + [...agg.hitSrc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k}:${v}`).join('  '));
  if (agg.stuck) lines.push('  travamentos em: ' + [...agg.stuckAt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k}:${v}`).join('  '));
  lines.push(`  quedas/bot mediana ${median(agg.falls)} (p90 ${pct(agg.falls, 0.9)}) | golpes/bot mediana ${median(agg.hits)} | travados ${agg.stuck} | NaN ${agg.nan}`);
  lines.push(`  ${median(agg.msTick).toFixed(3)} ms/tick (mundo+bots, ${players} jogadores)`);
  lines.push(`  decolagem das quedas: ${JSON.stringify(agg.takeoff)}`);
  const hot = [...agg.fallBuckets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (hot.length) lines.push(`  pontos de queda: ${hot.map(([x, n]) => `${x}:${n}`).join('  ')}`);
  // critérios de aprovação
  const probs = [];
  if (agg.nan) probs.push('NaN nas posições');
  if (meta.type === 'race') {
    if (agg.quotaT.length < seeds) probs.push(`cota não completou em ${seeds - agg.quotaT.length}/${seeds} sementes`);
  }
  if (meta.type === 'final' && agg.winners.length < seeds) probs.push('final sem vencedor');
  if (agg.stuck > seeds * 2) probs.push(`bots travados demais (${agg.stuck})`);
  lines.push(probs.length ? `  FALHOU: ${probs.join('; ')}` : '  ok');
  if (probs.length) failures++;
  console.log(lines.join('\n'));
}
process.exit(failures ? 1 : 0);
