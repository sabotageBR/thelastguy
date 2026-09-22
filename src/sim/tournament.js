// Torneio: 32 jogadores (humano no slot 0 + 31 bots), 4 rodadas:
// Corrida (→16), Corrida (→8), Sobrevivência (→≤4), Final (último vivo).
// Mantém quem segue vivo, a colocação final (1..32) e resolve rápido quando o humano pula.
import { Rng, hash32 } from '../core/rng.js';
import { pickNames } from './bots/names.js';
import { assignProfiles } from './bots/profiles.js';
import { WORLDS, worldById, SLOT_TYPES } from './levels/worlds.js';

export const PLAYERS = 32;

export class Tournament {
  /**
   * o: { seed, mode: 'world'|'quick'|'train', world, levelId (treino), humanName, humanSkin,
   *      difficulty, players, available: Set(ids de fases disponíveis), bots (treino) }
   */
  constructor(o) {
    this.seed = o.seed >>> 0 || 1;
    this.mode = o.mode || 'world';
    this.difficulty = o.difficulty || 'normal';
    const n = this.mode === 'train' ? Math.min(PLAYERS, (o.bots ?? 15) + 1) : o.players || PLAYERS;
    const rng = new Rng(hash32(this.seed, 'roster'));
    const names = pickNames(this.seed, n);
    const skins = [];
    for (let i = 0; i < 20; i++) if (i !== (o.humanSkin ?? 0)) skins.push(i);
    rng.shuffle(skins);
    const slots = Array.from({ length: n }, (_, i) => i);
    const profs = assignProfiles(this.seed, slots.slice(1), this.difficulty);
    this.roster = slots.map((i) =>
      i === 0
        ? { slot: 0, name: o.humanName || 'Você', skin: o.humanSkin ?? 0, human: true, lane: 0, rating: 2.2 }
        : { slot: i, name: names[i], skin: skins[i % skins.length], human: false, lane: i % 4, ...profs[i] },
    );
    this.alive = new Set(slots);
    this.humanIn = true;
    this.placement = new Array(n).fill(0);
    this.results = [];
    this.round = 0;
    this.rounds = this.planRounds(o, rng);
    this.over = false;
    this.winner = -1;
  }

  planRounds(o, rng) {
    const avail = o.available;
    const ok = (id) => !avail || avail.has(id);
    if (this.mode === 'train') return [{ levelId: o.levelId }];
    if (this.mode === 'quick') {
      return SLOT_TYPES.map((type, k) => {
        const pool = WORLDS.map((w) => w.phases[k]).filter(ok);
        return { levelId: pool.length ? pool[rng.int(pool.length)] : 'ceu-' + (k + 1) };
      });
    }
    const w = worldById(o.world);
    return w.phases.map((id, k) => ({ levelId: ok(id) ? id : 'ceu-' + (k + 1) }));
  }

  get current() {
    return this.rounds[this.round];
  }

  /** Configuração da próxima rodada: elenco (vivos), cota/meta e semente. */
  nextConfig() {
    const r = this.current;
    const alive = [...this.alive].sort((a, b) => a - b);
    const n = alive.length;
    const k = this.round;
    const quota = k === 0 ? Math.min(16, Math.floor(n / 2)) : Math.min(8, Math.floor(n / 2));
    const target = Math.min(4, Math.floor(n / 2));
    const roster = alive.map((s, i) => ({ ...this.roster[s], lane: this.roster[s].human ? 0 : (i % 3) + 1 }));
    const profiles = {};
    for (const s of alive) if (!this.roster[s].human) profiles[s] = { profile: this.roster[s].profile, personality: this.roster[s].personality };
    return {
      levelId: r.levelId,
      roster,
      profiles,
      quota: Math.max(1, quota),
      target: Math.max(1, target),
      seed: hash32(this.seed, 'round', k),
      round: k,
      rounds: this.rounds.length,
      humanPlays: this.alive.has(0),
    };
  }

  /** Registra o resultado da rodada (standings do melhor para o pior; qualified). */
  record(result) {
    this.results.push(result);
    const q = new Set(result.qualified);
    // colocação dos eliminados nesta rodada: logo abaixo de quem ainda está vivo
    const elim = result.standings.filter((s) => !q.has(s));
    let place = q.size + 1;
    // lugares já atribuídos a eliminados de rodadas anteriores ficam mais abaixo
    const taken = this.alive.size;
    place = taken - elim.length + 1;
    for (const s of elim) this.placement[s] = place++;
    this.alive = q;
    if (!q.has(0)) this.humanIn = false;
    this.round++;
    if (this.round >= this.rounds.length || q.size <= 1 || this.mode === 'train') {
      this.over = true;
      const order = result.standings.filter((s) => q.has(s));
      order.forEach((s, i) => (this.placement[s] = i + 1));
      this.winner = order[0] ?? -1;
    }
  }

  /** Resolve o resto do torneio na hora (humano pulou): por nota dos bots + ruído. */
  fastResolve() {
    const rng = new Rng(hash32(this.seed, 'fast', this.round));
    while (!this.over) {
      const cfg = this.nextConfig();
      const type = cfg.round < 2 ? 'race' : cfg.round === 2 ? 'survival' : 'final';
      const keep = type === 'race' ? cfg.quota : type === 'survival' ? cfg.target : 1;
      const order = cfg.roster
        .map((r) => ({ s: r.slot, v: (r.rating || 2) + rng.next() * 2.2 }))
        .sort((a, b) => b.v - a.v)
        .map((o) => o.s);
      this.record({ type, standings: order, qualified: order.slice(0, keep), endReason: 'fast' });
    }
  }

  humanPlacement() {
    return this.placement[0] || 0;
  }
}
