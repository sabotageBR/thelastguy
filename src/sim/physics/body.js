// Movimento de atores (personagens) em pixels inteiros, 1 px por vez contra os
// sólidos (modelo do Celeste). Posição = pés no centro inferior (c.x, c.y);
// corpo ocupa [x-HW, x+HW) × [y-H, y).
import { TUNING } from '../tuning.js';

export const HW = TUNING.body.w / 2; // 5
export const BH = TUNING.body.h; // 20
const STEP_UP = TUNING.stepUp;
// Em rampas o centro do pé fica até HW·|inclinação| abaixo da quina do bloco seguinte.
const RAMP_STEP = HW + 1;

export function blockedAt(space, c, x, y) {
  return space.solidAt(x - HW, y - BH, x + HW, y, c.ignore);
}

/** Suporte sob os pés em y (sólido/one-way com topo em y, ou rampa na coluna x). */
export function supportAt(space, c, x, y) {
  const s = space.topAt(x - HW, x + HW, y, c.ignore);
  if (s) return s;
  return space.rampAt(x, y, y);
}

function setSupport(c, sup) {
  c.ground = sup;
  c.groundMat = sup.mat || 'normal';
  c.groundVx = sup.conveyor || 0;
  c.onRamp = sup.slope !== undefined;
}

/** Atualiza o chão sob o personagem aterrado; devolve false se ficou sem chão. */
export function refreshSupport(space, c) {
  let sup = supportAt(space, c, c.x, c.y);
  if (!sup) {
    for (let k = 1; k <= STEP_UP; k++) {
      const s2 = supportAt(space, c, c.x, c.y + k);
      if (s2 && !blockedAt(space, c, c.x, c.y + k)) {
        c.y += k;
        sup = s2;
        break;
      }
    }
  }
  if (!sup) return false;
  setSupport(c, sup);
  return true;
}

/** Depois de um passo horizontal no chão: acompanha rampas e degraus de até 2 px. */
function followGround(space, c) {
  // Rampa sob o centro do pé tem prioridade (o corpo de 10 px ainda pode estar
  // apoiado no bloco plano vizinho enquanto a superfície da rampa sobe).
  for (let k = STEP_UP; k >= 1; k--) {
    const r = space.rampAt(c.x, c.y - k, c.y - k);
    if (r && !blockedAt(space, c, c.x, c.y - k)) {
      c.y -= k;
      setSupport(c, r);
      return;
    }
  }
  const sup = supportAt(space, c, c.x, c.y);
  if (sup) {
    setSupport(c, sup);
    return;
  }
  // degrau/rampa descendo (rampas: até RAMP_STEP, para sair do bloco para a descida)
  for (let k = 1; k <= RAMP_STEP; k++) {
    const s2 = k <= STEP_UP ? supportAt(space, c, c.x, c.y + k) : space.rampAt(c.x, c.y + k, c.y + k);
    if (s2 && !blockedAt(space, c, c.x, c.y + k)) {
      c.y += k;
      setSupport(c, s2);
      return;
    }
  }
  c.grounded = false;
  c.ground = null;
  c.leftGround = true;
}

function stepUp(space, c, s) {
  const maxK = c.onRamp ? RAMP_STEP : STEP_UP;
  for (let k = 1; k <= maxK; k++) {
    if (!blockedAt(space, c, c.x + s, c.y - k) && !blockedAt(space, c, c.x, c.y - k)) {
      c.x += s;
      c.y -= k;
      const sup = supportAt(space, c, c.x, c.y);
      if (sup) setSupport(c, sup);
      return true;
    }
  }
  return false;
}

/** No ar, caindo: se os pés entraram até 4 px numa rampa, sobe para a superfície. */
function airRampCatch(space, c) {
  if (c.vy < 0) return;
  const r = space.rampAt(c.x, c.y - 4, c.y - 1);
  if (r) {
    const sy = space.lastSY;
    if (!blockedAt(space, c, c.x, sy)) {
      c.y = sy;
      c.landed = true;
      c.grounded = true;
      setSupport(c, r);
      c.yr = 0;
    }
  }
}

