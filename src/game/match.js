// Uma rodada jogável: mundo + controladores + HUD + render + espectador.
import { World } from '../sim/world.js';
import { RaceRules } from '../sim/rules/race.js';
import { SurvivalRules } from '../sim/rules/survival.js';
import { FinalRules } from '../sim/rules/final.js';
import { FreeRules } from '../sim/rules/common.js';
import { buildLevel } from '../sim/levels/catalog.js';
import { makeInput } from '../sim/input.js';
import { ST } from '../sim/character.js';
import { BotController } from '../sim/bots/botController.js';
import { assignProfiles } from '../sim/bots/profiles.js';

export function makeRules(level, o = {}) {
  switch (level.type) {
    case 'race':
      return new RaceRules({ quota: o.quota ?? 16, timeLimit: Math.max(150, (level.target || 70) * 2), countdown: o.countdown });
    case 'survival':
      return new SurvivalRules({ target: o.target ?? 4, timeLimit: level.timeLimit ?? 90, countdown: o.countdown });
    case 'final':
      return new FinalRules({ countdown: o.countdown });
    default:
      return new FreeRules();
  }
}

const HIDDEN = new Set([ST.RESPAWN, ST.ELIM, ST.DONE]);

export class Match {
  /**
   * o: { renderer, hud, fx, human (HumanController), levelId, roster, humanSlot, seed,
   *      quota, target, botFactory(world, slot) → Controller, onEnd(result, match), training }
   */
  constructor(o) {
    this.o = o;
    this.level = buildLevel(o.levelId);
    this.introTicks = Math.round((o.intro || 0) * 60);
    this.rules = makeRules(this.level, { ...o, countdown: 180 + this.introTicks });
    if (o.training && this.level.type === 'race') this.rules.quota = o.roster.length;
    this.world = new World(this.level, { seed: o.seed, roster: o.roster, rules: this.rules });
    this.humanSlot = o.humanSlot === undefined ? 0 : o.humanSlot; // null = só bots (assistindo)
    this.inputs = [];
    for (const c of this.world.chars) this.inputs[c.slot] = makeInput();
    this.bots = [];
    const profs = o.profiles || assignProfiles(o.seed, this.world.chars.map((c) => c.slot), o.difficulty || 'normal');
    for (const c of this.world.chars) {
      if (c.human) continue;
      this.bots[c.slot] = o.botFactory ? o.botFactory(this.world, c.slot) : new BotController(this.world, c.slot, profs[c.slot]);
    }
    this.renderer = o.renderer;
    this.hud = o.hud;
    this.fx = o.fx;
    this.focus = this.humanSlot ?? this.world.chars[0].slot;
    this.renderer.setWorld(this.world, this.focus);
    this.spectating = this.humanSlot === null;
    this.introPending = this.introTicks > 0;
    this.humanDoneAt = 0;
    this.ended = false;
    this.autoplay = o.autoplay ? new BotController(this.world, this.humanSlot, { profile: 'hard' }) : null;
    this.unsub = this.fx.on((e) => this.onEvent(e));
    this.renderer.overlay = (ctx, cx, cy, vw, vh) => this.drawOverlay(ctx, cx, cy, vw, vh);
    if (this.hud) {
      this.hud.setVisible(!this.introTicks);
      this.hud.setObjective(this.level.objective || 'CORRA ATÉ A CHEGADA!');
      this.hud.hideBanner();
      this.hud.showSpectate(this.spectating, this.spectating ? this.world.bySlot[this.focus].name : '');
      this.hud.setGold(false);
    }
  }

  /** Sobrevoo da apresentação: da chegada (ou do alto da arena) até a largada. */
  startIntroCamera() {
    const cam = this.renderer.camera;
    const L = this.renderer.display.layout;
    cam.setView(L.vw, L.vh);
    const lvl = this.level;
    const f = this.world.bySlot[this.focus];
    cam.snapTo(f.x, f.y, 1);
    const toX = cam.x;
    const toY = cam.y;
    let fromX = toX;
    let fromY = toY;
    if (lvl.type === 'race' && lvl.finish) {
      cam.snapTo(lvl.finish.x, lvl.finish.y, 1);
      fromX = cam.x;
      fromY = cam.y;
    } else if (lvl.introFrom) {
      // arenas verticais: desce do topo até a largada
      cam.snapTo(lvl.introFrom.x, lvl.introFrom.y, 1);
      fromX = cam.x;
      fromY = cam.y;
    } else {
      fromY = toY - 120;
    }
    const dur = Math.max(1.5, this.introTicks / 60 - 0.6);
    cam.startTween(fromX, fromY, toX, toY, dur);
  }

