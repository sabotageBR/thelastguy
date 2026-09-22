import ceu from './ceu.js';
import gelo from './gelo.js';
import vulcao from './vulcao.js';
import selva from './selva.js';
import espaco from './espaco.js';

export const THEMES = { ceu, gelo, vulcao, selva, espaco };

export function getTheme(id) {
  return THEMES[id] || ceu;
}
