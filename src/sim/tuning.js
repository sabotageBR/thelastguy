// Parâmetros de física (px, segundos, +y para baixo, 60 Hz).
// Fonte da verdade do "feel". limits.js mede os valores reais a partir daqui.

export const TUNING = {
  body: { w: 10, h: 20 },
  // Caixa de dano mais tolerante que a de colisão: 1 px de cada lado, 3 px no topo.
  hurt: { inset: 1, top: 3 },

  run: 120,
  ground: { accel: 1000, decel: 1500, turn: 2400, over: 700 },
  air: { accel: 650, decel: 160, turn: 950, over: 120 },
  ice: { accel: 250, decel: 70, turn: 350, over: 90 },
  slide: { accel: 700, decel: 60, turn: 1200, over: 40 }, // superfícies de tobogã

  gRise: 700, // gravidade subindo com o pulo seguro
  gFall: 1000, // gravidade no resto do tempo
  maxFall: 400,
  jumpV: 290,
  jumpCutV: 110, // soltar o pulo cedo limita a subida a esta velocidade
  jumpCutMinTicks: 5,
  coyote: 6,
  buffer: 8,
  stepUp: 2,
  liftCap: 250,

  dive: {
    vx: 190,
    vy: -60,
    minAir: 6, // ticks no ar antes de aceitar mergulho
    groundVy: -120,
    airControl: 0.25,
    slideMax: 24,
    slideStop: 20,
    slideFriction: 420,
  },
  getup: 18,
  prone: { light: 21, heavy: 30, trip: 18, squash: 36, mashStep: 3, min: 9 },
  iframesAfterGetup: 30,
  respawnDelay: 60,
  respawnIframes: 60,
  celebrate: 72,
  stumble: { ticks: 12, control: 0.3 },

  // Rampas: fator na velocidade-alvo por inclinação |dy/dx| (descida / subida).
  ramp: { down: 0.42, up: 0.2 },

  // Níveis de knockback.
  knock: {
    bump: { base: 150, k: 0, min: 150, max: 150, up: 100 },
    trip: { vx: 70, vy: -90 },
    light: { base: 210, k: 0.5, min: 190, max: 300, up: 190, prone: 21 },
    heavy: { base: 300, k: 0.6, min: 280, max: 440, up: 250, prone: 30 },
  },
  ragdoll: { drag: 0.985, bounceV: 220, bounceK: 0.35, bounceX: 0.7, wallK: 0.4 },

  // Perfil de gravidade baixa (Estação Espacial).
  lowG: { g: 0.55, jump: 0.85, maxFall: 0.6, air: 0.8 },
};

/** Parâmetros efetivos para um perfil de física ('normal' | 'lowg'). */
export function makePhys(profile = 'normal') {
  const T = TUNING;
  const low = profile === 'lowg';
  const g = low ? T.lowG.g : 1;
  const j = low ? T.lowG.jump : 1;
  const airK = low ? T.lowG.air : 1;
  return {
    profile,
    run: T.run,
    gRise: T.gRise * g,
    gFall: T.gFall * g,
    maxFall: T.maxFall * (low ? T.lowG.maxFall : 1),
    jumpV: T.jumpV * j,
    jumpCutV: T.jumpCutV * j,
    jumpCutMinTicks: T.jumpCutMinTicks,
    coyote: T.coyote,
    buffer: T.buffer,
    ground: T.ground,
    air: { accel: T.air.accel * airK, decel: T.air.decel * airK, turn: T.air.turn * airK, over: T.air.over },
    ice: T.ice,
    slide: T.slide,
    dive: T.dive,
    // quantos ticks um "pulo segurado até o fim" dura em relação à gravidade normal (bots)
    holdScale: low ? (T.jumpV * j) / (T.gRise * g) / (T.jumpV / T.gRise) : 1,
  };
}
