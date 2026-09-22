// Renderer: compõe céu, parallax, geometria, obstáculos, personagens e efeitos
// no canvas de baixa resolução. Só lê a simulação.
import { DT, LANE_DY } from '../core/constants.js';
import { Camera } from './camera.js';
import { Islands } from './islands.js';
import { Parallax } from './parallax.js';
import { getAtlas, getFlashAtlas } from './sprites/atlas.js';
import { animate, makeAnimState } from './sprites/animator.js';
import { ATLAS_COLS, CELL } from './sprites/poses.js';
import { paintFinishGate, drawCheckpoint, drawStartGate } from './props/gates.js';
import { getTheme } from './themes/index.js';
import { drawObstacles } from './props/index.js';
import './props/basic.js';
import './props/extra.js';
import { Particles } from './particles.js';
import { Weather } from './weather.js';
import { ST } from '../sim/character.js';

const HIDDEN = new Set([ST.RESPAWN, ST.ELIM, ST.DONE]);

export class Renderer {
  constructor(display) {
    this.display = display;
    this.ctx = display.ctx;
    this.camera = new Camera();
    this.world = null;
    this.islands = null;
    this.parallax = null;
    this.anim = [];
    this.focus = 0;
    this.time = 0;
    this.drawList = [];
    this.particles = new Particles();
    this.weather = new Weather();
    this.weatherScale = 1;
    this.showNames = false;
    this.shakeEnabled = true;
    this.startOpen = 0;
    this.overlay = null; // função extra de desenho (debug)
  }

  setWorld(world, focusSlot = 0) {
    this.world = world;
    this.theme = getTheme(world.level.theme);
    if (this.islands) this.islands.dispose();
    this.islands = new Islands(world.level, this.theme);
    this.parallax = new Parallax(this.theme, world.seed & 0xffff);
    this.anim = [];
    for (const c of world.chars) this.anim[c.slot] = makeAnimState();
    this.finishGate = world.level.finish ? paintFinishGate(this.theme) : null;
    this.camera.setBounds(world.level.camBounds);
    this.camera.initialized = false;
    this.camera.mode = 'follow';
    this.focus = focusSlot;
    this.particles.clear();
    this.weather.setup(this.theme.weather, this.weatherScale);
    this.startOpen = 0;
    const seen = new Set(world.chars.map((c) => c.skin));
    for (const s of seen) getAtlas(s);
  }

  setFocus(slot) {
    this.focus = slot;
  }

  /** Posição interpolada de um personagem. */
  lerpPos(c, alpha) {
    if (c.snap) return [c.x, c.y];
    return [c.px + (c.x - c.px) * alpha, c.py + (c.y - c.py) * alpha];
  }

  render(alpha, frameDt) {
    const w = this.world;
    if (!w) return;
    const ctx = this.ctx;
    const L = this.display.layout;
    const vw = L.vw;
    const vh = L.vh;
    this.time += frameDt;
    const cam = this.camera;
    cam.setView(vw, vh);
    const renderT = (w.tick - 1 + alpha) * DT;

    // câmera
    const focus = w.bySlot[this.focus] || w.chars[0];
    if (cam.mode === 'tween') cam.updateTween(frameDt);
    else if (focus) {
      const [fx, fy] = this.lerpPos(focus, alpha);
      if (focus.active || !cam.initialized) cam.follow(frameDt, fx, fy, focus.facing, focus.vx);
    }
    cam.updateShake(frameDt, this.shakeEnabled);
    const cx = cam.rx;
    const cy = cam.ry;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    this.parallax.draw(ctx, cx, cy, vw, vh, w.level.camBounds.y0 + 200);
    this.weather.update(frameDt);
    this.weather.draw(ctx, cx, cy, vw, vh, false);
    this.islands.draw(ctx, cx, cy, vw, vh);

    // portal de chegada (arco de fundo)
    const fin = w.level.finish;
    if (fin && this.finishGate) {
      const g = this.finishGate;
      ctx.drawImage(g.canvas, fin.x - g.ax - cx, fin.y - g.ay - cy + 2);
    }
    // checkpoints e largada
    const human = w.chars.find((c) => c.human);
    for (const d of w.level.decor) {
      if (d.kind === 'checkpoint') {
        if (d.x < cx - 20 || d.x > cx + vw + 20) continue;
        const on = human ? human.checkpoint >= d.index : false;
        drawCheckpoint(ctx, d.x - cx, d.y - cy - 10, on, this.time);
      } else if (d.kind === 'startGate') {
        if (w.status !== 'countdown') this.startOpen = Math.min(1, this.startOpen + frameDt * 3);
        drawStartGate(ctx, d.x - cx, d.y - cy - 10, this.startOpen, this.theme);
      }
    }

    // obstáculos atrás dos personagens
    drawObstacles(ctx, w, this.theme, renderT, cx, cy, vw, vh, 'back');

    // personagens ordenados por faixa (fundo → frente); humano por último
    const list = this.drawList;
    list.length = 0;
    for (const c of w.chars) {
      if (!c.active || HIDDEN.has(c.state)) continue;
      const [x, y] = this.lerpPos(c, alpha);
      if (x < cx - 40 || x > cx + vw + 40 || y < cy - 40 || y > cy + vh + 60) {
        this.anim[c.slot].lastX = x;
        continue;
      }
      const key = (3 - c.lane) * 10 + (c.human ? 5 : 0) + (c.slot === this.focus ? 4 : 0);
      list.push({ c, x, y, key });
    }
    list.sort((a, b) => a.key - b.key);
    drawObstacles(ctx, w, this.theme, renderT, cx, cy, vw, vh, 'span');
    for (const it of list) this.drawShadow(ctx, it.c, it.x, it.y, cx, cy);
    for (const it of list) this.drawChar(ctx, it.c, it.x, it.y, cx, cy, frameDt);
    drawObstacles(ctx, w, this.theme, renderT, cx, cy, vw, vh, 'front');

    this.particles.update(frameDt);
    this.particles.draw(ctx, cx, cy);
    this.weather.draw(ctx, cx, cy, vw, vh, true);

    // marcador ▼ sobre o jogador focado
    if (focus && focus.active && !HIDDEN.has(focus.state)) {
      const [x, y] = this.lerpPos(focus, alpha);
      this.drawMarker(ctx, Math.round(x) - cx, Math.round(y) - cy - LANE_DY[focus.lane]);
    }
    if (this.overlay) this.overlay(ctx, cx, cy, vw, vh);
  }