  /** Pula a apresentação: começa a contagem 3-2-1 agora. */
  skipIntro() {
    const r = this.rules;
    if (r.phase !== 'countdown') return;
    const w = this.world;
    if (r.countdown - w.tick > 180) r.countdown = w.tick + 180;
    this.renderer.camera.tween = null;
    this.renderer.camera.mode = 'follow';
    this.renderer.camera.initialized = false;
    this.endIntro();
  }

  endIntro() {
    if (this.introDone) return;
    this.introDone = true;
    if (this.hud) {
      this.hud.setVisible(true);
      this.hud.setObjective(this.level.objective || 'CORRA ATÉ A CHEGADA!');
    }
    if (this.o.onIntroEnd) this.o.onIntroEnd(this);
  }

  get human() {
    return this.humanSlot === null ? null : this.world.bySlot[this.humanSlot];
  }

  step() {
    const w = this.world;
    const hs = this.humanSlot;
    if (hs !== null) {
      if (this.autoplay) this.autoplay.write(w, hs, this.inputs[hs]);
      else if (this.o.human) this.o.human.write(this.inputs[hs]);
    }
    for (let i = 0; i < this.bots.length; i++) {
      const b = this.bots[i];
      if (b) b.write(w, i, this.inputs[i]);
    }
    w.step(this.inputs);
    this.fx.drain(w);
    if (!this.introDone && this.rules.phase === 'countdown' && this.rules.countdown - w.tick <= 180) this.endIntro();
    if (w.status === 'over' && !this.ended) {
      this.ended = true;
      if (this.o.onEnd) this.o.onEnd(this.rules.result, this);
    }
  }

  onEvent(e) {
    const hud = this.hud;
    if (!hud) return;
    const isHuman = e.slot === this.humanSlot;
    switch (e.type) {
      case 'countdown':
        if (e.a <= 3) hud.showCount(String(e.a));
        break;
      case 'go':
        hud.showCount('VAI!', true);
        break;
      case 'qualified':
        if (isHuman) {
          const t = this.rules.type;
          hud.showBanner(t === 'race' ? 'QUALIFICADO!' : 'SOBREVIVEU!', 'good', t === 'race' ? `${e.a}º lugar` : '', 2600);
          hud.setGold(true);
          this.humanDoneAt = performance.now();
        }
        break;
      case 'eliminated':
        if (isHuman) {
          hud.showBanner('ELIMINADO!', 'bad', '', 2600);
          this.humanDoneAt = performance.now();
        }
        break;
      case 'winner':
        hud.showBanner(isHuman ? 'VOCÊ VENCEU!' : 'VENCEDOR!', 'win', isHuman ? '' : this.world.bySlot[e.slot].name, 0);
        this.focus = e.slot;
        this.renderer.setFocus(e.slot);
        break;
      case 'suddenDeath':
        hud.showBanner('MORTE SÚBITA!', 'bad', '', 1800);
        break;
      case 'boulder': {
        // pedra gigante solta: avisa quem está por perto
        const f = this.world.bySlot[this.focus];
        if (f && Math.abs(f.x - e.x) < 700) {
          hud.showBanner('PEDRA!', 'bad', 'corra!', 1400);
          this.renderer.camera.addShake(0.6);
        }
        break;
      }
      case 'freeze':
        hud.showBanner('TUDO CONGELOU!', '', 'o chão virou gelo', 1600);
        break;
      default:
        break;
    }
  }

  /** Candidatos a espectador: corrida = quem ainda corre (por progresso); arena = vivos. */
  spectateCandidates() {
    const w = this.world;
    if (this.rules.type === 'race') {
      const racing = w.chars.filter((c) => !c.finished && c.alive && c.slot !== this.humanSlot).sort((a, b) => b.progress - a.progress);
      if (racing.length) return racing;
    }
    return w.chars.filter((c) => c.alive && c.slot !== this.humanSlot);
  }

