// Registro de painters de obstáculos por tipo.
// Painter: (ctx, o, theme, t, cx, cy, layer) — chamado uma vez por camada
// ('back' atrás dos personagens, 'span' entre as faixas, 'front' na frente).
const PAINTERS = new Map();

export function registerPainter(type, fn) {
  PAINTERS.set(type, fn);
}

export function drawObstacles(ctx, world, theme, t, cx, cy, vw, vh, layer) {
  const obs = world.obstacles;
  for (let i = 0; i < obs.length; i++) {
    const o = obs[i];
    const b = o.viewBox ? o.viewBox(t) : o.bounds();
    if (b.x > cx + vw + 16 || b.x + b.w < cx - 16 || b.y > cy + vh + 16 || b.y + b.h < cy - 64) continue;
    const fn = PAINTERS.get(o.type);
    if (fn) fn(ctx, o, theme, t, cx, cy, layer);
  }
}
