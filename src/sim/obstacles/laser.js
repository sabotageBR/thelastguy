// Lasers: portões liga/desliga, feixes que sobem e descem, torretas giratórias,
// colunas com aviso pontilhado, linhas de parede a parede (BAIXA/ALTA) e cercas.
// Em corridas o laser derruba (light); na Varredura Laser elimina ('kill').
import { Obstacle, makeHazard } from './base.js';
import { registerObstacle } from './index.js';
import { aabbBox, capsuleBox } from '../physics/shapes.js';
import { mod, sin, cos, TAU, stepwise } from '../../core/dmath.js';
import { Rng, hash32 } from '../../core/rng.js';

/**
 * def.kind:
 *  'gate'   { x, y0 (teto), y1 (chão), on, off, warn }                      feixe vertical liga/desliga
 *  'sweep'  { x, w, yTop, yBot, period }                                     feixe horizontal subindo/descendo
 *  'turret' { x, y, len, period, arc (rad), base (ângulo central) }          feixe girando a partir de um ponto
 *  'arena'  { x0, x1, ground, ceil, schedule... }                            colunas, linhas e cercas (agenda)
 */
export class Laser extends Obstacle {
  constructor(def, world, id) {
    super(def, world, id);
    this.mode = def.kind || 'gate';
    this.tier = def.tier || 'light';
    this.on = def.on ?? 1.2;
    this.off = def.off ?? 1.4;
    this.warn = def.warn ?? 0.4;
    this.T = this.on + this.off;
    this.depth = 'front';
    this.world = world;
    if (this.mode === 'arena') this.buildArena(def, world);
  }

  gameTime(t) {
    const r = this.world.rules;
    return r ? t - r.countdown / 60 : t;
  }

  // ---------------------------------------------------------------- portão
  gateState(t) {
    const u = mod(t + this.phase * this.T, this.T);
    if (u < this.on) return 2;
    if (u > this.T - this.warn) return 1;
    return 0;
  }

  // ---------------------------------------------------------------- feixe que sobe e desce
  sweepY(t) {
    const d = this.def;
    const k = (1 - cos(TAU * (t / (d.period ?? 3) + this.phase))) / 2;
    return d.yBot + (d.yTop - d.yBot) * k;
  }

  // ---------------------------------------------------------------- torreta
  turretAngle(t) {
    const d = this.def;
    return (d.base ?? Math.PI / 2) + sin(TAU * (t / (d.period ?? 5) + this.phase)) * (d.arc ?? 1.0);
  }

  // ---------------------------------------------------------------- arena (colunas/linhas/cercas)
  buildArena(def, world) {
    const r = new Rng(hash32(world.seed, this.id, 'laser'));
    this.cols = [];
    this.lines = [];
    const add = (list, schedFn, from, to) => {
      let t = from;
      while (t < to) {
        const v = schedFn(t, r);
        if (!v) {
          t += 1;
          continue;
        }
        list.push(v.ev);
        t += v.dt;
      }
    };
    const colS = def.columns || [];
    add(
      this.cols,
      (t) => {
        const s = stepwise(colS, t);
        if (!s || !s.every) return null;
        const n = s.n || 1;
        const evs = [];
        for (let i = 0; i < n; i++) evs.push(def.x0 + 16 + r.next() * (def.x1 - def.x0 - 32));
        return { ev: { t: t + s.warn, warn: s.warn, xs: evs, w: s.w ?? 32 }, dt: s.every };
      },
      def.start ?? 2,
      200,
    );
    const lineS = def.lines || [];
    add(
      this.lines,
      (t) => {
        const s = stepwise(lineS, t);
        if (!s || !s.every) return null;
        const high = s.mix ? r.chance(0.5) : !!s.high;
        const ev = { t: t + s.warn, warn: s.warn, high };
        if (s.double && r.chance(s.double)) this.lines.push({ t: t + s.warn + 0.6, warn: s.warn + 0.6, high: !high });
        return { ev, dt: s.every };
      },
      (def.start ?? 2) + 13,
      200,
    );
    this.lines.sort((a, b) => a.t - b.t);
    this.fences = def.fences || null; // [[t, larguraLivre]]
    // "scanner": parede de laser que atravessa a arena com um vão de 48 px (no chão = fique;
    // no alto = pule na hora); sentidos alternados
    this.scans = [];
    const scanS = def.scanner || null;
    if (scanS) {
      let t = def.start ?? 2;
      let k = 0;
      while (t < 200) {
        const sc = stepwise(scanS, t);
        if (!sc || !sc.every) {
          t += 1;
          continue;
        }
        const warn = sc.warn ?? 0.8;
        this.scans.push({ t: t + warn, warn, dir: k % 2 ? -1 : 1, gapY: r.chance(0.5) ? 0 : 40, gap: sc.gap ?? 48, speed: sc.speed ?? 200 });
        t += sc.every;
        k++;
      }
    }
  }

