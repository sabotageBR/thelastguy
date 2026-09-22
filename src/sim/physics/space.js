// Espaço de colisão: grades de sólidos e rampas + consultas usadas pela física
// dos personagens e pelos bots. Retângulos inteiros [x, x+w) × [y, y+h).
import { Grid } from './grid.js';

export class Space {
  constructor(bounds) {
    const { x0, y0, x1, y1 } = bounds;
    this.bounds = bounds;
    this.solidGrid = new Grid(x0, y0, x1, y1, 64);
    this.rampGrid = new Grid(x0, y0, x1, y1, 64);
    this.solids = [];
    this.ramps = [];
    this._tmp = new Array(512);
    this._tmp2 = new Array(128);
  }

  /** Insere um sólido. `env` = envelope do movimento (para cinemáticos). */
  addSolid(s, env) {
    this.solids.push(s);
    const e = env || s;
    this.solidGrid.insert(s, e.x, e.y, e.x + e.w, e.y + e.h);
    return s;
  }

  addRamp(r, env) {
    this.ramps.push(r);
    const x0 = env ? env.x : Math.min(r.x0, r.x1);
    const x1 = env ? env.x + env.w : Math.max(r.x0, r.x1) + 1;
    const y0 = env ? env.y : Math.min(r.y0, r.y1) - 1;
    const y1 = env ? env.y + env.h : Math.max(r.y0, r.y1) + 1;
    this.rampGrid.insert(r, x0, y0, x1, y1);
    return r;
  }

  /** Primeiro sólido (não one-way, ativo) que sobrepõe a caixa; senão null. */
  solidAt(x0, y0, x1, y1, ignore) {
    const tmp = this._tmp;
    const n = this.solidGrid.queryInto(x0, y0, x1, y1, tmp);
    for (let i = 0; i < n; i++) {
      const s = tmp[i];
      if (!s.active || s.oneWay || s === ignore) continue;
      if (x0 < s.x + s.w && x1 > s.x && y0 < s.y + s.h && y1 > s.y) return s;
    }
    return null;
  }

  /** Há qualquer sólido (inclusive one-way) na caixa? */
  anySolidIn(x0, y0, x1, y1, ignore) {
    const tmp = this._tmp;
    const n = this.solidGrid.queryInto(x0, y0, x1, y1, tmp);
    for (let i = 0; i < n; i++) {
      const s = tmp[i];
      if (!s.active || s === ignore) continue;
      if (x0 < s.x + s.w && x1 > s.x && y0 < s.y + s.h && y1 > s.y) return true;
    }
    return false;
  }

  anyRampIn(x0, y0, x1, y1) {
    const tmp = this._tmp2;
    const n = this.rampGrid.queryInto(x0, y0, x1, y1, tmp);
    for (let i = 0; i < n; i++) {
      const r = tmp[i];
      if (!r.active) continue;
      const rx0 = Math.min(r.x0, r.x1);
      const rx1 = Math.max(r.x0, r.x1);
      const ry0 = Math.min(r.y0, r.y1);
      const ry1 = Math.max(r.y0, r.y1);
      if (x0 <= rx1 && x1 > rx0 && y0 <= ry1 && y1 > ry0) return true;
    }
    return false;
  }

  /** Sólido (inclusive one-way) cujo topo == y e que cobre [x0,x1) horizontalmente. */
  topAt(x0, x1, y, ignore) {
    const tmp = this._tmp;
    const n = this.solidGrid.queryInto(x0, y, x1, y + 1, tmp);
    let best = null;
    for (let i = 0; i < n; i++) {
      const s = tmp[i];
      if (!s.active || s === ignore || s.y !== y) continue;
      if (x0 < s.x + s.w && x1 > s.x) {
        // prefere o sólido que está mais sob o centro
        if (!best) best = s;
        else {
          const cx = (x0 + x1) / 2;
          const inS = cx >= s.x && cx < s.x + s.w;
          const inB = cx >= best.x && cx < best.x + best.w;
          if (inS && !inB) best = s;
        }
      }
    }
    return best;
  }

  /** Rampa cuja superfície na coluna x está em [yMin, yMax]; devolve a rampa (e this.lastSY). */
  rampAt(x, yMin, yMax) {
    const tmp = this._tmp2;
    const n = this.rampGrid.queryInto(x, yMin - 1, x + 1, yMax + 2, tmp);
    for (let i = 0; i < n; i++) {
      const r = tmp[i];
      if (!r.active) continue;
      const sy = r.surfaceY(x);
      if (sy === sy && sy >= yMin && sy <= yMax) {
        this.lastSY = sy;
        return r;
      }
    }
    return null;
  }

  /**
   * Distância (px) até o chão mais próximo abaixo de (x, y) numa faixa [x-hw, x+hw),
   * até `maxDist`; -1 se não houver. Considera sólidos, one-ways e rampas.
   */
  groundBelow(x, y, hw, maxDist, ignore) {
    const tmp = this._tmp;
    const n = this.solidGrid.queryInto(x - hw, y, x + hw, y + maxDist + 1, tmp);
    let best = -1;
    for (let i = 0; i < n; i++) {
      const s = tmp[i];
      if (!s.active || s === ignore) continue;
      if (x - hw < s.x + s.w && x + hw > s.x && s.y >= y && s.y <= y + maxDist) {
        const d = s.y - y;
        if (best < 0 || d < best) best = d;
      }
    }
    const tmp2 = this._tmp2;
    const m = this.rampGrid.queryInto(x, y, x + 1, y + maxDist + 1, tmp2);
    for (let i = 0; i < m; i++) {
      const r = tmp2[i];
      if (!r.active) continue;
      const sy = r.surfaceY(x);
      if (sy === sy && sy >= y && sy <= y + maxDist) {
        const d = sy - y;
        if (best < 0 || d < best) best = d;
      }
    }
    return best;
  }
}
