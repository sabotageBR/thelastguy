// Tabela de poses dos quadros (virado para a direita).
// Juntas em pé: ombro de trás (12,19), ombro da frente (18,19), quadril de trás (13,25),
// quadril da frente (16,25). Cada membro: [dx,dy do cotovelo/joelho em relação ao ombro/
// quadril, dx,dy da mão/pé em relação ao cotovelo/joelho]. Pé em repouso: y = 27.
//   bob: desloca o corpo todo em y; head: [dx,dy] extra da cabeça; face: expressão;
//   torso: 'up' | 'crouch'; rot: gira o quadro 90°×rot (horário) e apoia no chão.

const STAND = { ba: [0, 2, 0, 2], fa: [1, 2, 0, 2], bl: [0, 1, 0, 1], fl: [0, 1, 0, 1] };

function pose(o) {
  return { bob: 0, head: [0, 0], face: 'normal', torso: 'up', ...STAND, ...o };
}

function swap(p) {
  return { ...p, ba: p.fa, fa: p.ba, bl: p.fl, fl: p.bl };
}

const run0 = pose({ head: [1, 0], ba: [2, 1, 2, 0], fa: [-2, 1, -1, 2], bl: [-2, 1, -2, 0], fl: [2, 1, 2, 1] });
const run1 = pose({ bob: 1, head: [1, 0], ba: [1, 1, 2, 1], fa: [-1, 2, -1, 1], bl: [-1, 1, -2, -1], fl: [1, 1, 1, 0] });
const run2 = pose({ head: [1, -1], ba: [0, 2, 1, 1], fa: [0, 2, 0, 2], bl: [1, 0, -1, 1], fl: [0, 1, 0, 1] });

