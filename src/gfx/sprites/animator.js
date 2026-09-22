// Estado da simulação → quadro de animação (índice no atlas), rotação e escala.
import { ST } from '../../sim/character.js';
import { FRAME } from './poses.js';

const RUN = [FRAME.run0, FRAME.run1, FRAME.run2, FRAME.run3, FRAME.run4, FRAME.run5];
const GETUP = [FRAME.getup0, FRAME.getup1, FRAME.getup2, FRAME.getup3];
const CELEB = [FRAME.celebrate0, FRAME.celebrate1, FRAME.celebrate2, FRAME.celebrate3];
const EMOTES = {
  1: [FRAME.wave0, FRAME.wave1],
  2: [FRAME.dance0, FRAME.dance1, FRAME.dance2, FRAME.dance3],
  3: [FRAME.sad0, FRAME.sad1],
  4: [FRAME.laugh0, FRAME.laugh1],
};
const SPIN_STEP = (Math.PI * 2) / 16;

/** Estado de animação guardado por personagem no render. */
export function makeAnimState() {
  return { dist: 0, lastX: 0, frame: 0, rot: 0, sx: 1, sy: 1, t: 0 };
}

/**
 * Escolhe o quadro. `t` = tempo de render (s), `x` = posição interpolada.
 */
export function animate(c, a, t, x, dt) {
  const dx = x - a.lastX;
  a.lastX = x;
  a.t += dt;
  a.rot = 0;
  a.sx = 1;
  a.sy = 1;
  const desync = c.slot * 0.37;
  switch (c.state) {
    case ST.IDLE: {
      if (c.emote && EMOTES[c.emote]) {
        const fr = EMOTES[c.emote];
        a.frame = fr[Math.floor((t + desync) * (c.emote === 2 ? 8 : 5)) % fr.length];
        break;
      }
      if (c.landT > 0) {
        a.frame = FRAME.land;
        break;
      }
      const blink = ((t + desync) % 3.2) < 0.12;
      a.frame = blink ? FRAME.blink : Math.floor((t + desync) * 2) % 2 ? FRAME.idle1 : FRAME.idle0;
      break;
    }
    case ST.RUN: {
      if (c.landT > 2) {
        a.frame = FRAME.land;
        break;
      }
      a.dist += Math.abs(dx);
      a.frame = RUN[Math.floor(a.dist / 5) % 6];
      break;
    }
    case ST.JUMP:
      a.frame = c.vy < -120 ? FRAME.jumpUp : FRAME.jumpApex;
      break;
    case ST.FALL:
      a.frame = c.vy < 60 ? FRAME.jumpApex : Math.floor((t + desync) * 8) % 2 ? FRAME.fall1 : FRAME.fall0;
      break;
    case ST.DIVE:
      a.frame = FRAME.dive;
      a.rot = c.vy > 120 ? 0.3 * Math.sign(c.facing) : c.vy < -40 ? -0.2 * Math.sign(c.facing) : 0;
      break;
    case ST.SLIDE:
      a.frame = FRAME.slide;
      break;
    case ST.STUMBLE:
      a.frame = Math.floor(c.st / 5) % 2 ? FRAME.stumble1 : FRAME.stumble0;
      break;
    case ST.RAGDOLL: {
      a.frame = Math.floor(c.st / 6) % 2 ? FRAME.tumble1 : FRAME.tumble0;
      a.rot = Math.round(c.spin / SPIN_STEP) * SPIN_STEP * (c.facing < 0 ? -1 : 1);
      if (c.st < 5) a.frame = FRAME.hit;
      break;
    }
    case ST.PRONE:
      a.frame = FRAME.prone;
      break;
    case ST.GETUP: {
      const k = 1 - Math.max(0, c.timer) / 18;
      a.frame = GETUP[Math.min(3, Math.floor(k * 4))];
      break;
    }
    case ST.SQUASH:
      a.frame = FRAME.squash;
      a.sx = 1.3;
      a.sy = 0.45;
      break;
    case ST.CELEBRATE:
    case ST.WIN:
      if (c.emote && EMOTES[c.emote]) {
        const fr = EMOTES[c.emote];
        a.frame = fr[Math.floor((t + desync) * 6) % fr.length];
      } else a.frame = CELEB[Math.floor((t + desync) * 8) % 4];
      break;
    default:
      a.frame = FRAME.idle0;
  }
  return a;
}
