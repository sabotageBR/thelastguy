// Loop principal: simulação em passo fixo (60 Hz) + render interpolado.
import { DT } from '../core/constants.js';

export class Loop {
  /**
   * @param {object} o
   * @param {(dt:number)=>void} o.step    chamado N vezes por frame, com dt fixo
   * @param {(alpha:number, frameDt:number)=>void} o.render
   */
  constructor({ step, render, dt = DT, maxSteps = 5 }) {
    this.stepFn = step;
    this.renderFn = render;
    this.dt = dt;
    this.maxSteps = maxSteps;
    this.acc = 0;
    this.last = 0;
    this.running = false;
    this.paused = false;
    this.timeScale = 1;
    this.frameTimes = new Float32Array(120);
    this.frameIdx = 0;
    this.lastWork = 0;
    this._raf = 0;
    this._frame = this._frame.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this._raf = requestAnimationFrame(this._frame);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this._raf);
  }

  /** Reancora o relógio (ex.: ao voltar de uma aba escondida). */
  resetClock() {
    this.last = performance.now();
    this.acc = 0;
  }

  _frame(now) {
    if (!this.running) return;
    this._raf = requestAnimationFrame(this._frame);
    let frameDt = (now - this.last) / 1000;
    this.last = now;
    if (frameDt > 0.25) frameDt = 0.25;
    if (frameDt < 0) frameDt = 0;
    const t0 = performance.now();
    if (!this.paused) {
      this.acc += frameDt * this.timeScale;
      let n = 0;
      const max = this.maxSteps * Math.max(1, Math.ceil(this.timeScale));
      while (this.acc >= this.dt && n < max) {
        this.stepFn(this.dt);
        this.acc -= this.dt;
        n++;
      }
      if (n === max) this.acc = 0; // descarta tempo em vez de espiralar
    }
    this.renderFn(this.paused ? 1 : this.acc / this.dt, frameDt);
    this.lastWork = performance.now() - t0;
    // ignora intervalos anormais (aba em segundo plano, travadas do sistema)
    if (frameDt < 0.1 && !document.hidden) {
      this.frameTimes[this.frameIdx] = frameDt * 1000;
      this.frameIdx = (this.frameIdx + 1) % this.frameTimes.length;
    }
  }

  /** Percentil do tempo de frame (ms) nos últimos ~2 s. */
  framePercentile(p = 0.9) {
    const arr = Array.from(this.frameTimes).filter((v) => v > 0).sort((a, b) => a - b);
    if (!arr.length) return 0;
    return arr[Math.min(arr.length - 1, Math.floor(arr.length * p))];
  }
}
