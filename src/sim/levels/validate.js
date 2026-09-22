// Validador de fases: confere cada vão anotado (b.noteGap) contra o alcance real do pulo
// (integrado com os parâmetros do tuning) e contra os limites de desenho do slot.
// Vãos atravessados com ajuda (gêiser, trampolim, roda, ventilador) levam { assist }.
import { makePhys } from '../tuning.js';
import { designLimits } from '../limits.js';

const DT = 1 / 60;

/** Alcance (deslocamento do centro, px) de um pulo segurado, correndo, até pousar `rise` px acima. */
export function reachAt(phys, rise, run = phys.run) {
  let y = 0;
  let vy = -phys.jumpV;
  let t = 0;
  for (let k = 0; k < 900; k++) {
    const g = vy < 0 ? phys.gRise : phys.gFall;
    vy = Math.min(vy + g * DT, phys.maxFall);
    y += vy * DT;
    t += DT;
    if (vy > 0 && -y <= rise) return run * t;
  }
  return 0;
}

/**
 * Devolve a lista de problemas: { level, x0, x1, width, rise, severity: 'impossível' | 'limite', msg }.
 * 'impossível' = nem um pulo perfeito atravessa (ou o degrau é alto demais); 'limite' = acima do guia de desenho.
 */
export function validateLevel(level) {
  const phys = makePhys(level.physics || 'normal');
  const lim = designLimits(level.slot || 1, level.physics);
  const out = [];
  // o personagem pode sair com o centro 4 px além da borda e pousar com o centro 4 px antes da outra
  const SLACK = 8;
  for (const g of level.gaps || []) {
    if (g.assist) continue;
    const width = g.x1 - g.x0;
    const rise = g.h1 - g.h0;
    const reach = reachAt(phys, Math.max(rise, -400)) + SLACK;
    const base = { level: level.id, x0: g.x0, x1: g.x1, width, rise };
    if (rise > lim.step + 16 || width > reach - 2) {
      out.push({ ...base, severity: 'impossível', msg: `vão ${width} px (${rise >= 0 ? '+' : ''}${rise}) além do alcance ${Math.round(reach)}` });
    } else if (width > (rise >= 24 ? lim.gapRising : lim.gap) + Math.max(0, -rise) * 0.5 || rise > lim.step) {
      out.push({ ...base, severity: 'limite', msg: `vão ${width} px (${rise >= 0 ? '+' : ''}${rise}) acima do guia do slot ${level.slot}` });
    }
  }
  return out;
}
