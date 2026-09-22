// Perfis de habilidade dos bots e mistura por dificuldade do jogo (docs/design/motor.md §5.7).
// Habilidade nunca vira bônus de física: só decisões, reação, precisão e velocidade analógica.
import { Rng, hash32 } from '../../core/rng.js';

export const PROFILES = {
  easy: { name: 'easy', think: 18, react: 15, horizon: 40, cands: 6, noise: 4, margin: 0, mistake: 0.15, blunder: 0.02, mag: [0.85, 0.95], go: [18, 9], mash: 2, dazed: 24, dive: false },
  normal: { name: 'normal', think: 13, react: 9, horizon: 54, cands: 9, noise: 2, margin: 2, mistake: 0.06, blunder: 0.005, mag: [0.93, 1.0], go: [11, 6], mash: 4, dazed: 15, dive: true },
  hard: { name: 'hard', think: 10, react: 5, horizon: 66, cands: 12, noise: 1, margin: 2, mistake: 0.02, blunder: 0.001, mag: [1, 1], go: [6, 4], mash: 7, dazed: 6, dive: true },
  // "oráculo" do simulador: sem ruído, horizonte longo (detecta fases/planejador quebrados)
  oracle: { name: 'oracle', think: 6, react: 0, horizon: 90, cands: 12, noise: 0, margin: 2, mistake: 0, blunder: 0, mag: [1, 1], go: [0, 0], mash: 10, dazed: 0, dive: true },
};

export const MIXES = {
  easy: [0.6, 0.35, 0.05],
  normal: [0.25, 0.55, 0.2],
  hard: [0.05, 0.45, 0.5],
};

export const PERSONALITIES = ['neutral', 'cautious', 'aggressive'];

/** Sorteia perfis e personalidades para os bots de uma partida (determinístico). */
export function assignProfiles(seed, slots, difficulty = 'normal') {
  const r = new Rng(hash32(seed, 'profiles', difficulty));
  const mix = MIXES[difficulty] || MIXES.normal;
  const out = {};
  for (const s of slots) {
    const u = r.next();
    const p = u < mix[0] ? 'easy' : u < mix[0] + mix[1] ? 'normal' : 'hard';
    out[s] = { profile: p, personality: PERSONALITIES[r.int(3)], rating: p === 'easy' ? 1 : p === 'normal' ? 2 : 3 };
  }
  return out;
}
