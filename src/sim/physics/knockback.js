// Converte um contato com perigo em golpe no personagem.
import { applyHit } from '../character.js';
import { sqrt, clamp, max } from '../../core/dmath.js';

/**
 * hz: { tier, knock: 'blend'|'radial'|'fixed'|'normal', dirX?, dirY?, owner, cause? }
 * contact: { px, py, nx, ny, vx, vy } (vx,vy = velocidade do perigo no ponto)
 */
export function resolveHit(c, hz, contact, world) {
  if (hz.tier === 'kill') {
    world.kill(c, hz.cause || 'laser');
    return true;
  }
  let dx;
  let dy;
  const vx = contact.vx || 0;
  const vy = contact.vy || 0;
  if (hz.knock === 'fixed') {
    dx = hz.dirX;
    dy = hz.dirY;
  } else if (hz.knock === 'radial' || hz.knock === 'normal') {
    dx = contact.nx;
    dy = contact.ny;
  } else {
    const speed = sqrt(vx * vx + vy * vy);
    const w = 0.8 * clamp(speed / 200, 0, 1);
    dx = contact.nx + (speed > 0 ? (w * vx) / speed : 0);
    dy = contact.ny + (speed > 0 ? (w * vy) / speed : 0);
  }
  const d = sqrt(dx * dx + dy * dy) || 1;
  dx /= d;
  dy /= d;
  const closing = max(0, vx * contact.nx + vy * contact.ny);
  return applyHit(c, hz.tier, dx, dy, closing, world, hz.owner);
}
