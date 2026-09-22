// Gerador de objetos rolantes (chicletes, troncos, pedras, bolas de neve).
// A trajetória é simulada uma vez contra o terreno ESTÁTICO na criação e
// repetida para cada objeto: posição = função pura do tempo (bots conseguem prever).
import { Obstacle, makeHazard } from './base.js';
import { registerObstacle } from './index.js';
import { circleBox } from '../physics/shapes.js';
import { hashFloat } from '../../core/rng.js';
import { DT } from '../../core/constants.js';

/**
 * def: { x, y (ponto de nascimento, no chão), dir (±1), speed, r, interval (s),
 *        t0 (s), grow (r final; bolas de neve), giantEvery, giantR, giantTier, maxLife (s),
 *        trigger: x (só começa quando alguém passar de x; perseguição),
 *        gameClock (t0/until contam a partir do VAI!), until (s: não nasce mais depois) }
 * Bolas largas passam por cima de buracos estreitos (apoio em ±0,8 r): nichos para se esconder.
 */
export class Roller extends Obstacle {
  constructor(def, world, id) {
    super(def, world, id);
    this.dir = def.dir ?? -1;
    this.speed = def.speed ?? 120;
    this.r = def.r ?? 12;
    this.grow = def.grow ?? this.r;
    this.interval = def.interval ?? 2;
    this.t0 = def.t0 ?? 0;
    this.giantEvery = def.giantEvery ?? 0;
    this.giantR = def.giantR ?? 32;
    this.maxLife = def.maxLife ?? 16;
    this.tier = def.tier || 'heavy';
    this.giantTier = def.giantTier || this.tier;
    this.until = def.until ?? Infinity;
    this.trigger = def.trigger ?? null;
    this.triggerT = this.trigger === null ? 0 : -1;
    this.depth = 'span';
    this.world = world;
  }

  /** Simula o caminho de um objeto de raio r contra o terreno estático. */
  bake(world, r) {
    const sp = world.space;
    const xs = [];
    const ys = [];
    let x = this.x;
    let y = this.y;
    let vx = this.dir * this.speed;
    let vy = 0;
    const g = world.phys.gFall;
    const n = Math.round(this.maxLife / DT);
    const kill = world.level.killY;
    const b = world.level.bounds;
    const hw = Math.max(3, Math.round(r * 0.8));
    for (let i = 0; i < n; i++) {
      xs.push(x);
      ys.push(y);
      // chão sob a bola (só estático; apoio largo = atravessa buracos estreitos)
      const d = groundStatic(sp, Math.round(x), Math.round(y) - 2, hw, 6);
      if (d >= 0 && vy >= 0) {
        const gy = Math.round(y) - 2 + d;
        // inclinação sob o objeto: acelera descendo
        const dA = groundStatic(sp, Math.round(x + this.dir * 4), gy - 6, 1, 14);
        const slope = dA >= 0 ? (gy - 6 + dA - gy) / 4 : 0;
        vx += this.dir * slope * g * 0.45 * DT;
        const cap = this.speed * 1.4;
        if (Math.abs(vx) > cap) vx = Math.sign(vx) * cap;
        if (Math.sign(vx) !== this.dir || Math.abs(vx) < this.speed * 0.6) vx = this.dir * this.speed * 0.6;
        y = gy;
        vy = 0;
      } else {
        vy = Math.min(vy + g * DT, 420);
        y += vy * DT;
      }
      // parede à frente: some (obstáculos baixos, até 0,6 r, a bola grande atropela)
      const wall = sp.solidAt(Math.round(x + this.dir * r), Math.round(y - r * 1.4), Math.round(x + this.dir * (r + 2)), Math.round(y - Math.max(3, r * 0.6)));
      if (wall && !wall.kinematic && !wall.owner) break;
      x += vx * DT;
      if (y > kill || x < b.x0 || x > b.x1) break;
    }
    return { xs: Float32Array.from(xs), ys: Float32Array.from(ys), n: xs.length };
  }

