// Partes desenhadas à mão (templates ASCII) do personagem chibi, virado para a direita.
// Célula 32×32; pés na borda inferior. Cabeça: origem (10,7) em pé, 12×11.
import { parseTemplate } from '../pixel/buffer.js';

// Índices da paleta de personagem (0 = transparente).
export const P = {
  outline: 1, skin: 2, skinShade: 3, hair: 4, hairShade: 5,
  hat: 6, hatShade: 7, hatLight: 8, hatAccent: 9,
  shirt: 10, shirtShade: 11, pants: 12, pantsShade: 13,
  shoes: 14, eye: 15, accent: 16, accentShade: 17, blush: 18, mouth: 19,
  white: 20, metal: 21, metalDark: 22, bone: 23, boneDark: 24, gold: 25, goldDark: 26,
  black: 27, visor: 28, visorDark: 29, red: 30, pink: 31, shoeShade: 32,
  yellow: 33, yellowDark: 34, green: 35, greenDark: 36, orange: 37, orangeDark: 38, lightBlue: 39,
};

export const LEGEND = {
  o: P.outline, s: P.skin, S: P.skinShade, h: P.hair, H: P.hairShade,
  c: P.hat, C: P.hatShade, L: P.hatLight, b: P.hatAccent,
  t: P.shirt, T: P.shirtShade, p: P.pants, P: P.pantsShade, f: P.shoes, F: P.shoeShade,
  e: P.eye, a: P.accent, A: P.accentShade, k: P.blush, m: P.mouth,
  w: P.white, x: P.metal, X: P.metalDark, n: P.bone, N: P.boneDark, g: P.gold, G: P.goldDark,
  K: P.black, v: P.visor, V: P.visorDark, r: P.red, q: P.pink,
  y: P.yellow, Y: P.yellowDark, z: P.green, Z: P.greenDark, u: P.orange, U: P.orangeDark, i: P.lightBlue,
};

const T = (rows) => parseTemplate(rows, LEGEND);

// Crânio (pele) com orelha. 12×11.
export const HEAD = T([
  '...ssssss...',
  '..ssssssss..',
  '.ssssssssss.',
  '.ssssssssss.',
  'ssssssssssss',
  'ssssssssssss',
  'sssSssssssss',
  'ssSSssssssss',
  '.sssssssssss',
  '..sssssssss.',
  '...SSssssS..',
]);

// Rostos (sobre a cabeça, mesma origem). Olho perto na coluna 7, olho longe na 10.
export const FACES = {
  normal: T([
    '............',
    '............',
    '............',
    '............',
    '............',
    '............',
    '.......e..e.',
    '.......e..e.',
    '............',
    '........k..k',
  ]),
  blink: T([
    '............',
    '............',
    '............',
    '............',
    '............',
    '............',
    '............',
    '......ee.ee.',
    '............',
    '........k..k',
  ]),
  happy: T([
    '............',
    '............',
    '............',
    '............',
    '............',
    '............',
    '......e.e.e.',
    '.......e...e',
    '.........mm.',
    '........k..k',
  ]),
  hit: T([
    '............',
    '............',
    '............',
    '............',
    '............',
    '......e.e.e.',
    '.......e...e',
    '......e.e.e.',
    '.........m..',
  ]),
  sad: T([
    '............',
    '............',
    '............',
    '............',
    '............',
    '............',
    '......ee.ee.',
    '.......e..e.',
    '.........mm.',
  ]),
  wide: T([
    '............',
    '............',
    '............',
    '............',
    '............',
    '......ee.ee.',
    '......ee.ee.',
    '............',
    '.........mm.',
    '.........mm.',
  ]),
  laugh: T([
    '............',
    '............',
    '............',
    '............',
    '............',
    '............',
    '......e.e...',
    '.......e.e.e',
    '........mmm.',
    '........mmm.',
  ]),
};

// Cabelos (sobre a cabeça). dy = deslocamento vertical do template.
export const HAIR = {
  short: {
    dy: 0,
    t: T([
      '...hhhhhh...',
      '..hhhhhhhhh.',
      '.hhhhhhhhhhh',
      'hhhhhhhhhhhh',
      'hHhhhhhhhhh.',
      'hHhh........',
      'hHh.........',
      'hH..........',
      '.H..........',
    ]),
  },
  spiky: {
    dy: -2,
    t: T([
      '...h..h.h...',
      '..hh.hhhhh..',
      '..hhhhhhhhh.',
      '.hhhhhhhhhhh',
      '.hhhhhhhhhhh',
      'hhhhhhhhhhhh',
      'hHhhhhhhhhh.',
      'hHhhh.......',
      'hHh.........',
      'hH..........',
      '.H..........',
    ]),
  },
  long: {
    dy: 0,
    t: T([
      '...hhhhhh...',
      '..hhhhhhhhh.',
      '.hhhhhhhhhhh',
      'hhhhhhhhhhhh',
      'hHhhhhhhhhhh',
      'hHhhhhhh.hh.',
      'hHhh........',
      'hHhh........',
      'hHh.........',
      'hHh.........',
      '.H..........',
    ]),
  },
  bun: {
    dy: -3,
    t: T([
      '..hhh.......',
      '.hhhhh......',
      '..hhhhhhh...',
      '...hhhhhhh..',
      '..hhhhhhhhh.',
      '.hhhhhhhhhhh',
      'hhhhhhhhhhhh',
      'hHhhhhhhhhh.',
      'hHhh........',
      'hHh.........',
      'hH..........',
    ]),
  },
  none: null,
};

// Torsos 8×7 (origem (12,18) em pé). Camisa + começo da calça (cinto).
export const TORSO = {
  up: T([
    '.tttttt.',
    'Tttttttt',
    'Tttttttt',
    'Tttttttt',
    'TTtttttt',
    'PPpppppp',
    'PPpppppp',
  ]),
  crouch: T([
    '.tttttt.',
    'Tttttttt',
    'Tttttttt',
    'TTtttttt',
    'PPpppppp',
    'PPpppppp',
  ]),
};

// Estampas sobre o torso 'up' (mesma origem).
export const PRINTS = {
  skull: T(['........', '...ww...', '..wKKw..', '..wwww..', '...ww...']),
  stripes: T(['........', 'wwwwwwww', '........', 'wwwwwwww', '........']),
  vest: T(['.yy..yy.', 'uuy..yuu', 'uuy..yuu', 'uuyyyyuu', 'uuuuuuuu']),
  suit: T(['........', '...wwww.', '...wwww.', '...wwww.', '....ww..']),
  firefighter: T(['........', '........', 'yyyyyyyy', '........', 'yyyyyyyy']),
  chef: T(['.wwwwww.', 'wwwwwwww', 'wwwKwwww', 'wwwwwwww', 'wwwKwwww']),
  hoodie: T(['.TTTTTT.', 'T......T', '........', '...TT...', '........']),
  scarf: T(['.aaaaaa.', 'Aaaaaaaa', '.....aa.', '.....aa.', '........']),
  belt: T(['........', '........', '........', '........', '..........']),
  tie: T(['........', '.....K..', '....KK..', '.....K..', '........']),
  robot: T(['........', '..XXXX..', '..XrgX..', '..XXXX..', '........']),
};

export const HAND = T(['ss', 'ss']);
export const SHOE = T(['ffff', 'Ffff']);