  drawShadow(ctx, c, x, y, cx, cy) {
    let gy = y;
    if (!c.grounded) {
      const d = this.world.space.groundBelow(Math.round(x), Math.round(y), 4, 120);
      if (d < 0) return;
      gy = y + d;
    }
    const h = gy - y;
    const k = Math.max(0, 1 - h / 120);
    const sw = Math.round(4 + 5 * k);
    const sx = Math.round(x) - cx;
    const sy = Math.round(gy) - cy - LANE_DY[c.lane] - 1;
    ctx.fillStyle = 'rgba(8,24,72,0.28)';
    ctx.fillRect(sx - sw, sy, sw * 2, 1);
    ctx.fillRect(sx - sw + 2, sy + 1, sw * 2 - 4, 1);
  }

  drawChar(ctx, c, x, y, cx, cy, dt) {
    const a = animate(c, this.anim[c.slot], this.time, x, dt);
    // pisca durante invulnerabilidade pós-respawn
    if (c.iframes > 0 && c.iframes < 1000 && c.state !== ST.RAGDOLL && Math.floor(this.time * 20) % 2) return;
    const flash = c.human && c.state === ST.RAGDOLL && c.st < 4;
    const atlas = flash ? getFlashAtlas(c.skin) : getAtlas(c.skin);
    const f = a.frame;
    const sx = (f % ATLAS_COLS) * CELL;
    const sy = Math.floor(f / ATLAS_COLS) * CELL;
    const px = Math.round(x) - cx;
    const py = Math.round(y) - cy - LANE_DY[c.lane];
    const face = c.facing < 0 ? -1 : 1;
    if (a.rot === 0 && a.sx === 1 && a.sy === 1) {
      if (face > 0) ctx.drawImage(atlas, sx, sy, CELL, CELL, px - 16, py - 32, CELL, CELL);
      else {
        ctx.setTransform(-1, 0, 0, 1, px, 0);
        ctx.drawImage(atlas, sx, sy, CELL, CELL, -16, py - 32, CELL, CELL);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
      return;
    }
    // rotação (cambalhota) em torno do centro do corpo; escala (achatado) a partir dos pés
    ctx.translate(px, py - (a.rot ? 10 : 0));
    ctx.scale(face * a.sx, a.sy);
    if (a.rot) ctx.rotate(a.rot * face);
    ctx.drawImage(atlas, sx, sy, CELL, CELL, -16, a.rot ? -22 : -32, CELL, CELL);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  drawMarker(ctx, x, y) {
    const bob = Math.floor(this.time * 4) % 2;
    const my = y - 34 - bob;
    ctx.fillStyle = '#161028';
    ctx.fillRect(x - 5, my - 1, 11, 1);
    ctx.fillRect(x - 5, my, 1, 2);
    ctx.fillRect(x + 5, my, 1, 2);
    ctx.fillRect(x - 4, my + 2, 1, 1);
    ctx.fillRect(x + 4, my + 2, 1, 1);
    ctx.fillRect(x - 3, my + 3, 1, 1);
    ctx.fillRect(x + 3, my + 3, 1, 1);
    ctx.fillRect(x - 2, my + 4, 1, 1);
    ctx.fillRect(x + 2, my + 4, 1, 1);
    ctx.fillRect(x - 1, my + 5, 3, 1);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 4, my, 9, 1);
    ctx.fillRect(x - 4, my + 1, 9, 1);
    ctx.fillRect(x - 3, my + 2, 7, 1);
    ctx.fillRect(x - 2, my + 3, 5, 1);
    ctx.fillRect(x - 1, my + 4, 3, 1);
  }
}
