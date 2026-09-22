// Motor de áudio: AudioContext, barramentos (efeitos, UI, música) → limitador → saída.
// Destrava no primeiro gesto (exigência de celulares) e suspende com a aba oculta.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.vol = { master: 1, music: 0.6, sfx: 0.8 };
    this.muted = false;
    this.noise = null;
    this.waves = {};
    this.voices = 0;
    this.cool = new Map();
    const unlock = () => {
      this.unlock();
      if (this.ready) for (const ev of ['pointerup', 'touchend', 'keydown', 'click']) window.removeEventListener(ev, unlock, true);
    };
    for (const ev of ['pointerup', 'touchend', 'keydown', 'click']) window.addEventListener(ev, unlock, true);
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend().catch(() => {});
      else this.ctx.resume().catch(() => {});
    });
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = (this.ctx = new AC());
      this.master = ctx.createGain();
      this.limiter = ctx.createDynamicsCompressor();
      this.limiter.threshold.value = -6;
      this.limiter.ratio.value = 12;
      this.limiter.attack.value = 0.003;
      this.limiter.release.value = 0.15;
      this.master.connect(this.limiter).connect(ctx.destination);
      this.sfxBus = ctx.createGain();
      this.musicBus = ctx.createGain();
      this.uiBus = ctx.createGain();
      this.sfxBus.connect(this.master);
      this.musicBus.connect(this.master);
      this.uiBus.connect(this.master);
      // ruído branco (1 s) para percussão e efeitos
      const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let seed = 12345;
      for (let i = 0; i < d.length; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        d[i] = (seed / 0x7fffffff) * 2 - 1;
      }
      this.noise = buf;
      // ondas de pulso (duty 12,5 / 25 / 50%)
      for (const [k, duty] of [['p12', 0.125], ['p25', 0.25], ['p50', 0.5]]) {
        const n = 32;
        const re = new Float32Array(n);
        const im = new Float32Array(n);
        for (let i = 1; i < n; i++) re[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty);
        this.waves[k] = ctx.createPeriodicWave(re, im);
      }
      this.applyVolumes();
    }
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
    // buffer silencioso destrava iOS
    try {
      const s = this.ctx.createBufferSource();
      s.buffer = this.ctx.createBuffer(1, 1, 22050);
      s.connect(this.ctx.destination);
      s.start(0);
    } catch {
      /* ignora */
    }
    this.ready = this.ctx.state === 'running' || true;
  }

  setVolume(kind, v) {
    this.vol[kind] = v;
    this.applyVolumes();
  }

  setMuted(m) {
    this.muted = m;
    this.applyVolumes();
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const m = this.muted ? 0 : this.vol.master;
    this.master.gain.setTargetAtTime(m, t, 0.02);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx * this.vol.sfx, t, 0.02);
    this.uiBus.gain.setTargetAtTime(this.vol.sfx * this.vol.sfx, t, 0.02);
    this.musicBus.gain.setTargetAtTime(this.vol.music * this.vol.music * 0.7, t, 0.02);
  }

  /** Oscilador com envelope. o: { type ('p25'|'triangle'|...), f0, f1, curve, dur, a, vol, bus, at, detune } */
  tone(o) {
    const ctx = this.ctx;
    if (!ctx || this.voices > 24) return;
    const t = o.at ?? ctx.currentTime;
    const osc = ctx.createOscillator();
    if (this.waves[o.type]) osc.setPeriodicWave(this.waves[o.type]);
    else osc.type = o.type || 'square';
    const g = ctx.createGain();
    const dur = o.dur ?? 0.12;
    const a = o.a ?? 0.005;
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1) {
      if (o.curve === 'lin') osc.frequency.linearRampToValueAtTime(o.f1, t + dur);
      else osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + dur);
    }
    if (o.detune) osc.detune.value = o.detune;
    const v = o.vol ?? 0.3;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc.connect(g);
    if (o.pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = o.pan;
      node = g.connect(p);
    } else node = g;
    node.connect(o.bus || this.sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
    this.voices++;
    osc.onended = () => this.voices--;
  }

  /** Ruído filtrado. o: { filter ('lowpass'|'highpass'|'bandpass'), f0, f1, q, dur, vol, bus, at } */
  noiseHit(o) {
    const ctx = this.ctx;
    if (!ctx || !this.noise || this.voices > 24) return;
    const t = o.at ?? ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = o.filter || 'lowpass';
    f.frequency.setValueAtTime(o.f0 ?? 1000, t);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + (o.dur ?? 0.1));
    f.Q.value = o.q ?? 1;
    const g = ctx.createGain();
    const dur = o.dur ?? 0.1;
    const v = o.vol ?? 0.3;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + (o.a ?? 0.003));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(o.bus || this.sfxBus);
    src.start(t, Math.random() * 0.8);
    src.stop(t + dur + 0.02);
    this.voices++;
    src.onended = () => this.voices--;
  }

  /** Evita repetir o mesmo som mais rápido que `ms`. */
  cooldown(key, ms) {
    if (!this.ctx) return false;
    const now = this.ctx.currentTime * 1000;
    const last = this.cool.get(key) || -1e9;
    if (now - last < ms) return false;
    this.cool.set(key, now);
    return true;
  }
}
