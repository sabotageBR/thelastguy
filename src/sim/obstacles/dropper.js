// Perigos que caem com aviso: pingentes (posições fixas que tremem, caem e voltam a crescer),
// meteoros e bombas (agenda por semente, marcador no chão; podem destruir ladrilhos).
import { Obstacle, makeHazard } from './base.js';
import { registerObstacle } from './index.js';
import { circleBox, aabbBox } from '../physics/shapes.js';
import { Rng, hash32 } from '../../core/rng.js';
import { stepwise, mod } from '../../core/dmath.js';

/**
 * Pingentes em posições fixas. def: { xs: [x...], y (teto), ground (y do chão), shake, fall, regrow,
 *   stagger (s entre pingentes), w (largura), tier }
 * Ciclo por pingente: pendurado → treme (aviso) → cai (queda) → quebra → cresce de novo.
 */
export class Icicles extends Obstacle {
  constructor(def, world, id) {
    super(def, world, id);
    this.xs = def.xs;
    this.top = def.y;
    this.ground = def.ground;
    this.shake = def.shake ?? 0.8;
    this.fall = def.fall ?? 0.35;
    this.regrow = def.regrow ?? 2.5;
    this.hang = def.hang ?? 0.6;
    this.stagger = def.stagger ?? 0.4;
    this.w = def.w ?? 10;
    this.len = def.len ?? 18;
    this.tier = def.tier || 'light';
    this.T = this.hang + this.shake + this.fall + this.regrow;
    this.depth = 'span';
  }

  /** Estado do pingente i em t: { s: 'hang'|'shake'|'fall'|'grow', k (0..1), y (ponta) }. */
  stateAt(i, t, out = {}) {
    let u = mod(t + i * this.stagger + this.phase * this.T, this.T);
    out.y = this.top + this.len;
    if (u < this.hang) {
      out.s = 'hang';
      out.k = u / this.hang;
      return out;
    }
    u -= this.hang;
    if (u < this.shake) {
      out.s = 'shake';
      out.k = u / this.shake;
      return out;
    }
    u -= this.shake;
    if (u < this.fall) {
      const k = u / this.fall;
      out.s = 'fall';
      out.k = k;
      out.y = this.top + this.len + (this.ground - this.top - this.len) * k * k;
      return out;
    }
    u -= this.fall;
    out.s = 'grow';
    out.k = u / this.regrow;
    return out;
  }

  init(world) {
    const self = this;
    const x0 = Math.min(...this.xs) - this.w;
    const x1 = Math.max(...this.xs) + this.w;
    this.env = { x: x0, y: this.top, w: x1 - x0, h: this.ground - this.top + 4 };
    const st = {};
    world.addHazard(
      makeHazard(this, {
        tier: this.tier,
        knock: 'fixed',
        dirX: 0,
        dirY: -1,
        env: this.env,
        test(box, t, out) {
          for (let i = 0; i < self.xs.length; i++) {
            self.stateAt(i, t, st);
            if (st.s !== 'fall') continue;
            if (aabbBox(self.xs[i] - self.w / 2, st.y - self.len, self.w, self.len, box, out)) {
              out.vx = 0;
              out.vy = 300;
              return true;
            }
          }
          return false;
        },
      }),
    );
  }

  bounds() {
    return this.env;
  }
}
registerObstacle('icicles', Icicles);

/**
 * Chuva de meteoros/bombas/bolas de neve em arco: agenda determinística.
 * def: { x0, x1 (faixa), ground (y do impacto), top (y de onde caem), schedule: [[t, intervalo], ...],
 *   warn: [[t, s], ...], radius, aimChance, lines: [[t, cada N s]], big: [[t, cada N s]], bigRadius,
 *   destroys (true: abre buraco nos ladrilhos), tier, look: 'meteor'|'bomb'|'snow'|'debris' }
 */
export class Bombard extends Obstacle {
  constructor(def, world, id) {
    super(def, world, id);
    this.x0 = def.x0;
    this.x1 = def.x1;
    this.ground = def.ground;
    this.top = def.top ?? def.ground - 260;
    this.radius = def.radius ?? 24;
    this.bigRadius = def.bigRadius ?? 40;
    this.tier = def.tier || 'heavy';
    this.destroys = !!def.destroys;
    this.look = def.look || 'meteor';
    this.flight = def.flight ?? 0.45;
    this.depth = 'front';
    this.events = [];
    this.world = world;
    this.build(def, world);
  }