export const FRAMES = [
  ['idle0', pose({})],
  ['idle1', pose({ bob: 1, ba: [0, 2, 0, 1], fa: [1, 2, 0, 1] })],
  ['blink', pose({ face: 'blink' })],
  ['run0', run0],
  ['run1', run1],
  ['run2', run2],
  ['run3', swap(run0)],
  ['run4', swap(run1)],
  ['run5', swap(run2)],
  ['jumpUp', pose({ bob: -1, ba: [-1, -2, -1, -2], fa: [1, -2, 1, -2], bl: [-1, 1, -1, 0], fl: [2, 0, 0, 2] })],
  ['jumpApex', pose({ bob: -1, ba: [-2, -1, -2, -1], fa: [2, -1, 2, -1], bl: [-1, 1, -1, 1], fl: [1, 1, 1, 0] })],
  ['fall0', pose({ ba: [-2, -2, -1, -2], fa: [2, -2, 1, -2], bl: [-1, 1, 0, 1], fl: [1, 1, 0, 1] })],
  ['fall1', pose({ ba: [-2, -1, -2, -2], fa: [2, -1, 2, -2], bl: [-1, 1, -1, 1], fl: [1, 1, 1, 1] })],
  ['land', pose({ bob: 2, torso: 'crouch', ba: [-1, 1, -1, 1], fa: [2, 1, 1, 1], bl: [-1, 0, 0, 0], fl: [1, 0, 0, 0] })],
  ['dive', pose({ face: 'normal', ba: [0, -3, 0, -3], fa: [1, -3, 0, -3], bl: [0, 1, 0, 1], fl: [0, 1, 0, 1], rot: 1 })],
  ['slide', pose({ face: 'happy', ba: [0, -3, 0, -3], fa: [1, -3, 0, -3], bl: [0, 1, -1, 1], fl: [0, 1, 0, 1], rot: 1 })],
  ['hit', pose({ head: [-1, 0], face: 'hit', ba: [-2, -2, -1, -2], fa: [2, -2, 2, -1], bl: [-1, 1, -1, 1], fl: [2, 0, 1, 1] })],
  ['tumble0', pose({ bob: 2, torso: 'crouch', face: 'hit', ba: [1, 1, 2, 0], fa: [2, 0, 1, 1], bl: [2, -2, 0, 2], fl: [3, -1, 0, 2] })],
  ['tumble1', pose({ face: 'hit', ba: [-2, -2, -2, -1], fa: [2, -2, 2, -1], bl: [-2, 1, -2, 1], fl: [2, 1, 2, 1] })],
  ['stumble0', pose({ head: [-1, 0], face: 'wide', ba: [-2, -1, -1, -2], fa: [2, -2, 1, -2], bl: [-1, 1, -1, 1], fl: [2, 0, 1, 1] })],
  ['stumble1', pose({ head: [-1, 1], face: 'wide', ba: [-1, -2, -2, -1], fa: [1, -2, 2, -1], bl: [-2, 1, -1, 1], fl: [1, 1, 1, 1] })],
  ['prone', pose({ face: 'hit', ba: [0, 2, 0, 2], fa: [0, 2, 0, 2], bl: [0, 1, 0, 1], fl: [0, 1, 0, 1], rot: 1 })],
  ['getup0', pose({ bob: 5, torso: 'crouch', head: [2, 1], face: 'blink', ba: [1, 2, 1, 2], fa: [2, 2, 1, 2], bl: [-1, 0, -2, 0], fl: [1, 0, -1, 0] })],
  ['getup1', pose({ bob: 3, torso: 'crouch', head: [1, 0], face: 'normal', ba: [1, 2, 1, 1], fa: [2, 2, 1, 1], bl: [-1, 0, -1, 0], fl: [1, 0, 0, 0] })],
  ['getup2', pose({ bob: 2, torso: 'crouch', ba: [0, 2, 0, 1], fa: [1, 2, 1, 1], bl: [-1, 0, 0, 0], fl: [1, 0, 0, 0] })],
  ['getup3', pose({ bob: 1, ba: [0, 2, 0, 1], fa: [1, 2, 0, 1], bl: [0, 1, 0, 0], fl: [0, 1, 0, 0] })],
  ['celebrate0', pose({ face: 'happy', ba: [-1, -2, -1, -3], fa: [1, -2, 1, -3] })],
  ['celebrate1', pose({ bob: -2, face: 'happy', ba: [-2, -2, -1, -3], fa: [2, -2, 1, -3], bl: [-1, 1, 0, 0], fl: [1, 1, 0, 0] })],
  ['celebrate2', pose({ bob: -3, face: 'laugh', ba: [-2, -2, -2, -2], fa: [2, -2, 2, -2], bl: [-1, 0, -1, 1], fl: [1, 0, 1, 1] })],
  ['celebrate3', pose({ bob: -1, face: 'happy', ba: [-1, -2, -1, -3], fa: [1, -2, 1, -3] })],
  ['wave0', pose({ face: 'happy', fa: [2, -2, 1, -3] })],
  ['wave1', pose({ face: 'happy', fa: [2, -2, 2, -2] })],
  ['dance0', pose({ face: 'happy', head: [1, 0], ba: [-2, 0, -1, -2], fa: [2, 0, 1, 2], bl: [-1, 1, -1, 1], fl: [2, 0, 1, 1] })],
  ['dance1', pose({ bob: 1, face: 'happy', ba: [-1, 1, -1, 1], fa: [1, 1, 1, 1] })],
  ['dance2', pose({ face: 'happy', head: [-1, 0], ba: [-2, 0, -1, 2], fa: [2, 0, 1, -2], bl: [-2, 0, -1, 1], fl: [1, 1, 1, 1] })],
  ['dance3', pose({ bob: 1, face: 'laugh', ba: [-1, 1, -1, 1], fa: [1, 1, 1, 1] })],
  ['sad0', pose({ head: [0, 1], face: 'sad', ba: [0, 2, 0, 2], fa: [0, 2, 0, 2] })],
  ['sad1', pose({ bob: 1, head: [0, 1], face: 'sad', ba: [0, 2, 0, 2], fa: [0, 2, 0, 2] })],
  ['laugh0', pose({ face: 'laugh', fa: [1, 2, -2, 0], ba: [0, 2, 1, 0] })],
  ['laugh1', pose({ bob: 1, face: 'laugh', fa: [1, 2, -2, 0], ba: [0, 2, 1, 0] })],
  ['void0', pose({ face: 'wide', ba: [-2, -2, -1, -3], fa: [2, -2, 1, -3], bl: [-2, 1, 0, 1], fl: [2, 0, 0, 2] })],
  ['void1', pose({ face: 'wide', ba: [-1, -3, -2, -2], fa: [1, -3, 2, -2], bl: [-1, 1, -1, 1], fl: [1, 1, 1, 0] })],
  ['squash', pose({ face: 'hit' })],
];

export const FRAME = Object.fromEntries(FRAMES.map(([name], i) => [name, i]));
export const FRAME_COUNT = FRAMES.length;
export const ATLAS_COLS = 8;
export const CELL = 32;
