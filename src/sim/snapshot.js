// Snapshot do estado dinâmico de um World (para replay, testes de determinismo e, no futuro,
// sincronização em rede). A geometria e os obstáculos "puros" (funções do tempo) não entram:
// saem do matchConfig { seed, levelId, rules, roster }. Entram: personagens, sólidos que se mexem,
// obstáculos com estado (serialize/deserialize), regras e o RNG da partida.
import { Character } from './character.js';
import { Solid, Ramp } from './physics/solid.js';

/** Converte referências (personagens, sólidos, rampas) em marcadores; resto vira JSON puro. */
function encode(v, ctx) {
  if (v === null || typeof v !== 'object') return typeof v === 'function' ? undefined : v;
  if (v instanceof Character) return { $c: v.slot };
  if (v instanceof Solid || v instanceof Ramp) {
    const i = ctx.index.get(v);
    return i === undefined ? null : { $s: i };
  }
  if (Array.isArray(v)) return v.map((x) => encode(x, ctx));
  if (v instanceof Set) return { $set: [...v].map((x) => encode(x, ctx)) };
  const o = {};
  for (const k of Object.keys(v)) {
    if (k === 'world' || k.startsWith('_')) continue;
    const e = encode(v[k], ctx);
    if (e !== undefined) o[k] = e;
  }
  return o;
}

function decode(v, ctx) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map((x) => decode(x, ctx));
  if ('$c' in v) return ctx.world.bySlot[v.$c];
  if ('$s' in v) return ctx.list[v.$s] || null;
  if ('$set' in v) return new Set(v.$set.map((x) => decode(x, ctx)));
  const o = {};
  for (const k of Object.keys(v)) o[k] = decode(v[k], ctx);
  return o;
}

function context(world) {
  const list = [...world.space.solids, ...world.space.ramps];
  const index = new Map();
  list.forEach((s, i) => index.set(s, i));
  return { world, list, index };
}

/** Estado dinâmico do mundo como objeto JSON (sem referências). */
export function snapshot(world) {
  const ctx = context(world);
  // o personagem em si vira campos (encode() transformaria a referência num marcador)
  const chars = world.chars.map((c) => {
    const o = {};
    for (const k of Object.keys(c)) {
      const e = encode(c[k], ctx);
      if (e !== undefined) o[k] = e;
    }
    return o;
  });
  const solids = world.space.solids.map((s) => [s.x, s.y, s.px, s.py, s.vx, s.vy, s.active, s.riders, s.bounce, s.mat, s.kind, s.snap]);
  const ramps = world.space.ramps.map((r) => [r.x0, r.y0, r.x1, r.y1, r.active, r.vx, r.vy]);
  const obstacles = world.obstacles.map((o) => (o.serialize ? encode(o.serialize(), ctx) : null));
  const rules = world.rules ? encode(world.rules, ctx) : null;
  return { v: 1, tick: world.tick, t: world.t, status: world.status, rng: world.rng.serialize(), chars, solids, ramps, obstacles, rules };
}

/** Aplica um snapshot num mundo construído com o mesmo matchConfig. */
export function restore(world, snap) {
  const ctx = context(world);
  world.tick = snap.tick;
  world.t = snap.t;
  world.status = snap.status;
  world.rng.deserialize(snap.rng);
  snap.solids.forEach((a, i) => {
    const s = world.space.solids[i];
    [s.x, s.y, s.px, s.py, s.vx, s.vy, s.active, s.riders, s.bounce, s.mat, s.kind, s.snap] = a;
  });
  snap.ramps.forEach((a, i) => {
    const r = world.space.ramps[i];
    [r.x0, r.y0, r.x1, r.y1, r.active, r.vx, r.vy] = a;
  });
  snap.chars.forEach((cs) => {
    const c = world.bySlot[cs.slot];
    const d = decode(cs, ctx);
    for (const k of Object.keys(d)) c[k] = d[k];
    if (!('ground' in d)) c.ground = null;
    if (!('ignore' in d)) c.ignore = null;
  });
  snap.obstacles.forEach((os, i) => {
    const o = world.obstacles[i];
    if (os !== null && o.deserialize) o.deserialize(decode(os, ctx));
  });
  if (snap.rules && world.rules) {
    const d = decode(snap.rules, ctx);
    for (const k of Object.keys(d)) world.rules[k] = d[k];
  }
  world.events.drain([]);
}

/** Hash FNV-1a (32 bits) do estado relevante — igual em duas execuções = determinístico. */
export function hashWorld(world) {
  let h = 0x811c9dc5;
  const mix = (n) => {
    // números viram inteiros de milésimos (estável entre execuções)
    let v = typeof n === 'number' ? Math.round(n * 1000) | 0 : n === true ? 1 : n === false ? 0 : 0;
    for (let k = 0; k < 4; k++) {
      h ^= v & 255;
      h = Math.imul(h, 0x01000193);
      v >>>= 8;
    }
  };
  mix(world.tick);
  for (const c of world.chars) {
    mix(c.x);
    mix(c.y);
    mix(c.vx);
    mix(c.vy);
    mix(c.state);
    mix(c.alive);
    mix(c.finished);
    mix(c.checkpoint);
  }
  for (const s of world.space.solids) {
    if (!s.kinematic && !s.owner) continue;
    mix(s.x);
    mix(s.y);
    mix(s.active);
  }
  const str = JSON.stringify(world.obstacles.map((o) => (o.serialize ? o.serialize() : 0)));
  for (let i = 0; i < str.length; i++) mix(str.charCodeAt(i));
  return h >>> 0;
}
