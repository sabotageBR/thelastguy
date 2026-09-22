// Personagem: estado + máquina de estados + controle, gravidade e aterrissagem.
// Os estados mapeiam direto nas animações da folha de sprites.
import { TUNING as T } from './tuning.js';
import { moveX, moveY, refreshSupport, unstick, HW, BH } from './physics/body.js';
import { approach, clamp, sign, abs, sqrt, max, min } from '../core/dmath.js';

export const ST = {
  IDLE: 0,
  RUN: 1,
  JUMP: 2,
  FALL: 3,
  DIVE: 4,
  SLIDE: 5, // deslize de barriga depois do mergulho
  STUMBLE: 6, // tropeção de pé (bumper/empurrador)
  TRIP: 7, // tropeço que derruba (barreira)
  RAGDOLL: 8, // voando girando depois de um golpe (ATINGIDO)
  PRONE: 9, // deitado (CAÍDA)
  GETUP: 10, // levantando (LEVANTAR)
  SQUASH: 11, // achatado por esmagador/espremido
  CELEBRATE: 12, // cruzou a chegada (CHEGADA)
  RESPAWN: 13, // caiu; esperando reaparecer (invisível)
  ELIM: 14, // eliminado (fora da rodada)
  DONE: 15, // qualificado e fora da pista
  WIN: 16, // vencedor comemorando
};
export const STATE_NAMES = Object.keys(ST);

const CONTROLLABLE = new Set([ST.IDLE, ST.RUN, ST.JUMP, ST.FALL, ST.STUMBLE]);
const INVULNERABLE = new Set([ST.RESPAWN, ST.ELIM, ST.DONE, ST.CELEBRATE, ST.WIN]);
const IFRAMES_UNTIL_GETUP = 1 << 20;

export class Character {
  constructor(slot, o = {}) {
    this.slot = slot;
    this.name = o.name || `P${slot}`;
    this.skin = o.skin ?? 0;
    this.human = !!o.human;
    this.lane = o.lane ?? slot % 4;
    this.x = 0;
    this.y = 0;
    this.xr = 0;
    this.yr = 0;
    this.px = 0; // posição no tick anterior (render)
    this.py = 0;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.state = ST.IDLE;
    this.st = 0; // ticks no estado atual
    this.timer = 0;
    this.grounded = false;
    this.ground = null;
    this.groundMat = 'normal';
    this.groundVx = 0;
    this.onRamp = false;
    this.ignore = null;
    this.coyote = 0;
    this.buffer = 0;
    this.jumpTicks = 0;
    this.airTicks = 0;
    this.noCut = false;
    this.diveUsed = false;
    this.pendingDive = false;
    this.iframes = 0;
    this.proneTicks = 0;
    this.spin = 0; // rotação visual na cambalhota (rad)
    this.spinV = 0;
    this.landed = false;
    this.headHit = false;
    this.hitWall = 0;
    this.leftGround = false;
    this.snap = false; // teleportou neste tick (render não interpola)
    this.active = true; // colidível/visível
    this.alive = true; // ainda na rodada
    this.finished = false;
    this.qualified = false;
    this.eliminated = false;
    this.place = 0;
    this.checkpoint = 0;
    this.progress = 0;
    this.lastHitTick = -9999;
    this.bumpCooldown = 0;
    this.lastFallTick = -1;
    this.falls = 0;
    this.hits = 0;
    this.landT = 0; // ticks restantes do "impacto" de aterrissagem (animação)
    this.launched = false; // lançado por trampolim/gêiser: sem decaimento de sobrevelocidade no ar
    this.emote = 0; // 0 nenhum, 1..4 emotes
    this.emoteT = 0;
    this.stuckRespawns = 0;
  }
}

export function setState(c, s) {
  if (c.state !== s) {
    c.state = s;
    c.st = 0;
  }
}

export function isControllable(c) {
  return CONTROLLABLE.has(c.state);
}

export function isVulnerable(c) {
  return c.active && c.alive && c.iframes <= 0 && !INVULNERABLE.has(c.state);
}

