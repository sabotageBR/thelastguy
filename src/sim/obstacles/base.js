// Classe base dos obstáculos. Contrato:
//   init(world)          registra sólidos/perigos/zonas no mundo
//   update(world, t)     antes dos personagens: move sólidos cinemáticos, atualiza estado
//   post(world, t)       depois dos personagens (opcional)
//   pose(t, out)         pose pura no tempo t (render suave e bots)
//   safety(x, y, t)      contribuição de segurança para bots em arenas (opcional)
//   serialize()/deserialize(o)   só para obstáculos com estado
import { hashFloat } from '../../core/rng.js';

export class Obstacle {
  constructor(def, world, id) {
    this.id = id;
    this.type = def.type;
    this.def = def;
    this.kind = def.kind || def.type; // variante visual (tema)
    this.x = def.x || 0;
    this.y = def.y || 0;
    // Fase: padrão do designer + jitter por partida (compartilhado no grupo).
    const jitter = def.jitter ? def.jitter * hashFloat(world.seed, def.group ?? id) : 0;
    this.phase = (def.phase || 0) + jitter;
    this.depth = def.depth || 'span'; // back | span | front (ordem de desenho)
    this.world = world;
  }

  init() {}

  pose(t, out) {
    return out;
  }

  /** Envelope (retângulo) de tudo que o obstáculo pode ocupar — para culling do render. */
  bounds() {
    return { x: this.x - 32, y: this.y - 32, w: 64, h: 64 };
  }
}

/** Constrói um perigo genérico. */
export function makeHazard(owner, o) {
  return {
    owner,
    tier: o.tier || 'heavy',
    knock: o.knock || 'blend',
    dirX: o.dirX || 0,
    dirY: o.dirY || 0,
    cause: o.cause,
    env: o.env,
    test: o.test,
    active: o.active || null,
  };
}
