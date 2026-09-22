// Aplicativo: junta exibição, entrada, áudio, telas, torneio e partidas.
import { Display } from '../gfx/display.js';
import { Renderer } from '../gfx/renderer.js';
import { Loop } from './loop.js';
import { Keyboard } from '../input/keyboard.js';
import { TouchControls } from '../input/touch.js';
import { Gamepad } from '../input/gamepad.js';
import { HumanController } from '../input/index.js';
import { FX } from './fx.js';
import { Hud } from '../ui/hud.js';
import { Match } from './match.js';
import { Settings } from './settings.js';
import { AudioEngine } from '../audio/engine.js';
import { Sfx } from '../audio/sfx.js';
import { Sequencer } from '../audio/sequencer.js';
import { ScreenManager } from '../ui/screens.js';
import { titleScreen, mainMenu, worldsScreen, trainingScreen, characterScreen, settingsScreen } from '../ui/menus.js';
import { lobbyScreen, introCard, resultsScreen, finalScreen, pauseScreen, trainingDone } from '../ui/flow.js';
import { Tournament } from '../sim/tournament.js';
import { levelIds, levelMeta, buildLevel } from '../sim/levels/catalog.js';
import { WORLDS } from '../sim/levels/worlds.js';
import { hash32 } from '../core/rng.js';
import { warmAtlases } from '../gfx/sprites/atlas.js';