function surfaceParams(c, P) {
  if (c.groundMat === 'ice') return P.ice;
  if (c.groundMat === 'slide') return P.slide;
  return P.ground;
}

function accelToward(v, target, prm, dt, k = 1) {
  if (target === 0) return approach(v, 0, prm.decel * dt * k);
  if (v !== 0 && sign(v) !== sign(target)) return approach(v, target, prm.turn * dt * k);
  if (abs(v) > abs(target)) return approach(v, target, prm.over * dt * k);
  return approach(v, target, prm.accel * dt * k);
}

/** Ticks até aterrissar (estimativa) ou -1 se não há chão até 64 px abaixo. */
export function ticksToLand(world, c) {
  const d = world.space.groundBelow(c.x, c.y, HW, 64, c.ignore);
  if (d < 0) return -1;
  const g = world.phys.gFall;
  const vy = c.vy;
  const tau = (-vy + sqrt(vy * vy + 2 * g * d)) / g;
  return tau * 60;
}

export function doJump(c, world) {
  const P = world.phys;
  c.vy = -P.jumpV;
  const g = c.ground;
  if (g && (g.kinematic || g.dynamic)) {
    c.vx += clamp(g.vx || 0, -T.liftCap, T.liftCap);
    if (g.vy < 0) c.vy += max(g.vy, -T.liftCap);
  }
  c.grounded = false;
  c.ground = null;
  c.coyote = 0;
  c.buffer = 0;
  c.jumpTicks = 0;
  c.airTicks = 0;
  c.noCut = false;
  c.pendingDive = false;
  setState(c, ST.JUMP);
  world.emit('jump', c);
}

export function doDive(c, world, fromGround = false) {
  const D = T.dive;
  const dir = c.facing;
  const speed = max(abs(c.vx), D.vx);
  c.vx = dir * speed;
  if (fromGround) {
    c.vy = D.groundVy;
    c.grounded = false;
    c.ground = null;
  } else {
    c.vy = min(c.vy, D.vy);
  }
  c.diveUsed = true;
  c.pendingDive = false;
  c.buffer = 0;
  setState(c, ST.DIVE);
  world.emit('dive', c);
}

function enterGetup(c) {
  setState(c, ST.GETUP);
  c.timer = T.getup;
  c.spin = 0;
  c.spinV = 0;
}

function becomeAirborne(c, world) {
  c.grounded = false;
  c.ground = null;
  c.onRamp = false;
  c.airTicks = 0;
  if (c.state === ST.IDLE || c.state === ST.RUN || c.state === ST.STUMBLE) {
    setState(c, ST.FALL);
    c.coyote = world.phys.coyote;
  }
}