  /** x da parede do scanner em g (ou null se fora da arena / ainda não saiu). */
  scanX(e, g) {
    const d = this.def;
    const age = g - e.t;
    if (age < 0) return null;
    const x = e.dir > 0 ? d.x0 + age * e.speed : d.x1 - age * e.speed;
    return x < d.x0 - 2 || x > d.x1 + 2 ? null : x;
  }

  colState(e, g) {
    const d = g - e.t;
    if (d < -e.warn) return 0;
    if (d < 0) return 1;
    if (d < 0.5) return 2;
    return 0;
  }

  lineY(e) {
    const d = this.def;
    return e.high ? { y0: d.ground - 40, y1: d.ground - 32 } : { y0: d.ground - 12, y1: d.ground - 4 };
  }

  fenceGap(g) {
    if (!this.fences) return null;
    const w = stepwise(this.fences, g);
    const d = this.def;
    const cx = (d.x0 + d.x1) / 2;
    return { x0: cx - w / 2, x1: cx + w / 2 };
  }

  init(world) {
    const self = this;
    const d = this.def;
    let env;
    if (this.mode === 'gate') env = { x: this.x - 6, y: d.y0, w: 12, h: d.y1 - d.y0 };
    else if (this.mode === 'sweep') env = { x: this.x, y: d.yTop - 4, w: d.w, h: d.yBot - d.yTop + 8 };
    else if (this.mode === 'turret') env = { x: this.x - d.len, y: this.y - d.len, w: d.len * 2, h: d.len * 2 };
    else env = { x: d.x0 - 8, y: d.ceil ?? d.ground - 160, w: d.x1 - d.x0 + 16, h: d.ground - (d.ceil ?? d.ground - 160) + 4 };
    this.env = env;
    const tier = this.tier;
    world.addHazard(
      makeHazard(this, {
        tier,
        knock: 'fixed',
        dirX: 0,
        dirY: -1,
        cause: 'laser',
        env,
        test(box, t, out) {
          return self.hit(box, t, out);
        },
      }),
    );
  }

  hit(box, t, out) {
    const d = this.def;
    if (this.mode === 'gate') {
      if (this.gateState(t) !== 2) return false;
      return aabbBox(this.x - 1.5, d.y0, 3, d.y1 - d.y0, box, out);
    }
    if (this.mode === 'sweep') {
      const y = this.sweepY(t);
      return aabbBox(this.x, y - 1.5, d.w, 3, box, out);
    }
    if (this.mode === 'turret') {
      const a = this.turretAngle(t);
      return capsuleBox(this.x, this.y, this.x + cos(a) * d.len, this.y + sin(a) * d.len, 2, box, out);
    }
    // arena
    const g = this.gameTime(t);
    for (const e of this.cols) {
      if (e.t > g + 0.1) break;
      if (this.colState(e, g) !== 2) continue;
      for (const x of e.xs) if (aabbBox(x - e.w / 2, d.ceil ?? d.ground - 160, e.w, d.ground - (d.ceil ?? d.ground - 160), box, out)) return true;
    }
    for (const e of this.lines) {
      if (e.t > g + 0.1) break;
      if (g < e.t || g > e.t + 0.45) continue;
      const L = this.lineY(e);
      if (aabbBox(d.x0, L.y0, d.x1 - d.x0, L.y1 - L.y0, box, out)) return true;
    }
    const top = d.ceil ?? d.ground - 160;
    for (const e of this.scans) {
      if (e.t > g) break;
      const x = this.scanX(e, g);
      if (x === null) continue;
      const g0 = d.ground - e.gapY - e.gap;
      const g1 = d.ground - e.gapY;
      if (aabbBox(x - 1.5, top, 3, g0 - top, box, out)) return true;
      if (g1 < d.ground && aabbBox(x - 1.5, g1, 3, d.ground - g1, box, out)) return true;
    }
    const f = this.fenceGap(g);
    if (f && (box.x0 < f.x0 || box.x1 > f.x1)) {
      out.px = (box.x0 + box.x1) / 2;
      out.py = (box.y0 + box.y1) / 2;
      out.nx = box.x0 < f.x0 ? 1 : -1;
      out.ny = -0.3;
      return true;
    }
    return false;
  }

  safety(x, y, t) {
    if (this.mode !== 'arena') return 0;
    const g = this.gameTime(t);
    let s = 0;
    for (const e of this.cols) {
      if (e.t > g + 1.3) break;
      if (e.t + 0.5 < g || g < e.t - e.warn) continue;
      for (const cx of e.xs) if (Math.abs(cx - x) < e.w / 2 + 10) s -= 150;
    }
    const f = this.fenceGap(g + 1);
    if (f && (x < f.x0 + 12 || x > f.x1 - 12)) s -= 120;
    return s;
  }

  bounds() {
    return this.env;
  }
}
registerObstacle('laser', Laser);