  spectate(dir = 1) {
    const list = this.spectateCandidates();
    if (!list.length) return;
    let i = list.findIndex((c) => c.slot === this.focus);
    i = i < 0 ? 0 : (i + dir + list.length) % list.length;
    this.focus = list[i].slot;
    this.renderer.setFocus(this.focus);
    if (this.hud) this.hud.showSpectate(true, list[i].name);
  }

  updateHud() {
    const hud = this.hud;
    if (!hud) return;
    const w = this.world;
    const r = this.rules;
    if (r.type === 'race') {
      hud.setCounter('Qualificado', `${r.finishOrder.length}/${r.quota}`);
      hud.setTimer(r.phase === 'running' && r.timeLimit - r.elapsed <= 30 ? r.timeLeft : null);
      const h = this.human;
      if (h && !h.finished && h.alive && r.phase === 'running') {
        let rank = r.finishOrder.length + 1;
        for (const c of w.chars) if (c !== h && !c.finished && c.progress > h.progress) rank++;
        hud.setPosition(rank);
      } else hud.setPosition(0);
    } else if (r.type === 'survival' || r.type === 'final') {
      const alive = w.chars.filter((c) => c.alive).length;
      hud.setCounter('Vivos', `${alive}`, r.type === 'survival' ? `meta: ${r.target}` : 'último vence');
      hud.setTimer(r.phase === 'running' && r.timeLimit ? r.timeLeft : r.phase === 'running' && r.type === 'final' ? Math.max(0, r.suddenDeathAt - r.elapsed) : null);
      hud.setPosition(0);
    } else {
      hud.setCounter('Treino', '—');
      hud.setTimer(null);
    }
    hud.tick();
  }

  frame(alpha, dt) {
    if (this.introPending) {
      this.introPending = false;
      this.startIntroCamera();
    }
    // espectador automático depois que o humano termina
    const h = this.human;
    if (h && this.humanDoneAt && !this.spectating && performance.now() - this.humanDoneAt > 2200 && this.world.status === 'running') {
      if (HIDDEN.has(h.state) || h.finished || !h.alive) {
        this.spectating = true;
        this.spectate(0);
      }
    }
    if (this.spectating && this.world.status === 'running') {
      const f = this.world.bySlot[this.focus];
      if (!f || !f.active || (this.rules.type === 'race' ? f.finished : !f.alive)) this.spectate(1);
    }
    this.renderer.render(alpha, dt);
    this.updateHud();
  }

  /** Barra de progresso da corrida (a visão lateral não mostra a chegada). */
  drawOverlay(ctx, cx, cy, vw) {
    const w = this.world;
    const lvl = this.level;
    if (lvl.type !== 'race' || !lvl.finish) return;
    const x0 = lvl.start ? lvl.start.x : 0;
    const x1 = lvl.finish.x;
    const bw = Math.min(160, Math.round(vw * 0.34));
    const bx = Math.round((vw - bw) / 2);
    const by = 22;
    ctx.fillStyle = '#0f151f';
    ctx.fillRect(bx - 1, by - 1, bw + 2, 6);
    ctx.fillStyle = '#3a4458';
    ctx.fillRect(bx, by, bw, 4);
    // bandeira quadriculada no fim
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 2; j++) {
        ctx.fillStyle = (i + j) & 1 ? '#fff' : '#0f151f';
        ctx.fillRect(bx + bw + 2 + i * 2, by - 2 + j * 2, 2, 2);
      }
    const pos = (c) => bx + Math.round(Math.max(0, Math.min(1, (c.progress - x0) / (x1 - x0))) * (bw - 1));
    for (const c of w.chars) {
      if (c.slot === this.humanSlot) continue;
      ctx.fillStyle = c.finished ? '#fcd223' : '#c8d0dc';
      ctx.fillRect(pos(c), by + 1, 1, 2);
    }
    const h = this.human || this.world.bySlot[this.focus];
    if (h) {
      const px = h.finished ? bx + bw - 1 : pos(h);
      ctx.fillStyle = '#0f151f';
      ctx.fillRect(px - 2, by - 3, 5, 9);
      ctx.fillStyle = '#e32a31';
      ctx.fillRect(px - 1, by - 2, 3, 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(px - 1, by + 1, 3, 4);
    }
  }

  dispose() {
    if (this.unsub) this.unsub();
    this.renderer.overlay = null;
  }
}
