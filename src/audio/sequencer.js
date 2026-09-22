// Sequenciador chiptune: 4 canais (lead p25/p50, harmonia, baixo triangular, ruído).
// Passos de semicolcheia; agenda com antecedência (setInterval 25 ms, janela de 0,1 s).
import { SONGS } from './songs.js';

const NOTE_RE = /^([A-G])(#|b)?(-?\d)$/;
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function freq(tok) {
  const m = NOTE_RE.exec(tok);
  if (!m) return 0;
  let n = SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (+m[3] + 1) * 12;
  return 440 * Math.pow(2, (n - 69) / 12);
}

function parse(str) {
  return str.trim().split(/\s+/);
}

export class Sequencer {
  constructor(engine) {
    this.e = engine;
    this.song = null;
    this.name = '';
    this.step = 0;
    this.next = 0;
    this.timer = 0;
    this.tempo = 1;
    this.orderIdx = 0;
    this.pendingSong = null;
  }

  play(name, tempo = 1) {
    if (this.name === name && this.song) {
      this.tempo = tempo;
      return;
    }
    const s = SONGS[name];
    if (!s) return;
    this.name = name;
    this.tempo = tempo;
    // compila padrões
    const pats = {};
    for (const [k, p] of Object.entries(s.patterns)) {
      pats[k] = {};
      for (const [ch, str] of Object.entries(p)) pats[k][ch] = parse(str);
    }
    this.song = { ...s, pats };
    this.step = 0;
    this.orderIdx = 0;
    if (!this.e.ctx) return;
    this.next = this.e.ctx.currentTime + 0.05;
    if (!this.timer) this.timer = setInterval(() => this.tick(), 25);
  }

  setTempo(k) {
    this.tempo = k;
  }

  stop() {
    this.song = null;
    this.name = '';
    clearInterval(this.timer);
    this.timer = 0;
  }

  tick() {
    const ctx = this.e.ctx;
    if (!ctx || !this.song || ctx.state !== 'running') return;
    if (this.next < ctx.currentTime - 0.2) this.next = ctx.currentTime + 0.02; // reancora após pausa
    const sp = 60 / (this.song.bpm * this.tempo) / 4;
    while (this.next < ctx.currentTime + 0.1) {
      this.schedule(this.next, sp);
      this.next += sp;
      this.step++;
    }
  }

  schedule(t, sp) {
    const s = this.song;
    const patName = s.order[this.orderIdx % s.order.length];
    const pat = s.pats[patName];
    const len = pat.len || (pat.lead ? pat.lead.length : 32);
    const i = this.step % len;
    const e = this.e;
    const bus = e.musicBus;
    for (const ch of ['lead', 'harm', 'bass']) {
      const seq = pat[ch];
      if (!seq) continue;
      const tok = seq[i];
      if (!tok || tok === '.' || tok === '-') continue;
      // duração: até o próximo token que não seja '.'
      let d = 1;
      while (d < 8 && seq[(i + d) % seq.length] === '.') d++;
      const f = freq(tok);
      if (!f) continue;
      const inst = s.inst[ch];
      e.tone({ type: inst.type, f0: f, dur: Math.max(0.05, d * sp * (inst.len ?? 0.9)), a: inst.a ?? 0.005, vol: inst.vol, bus, at: t });
    }
    const dr = pat.drums;
    if (dr) {
      const tok = dr[i];
      if (tok === 'k') {
        e.tone({ type: 'sine', f0: 150, f1: 40, dur: 0.12, vol: 0.5, bus, at: t });
      } else if (tok === 's') {
        e.noiseHit({ filter: 'bandpass', f0: 1800, q: 0.8, dur: 0.1, vol: 0.28, bus, at: t });
      } else if (tok === 'h') {
        e.noiseHit({ filter: 'highpass', f0: 7000, dur: 0.03, vol: 0.12, bus, at: t });
      } else if (tok === 'o') {
        e.noiseHit({ filter: 'highpass', f0: 6000, dur: 0.12, vol: 0.1, bus, at: t });
      } else if (tok === 't') {
        e.tone({ type: 'triangle', f0: 220, f1: 110, dur: 0.1, vol: 0.3, bus, at: t });
      }
    }
    if (i === len - 1) this.orderIdx++;
  }
}