function onLand(c, vyImpact, world) {
  c.grounded = true;
  c.launched = false;
  c.diveUsed = false;
  c.pendingDive = false;
  c.coyote = 0;
  c.airTicks = 0;
  c.vy = 0;
  const sup = c.ground;
  if (sup && sup.bounce && c.state !== ST.RAGDOLL) {
    c.vy = sup.bounce;
    c.grounded = false;
    c.ground = null;
    c.noCut = true;
    c.jumpTicks = 99;
    const own = sup.owner;
    if (own && own.aimX !== undefined) {
      // gêiser mirado: cai no alvo (aimX, e aimY se o pouso for em outra altura), venha de onde vier
      const g = world.phys.gFall;
      const v0 = -sup.bounce;
      const rise = own.aimY !== undefined ? sup.y - own.aimY : 0; // quanto o pouso é mais alto
      const tf = (v0 + sqrt(max(0, v0 * v0 - 2 * g * rise))) / g;
      c.vx = (own.aimX - c.x) / tf;
      c.launched = 2; // voo mirado: balístico (só frear muda) e sem mergulho
      c.diveUsed = true;
    } else if (own && own.launchVx) {
      const d = c.vx > 1 ? 1 : c.vx < -1 ? -1 : c.facing;
      c.vx = d * max(abs(c.vx), own.launchVx);
      c.launched = true;
    }
    setState(c, ST.JUMP);
    world.emit('bounce', c, sup);
    if (sup.owner && sup.owner.onBounce) sup.owner.onBounce(c, world);
    return;
  }
  switch (c.state) {
    case ST.DIVE:
      setState(c, ST.SLIDE);
      c.timer = T.dive.slideMax;
      world.emit('diveLand', c);
      break;
    case ST.RAGDOLL:
      if (vyImpact > T.ragdoll.bounceV) {
        c.vy = -vyImpact * T.ragdoll.bounceK;
        c.vx *= T.ragdoll.bounceX;
        c.grounded = false;
        c.ground = null;
        world.emit('thud', c);
      } else {
        setState(c, ST.PRONE);
        c.timer = c.proneTicks || T.prone.light;
        c.spin = 0;
        c.spinV = 0;
        world.emit('thud', c);
      }
      break;
    case ST.JUMP:
    case ST.FALL:
    case ST.IDLE:
    case ST.RUN:
      setState(c, abs(c.vx - c.groundVx) > 8 ? ST.RUN : ST.IDLE);
      if (vyImpact > 120) c.landT = 5;
      world.emit('land', c, null, vyImpact);
      if (c.buffer > 0) doJump(c, world);
      break;
    case ST.STUMBLE:
      break;
    default:
      break;
  }
}

function handleJumpInput(c, inp, world) {
  const P = world.phys;
  if (inp.dive) {
    if (c.grounded) {
      if (c.state !== ST.STUMBLE) doDive(c, world, true);
      return;
    }
    if (!c.diveUsed) {
      doDive(c, world);
      return;
    }
  }
  if (inp.jump) {
    if (c.grounded || (c.coyote > 0 && c.state === ST.FALL)) {
      doJump(c, world);
      return;
    }
    if (!c.diveUsed && (c.state === ST.JUMP || c.state === ST.FALL)) {
      const land = ticksToLand(world, c);
      if (land >= 0 && land <= P.buffer && c.vy > 0) c.buffer = P.buffer;
      else if (c.airTicks >= T.dive.minAir) {
        doDive(c, world);
        return;
      } else c.pendingDive = true;
    } else {
      c.buffer = P.buffer;
    }
  }
  if (c.pendingDive && !c.grounded && !c.diveUsed && c.airTicks >= T.dive.minAir) {
    doDive(c, world);
    return;
  }
  if (c.buffer > 0) {
    if (c.grounded) doJump(c, world);
    else c.buffer--;
  }
}

/** Aplica um golpe. tier: 'bump' | 'trip' | 'light' | 'heavy' | 'squash'. (nx, ny) direção unitária. */
export function applyHit(c, tier, nx, ny, closing, world, src) {
  if (!isVulnerable(c)) return false;
  const K = T.knock;
  if (tier === 'squash') {
    // pedra gigante: achata por 1,2 s
    applySquash(c, world, src);
    c.timer = 72;
    return true;
  }
  if (tier === 'bump') {
    if (c.bumpCooldown > 0) return false;
    const k = K.bump;
    c.vx = (nx >= 0 ? 1 : -1) * k.base;
    c.vy = min(c.vy, -k.up);
    c.grounded = false;
    c.ground = null;
    setState(c, ST.STUMBLE);
    c.timer = T.stumble.ticks;
    c.bumpCooldown = 12;
    world.emit('bump', c, src);
    return true;
  }
  if (tier === 'trip') {
    if (!c.grounded) return false;
    c.vx = c.facing * K.trip.vx;
    c.vy = K.trip.vy;
    c.grounded = false;
    c.ground = null;
    c.proneTicks = T.prone.trip;
    setState(c, ST.RAGDOLL);
    c.spinV = 0;
    c.spin = 0;
    c.iframes = IFRAMES_UNTIL_GETUP;
    c.hits++;
    world.emit('trip', c, src);
    return true;
  }
  const k = tier === 'heavy' ? K.heavy : K.light;
  const mag = clamp(k.base + k.k * max(0, closing), k.min, k.max);
  let vx = nx * mag;
  if (abs(vx) < 60) vx = (vx >= 0 ? 1 : -1) * 60;
  c.vx = vx;
  c.vy = min(ny * mag, -k.up);
  c.grounded = false;
  c.ground = null;
  c.proneTicks = k.prone;
  setState(c, ST.RAGDOLL);
  c.spinV = (vx >= 0 ? 1 : -1) * (tier === 'heavy' ? 14 : 10);
  c.iframes = IFRAMES_UNTIL_GETUP;
  c.lastHitTick = world.tick;
  c.hits++;
  world.emit('hit', c, src, tier === 'heavy' ? 2 : 1);
  return true;
}

