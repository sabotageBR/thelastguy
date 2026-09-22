// Catálogo de fases: id → { meta, build }.
import * as ceu1 from './ceu/fase1.js';
import * as ceu2 from './ceu/fase2.js';
import * as ceu3 from './ceu/fase3.js';
import * as ceu4 from './ceu/fase4.js';
import * as gelo1 from './gelo/fase1.js';
import * as gelo2 from './gelo/fase2.js';
import * as gelo3 from './gelo/fase3.js';
import * as gelo4 from './gelo/fase4.js';
import * as vulc1 from './vulcao/fase1.js';
import * as vulc2 from './vulcao/fase2.js';
import * as vulc3 from './vulcao/fase3.js';
import * as vulc4 from './vulcao/fase4.js';
import * as selva1 from './selva/fase1.js';
import * as selva2 from './selva/fase2.js';
import * as selva3 from './selva/fase3.js';
import * as selva4 from './selva/fase4.js';
import * as esp1 from './espaco/fase1.js';
import * as esp2 from './espaco/fase2.js';
import * as esp3 from './espaco/fase3.js';
import * as esp4 from './espaco/fase4.js';
import playground from './test/playground.js';

const LEVELS = {
  'ceu-1': ceu1,
  'ceu-2': ceu2,
  'ceu-3': ceu3,
  'ceu-4': ceu4,
  'gelo-1': gelo1,
  'gelo-2': gelo2,
  'gelo-3': gelo3,
  'gelo-4': gelo4,
  'vulc-1': vulc1,
  'vulc-2': vulc2,
  'vulc-3': vulc3,
  'vulc-4': vulc4,
  'selva-1': selva1,
  'selva-2': selva2,
  'selva-3': selva3,
  'selva-4': selva4,
  'esp-1': esp1,
  'esp-2': esp2,
  'esp-3': esp3,
  'esp-4': esp4,
  playground: { meta: { id: 'playground', world: 'ceu', type: 'free', name: 'Treino Livre' }, default: playground },
};

export function levelIds() {
  return Object.keys(LEVELS);
}

export function levelMeta(id) {
  return LEVELS[id]?.meta || null;
}

const cache = new Map();

/** Constrói (com cache) a fase `id`. */
export function buildLevel(id) {
  if (!LEVELS[id]) throw new Error(`fase desconhecida: ${id}`);
  if (!cache.has(id)) cache.set(id, LEVELS[id].default());
  return cache.get(id);
}