  build(def, world) {
    const r = new Rng(hash32(world.seed, this.id, 'bombard'));
    const start = def.start ?? 2;
    const end = def.end ?? 200;
    let t = start;
    const sched = def.schedule || [[0, 1.5]];
    const warnS = def.warn || [[0, 1.0]];
    while (t < end) {
      const interval = stepwise(sched, t);
      const warn = stepwise(warnS, t);
      const big = def.big && stepwise(def.big, t) > 0 && r.chance(interval / stepwise(def.big, t));
      const x = this.x0 + r.next() * (this.x1 - this.x0);
      this.events.push({ impact: t + warn, warn, x, aim: r.chance(def.aimChance ? stepwise(def.aimChance, t) : 0), r: big ? this.bigRadius : this.radius, big, seed: r.int(1 << 30) });
      if (def.lines && stepwise(def.lines, t) > 0 && r.chance(interval / stepwise(def.lines, t))) {
        const lx = this.x0 + r.next() * (this.x1 - this.x0 - 160);
        for (let k = 0; k < 5; k++) this.events.push({ impact: t + warn + k * 0.18, warn, x: lx + k * 40, r: this.radius, line: true });
      }
      t += interval;
    }
    this.events.sort((a, b) => a.impact - b.impact);
    this.resolved = new Set();
  }

  gameTime(t) {
    const r = this.world.rules;
    return r ? t - r.countdown / 60 : t;
  }

  /** Posição do evento e no tempo de jogo g: fase ('warn' | 'fall' | 'boom'). */
  phaseOf(e, g) {
    const dt = g - e.impact;
    if (dt < -e.warn) return null;
    if (dt < -this.flight) return 'warn';
    if (dt < 0) return 'fall';
    if (dt < 0.15) return 'boom';
    return null;
  }

  init(world) {
    const self = this;
    this.env = { x: this.x0 - 48, y: this.top - 16, w: this.x1 - this.x0 + 96, h: this.ground - this.top + 64 };
    world.addHazard(
      makeHazard(this, {
        tier: this.tier,
        knock: 'radial',
        env: this.env,
        test(box, t, out) {
          const g = self.gameTime(t);
          const evs = self.events;
          for (let i = 0; i < evs.length; i++) {
            const e = evs[i];
            if (e.impact < g - 0.2) continue;
            if (e.impact > g + 0.05) break;
            if (self.phaseOf(e, g) !== 'boom') continue;
            const ex = self.impactX(e);
            if (circleBox(ex, self.ground - 4, e.r, box, out)) {
              out.vx = 0;
              out.vy = -200;
              return true;
            }
          }
          return false;
        },
      }),
    );
  }

  /** x do impacto (eventos "mirados" seguem o jogador mais próximo no momento do aviso). */
  impactX(e) {
    if (!e.aim) return e.x;
    if (e.aimX !== undefined) return e.aimX;
    return e.x;
  }

  update(world) {
    const g = this.gameTime(world.t);
    const evs = this.events;
    for (let i = 0; i < evs.length; i++) {
      const e = evs[i];
      if (e.impact > g + e.warn + 0.05) break;
      // trava a mira no começo do aviso (determinístico: jogador vivo mais próximo)
      if (e.aim && e.aimX === undefined && g >= e.impact - e.warn) {
        let best = null;
        let bd = Infinity;
        for (const c of world.chars) {
          if (!c.alive || !c.active) continue;
          const d = Math.abs(c.x - e.x);
          if (d < bd) {
            bd = d;
            best = c;
          }
        }
        e.aimX = best ? Math.max(this.x0, Math.min(this.x1, best.x)) : e.x;
      }
      if (this.destroys && !this.resolved.has(e) && g >= e.impact) {
        this.resolved.add(e);
        this.smash(world, this.impactX(e), e.r * (e.big ? 1 : 0.6));
        world.events.push('explode', world.tick, { x: this.impactX(e), y: this.ground, src: this.id, a: e.big ? 2 : 1 });
      }
    }
  }

