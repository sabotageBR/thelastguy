// Construtor de fases. Coordenadas: x cresce para a direita; `h` é a altura
// acima da linha de base (y = -h, y cresce para baixo).
import { TILE } from '../../core/constants.js';

export const BASE_DEPTH = 48; // espessura visual/física padrão dos blocos

export class LevelBuilder {
  constructor(meta = {}) {
    this.meta = {
      id: 'sem-id',
      world: 'ceu',
      theme: meta.world || 'ceu',
      name: 'Fase',
      type: 'race', // race | survival | final | free
      objective: 'CORRA ATÉ A CHEGADA!',
      physics: 'normal',
      target: 70,
      slot: 1,
      camera: 'follow', // follow | arena | vertical
      ...meta,
    };
    this.solids = [];
    this.ramps = [];
    this.obstacles = [];
    this.decor = [];
    this.checkpoints = [];
    this.spawns = [];
    this.start = null;
    this.finish = null;
    this.extra = []; // retângulos extras para os limites do nível
    this.killY = null;
    this.gaps = []; // registro para o validador
    this.hides = []; // esconderijos (nichos) — dica para os bots
    this.lifts = []; // zonas onde subir é progresso (ver progress.js)
  }

  static Y(h) {
    return -h;
  }

  // ------------------------------------------------------------------ geometria
  /** Bloco sólido com topo na altura h. */
  block(x, h, w, o = {}) {
    const s = {
      x: Math.round(x),
      y: Math.round(-h),
      w: Math.round(w),
      h: o.depth ?? BASE_DEPTH,
      kind: o.kind || 'path',
      mat: o.mat || 'normal',
      conveyor: o.conveyor || 0,
      bounce: o.bounce || 0,
      oneWay: false,
      deco: o.deco || null,
    };
    this.solids.push(s);
    return s;
  }

  /** Barreira baixa listrada (sólida: é preciso pular). */
  hurdle(x, h, w = 8, height = 12) {
    const s = this.block(x, h + height, w, { depth: height, kind: 'hurdle' });
    return s;
  }

  /** Plataforma que só colide por cima. */
  oneway(x, h, w, o = {}) {
    const s = this.block(x, h, w, { depth: o.depth ?? 8, kind: o.kind || 'plank', ...o });
    s.oneWay = true;
    return s;
  }

  /** Parede/coluna do chão (topo em hTop) até a base (h0). */
  wall(x, h0, w, hTop, o = {}) {
    return this.block(x, hTop, w, { depth: hTop - h0 + (o.extra ?? BASE_DEPTH), kind: o.kind || 'wall', ...o });
  }

  /** Rampa de (x0,h0) a (x1,h1). Desenhada com cunha sólida por baixo. */
  ramp(x0, h0, x1, h1, o = {}) {
    const r = {
      x0: Math.round(x0),
      y0: Math.round(-h0),
      x1: Math.round(x1),
      y1: Math.round(-h1),
      mat: o.mat || 'normal',
      conveyor: o.conveyor || 0,
      kind: o.kind || 'ramp',
      depth: o.depth ?? BASE_DEPTH,
    };
    this.ramps.push(r);
    return r;
  }

  obstacle(type, params = {}) {
    const d = { type, theme: this.meta.theme, ...params };
    this.obstacles.push(d);
    return d;
  }

  deco(kind, params = {}) {
    const d = { kind, ...params };
    this.decor.push(d);
    return d;
  }

  bound(x, y, w, h) {
    this.extra.push({ x, y, w, h });
  }

  // ------------------------------------------------------------------ marcos
  /** Área de largada: plataforma + 32 posições. */
  startArea(x, w, h = 0, o = {}) {
    this.block(x, h, w, { kind: o.kind || 'start', depth: o.depth });
    const spawn = [];
    const x0 = x + (o.back ?? 24);
    for (let i = 0; i < 32; i++) spawn.push({ x: Math.round(x0 + (i % 16) * 3 + (i >> 4) * 1.5), y: -h, facing: 1 });
    this.spawns = spawn;
    this.start = { x, y: -h, spawn: spawn.slice(0, 16) };
    this.deco('startGate', { x: x + w - 8, y: -h });
    return this;
  }