/** Achatado (esmagador/espremido). */
export function applySquash(c, world, src) {
  if (!c.active || !c.alive || INVULNERABLE.has(c.state)) return;
  c.vx = 0;
  c.vy = 0;
  setState(c, ST.SQUASH);
  c.timer = T.prone.squash;
  c.iframes = IFRAMES_UNTIL_GETUP;
  c.hits++;
  world.emit('squash', c, src);
}

/** Um tick de simulação do personagem (controle, gravidade, movimento, aterrissagem). */
export function stepCharacter(c, inp, world) {
  const P = world.phys;
  const dt = world.dt;
  const space = world.space;
  c.px = c.x;
  c.py = c.y;
  c.snap = false;
  c.landed = false;
  c.headHit = false;
  c.hitWall = 0;
  c.leftGround = false;
  c.st++;
  if (c.bumpCooldown > 0) c.bumpCooldown--;
  if (c.landT > 0) c.landT--;
  if (c.emoteT > 0 && --c.emoteT === 0) c.emote = 0;
  if (inp.emote) {
    c.emote = inp.emote;
    c.emoteT = 150;
  }

  if (c.state === ST.RESPAWN) {
    if (--c.timer <= 0) world.respawn(c);
    return;
  }
  if (!c.active) return;
  if (c.iframes > 0 && c.iframes < IFRAMES_UNTIL_GETUP) c.iframes--;

  unstick(space, c);
  // gêiser em erupção lança quem está parado em cima
  if (c.grounded && c.ground && c.ground.erupt && c.ground.bounce && c.state !== ST.RAGDOLL) onLand(c, 0, world);

  // --- estados e entradas
  let move = 0;
  switch (c.state) {
    case ST.IDLE:
    case ST.RUN:
    case ST.JUMP:
    case ST.FALL:
      move = inp.move;
      handleJumpInput(c, inp, world);
      break;
    case ST.STUMBLE:
      move = inp.move * T.stumble.control;
      if (--c.timer <= 0) setState(c, c.grounded ? ST.IDLE : ST.FALL);
      break;
    case ST.DIVE:
      move = inp.move; // a aceleração é que é reduzida (airControl)
      break;
    case ST.SLIDE:
      if (--c.timer <= 0 || abs(c.vx - c.groundVx) < T.dive.slideStop) enterGetup(c);
      break;
    case ST.PRONE:
    case ST.SQUASH:
      if (inp.jump) c.timer -= T.prone.mashStep;
      if (--c.timer <= 0 && c.grounded) enterGetup(c);
      break;
    case ST.GETUP:
      if (--c.timer <= 0) {
        setState(c, ST.IDLE);
        c.iframes = T.iframesAfterGetup;
      }
      break;
    case ST.CELEBRATE:
    case ST.WIN:
      if (c.timer > 0 && --c.timer === 0) world.onCelebrateEnd(c);
      break;
    case ST.RAGDOLL:
      c.spin += c.spinV * dt;
      // rodopiando no ar por muito tempo (corrente de ventilador, buraco negro): recupera o controle
      if (c.st > 96 && !c.grounded) {
        setState(c, ST.FALL);
        c.spin = 0;
        c.iframes = 30;
      }
      break;
    default:
      break;
  }
  if (c.state === ST.IDLE && abs(move) > 0.05) setState(c, ST.RUN);
  if (move !== 0 && isControllable(c)) c.facing = move > 0 ? 1 : -1;

  // --- velocidade horizontal
  const st = c.state;
  if (st === ST.IDLE || st === ST.RUN || st === ST.JUMP || st === ST.FALL || st === ST.STUMBLE || st === ST.DIVE) {
    let target = move * P.run;
    let prm;
    let base = 0;
    if (c.grounded) {
      prm = surfaceParams(c, P);
      base = c.groundVx;
      if (c.onRamp && c.ground && target !== 0) {
        const s = c.ground.slope;
        const downhill = sign(s) === sign(target);
        target *= downhill ? 1 + T.ramp.down * abs(s) : 1 - T.ramp.up * abs(s);
      }
    } else {
      prm = P.air;
    }
    const k = st === ST.DIVE ? T.dive.airControl : 1;
    // lançado por trampolim/gêiser: voo balístico — sem arrasto ao soltar o direcional e sem
    // perder o impulso segurando para frente; só empurrar para trás freia
    const ballistic =
      c.launched &&
      !c.grounded &&
      (target === 0 || (c.launched === 2 ? sign(target) === sign(c.vx) : sign(target) === sign(c.vx) && abs(c.vx) >= abs(target)));
    if (!ballistic) c.vx = base + accelToward(c.vx - base, target, prm, dt, k);
    if (c.grounded && st === ST.RUN && abs(move) < 0.05 && abs(c.vx - base) < 4) setState(c, ST.IDLE);
  } else if (st === ST.RAGDOLL) {
    c.vx *= T.ragdoll.drag;
  } else if (c.grounded) {
    const base = c.groundVx;
    const ice = c.groundMat === 'ice' ? 0.15 : 1;
    const fr = st === ST.SLIDE ? T.dive.slideFriction : P.ground.decel;
    c.vx = base + approach(c.vx - base, 0, fr * dt * ice);
  } else {
    c.vx = approach(c.vx, 0, P.air.decel * dt);
  }

  // --- gravidade e forças
  if (!c.grounded) {
    c.airTicks++;
    if (c.coyote > 0) c.coyote--;
    let g = P.gFall;
    if (st === ST.JUMP && c.vy < 0 && inp.jumpHeld && !c.noCut) g = P.gRise;
    c.vy += g * dt;
    if (st === ST.JUMP) {
      c.jumpTicks++;
      if (!c.noCut && !inp.jumpHeld && c.jumpTicks >= P.jumpCutMinTicks && c.vy < -P.jumpCutV) c.vy = -P.jumpCutV;
      if (c.vy >= 0) setState(c, ST.FALL);
    }
    if (c.vy > P.maxFall) c.vy = P.maxFall;
  }
  world.applyForces(c, dt);

  // --- movimento
  moveX(space, c, c.vx * dt);
  if (c.hitWall) {
    if (c.state === ST.RAGDOLL) c.vx = -c.vx * T.ragdoll.wallK;
    else c.vx = c.grounded ? c.groundVx : 0;
  }
  if (c.landed) {
    // pegou uma rampa no ar durante o passo horizontal
    const vy = c.vy;
    c.landed = false;
    onLand(c, vy, world);
  }
  if (c.leftGround) becomeAirborne(c, world); // saiu andando de uma borda
  if (!c.grounded) {
    const vyBefore = c.vy;
    moveY(space, c, c.vy * dt);
    if (c.headHit && c.vy < 0) c.vy = 0;
    if (c.landed) onLand(c, vyBefore, world);
  } else if (!refreshSupport(space, c)) {
    becomeAirborne(c, world);
  }
}

/** Caixa de dano (hurtbox) atual: [x0, y0, x1, y1). */
export function hurtBox(c, out) {
  const H = T.hurt;
  out.x0 = c.x - HW + H.inset;
  out.x1 = c.x + HW - H.inset;
  out.y0 = c.y - BH + H.top;
  out.y1 = c.y;
  return out;
}