  /** Destrói ladrilhos (obstáculos com tiles) no raio do impacto. */
  smash(world, x, r) {
    for (const o of world.obstacles) {
      if (!o.tiles) continue;
      for (const t of o.tiles) {
        if (t.st === 2) continue;
        const cx = t.s.x + t.s.w / 2;
        if (Math.abs(cx - x) <= r && Math.abs(t.s.y - this.ground) < 24) {
          t.st = 2;
          t.s.active = false;
          t.fallT = world.tick;
          t.timer = -1;
        }
      }
    }
  }

  safety(x, y, t) {
    const g = this.gameTime(t);
    let s = 0;
    for (const e of this.events) {
      if (e.impact < g - 0.1) continue;
      if (e.impact > g + 1.2) break;
      if (g < e.impact - e.warn) continue; // só o que já está avisado (justo com humanos)
      if (Math.abs(this.impactX(e) - x) < e.r + 8) s -= 120;
    }
    return s;
  }

  serialize() {
    return { aims: this.events.map((e) => e.aimX ?? null), resolved: [...this.resolved].map((e) => this.events.indexOf(e)) };
  }

  deserialize(o) {
    o.aims.forEach((a, i) => {
      if (a === null) delete this.events[i].aimX;
      else this.events[i].aimX = a;
    });
    this.resolved = new Set(o.resolved.map((i) => this.events[i]));
  }

  bounds() {
    return this.env;
  }
}
registerObstacle('bombard', Bombard);

/**
 * Pedras caindo numa coluna (torre de magma): linha de aviso tracejada, depois a pedra desce
 * a coluna inteira em velocidade constante. Agenda determinística por semente.
 * def: { x0, x1 (faixa das colunas), top, bottom (y), start (s de jogo), schedule: [[t, intervalo]],
 *   warn (s), speed (px/s), r, tier }
 */
export class Rockfall extends Obstacle {
  constructor(def, world, id) {
    super(def, world, id);
    this.x0 = def.x0;
    this.x1 = def.x1;
    this.top = def.top;
    this.bottom = def.bottom;
    this.warn = def.warn ?? 0.8;
    this.speed = def.speed ?? 260;
    this.r = def.r ?? 10;
    this.tier = def.tier || 'light';
    this.life = (this.bottom - this.top) / this.speed;
    this.depth = 'front';
    this.world = world;
    const rng = new Rng(hash32(world.seed, id, 'rockfall'));
    this.events = [];
    let t = def.start ?? 70;
    const sched = def.schedule || [[0, 2]];
    while (t < 400) {
      this.events.push({ t, x: Math.round(this.x0 + rng.next() * (this.x1 - this.x0)) });
      t += stepwise(sched, t) * (0.8 + rng.next() * 0.4);
    }
  }

  gameTime(t) {
    const r = this.world.rules;
    return r ? t - r.countdown / 60 : t;
  }

  /** Eventos visíveis em g: cb(x, y|null (null = só aviso), k). */
  forEach(g, cb) {
    const ev = this.events;
    for (let k = 0; k < ev.length; k++) {
      const e = ev[k];
      if (e.t - this.warn > g) break;
      const age = g - e.t;
      if (age > this.life) continue;
      cb(e.x, age < 0 ? null : this.top + age * this.speed, k);
    }
  }

  init(world) {
    const self = this;
    this.env = { x: this.x0 - this.r, y: this.top - this.r, w: this.x1 - this.x0 + this.r * 2, h: this.bottom - this.top + this.r * 2 };
    world.addHazard(
      makeHazard(this, {
        tier: this.tier,
        knock: 'fixed',
        dirX: 0,
        dirY: 1,
        env: this.env,
        test(box, t, out) {
          let hit = false;
          self.forEach(self.gameTime(t), (x, y) => {
            if (!hit && y !== null && circleBox(x, y, self.r, box, out)) hit = true;
          });
          if (hit) {
            out.vx = 0;
            out.vy = self.speed;
          }
          return hit;
        },
      }),
    );
  }

  safety(x, y, t) {
    let s = 0;
    this.forEach(this.gameTime(t), (ex, ey) => {
      if (Math.abs(ex - x) < this.r + 8 && (ey === null || ey < y)) s -= 60;
    });
    return s;
  }

  bounds() {
    return this.env;
  }
}
registerObstacle('rockfall', Rockfall);
