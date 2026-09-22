// Biblioteca de segmentos: atalhos para montar as fases (docs/design/conteudo.md §3).
// Todas as funções recebem o LevelBuilder `b`; alturas `h` acima da linha de base.

/** Chão contínuo de x0 a x1 na altura h. */
export function flat(b, x0, x1, h, o = {}) {
  return b.block(x0, h, x1 - x0, o);
}

/** Barreiras listradas em xs sobre o chão na altura h. */
export function hurdles(b, xs, h, height = 12, w = 8) {
  for (const x of xs) b.hurdle(x - w / 2, h, w, height);
}

/**
 * Sequência de blocos separados por vãos. Começa depois de um chão que termina em x0.
 * gaps[i] = largura do vão i; rises[i] = variação de altura ao aterrissar; widths[i] = largura do bloco.
 * Devolve { x, h } do fim.
 */
export function gaps(b, x0, h0, gapList, rises = [], widths = [], o = {}) {
  let x = x0;
  let h = h0;
  for (let i = 0; i < gapList.length; i++) {
    const g = gapList[i];
    const nh = h + (rises[i] || 0);
    const w = widths[i] ?? 80;
    b.noteGap(x, h, x + g, nh);
    b.block(x + g, nh, w, o);
    x += g + w;
    h = nh;
  }
  return { x, h };
}

/** Martelos-pêndulo sobre o chão na altura h (pivô `pivot` px acima do chão). */
export function pendulums(b, xs, h, o = {}) {
  const pivot = o.pivot ?? 120;
  xs.forEach((x, i) => {
    b.obstacle('pendulum', {
      x,
      y: -(h + pivot),
      length: o.length ?? 96,
      amp: o.amp ?? 55,
      period: o.period ?? 2.4,
      headW: o.headW ?? 40,
      headH: o.headH ?? 24,
      phase: o.phases ? o.phases[i] : (o.phaseStep ?? 0) * i,
      groundY: -h,
      kind: o.kind,
      jitter: o.jitter ?? 0,
      group: o.group,
    });
  });
}

/** Blocos empurradores (roxos) deslizando no chão na altura h. */
export function pushers(b, xs, h, o = {}) {
  xs.forEach((x, i) => {
    const size = o.size ?? 32;
    b.obstacle('pusher', {
      x,
      y: -(h + size),
      w: o.w ?? size,
      h: size,
      stroke: o.stroke ?? 48,
      dir: o.dirs ? o.dirs[i] : i % 2 ? -1 : 1,
      period: o.period ?? 2,
      phase: o.phases ? o.phases[i] : (i % 2) * 0.5,
      profile: o.profile || 'sine',
      kind: o.kind || 'pusher',
      impart: o.impart,
      mat: o.mat,
    });
  });
}

/** Esmagadores: blocos que descem do alto (fundo em repouso a `lift` px do chão h) até o chão. */
export function crushers(b, xs, h, o = {}) {
  const w = o.w ?? 48;
  const bh = o.h ?? 32;
  const lift = o.lift ?? 112;
  xs.forEach((x, i) => {
    b.obstacle('crusher', {
      x: x - w / 2,
      y: -(h + lift + bh),
      w,
      h: bh,
      drop: lift,
      times: o.times,
      phase: o.phases ? o.phases[i] : (o.phaseStep ?? 0) * i,
      kind: o.kind || 'crusher',
      groundY: -h,
    });
  });
}

/** Rotor (tambor com braços) com pivô `pivot` px acima do chão h. */
export function rotor(b, x, h, o = {}) {
  return b.obstacle('rotator', {
    x,
    y: -(h + (o.pivot ?? 96)),
    length: o.length ?? 84,
    arms: o.arms ?? 2,
    period: o.period ?? 6,
    dir: o.dir ?? 1,
    headR: o.headR ?? 14,
    kind: o.kind || 'hammer',
    phase: o.phase ?? 0,
    groundY: -h,
    post: o.post,
    tier: o.tier,
  });
}

/** Plataforma móvel. (x, h) = posição central de repouso (topo). */
export function mover(b, x, h, o = {}) {
  const w = o.w ?? 64;
  return b.obstacle('mover', {
    x: x - w / 2,
    y: -h,
    w,
    h: o.depth ?? 12,
    amp: o.amp ?? 40,
    period: o.period ?? 3,
    axis: o.axis || 'x',
    phase: o.phase ?? 0,
    kind: o.kind || 'mover',
    oneWay: o.oneWay,
    mat: o.mat,
  });
}

/** Trampolins (marshmallow) com topo na altura h. */
export function pads(b, xs, h, o = {}) {
  for (const x of xs) {
    const w = o.w ?? 48;
    b.obstacle('pad', { x: x - w / 2, y: -h, w, h: o.depth ?? 16, apex: o.apex ?? 104, vx: o.vx, aimX: o.aimX, aimY: o.aimH !== undefined ? -o.aimH : undefined, kind: o.kind || 'pad', pulse: o.pulse, phase: o.phase });
  }
}

/** Ponte/ladrilhos que desmoronam (topo na altura h). */
export function crumble(b, x, h, w, o = {}) {
  const tw = o.tileW ?? 16;
  return b.obstacle('crumble', {
    x,
    y: -h,
    n: Math.round(w / tw),
    tileW: tw,
    depth: o.depth ?? 12,
    delay: o.delay ?? 0.5,
    respawn: o.respawn ?? 3,
    kind: o.kind || 'crumble',
    delaySchedule: o.delaySchedule,
    randomSchedule: o.randomSchedule,
    shrinkSchedule: o.shrinkSchedule,
    standTrigger: o.standTrigger,
    oneWay: o.oneWay,
    mat: o.mat,
    look: o.look,
  });
}

export function bumper(b, x, h, r = 12) {
  return b.obstacle('bumper', { x, y: -(h + r), r });
}

export function seesaw(b, x, h, w = 128, maxAngle = 22) {
  return b.obstacle('seesaw', { x, y: -h, w, maxAngle });
}

export function conveyor(b, x, h, w, speed, o = {}) {
  return b.obstacle('conveyor', { x, y: -h, w, h: o.depth ?? 24, speed, mat: o.mat });
}

export function roller(b, x, h, o = {}) {
  return b.obstacle('roller', {
    x,
    y: -h,
    dir: o.dir ?? -1,
    speed: o.speed ?? 120,
    r: o.r ?? 12,
    grow: o.grow,
    interval: o.interval ?? 2,
    t0: o.t0 ?? 0,
    giantEvery: o.giantEvery,
    giantR: o.giantR,
    maxLife: o.maxLife,
    trigger: o.trigger,
    look: o.look,
    tier: o.tier,
    giantTier: o.giantTier,
    giantLook: o.giantLook,
    gameClock: o.gameClock,
    until: o.until,
  });
}

/** Linha de chegada com o portal FINISH e faixa quadriculada no chão. */
export function finish(b, x, h) {
  b.finishLine(x, h);
  b.deco('finishFloor', { x, y: -h });
}