  init(world) {
    this.path = this.bake(world, this.r);
    this.giantPath = this.giantEvery ? this.bake(world, this.giantR) : null;
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const p of [this.path, this.giantPath]) {
      if (!p) continue;
      for (let i = 0; i < p.n; i++) {
        x0 = Math.min(x0, p.xs[i]);
        x1 = Math.max(x1, p.xs[i]);
        y0 = Math.min(y0, p.ys[i]);
        y1 = Math.max(y1, p.ys[i]);
      }
    }
    const R = Math.max(this.grow, this.giantEvery ? this.giantR : 0) + 4;
    this.env = { x: x0 - R, y: y0 - R * 2, w: x1 - x0 + R * 2, h: y1 - y0 + R * 2 + 4 };
    const self = this;
    const tmp = {};
    const hazard = (giant) =>
      makeHazard(this, {
        tier: giant ? this.giantTier : this.tier,
        env: this.env,
        test(box, t, out) {
          self.liveRange(t);
          const k1 = self._k1;
          for (let k = self._k0; k <= k1; k++) {
            const it = self.instance(k, t, tmp);
            if (!it || it.giant !== giant) continue;
            if (circleBox(it.x, it.y - it.r, it.r, box, out)) {
              out.vx = it.vx;
              out.vy = 0;
              return true;
            }
          }
          return false;
        },
      });
    world.addHazard(hazard(false));
    if (this.giantEvery) world.addHazard(hazard(true));
    this._list = [];
  }

  startTime() {
    const base = this.def.gameClock && this.world.rules ? this.world.rules.countdown / 60 : 0;
    return base + this.t0 + (this.triggerT > 0 ? this.triggerT : 0);
  }

  /** Faixa [_k0, _k1] dos objetos possivelmente vivos em t (sem alocar; _k1 < _k0 = nenhum). */
  liveRange(t) {
    this._k0 = 0;
    this._k1 = -1;
    if (this.triggerT < 0) return;
    const start = this.startTime();
    if (t < start) return;
    let kMax = Math.floor((t - start) / this.interval);
    if (this.until < Infinity) kMax = Math.min(kMax, Math.ceil((this.until - this.t0) / this.interval) - 1);
    this._k0 = Math.max(0, Math.floor((t - start - this.maxLife) / this.interval));
    this._k1 = kMax;
  }

  /** Índices k dos objetos vivos em t (para o render). */
  instances(t) {
    const out = this._list;
    out.length = 0;
    this.liveRange(t);
    for (let k = this._k0; k <= this._k1; k++) out.push(k);
    return out;
  }

  /** Estado do objeto k em t (ou null se já sumiu). */
  instance(k, t, out) {
    const jit = this._jit || (this._jit = []);
    let jitter = jit[k];
    if (jitter === undefined) jitter = jit[k] = hashFloat(this.world.seed, this.id, k) * this.interval * 0.25;
    const spawn = this.startTime() + k * this.interval + jitter;
    const age = t - spawn;
    if (age < 0) return null;
    const giant = this.giantEvery && (k + 1) % this.giantEvery === 0;
    const p = giant ? this.giantPath : this.path;
    const i = Math.floor(age / DT);
    if (i >= p.n - 1) return null;
    const f = age / DT - i;
    out.x = p.xs[i] + (p.xs[i + 1] - p.xs[i]) * f;
    out.y = p.ys[i] + (p.ys[i + 1] - p.ys[i]) * f;
    out.vx = (p.xs[i + 1] - p.xs[i]) / DT;
    const base = giant ? this.giantR : this.r;
    const dist = Math.abs(out.x - this.x);
    out.r = giant ? base : base + (this.grow - base) * Math.min(1, dist / 480);
    out.giant = !!giant;
    out.angle = (out.x - this.x) / out.r;
    return out;
  }

  update(world) {
    if (this.triggerT < 0 && world.rules && world.rules.phase === 'running') {
      for (const c of world.chars) {
        if (c.active && c.x >= this.trigger) {
          this.triggerT = world.t;
          world.events.push('boulder', world.tick, { x: this.x, y: this.y, src: this.id });
          break;
        }
      }
    }
  }

  serialize() {
    return [this.triggerT];
  }

  deserialize(o) {
    [this.triggerT] = o;
  }

  bounds() {
    return this.env;
  }
}
registerObstacle('roller', Roller);

/** Distância até o chão estático (sólidos não cinemáticos — inclusive ladrilhos — e rampas estáticas). */
function groundStatic(sp, x, y, hw, maxDist) {
  const tmp = sp._tmp;
  const n = sp.solidGrid.queryInto(x - hw, y, x + hw, y + maxDist + 1, tmp);
  let best = -1;
  for (let i = 0; i < n; i++) {
    const s = tmp[i];
    if (!s.active || s.kinematic) continue;
    if (x - hw < s.x + s.w && x + hw > s.x && s.y >= y && s.y <= y + maxDist) {
      const d = s.y - y;
      if (best < 0 || d < best) best = d;
    }
  }
  const tmp2 = sp._tmp2;
  const m = sp.rampGrid.queryInto(x, y, x + 1, y + maxDist + 1, tmp2);
  for (let i = 0; i < m; i++) {
    const r = tmp2[i];
    if (!r.active || r.dynamic) continue;
    const sy = r.surfaceY(x);
    if (sy === sy && sy >= y && sy <= y + maxDist) {
      const d = sy - y;
      if (best < 0 || d < best) best = d;
    }
  }
  return best;
}