export class App {
  constructor() {
    this.params = new URLSearchParams(location.search);
    this.settings = new Settings();
    this.display = new Display(document.getElementById('game'));
    this.renderer = new Renderer(this.display);
    this.kb = new Keyboard();
    this.touch = new TouchControls(document.getElementById('touch'));
    this.pad = new Gamepad();
    this.human = new HumanController(this.kb, this.touch, this.pad);
    this.audio = new AudioEngine();
    this.sfx = new Sfx(this.audio);
    this.music = new Sequencer(this.audio);
    this.fx = new FX(this.renderer, { onEvent: (e, w, f) => this.sfx.onEvent(e, w, f, this.viewRect()) });
    this.hud = new Hud(document.getElementById('hud'));
    this.screens = new ScreenManager(document.getElementById('screens'), this);
    this.touchMode = this.display.touch || this.params.has('touch');
    this.scene = null;
    this.tour = null;
    this.mode = 'menu';
    this.available = new Set(levelIds());
    this.applySettings();
    this.settings.onChange(() => this.applySettings());
    this.loop = new Loop({ step: () => this.step(), render: (a, dt) => this.frame(a, dt) });
    this.hud.pause.addEventListener('click', () => this.pause());
    this.hud.specPrev.addEventListener('click', () => this.scene && this.scene.spectate(-1));
    this.hud.specNext.addEventListener('click', () => this.scene && this.scene.spectate(1));
    this.hud.specSpeed.addEventListener('click', () => {
      this.loop.timeScale = this.loop.timeScale === 1 ? 2 : 1;
      this.hud.specSpeed.textContent = `${this.loop.timeScale}×`;
    });
    this.hud.specLeave.addEventListener('click', () => this.onSkipWatching());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.mode === 'match') this.pause();
      this.loop.resetClock();
    });
    this.kb.onKey((e) => {
      if (e.repeat) return;
      if ((e.code === 'Escape' || e.code === 'KeyP') && this.mode === 'match' && !this.screens.active) this.pause();
    });
    this.setupOrientation();
    this.qualityT = 0;
    this.qualityDropped = false;
  }

  // ------------------------------------------------------------------ utilidades
  viewRect() {
    const c = this.renderer.camera;
    return { x: c.x, y: c.y, w: c.vw, h: c.vh };
  }

  worldReady(id) {
    const w = WORLDS.find((x) => x.id === id);
    return !!w && w.phases.every((p) => this.available.has(p));
  }

  applySettings() {
    const s = this.settings;
    this.audio.setVolume('music', s.get('music'));
    this.audio.setVolume('sfx', s.get('sfx'));
    this.renderer.shakeEnabled = s.get('shake');
    this.fx.vibrate = s.get('vibrate');
    this.touch.configure({ size: s.get('buttonSize'), leftHanded: s.get('leftHanded'), diveButton: s.get('diveButton'), arrows: s.get('controls') === 'arrows' });
    const q = s.get('quality');
    const low = q === 'low' || (q === 'auto' && this.lowEnd());
    this.renderer.particles.setCap(low ? 80 : q === 'medium' ? 200 : 400);
    this.renderer.weatherScale = low ? 0.4 : q === 'medium' ? 0.7 : 1;
    this.display.maxVw = low ? 480 : q === 'medium' ? 560 : 640;
    this.display.resize();
    this.fpsOn = s.get('fps') || this.params.has('fps');
  }

  lowEnd() {
    const mem = navigator.deviceMemory || 8;
    const cores = navigator.hardwareConcurrency || 8;
    return this.display.touch && (mem <= 4 || cores <= 4);
  }

  toast(msg, ms = 1800) {
    const t = document.getElementById('toast');
    t.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'toast-box';
    box.textContent = msg;
    t.append(box);
    t.hidden = false;
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => (t.hidden = true), ms);
  }

  toggleFullscreen() {
    const el = document.documentElement;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (el.requestFullscreen) {
      el.requestFullscreen({ navigationUI: 'hide' })
        .then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}))
        .catch(() => this.toast('Tela cheia indisponível neste navegador'));
    } else this.toast('No iPhone: Compartilhar → Adicionar à Tela de Início');
  }

  setupOrientation() {
    const rot = document.getElementById('rotate');
    const check = () => {
      const portrait = this.display.touch && window.innerHeight > window.innerWidth * 1.05;
      rot.hidden = !portrait;
      if (portrait && this.mode === 'match' && !this.loop.paused) this.pause();
    };
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    check();
  }

  // ------------------------------------------------------------------ loop
  start() {
    this.loop.start();
    if (this.params.get('level')) {
      this.startTraining(this.params.get('level'), +(this.params.get('bots') ?? 15), { autoplay: this.params.has('autoplay') });
    } else this.showTitle();
  }

  step() {
    this.pad.poll();
    if (this.scene) this.scene.step();
    if (this.pad.pauseSerial !== this._padPause) {
      if (this._padPause !== undefined && this.mode === 'match' && !this.screens.active) this.pause();
      this._padPause = this.pad.pauseSerial;
    }
  }

  frame(alpha, dt) {
    this.screens.gamepad(this.pad);
    if (this.scene) this.scene.frame(alpha, dt);
    else {
      const ctx = this.display.ctx;
      ctx.fillStyle = '#32b7fd';
      ctx.fillRect(0, 0, this.display.layout.vw, this.display.layout.vh);
    }
    if (this.fpsOn) this.drawFps();
    this.autoQuality(dt);
  }

  drawFps() {
    const ctx = this.display.ctx;
    const ms = this.loop.framePercentile(0.5) || 16.7;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(2, this.display.layout.vh - 12, 58, 10);
    ctx.fillStyle = '#fff';
    ctx.font = '8px monospace';
    ctx.fillText(`${Math.round(1000 / ms)} fps ${this.loop.lastWork.toFixed(1)}ms`, 4, this.display.layout.vh - 4);
  }

  autoQuality(dt) {
    if (this.settings.get('quality') !== 'auto' || this.qualityDropped || this.mode !== 'match') return;
    this.qualityT += dt;
    if (this.qualityT > 3 && this.loop.framePercentile(0.9) > 19) {
      this.qualityDropped = true;
      this.renderer.particles.setCap(120);
      this.renderer.weatherScale = 0.4;
      this.display.maxVw = 480;
      this.display.resize();
      this.toast('Qualidade ajustada');
    }
  }

  setScene(scene) {
    if (this.scene && this.scene.dispose) this.scene.dispose();
    this.scene = scene;
  }

  // ------------------------------------------------------------------ fundo (atração)
  startAttract() {
    if (this.mode === 'attract' && this.scene) return;
    this.mode = 'attract';
    this.loop.paused = false;
    this.loop.timeScale = 1;
    this.hud.setVisible(false);
    this.touch.setEnabled(false);
    const seed = (Math.random() * 1e9) | 0;
    const roster = Array.from({ length: 12 }, (_, i) => ({ slot: i, name: `bot${i}`, skin: (i * 7 + 3) % 20, lane: i % 4 }));
    const m = new Match({
      renderer: this.renderer,
      hud: null,
      fx: this.fx,
      levelId: 'ceu-1',
      roster,
      humanSlot: null,
      seed,
      countdown: 60,
      onEnd: () => {
        this.scene = null;
        this.mode = 'menu';
        this.startAttract();
      },
    });
    m.rules.countdown = 30;
    this.renderer.overlay = null;
    this.setScene(m);
  }

  // ------------------------------------------------------------------ telas
  showTitle() {
    this.startAttract();
    this.music.play('menu');
    this.screens.show(titleScreen);
  }

  showMenu() {
    this.startAttract();
    this.music.play('menu');
    this.screens.show(mainMenu);
  }

  showWorlds() {
    this.screens.show(worldsScreen);
  }

  showTraining() {
    this.screens.show(trainingScreen, {});
  }

  showCharacter() {
    this.screens.show(characterScreen);
  }

  showSettings(from) {
    this.screens.show(settingsScreen, { from });
  }

  // ------------------------------------------------------------------ torneio
  startTournament(o) {
    this.audio.unlock();
    const s = this.settings;
    const seed = o.seed ?? ((Math.random() * 1e9) >>> 0);
    this.tour = new Tournament({
      seed,
      mode: o.mode,
      world: o.world,
      humanName: s.get('name') || 'Você',
      humanSkin: s.get('skin'),
      difficulty: s.get('difficulty'),
      available: this.available,
    });
    this.worldId = o.world || null;
    warmAtlases(this.tour.roster.map((r) => r.skin));
    this.screens.show(lobbyScreen, { roster: this.tour.roster, world: this.worldId, onDone: () => this.playRound() });
  }

  startTraining(levelId, bots = 15, o = {}) {
    this.audio.unlock();
    const s = this.settings;
    this.tour = new Tournament({
      seed: (Math.random() * 1e9) >>> 0,
      mode: 'train',
      levelId,
      bots,
      humanName: s.get('name') || 'Você',
      humanSkin: s.get('skin'),
      difficulty: s.get('difficulty'),
    });
    this.autoplay = !!o.autoplay;
    this.worldId = levelMeta(levelId)?.world;
    this.screens.show(lobbyScreen, { roster: this.tour.roster, fast: true, world: this.worldId, onDone: () => this.playRound() });
  }

  playRound() {
    const tour = this.tour;
    const cfg = tour.nextConfig();
    const level = buildLevel(cfg.levelId);
    const humanPlays = cfg.humanPlays;
    this.mode = 'match';
    this.loop.paused = false;
    this.loop.timeScale = 1;
    this.qualityT = 0;
    this.hud.specSpeed.textContent = '1×';
    const training = tour.mode === 'train';
    const m = new Match({
      renderer: this.renderer,
      hud: this.hud,
      fx: this.fx,
      human: this.human,
      levelId: cfg.levelId,
      roster: cfg.roster,
      profiles: cfg.profiles,
      humanSlot: humanPlays ? 0 : null,
      seed: cfg.seed,
      quota: training ? cfg.roster.length : cfg.quota,
      target: cfg.target,
      training,
      difficulty: tour.difficulty,
      intro: this.autoplay ? 0.5 : 4.5,
      autoplay: this.autoplay,
      onIntroEnd: () => {
        this.screens.clear();
        this.touch.setEnabled(humanPlays);
        this.touch.setVisible(this.touchMode);
        this.human.sync();
      },
      onEnd: (result) => this.onRoundEnd(result, humanPlays),
    });
    this.setScene(m);
    this.touch.setEnabled(false);
    this.screens.show(introCard, { cfg, level });
    const world = levelMeta(cfg.levelId)?.world || 'ceu';
    this.music.play(world, level.type === 'final' ? 1.12 : 1);
  }

  skipIntro() {
    if (this.scene && this.scene.skipIntro) this.scene.skipIntro();
  }

  onRoundEnd(result, humanWas) {
    const tour = this.tour;
    this.touch.setEnabled(false);
    this.hud.setVisible(false);
    this.hud.showSpectate(false);
    this.loop.timeScale = 1;
    if (tour.mode === 'train') {
      this.mode = 'results';
      this.screens.show(trainingDone, {
        result,
        level: buildLevel(tour.rounds[0].levelId),
        onAgain: () => this.startTraining(tour.rounds[0].levelId, tour.roster.length - 1),
        onMenu: () => this.quitToMenu(),
      });
      return;
    }
    tour.record(result);
    if (tour.over) this.recordStats();
    this.mode = 'results';
    this.screens.show(resultsScreen, {
      tour,
      result,
      humanWas,
      onNext: () => (tour.over ? this.showFinal() : this.playRound()),
      onWatch: () => (tour.over ? this.showFinal() : this.playRound()),
      onSkip: () => {
        tour.fastResolve();
        this.recordStats();
        this.showFinal();
      },
      onQuit: () => this.quitToMenu(),
    });
  }

  onSkipWatching() {
    const tour = this.tour;
    if (!tour || tour.mode === 'train') return this.quitToMenu();
    tour.fastResolve();
    this.recordStats();
    this.showFinal();
  }

  recordStats() {
    const tour = this.tour;
    if (!tour || tour._recorded) return;
    tour._recorded = true;
    this.settings.recordMatch(this.worldId || 'quick', tour.humanPlacement(), tour.winner === 0);
  }

  showFinal() {
    this.setScene(null);
    this.mode = 'final';
    this.startAttract();
    this.music.play('menu');
    this.screens.show(finalScreen, {
      tour: this.tour,
      onAgain: () => this.startTournament({ mode: this.tour.mode, world: this.worldId }),
      onMenu: () => this.quitToMenu(),
    });
    if (this.tour.winner === 0) this.sfx.onEvent({ type: 'winner' }, null, true, null);
  }

  quitToMenu() {
    this.loop.paused = false;
    this.loop.timeScale = 1;
    this.hud.setVisible(false);
    this.hud.showSpectate(false);
    this.touch.setEnabled(false);
    this.setScene(null);
    this.mode = 'menu';
    this.showMenu();
  }

  pause() {
    if (this.mode !== 'match' || this.loop.paused) return;
    this.loop.paused = true;
    this.touch.setEnabled(false);
    this.showPause();
  }

  showPause() {
    this.screens.show(pauseScreen, {
      onResume: () => this.resume(),
      onSettings: () => this.showSettings('pause'),
      onQuit: () => this.quitToMenu(),
    });
  }

  resume() {
    this.screens.clear();
    this.loop.paused = false;
    this.loop.resetClock();
    const humanPlays = this.scene && this.scene.humanSlot !== null;
    this.touch.setEnabled(humanPlays);
    this.human.sync();
  }
}
