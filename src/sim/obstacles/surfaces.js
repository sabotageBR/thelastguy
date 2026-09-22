// Superfícies especiais e perigos simples: trampolim/gêiser, esteira, bumper.
import { Obstacle, makeHazard } from './base.js';
import { registerObstacle } from './index.js';
import { Solid } from '../physics/solid.js';
import { circleBox } from '../physics/shapes.js';
import { mod } from '../../core/dmath.js';

/** Trampolim (marshmallow) ou gêiser pulsante.
 *  def: { x, y (topo), w, apex (px), vx (lançamento), aimX/aimY (alvo do pouso), pulse: {on, off} } */
export class Pad extends Obstacle {
  constructor(def, world, id) {
    super(def, world, id);
    this.w = def.w ?? 48;
    this.h = def.h ?? 12;
    // v = sqrt(2 g h) com a gravidade de queda (sem corte de pulo)
    const g = world.phys.gFall;
    this.vy = -Math.sqrt(2 * g * (def.apex ?? 104));
    this.pulse = def.pulse || null;
    this.launchVx = def.vx || 0; // velocidade horizontal fixa do lançamento (0 = mantém)
    this.aimX = def.aimX; // x do pouso (gêiser mirado); undefined = usa launchVx
    this.aimY = def.aimY; // y do chão do pouso (se diferente do topo do gêiser)
    this.lastBounce = -99;
    this.depth = 'back';
    // gêiser pulsante: os bots precisam saber quando ele vai estar ativo
    if (this.pulse) this.futureSolids = this.futureBounce;
  }

  /** Para bots: atualiza a força do quique no tempo futuro t (a posição não muda). */
  futureBounce(t, cb) {
    this.solid.bounce = this.active(t) ? this.vy : 0;
    cb(this.solid, this.solid.x, this.solid.y);
  }

  active(t) {
    if (!this.pulse) return true;
    const T = this.pulse.on + this.pulse.off;
    return mod(t + this.phase * T, T) < this.pulse.on;
  }

  init(world) {
    this.solid = new Solid({ x: this.x, y: this.y, w: this.w, h: this.h, kind: this.kind, owner: this, bounce: this.vy });
    this.solid.erupt = true; // lança também quem pisa andando (e, no gêiser, quem está parado na erupção)
    world.addStaticSolid(this.solid);
    this.env = { x: this.x, y: this.y - 24, w: this.w, h: this.h + 24 };
  }

  update(world, t) {
    this.solid.bounce = this.active(t) ? this.vy : 0;
  }

  onBounce(c, world) {
    if (!world.isGhost) this.lastBounce = world.tick;
  }

  bounds() {
    return this.env;
  }
}
registerObstacle('pad', Pad);

/** Esteira: bloco com velocidade de superfície. def: { x, y (topo), w, h, speed } */
export class Conveyor extends Obstacle {
  constructor(def, world, id) {
    super(def, world, id);
    this.w = def.w ?? 128;
    this.h = def.h ?? 24;
    this.speed = def.speed ?? -50;
    this.depth = 'back';
  }

  init(world) {
    this.solid = new Solid({ x: this.x, y: this.y, w: this.w, h: this.h, kind: 'conveyor', owner: this, conveyor: this.speed, mat: this.def.mat });
    world.addStaticSolid(this.solid);
    this.env = { x: this.x, y: this.y - 14, w: this.w, h: this.h + 14 };
  }

  bounds() {
    return this.env;
  }
}
registerObstacle('conveyor', Conveyor);

/** Bumper redondo: empurra para longe (tropeção leve). def: { x, y (centro), r } */
export class Bumper extends Obstacle {
  constructor(def, world, id) {
    super(def, world, id);
    this.r = def.r ?? 12;
    this.lastHit = -99;
    this.depth = 'span';
  }

  init(world) {
    const self = this;
    this.env = { x: this.x - this.r - 2, y: this.y - this.r - 2, w: this.r * 2 + 4, h: this.r * 2 + 4 };
    world.addHazard(
      makeHazard(this, {
        tier: 'bump',
        knock: 'radial',
        env: this.env,
        test(box, t, out) {
          if (!circleBox(self.x, self.y, self.r, box, out)) return false;
          out.vx = 0;
          out.vy = 0;
          return true;
        },
      }),
    );
  }

  bounds() {
    return this.env;
  }
}
registerObstacle('bumper', Bumper);
