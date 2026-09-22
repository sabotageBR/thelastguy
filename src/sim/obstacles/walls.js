// Paredões estilo Block Dash: ondas de paredes que varrem a arena.
//   LOW  (cheia de 0 a 24 px): pule.   HIGH (aberta abaixo de 28 px): fique no chão.
//   PAIR (baixa e alta, 160 px uma da outra)   CROSSED (dos dois lados ao mesmo tempo).
// Agenda determinística por semente; posição = função pura do tempo (bots preveem).
import { Obstacle } from './base.js';
import { registerObstacle } from './index.js';
import { Solid } from '../physics/solid.js';
import { Rng, hash32 } from '../../core/rng.js';
import { stepwise } from '../../core/dmath.js';

const POOL = 16;

/**
 * def: { x0, x1 (limites da arena), y (topo do chão), thick, lowH, highGap, highTop,
 *        schedule: [{ t, interval, speed, types: {low, high, pair, crossed, double} }] }
 */
export class Walls extends Obstacle {
  constructor(def, world, id) {
    super(def, world, id);
    this.x0 = def.x0;
    this.x1 = def.x1;
    this.gy = def.y;
    this.thick = def.thick ?? 32;
    this.lowH = def.lowH ?? 24;
    this.highGap = def.highGap ?? 28;
    this.highTop = def.highTop ?? 144;
    this.schedule = def.schedule;
    this.start = def.start ?? 1.0; // s depois do VAI!
    this.depth = 'span';
    this.waves = [];
    this.pool = [];
    this.world = world;
    this.buildWaves(world);
  }

  buildWaves(world) {
    const r = new Rng(hash32(world.seed, this.id, 'walls'));
    let t = this.start;
    const end = 200;
    let side = r.chance(0.5) ? 1 : -1;
    while (t < end) {
      const st = stepwise(this.schedule.map((s) => [s.t, s]), t);
      const P = st.types;
      const u = r.next();
      let kind = 'low';
      const total = P.low + P.high + (P.pair || 0) + (P.crossed || 0);
      let acc = P.low / total;
      if (u < acc) kind = 'low';
      else if (u < (acc += P.high / total)) kind = 'high';
      else if (u < (acc += (P.pair || 0) / total)) kind = 'pair';
      else kind = 'crossed';
      if (st.alternate) side = -side;
      else if (r.chance(0.3)) side = -side;
      const pieces = [];
      const spd = st.speed;
      if (kind === 'low' || kind === 'high') pieces.push({ type: kind, dir: side, delay: 0 });
      else if (kind === 'pair') {
        const first = r.chance(0.5) ? 'low' : 'high';
        pieces.push({ type: first, dir: side, delay: 0 });
        pieces.push({ type: first === 'low' ? 'high' : 'low', dir: side, delay: 160 / spd });
      } else {
        const a = r.chance(0.5) ? 'low' : 'high';
        pieces.push({ type: a, dir: 1, delay: 0 });
        pieces.push({ type: a === 'low' ? 'high' : 'low', dir: -1, delay: 0 });
      }
      if (st.double && r.chance(st.double) && kind !== 'crossed') {
        pieces.push({ type: r.chance(0.5) ? 'low' : 'high', dir: side, delay: (st.interval * 0.5) });
      }
      for (const p of pieces) this.waves.push({ t: t + p.delay, type: p.type, dir: p.dir, speed: spd, idx: this.waves.length });
      t += st.interval;
    }
    this.waves.sort((a, b) => a.t - b.t);
    this.waves.forEach((w, i) => (w.idx = i));
  }

  init(world) {
    const env = { x: this.x0 - 80, y: this.gy - this.highTop - 8, w: this.x1 - this.x0 + 160, h: this.highTop + 16 };
    this.env = env;
    for (let i = 0; i < POOL; i++) {
      const s = new Solid({ x: -9999, y: 0, w: this.thick, h: 8, kind: 'wall', owner: this, impart: 1.0 });
      s.active = false;
      this.pool.push(s);
      world.addKinematic(s, env);
    }
  }

  /** Geometria da onda w no tempo absoluto de jogo g (s desde o VAI!). null se fora. */
  waveRect(w, g, out) {
    const age = g - w.t;
    if (age < 0) return null;
    const span = this.x1 - this.x0 + this.thick * 2 + 64;
    const d = age * w.speed;
    if (d > span) return null;
    out.x = w.dir > 0 ? this.x0 - this.thick - 32 + d : this.x1 + 32 - d;
    if (w.type === 'low') {
      out.y = this.gy - this.lowH;
      out.h = this.lowH;
    } else {
      out.y = this.gy - this.highTop;
      out.h = this.highTop - this.highGap;
    }
    out.w = this.thick;
    out.vx = w.dir * w.speed;
    return out;
  }

  gameTime(t) {
    const r = this.world.rules;
    if (!r) return t;
    // tempo de jogo = t menos a contagem regressiva
    return t - r.countdown / 60;
  }

  /** Chama cb(solid, x, y) para cada peça ativa no tempo t (pool fixo por índice da onda). */
  forEachActive(t, cb) {
    const g = this.gameTime(t);
    const o = this._r || (this._r = {});
    // ondas que podem estar ativas: t - vida máxima ≤ onda.t ≤ g
    const maxLife = (this.x1 - this.x0 + 200) / 80;
    for (let i = 0; i < this.waves.length; i++) {
      const w = this.waves[i];
      if (w.t > g) break;
      if (w.t < g - maxLife) continue;
      if (!this.waveRect(w, g, o)) continue;
      cb(this.pool[w.idx % POOL], w, o);
    }
  }

  update(world, t) {
    const seen = this._seen || (this._seen = new Array(POOL).fill(false));
    seen.fill(false);
    this.forEachActive(t, (s, w, o) => {
      const k = w.idx % POOL;
      seen[k] = true;
      if (!s.active || s.wave !== w.idx) {
        // entra em cena: posiciona sem empurrar ninguém
        s.wave = w.idx;
        s.active = true;
        s.x = Math.round(o.x);
        s.y = Math.round(o.y);
        s.h = o.h;
        s.w = o.w;
        s.snap = true;
        s.lowWall = w.type === 'low';
        return;
      }
      s.h = o.h;
      world.moveSolid(s, o.x, o.y);
    });
    for (let k = 0; k < POOL; k++) {
      if (!seen[k] && this.pool[k].active) {
        this.pool[k].active = false;
        this.pool[k].x = -9999;
      }
    }
  }

  futureSolids(t, cb) {
    this.forEachActive(t, (s, w, o) => {
      if (s.wave === w.idx && s.active) cb(s, Math.round(o.x), Math.round(o.y));
    });
  }

  /** Segurança para bots: longe das bordas e fora do caminho das paredes baixas próximas. */
  safety(x, y, t) {
    let s = 0;
    const g = this.gameTime(t);
    const o = this._rs || (this._rs = {});
    for (let i = 0; i < this.waves.length; i++) {
      const w = this.waves[i];
      if (w.t > g + 0.6) break;
      if (!this.waveRect(w, g, o)) continue;
      const dx = (x - o.x) * Math.sign(o.vx);
      if (dx > 0 && dx < 120) s -= w.type === 'low' ? 6 : 2;
    }
    return s;
  }

  bounds() {
    return this.env;
  }

  serialize() {
    return null; // tudo é função do tempo + semente
  }
}
registerObstacle('walls', Walls);
