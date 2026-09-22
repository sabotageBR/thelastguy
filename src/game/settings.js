// Configurações do jogador (persistidas) e estatísticas.
import { load, save } from './storage.js';

export const DEFAULTS = {
  name: '',
  skin: 0,
  music: 0.6,
  sfx: 0.8,
  difficulty: 'normal',
  quality: 'auto',
  fps: false,
  shake: true,
  vibrate: true,
  names: false,
  controls: 'joystick', // joystick | arrows
  diveButton: false,
  buttonSize: 1,
  leftHanded: false,
};

export class Settings {
  constructor() {
    this.v = { ...DEFAULTS, ...load('settings.v1', {}) };
    this.stats = { matches: 0, crowns: 0, best: {}, ...load('stats.v1', {}) };
    this.listeners = new Set();
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches && load('settings.v1', null) === null) {
      this.v.shake = false;
    }
  }

  get(k) {
    return this.v[k];
  }

  set(k, val) {
    this.v[k] = val;
    save('settings.v1', this.v);
    for (const fn of this.listeners) fn(k, val);
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  recordMatch(worldId, placement, won) {
    const s = this.stats;
    s.matches++;
    if (won) s.crowns++;
    if (!s.best[worldId] || placement < s.best[worldId]) s.best[worldId] = placement;
    save('stats.v1', s);
  }
}