  /** Arena: posições espalhadas pela largura. */
  arenaSpawns(x0, x1, h = 0, n = 32) {
    const spawn = [];
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      spawn.push({ x: Math.round(x0 + (x1 - x0) * t), y: -h, facing: t < 0.5 ? 1 : -1 });
    }
    this.spawns = spawn;
    this.start = { x: x0, y: -h, spawn };
    return this;
  }

  checkpoint(x, h = 0, w = 64) {
    const spawn = [];
    for (let i = 0; i < 8; i++) spawn.push({ x: Math.round(x + 8 + (i * (w - 16)) / 7), y: -h });
    const cp = { x: Math.round(x), y: -h, spawn };
    this.checkpoints.push(cp);
    this.deco('checkpoint', { x: Math.round(x), y: -h, index: this.checkpoints.length });
    return cp;
  }

  finishLine(x, h = 0) {
    this.finish = { x: Math.round(x), y: -h };
    this.deco('finishGate', { x: Math.round(x), y: -h });
    return this;
  }

  /** Esconderijo (x do centro de um nicho): os bots consideram parar ali quando algo vem rolando. */
  hide(x) {
    this.hides.push(Math.round(x));
  }

  /** Zona de elevador: entre x0 e x1, subir de h0 a h1 conta como avançar até xOut (dica para bots). */
  lift(x0, x1, h0, h1, xOut) {
    this.lifts.push({ x0, x1, h0, h1, xOut });
  }

  /** Registra um vão para o validador de limites. */
  noteGap(x0, h0, x1, h1, o = {}) {
    this.gaps.push({ x0, h0, x1, h1, ...o });
  }

  // ------------------------------------------------------------------ montagem
  build() {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    const grow = (ax, ay, bx, by) => {
      if (ax < x0) x0 = ax;
      if (ay < y0) y0 = ay;
      if (bx > x1) x1 = bx;
      if (by > y1) y1 = by;
    };
    for (const s of this.solids) grow(s.x, s.y, s.x + s.w, s.y + s.h);
    for (const r of this.ramps) grow(Math.min(r.x0, r.x1), Math.min(r.y0, r.y1), Math.max(r.x0, r.x1), Math.max(r.y0, r.y1) + r.depth);
    for (const e of this.extra) grow(e.x, e.y, e.x + e.w, e.y + e.h);
    for (const o of this.obstacles) {
      if (o.x !== undefined) grow(o.x - 64, (o.y ?? 0) - 64, o.x + 64, (o.y ?? 0) + 64);
    }
    if (!isFinite(x0)) {
      x0 = 0;
      y0 = -200;
      x1 = 480;
      y1 = 100;
    }
    const solidBottom = y1;
    const killY = this.killY ?? solidBottom + 120;
    const bounds = {
      x0: Math.floor(x0 - 256),
      y0: Math.floor(y0 - 480),
      x1: Math.ceil(x1 + 256),
      y1: Math.ceil(killY + 128),
    };
    const cam = this.meta.cameraBounds || { x0: x0 - 32, x1: x1 + 32, y0: y0 - 400, y1: solidBottom + 32 };
    return {
      ...this.meta,
      solids: this.solids,
      ramps: this.ramps,
      obstacles: this.obstacles,
      decor: this.decor,
      spawns: this.spawns,
      start: this.start || { x: 0, y: 0, spawn: this.spawns },
      checkpoints: this.checkpoints,
      finish: this.finish,
      bounds,
      camBounds: cam,
      killY,
      gaps: this.gaps,
      hides: this.hides,
      lifts: this.lifts,
      tile: TILE,
    };
  }
}
