// Políticas de controle em malha fechada (as mesmas na previsão e na execução real).
// plan: { type, dir, mag, at, hold, ticks, dive, x }   S: estado da execução (resetado por plano).
import { ST } from '../character.js';
import { HW, blockedAt } from '../physics/body.js';

export const FULL_HOLD = 22;
export const TAP_HOLD = 3;

export function makeState() {
  return { jumped: false, holdUntil: -1, dived: false, hopK: -99, jumpK: -1 };
}

export function resetState(S) {
  S.jumped = false;
  S.holdUntil = -1;
  S.dived = false;
  S.hopK = -99;
  S.jumpK = -1;
  return S;
}

// segurar o pulo "até o fim" dura mais na gravidade baixa (a subida é mais longa)
let holdScale = 1;

function press(S, k, inp, hold) {
  inp.jump = true;
  inp.jumpHeld = true;
  S.jumped = true;
  S.jumpK = k;
  S.holdUntil = k + (hold >= 12 ? Math.round(hold * holdScale) : hold);
}

/** Não há chão logo à frente (borda)? */
export function edgeAhead(c, dir, W, bias = 0) {
  const px = Math.round(c.x + dir * (HW + 2 + Math.abs(c.vx) * 0.034 + bias));
  return W.space.groundBelow(px, c.y, 1, 12) < 0;
}

/** Parede baixa à frente que dá para pular (barreira, degrau)? */
function lowWallAhead(c, dir, W) {
  const sp = W.space;
  if (!blockedAt(sp, c, c.x + dir * 4, c.y)) return false;
  // alto demais? (bloco maior que ~46 px)
  return !blockedAt(sp, c, c.x + dir * 4, c.y - 46);
}

function autoHop(c, dir, inp, W, S, k) {
  if (!c.grounded || k - S.hopK < 16 || inp.jump) return;
  if (lowWallAhead(c, dir, W)) {
    press(S, k, inp, FULL_HOLD);
    S.hopK = k;
  }
}

/** Continuação padrão depois da ação principal: corre, pula barreiras e pula nas bordas. */
function cruise(c, dir, mag, inp, W, S, k, bias = 0) {
  inp.move = dir * mag;
  if (c.grounded && !inp.jump && k - S.jumpK > 8 && edgeAhead(c, dir, W, bias)) {
    press(S, k, inp, FULL_HOLD);
    return;
  }
  autoHop(c, dir, inp, W, S, k);
}

export function runPolicy(plan, c, k, inp, W, S) {
  holdScale = (W.phys && W.phys.holdScale) || 1;
  const dir = plan.dir || 1;
  const mag = plan.mag ?? 1;
  switch (plan.type) {
    case 'run':
      inp.move = dir * mag;
      autoHop(c, dir, inp, W, S, k);
      break;
    case 'edge':
      if (!S.jumped) {
        inp.move = dir * mag;
        if (c.grounded && edgeAhead(c, dir, W, plan.bias || 0)) press(S, k, inp, plan.hold ?? FULL_HOLD);
        else autoHop(c, dir, inp, W, S, k);
      } else cruise(c, dir, mag, inp, W, S, k, plan.bias || 0);
      break;
    case 'jumpAt':
      if (!S.jumped) {
        inp.move = k < (plan.pre ?? 0) && c.grounded ? 0 : dir * mag;
        // na previsão só pula com o pé no chão; na execução o coyote vira margem de erro
        if (k >= plan.at && (c.grounded || (!W.isGhost && c.coyote > 0))) press(S, k, inp, plan.hold ?? FULL_HOLD);
      } else cruise(c, dir, mag, inp, W, S, k);
      break;
    case 'wait':
      if (k < plan.ticks) {
        inp.move = 0;
        // não fica parado na beirada
        if (c.grounded && edgeAhead(c, dir, W)) inp.move = -dir * 0.4;
      } else cruise(c, dir, mag, inp, W, S, k);
      break;
    case 'retreat':
      if (k < plan.ticks) inp.move = -dir;
      else cruise(c, dir, mag, inp, W, S, k);
      break;
    case 'goto': {
      const dx = plan.x - c.x;
      const d = dx > 0 ? 1 : -1;
      inp.move = Math.abs(dx) < 3 ? 0 : d * (Math.abs(dx) < 12 ? 0.5 : mag);
      if (plan.jumpAt !== undefined && !S.jumped && k >= plan.jumpAt && c.grounded) press(S, k, inp, plan.hold ?? FULL_HOLD);
      else if (!S.jumped && c.grounded && Math.abs(dx) > 8 && edgeAhead(c, d, W) && plan.leap) press(S, k, inp, FULL_HOLD);
      else autoHop(c, d, inp, W, S, k);
      break;
    }
    case 'airdive':
      // no ar: continua para frente e mergulha no tick `at`
      inp.move = dir * mag;
      if (!S.dived && !c.grounded && k >= plan.at && !c.diveUsed) {
        inp.jump = true;
        S.dived = true;
      }
      if (c.grounded) cruise(c, dir, mag, inp, W, S, k);
      break;
    case 'hop': {
      // saltita em direção a x: pula sempre que estiver no chão (um ladrilho por pouso)
      const dx = plan.x - c.x;
      const d = dx > 0 ? 1 : -1;
      inp.move = Math.abs(dx) < 4 ? 0 : d * mag;
      if (c.grounded && k - S.jumpK > 3) press(S, k, inp, plan.hold ?? TAP_HOLD + 6);
      break;
    }
    case 'hold':
      inp.move = 0;
      if (plan.jumpAt !== undefined && !S.jumped && k >= plan.jumpAt && c.grounded) press(S, k, inp, plan.hold ?? FULL_HOLD);
      break;
    default:
      inp.move = dir * mag;
  }
  if (S.holdUntil > k) inp.jumpHeld = true;
  // mergulho no ápice (se o plano pedir)
  if (plan.dive && S.jumped && !S.dived && !c.grounded && c.vy >= 0 && (c.state === ST.FALL || c.state === ST.JUMP) && k > S.jumpK + 6) {
    inp.jump = true;
    S.dived = true;
  }
  return inp;
}