/** Move no eixo X. Devolve false se bateu numa parede (c.hitWall = ±1). */
export function moveX(space, c, amount) {
  c.xr += amount;
  let n = Math.round(c.xr);
  if (n === 0) return true;
  c.xr -= n;
  const s = n > 0 ? 1 : -1;
  if (!c.grounded) {
    const x0 = Math.min(c.x, c.x + n) - HW;
    const x1 = Math.max(c.x, c.x + n) + HW;
    if (!space.solidAt(x0, c.y - BH, x1, c.y, c.ignore) && !space.anyRampIn(x0, c.y - 5, x1, c.y + 1)) {
      c.x += n;
      return true;
    }
  }
  while (n !== 0) {
    const nx = c.x + s;
    if (!blockedAt(space, c, nx, c.y)) {
      c.x = nx;
      if (c.grounded) followGround(space, c);
      else airRampCatch(space, c);
    } else if (c.grounded && stepUp(space, c, s)) {
      // subiu um degrau pequeno
    } else {
      c.xr = 0;
      c.hitWall = s;
      return false;
    }
    n -= s;
  }
  return true;
}

/** Pode aterrissar ao descer 1 px a partir de c.y? Define o suporte. */
function landingBelow(space, c) {
  const s = space.topAt(c.x - HW, c.x + HW, c.y, c.ignore);
  if (s) {
    setSupport(c, s);
    return true;
  }
  const r = space.rampAt(c.x, c.y, c.y);
  if (r) {
    setSupport(c, r);
    return true;
  }
  return false;
}

/** Move no eixo Y. Descendo: para no chão (c.landed). Subindo: para no teto (c.headHit). */
export function moveY(space, c, amount) {
  c.yr += amount;
  let n = Math.round(c.yr);
  if (n === 0) return true;
  c.yr -= n;
  const s = n > 0 ? 1 : -1;
  // caminho rápido: nada no volume varrido
  const y0 = s > 0 ? c.y - BH : c.y - BH + n;
  const y1 = s > 0 ? c.y + n + 1 : c.y;
  if (!space.anySolidIn(c.x - HW, y0, c.x + HW, y1, c.ignore) && !space.anyRampIn(c.x - HW, y0, c.x + HW, y1)) {
    c.y += n;
    return true;
  }
  while (n !== 0) {
    if (s > 0) {
      if (landingBelow(space, c)) {
        c.yr = 0;
        c.landed = true;
        c.grounded = true;
        return false;
      }
      // embutido num sólido não one-way logo abaixo? (não deveria acontecer)
      if (blockedAt(space, c, c.x, c.y + 1)) {
        c.yr = 0;
        c.landed = true;
        c.grounded = true;
        return false;
      }
    } else if (blockedAt(space, c, c.x, c.y - 1)) {
      c.yr = 0;
      c.headHit = true;
      return false;
    }
    c.y += s;
    n -= s;
  }
  return true;
}

/**
 * Movimento "bruto" (carregar/empurrar): 1 px por vez contra sólidos, ignorando
 * `ignore` (o próprio sólido que carrega). Não mexe em chão/aterrissagem.
 * Devolve false se foi bloqueado em algum eixo.
 */
export function rawMove(space, c, dx, dy, ignore) {
  const prev = c.ignore;
  c.ignore = ignore;
  let ok = true;
  const sx = dx > 0 ? 1 : -1;
  for (let i = Math.abs(dx); i > 0; i--) {
    if (blockedAt(space, c, c.x + sx, c.y)) {
      ok = false;
      break;
    }
    c.x += sx;
  }
  const sy = dy > 0 ? 1 : -1;
  for (let i = Math.abs(dy); i > 0; i--) {
    if (blockedAt(space, c, c.x, c.y + sy)) {
      ok = false;
      break;
    }
    c.y += sy;
  }
  c.ignore = prev;
  return ok;
}

/** O corpo do personagem sobrepõe o sólido s? */
export function overlapsSolid(c, s) {
  return c.x - HW < s.x + s.w && c.x + HW > s.x && c.y - BH < s.y + s.h && c.y > s.y;
}

/** Rede de segurança: se começou o tick dentro de um sólido, procura o espaço livre mais próximo. */
export function unstick(space, c) {
  if (!blockedAt(space, c, c.x, c.y)) return true;
  for (let d = 1; d <= 40; d++) {
    const cand = [
      [0, -d],
      [-d, 0],
      [d, 0],
      [0, d],
      [-d, -d],
      [d, -d],
    ];
    for (const [dx, dy] of cand) {
      if (!blockedAt(space, c, c.x + dx, c.y + dy)) {
        c.x += dx;
        c.y += dy;
        c.xr = 0;
        c.yr = 0;
        return true;
      }
    }
  }
  return false;
}
