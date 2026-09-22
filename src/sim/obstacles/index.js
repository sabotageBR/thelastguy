// Registro de tipos de obstáculo.
const REGISTRY = new Map();

export function registerObstacle(type, cls) {
  REGISTRY.set(type, cls);
}

export function createObstacle(def, world, id) {
  const C = REGISTRY.get(def.type);
  if (!C) throw new Error(`obstáculo desconhecido: ${def.type}`);
  const o = new C(def, world, id);
  o.init(world);
  return o;
}

export function obstacleTypes() {
  return [...REGISTRY.keys()];
}
