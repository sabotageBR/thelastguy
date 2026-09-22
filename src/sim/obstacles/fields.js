// Perigos de área: lava/água (estática ou subindo, com elástico no líder), buraco negro
// (atração + núcleo letal) e o totem giratório que cruza as faixas (DSWEEP).
import { Obstacle, makeHazard } from './base.js';
import { registerObstacle } from './index.js';
import { aabbBox } from '../physics/shapes.js';
import { piecewise, sqrt, mod, TAU, sin, cos, stepwise } from '../../core/dmath.js';

/**
 * Lava/água. def: { x, w, y (superfície inicial), rise: [[t, px/s], ...] (0 = parada),
 *   idle (s), band (px: elástico — nunca mais que `band` abaixo do mais alto vivo), look: 'lava'|'water' }
 * Encostar = queda (respawn em corridas, eliminação em arenas).
 */
export class Liquid extends Obstacle {
  constructor(def, world, id) {
    super(def, world, id);
    this.w = def.w ?? 10000;
    this.level = def.y;
    this.rise = def.rise || null;
    this.band = def.band ?? 0;
    this.idle = def.idle ?? 0;
    this.look = def.look || 'lava';
    this.depth = 'front';
    this.world = world;
  }

  /** Superfície (y) atual — com estado (o elástico depende dos jogadores). */
  surface() {
    return this.level;
  }

  init(world) {
    const self = this;
    this.env = { x: this.x, y: this.level - 4000, w: this.w, h: 8000 };
    world.addKiller({
      owner: this,
      killAt(b, t) {
        if (b.x1 < self.x || b.x0 > self.x + self.w) return null;
        return b.y1 > self.surfaceAt(t) + 3 ? self.look : null;
      },
    });
  }

  /** Superfície prevista em t (bots): extrapola a subida atual. */
  surfaceAt(t) {
    if (!this.rise) return this.level;
    const w = this.world;
    const dt = t - w.t;
    if (dt <= 0) return this.level;
    const g = w.rules ? w.rules.elapsed : 0;
    const v = g < this.idle ? 0 : stepwise(this.rise, g);
    return this.level - v * dt;
  }

  update(world) {
    if (!this.rise || !world.rules || world.rules.phase === 'countdown') return;
    const g = world.rules.elapsed;
    if (g < this.idle) return;
    let v = stepwise(this.rise, g);
    if (world.rules.suddenDeath) v *= 2.2;
    this.level -= v / 60;
    if (this.band > 0 && g > 30) {
      let top = Infinity;
      for (const c of world.chars) if (c.alive && c.active && c.y < top) top = c.y;
      if (top < Infinity && this.level - top > this.band) this.level = top + this.band;
    }
  }

  safety(x, y, t) {
    const s = this.surfaceAt(t);
    return Math.min(60, (s - y) * 0.6);
  }

  serialize() {
    return this.level;
  }

  deserialize(v) {
    this.level = v;
  }

  bounds() {
    return { x: this.x, y: this.level - 16, w: this.w, h: 400 };
  }
}
registerObstacle('liquid', Liquid);

/**
 * Buraco negro: puxa para o centro (deriva no chão + aceleração no ar), núcleo elimina.
 * def: { x, y (centro), radius, ground: [[t, px/s]], air: [[t, px/s²]], core }
 */
export class BlackHole extends Obstacle {
  constructor(def, world, id) {
    super(def, world, id);
    this.radius = def.radius ?? 400;
    this.groundS = def.ground || [[0, 20]];
    this.airS = def.air || [[0, 150]];
    this.core = def.core ?? 14;
    this.depth = 'back';
    this.world = world;
  }

  gameTime(t) {
    const r = this.world.rules;
    return r ? Math.max(0, r.elapsed + (t - this.world.t)) : t;
  }

  init(world) {
    const self = this;
    this.env = { x: this.x - this.radius, y: this.y - this.radius, w: this.radius * 2, h: this.radius * 2 };
    world.addZone({
      owner: this,
      groundK: 1,
      forceAt(c, t, f) {
        if (!world.rules || world.rules.phase === 'countdown') return false;
        const dx = self.x - c.x;
        const dy = self.y - (c.y - 10);
        const d = sqrt(dx * dx + dy * dy) || 1;
        if (d > self.radius) return false;
        const g = self.gameTime(t);
        const k = 1 - d / self.radius;
        if (c.grounded) {
          f.dx = (dx / d) * stepwise(self.groundS, g) * (0.5 + k);
        } else {
          const a = stepwise(self.airS, g) * (0.4 + k);
          f.ax = (dx / d) * a;
          f.ay = (dy / d) * a;
        }
        return true;
      },
    });
    world.addKiller({
      owner: this,
      killAt(b) {
        const cx = (b.x0 + b.x1) / 2;
        const cy = (b.y0 + b.y1) / 2;
        const dx = cx - self.x;
        const dy = cy - self.y;
        return dx * dx + dy * dy < self.core * self.core ? 'buraco negro' : null;
      },
    });
  }

