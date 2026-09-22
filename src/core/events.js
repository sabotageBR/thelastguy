// Fila de eventos da simulação para render/áudio/HUD (e, no futuro, rede).
// Cada evento: { type, tick, slot, x, y, a, b } — campos opcionais conforme o tipo.

export class EventQueue {
  constructor() {
    this.items = [];
  }

  push(type, tick, data) {
    const e = data ? Object.assign({ type, tick }, data) : { type, tick };
    this.items.push(e);
    return e;
  }

  /** Copia os eventos pendentes para `out` (array) e limpa a fila. */
  drain(out) {
    const n = this.items.length;
    for (let i = 0; i < n; i++) out.push(this.items[i]);
    this.items.length = 0;
    return n;
  }

  clear() {
    this.items.length = 0;
  }
}

/** Emissor simples de eventos (para UI/jogo, fora da simulação). */
export class Emitter {
  constructor() {
    this.map = new Map();
  }

  on(type, fn) {
    if (!this.map.has(type)) this.map.set(type, new Set());
    this.map.get(type).add(fn);
    return () => this.off(type, fn);
  }

  off(type, fn) {
    this.map.get(type)?.delete(fn);
  }

  emit(type, payload) {
    const set = this.map.get(type);
    if (set) for (const fn of [...set]) fn(payload);
  }
}