  safety(x, y) {
    const dx = x - this.x;
    const dy = y - this.y;
    const d = sqrt(dx * dx + dy * dy);
    return 0.5 * Math.min(d, 200) - (d < 60 ? 200 : 0);
  }

  bounds() {
    return this.env;
  }
}
registerObstacle('blackhole', BlackHole);

/**
 * Totem giratório (DSWEEP): troncos giram em volta de um eixo vertical e cruzam todas as
 * faixas; acertam quem estiver no alcance quando passam pela "frente" (janela curta).
 * def: { x (totem), ground (y), reach (px), speed: [[t, graus/s]], reverse: [[t, cada N s]],
 *   bars: [{ type: 'low'|'high', offset (rad), from (s: entra em jogo) }] }
 */
export class TotemSweep extends Obstacle {
  constructor(def, world, id) {
    super(def, world, id);
    this.gy = def.ground;
    this.reach = def.reach ?? 220;
    this.speedS = def.speed || [[0, 45]];
    this.reverseS = def.reverse || null;
    this.bars = def.bars || [{ type: 'low', offset: 0 }];
    this.hitArc = def.hitArc ?? 0.13; // rad em volta da "frente" que acerta
    this.depth = 'span';
    this.world = world;
    this.angle = 0;
    this.dir = 1;
    this.lastRev = 0;
  }

  update(world) {
    const r = world.rules;
    if (!r || r.phase === 'countdown') return;
    const g = r.elapsed;
    const sp = (stepwise(this.speedS, g) * Math.PI) / 180;
    if (this.reverseS) {
      const every = stepwise(this.reverseS, g);
      if (every > 0 && this.lastRev === 0) this.lastRev = g; // começa a contar quando liga
      if (every > 0 && g - this.lastRev >= every) {
        this.lastRev = g;
        this.dir = -this.dir;
        world.events.push('reverse', world.tick, { src: this.id });
      }
    }
    this.angle += this.dir * sp * world.dt;
  }

  /** Ângulo previsto em t (bots): velocidade atual constante. */
  angleAt(t) {
    const w = this.world;
    const r = w.rules;
    const g = r ? r.elapsed : 0;
    const sp = (stepwise(this.speedS, g) * Math.PI) / 180;
    return this.angle + this.dir * sp * Math.max(0, t - w.t);
  }

  barFront(bar, t) {
    // o tronco é um diâmetro: cruza o plano dos jogadores em 0 e em π
    if (!this.barOn(bar)) return false;
    const a = mod(this.angleAt(t) + bar.offset, Math.PI);
    return a < this.hitArc || a > Math.PI - this.hitArc;
  }

  barOn(bar) {
    if (!bar.from) return true;
    const r = this.world.rules;
    return !!r && r.elapsed >= bar.from;
  }

  /** Segundos até a próxima inversão (Infinity se não houver) — os olhos piscam antes. */
  reverseIn() {
    if (!this.reverseS) return Infinity;
    const r = this.world.rules;
    const g = r ? r.elapsed : 0;
    const every = stepwise(this.reverseS, g);
    if (!(every > 0)) {
      const next = this.reverseS.find(([t0, e]) => t0 > g && e > 0);
      return next ? next[0] + next[1] - g : Infinity;
    }
    return Math.max(0, this.lastRev + every - g);
  }

  init(world) {
    const self = this;
    this.env = { x: this.x - this.reach, y: this.gy - 64, w: this.reach * 2, h: 68 };
    world.addHazard(
      makeHazard(this, {
        tier: 'heavy',
        knock: 'fixed',
        dirX: 0,
        dirY: -1,
        env: this.env,
        test(box, t, out) {
          for (const b of self.bars) {
            if (!self.barFront(b, t)) continue;
            const y0 = b.type === 'low' ? self.gy - 20 : self.gy - 56;
            const y1 = b.type === 'low' ? self.gy : self.gy - 28;
            if (aabbBox(self.x - self.reach, y0, self.reach * 2, y1 - y0, box, out)) {
              out.vx = 0;
              out.vy = 0;
              out.nx = (box.x0 + box.x1) / 2 > self.x ? 1 : -1;
              out.ny = -0.6;
              return true;
            }
          }
          return false;
        },
      }),
    );
  }

  serialize() {
    return [this.angle, this.dir, this.lastRev];
  }

  deserialize(o) {
    [this.angle, this.dir, this.lastRev] = o;
  }

  bounds() {
    return this.env;
  }
}
registerObstacle('totem', TotemSweep);
