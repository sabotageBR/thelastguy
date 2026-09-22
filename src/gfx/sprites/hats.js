// Chapéus e cabeças inteiras. Posição relativa à origem da cabeça (dx, dy).
//   over: desenhado sobre a cabeça; back: desenhado atrás da cabeça (ex.: chifre de trás).
//   hidesHair: 'top' esconde o cabelo acima da linha 4; 'all' esconde todo o cabelo.
//   replacesHead: a cabeça (crânio+rosto) não é desenhada; o template já tem rosto.
import { parseTemplate } from '../pixel/buffer.js';
import { LEGEND } from './parts.js';

const T = (rows) => parseTemplate(rows, LEGEND);

export const HATS = {
  none: null,

  cap: {
    dx: 0,
    dy: -1,
    hidesHair: 'top',
    over: T([
      '...cccccc.....',
      '..cLLcccccc...',
      '.cLcccccccccc.',
      '.cccccccccccc.',
      'ccccccccccccc.',
      'CCCCCCCCCCbbbb',
      '......SSSSS...',
    ]),
  },

  capBack: {
    // boné virado para trás
    dx: -2,
    dy: -1,
    hidesHair: 'top',
    over: T([
      '.....cccccc...',
      '....ccccccLc..',
      '...cccccccccL.',
      '...cccccccccc.',
      '..ccccccccccc.',
      'bbbCCCCCCCCCC.',
    ]),
  },

  beanie: {
    dx: 0,
    dy: -4,
    hidesHair: 'top',
    over: T([
      '.....LL.....',
      '....LccL....',
      '.....cc.....',
      '...cccccc...',
      '..cLcccccc..',
      '.cLcccccccc.',
      '.cccccccccc.',
      'cccccccccccc',
      'CbCbCbCbCbCb',
    ]),
  },

  cowboy: {
    dx: -3,
    dy: -4,
    hidesHair: 'top',
    over: T([
      '......ccccc.......',
      '.....ccCcccc......',
      '.....cCcccccc.....',
      '....cccccccccc....',
      '....aaaaaaaaaa....',
      'cccccccccccccccccc',
      '.CCCCCCCCCCCCCCCC.',
    ]),
  },

  viking: {
    dx: -1,
    dy: -3,
    hidesHair: 'top',
    back: T(['nn............', 'Nn............', '.Nn...........', '..N...........']),
    over: T([
      '..............',
      '.....xxxx...nn',
      '....xxxxxx..nN',
      '...xXxxxxxx.N.',
      '..xxxxxxxxxxN.',
      '.xxxxxxxxxxxx.',
      '.XxXxXxXxXxX..',
      '..X.........x.',
    ]),
  },

  chef: {
    dx: 0,
    dy: -7,
    hidesHair: 'top',
    over: T([
      '...ww.ww....',
      '..wwwwwwww..',
      '.wwwwwwwwww.',
      '.wwwiwwwwww.',
      '..wwwwwwww..',
      '..wwwwwwww..',
      '..wwwwwwww..',
      '.iiiiiiiiii.',
      '.wwwwwwwwww.',
    ]),
  },

  tophat: {
    dx: 0,
    dy: -8,
    hidesHair: 'top',
    over: T([
      '...KKKKKK...',
      '...KKKKKK...',
      '...KKKKKK...',
      '...KKKKKK...',
      '...KKKKKK...',
      '...aaaaaa...',
      '...KKKKKK...',
      '.KKKKKKKKKK.',
    ]),
  },

  crown: {
    dx: 1,
    dy: -4,
    hidesHair: false,
    over: T(['g..g..g..g', 'gg.gg.gg.g', 'gggggggggg', 'grgggggrgg', 'GGGGGGGGGG']),
  },

  hardhat: {
    dx: -1,
    dy: -3,
    hidesHair: 'top',
    over: T([
      '....cccccc....',
      '...cLcbccccc..',
      '..cLccbcccccc.',
      '..cccccbccccc.',
      '.ccccccccccccc',
      'CCCCCCCCCCCCCC',
    ]),
  },

  firefighter: {
    dx: -2,
    dy: -3,
    hidesHair: 'top',
    over: T([
      '.....cccccc....',
      '....cLcccccc...',
      '...cLccgccccc..',
      '...cccgggcccc..',
      '..ccccccccccccc',
      'CCCCCCCCCCCCCCC',
      'CC.............',
    ]),
  },

  safari: {
    dx: -2,
    dy: -4,
    hidesHair: 'top',
    over: T([
      '.....cccccc.....',
      '....cLcccccc....',
      '....cccccccc....',
      '....bbbbbbbb....',
      '..cccccccccccc..',
      'CCCCCCCCCCCCCCCC',
    ]),
  },

  tricorn: {
    dx: -2,
    dy: -4,
    hidesHair: 'top',
    over: T([
      '......KKKK......',
      '....KKKKKKKK....',
      '...KKKKKKKKKK...',
      'gKKKKKKKKKKKKKKg',
      '.gKKKKKKKKKKKKg.',
      '..gggggggggggg..',
    ]),
  },

  ninja: {
    dx: 0,
    dy: 0,
    hidesHair: false,
    over: T([
      '............',
      '............',
      '............',
      '...ccccccccc',
      'cccccccccccc',
      'cc..........',
      'c...........',
      '............',
      '....KKKKKKKK',
      '...KKKKKKKKK',
      '....KKKKKK..',
    ]),
  },

  bunny: {
    dx: 2,
    dy: -9,
    hidesHair: false,
    back: T(['.ww......', 'wqw......', 'wqw......', 'wqww.....', '.www.....']),
    over: T([
      '.....ww..',
      '....wqw..',
      '....wqw..',
      '....wqw..',
      '....wqw..',
      '....www..',
      '.....w...',
    ]),
  },

  headphones: {
    dx: -1,
    dy: -1,
    hidesHair: false,
    over: T([
      '..XXXXXXXXX...',
      '.X.........X..',
      'X...........X.',
      'X...........X.',
      'X...........X.',
      '..............',
      '..............',
      '...aa.........',
      '...aa.........',
    ]),
  },

  // ---- cabeças inteiras (substituem crânio + rosto)
  panda: {
    dx: -1,
    dy: -2,
    replacesHead: true,
    over: T([
      '.KK......KK...',
      'KKKK....KKKK..',
      'KK.wwwwwwwKK..',
      '..wwwwwwwwww..',
      '.wwwwwwwwwwww.',
      '.wwwwwKKwwKKw.',
      '.wwwwKKewKKew.',
      '.wwwwwKKwwKKw.',
      '.wwwwwwwwKKww.',
      '..wwwwwwwwww..',
      '...wwwwwwww...',
      '....wwwwww....',
    ]),
  },

  astronaut: {
    dx: -2,
    dy: -2,
    replacesHead: true,
    over: T([
      '.....wwwwww.....',
      '...wwwwwwwwww...',
      '..wwwwwwwwwwww..',
      '.wwwwwvvvvvvvw..',
      '.wwwwvvwvvvvvvw.',
      'wwwwvvwvvvvvvvw.',
      'wwwwvvvvsssevvw.',
      'wwwwvvvvsssevvw.',
      'wwwwvvvvVVVVVvw.',
      '.wwwwvvVVVVVVw..',
      '.wwwwwVVVVVVww..',
      '..wwwwwwwwwww...',
      '...iiiiiiiii....',
    ]),
  },

  robot: {
    dx: -1,
    dy: -4,
    replacesHead: true,
    over: T([
      '.......r......',
      '.......X......',
      '...xxxxxxxx...',
      '..xxxxxxxxxx..',
      '.xxxxxxxxxxxx.',
      '.xXxxxxxxxxxx.',
      '.xXxxxxKKKKKx.',
      '.xXxxxxKiKKiK.',
      '.xXxxxxKKKKKx.',
      '.xXxxxxxxxxxx.',
      '.xXxxxxXXXXxx.',
      '.xXxxxxxxxxxx.',
      '..XXXXXXXXXX..',
      '....XXXXXX....',
    ]),
  },

  dino: {
    dx: -2,
    dy: -4,
    replacesHead: true,
    over: T([
      '.......c........',
      '.....c.cc.......',
      '....cccccc......',
      '...cccccccccc...',
      '..cccccccccccc..',
      '.cCcccccccccccc.',
      '.cCccsssssssecc.',
      '.cCcssssssssecc.',
      '.cCcsssssskksscc',
      '.cCccsssssssccww',
      '..cCccccccccccw.',
      '...cCccccccccc..',
      '....CCCCCCCCC...',
    ]),
  },

  penguin: {
    dx: -2,
    dy: -3,
    replacesHead: true,
    over: T([
      '......KKKKK.....',
      '....KKKKKKKKK...',
      '...KKKKKKKKKKK..',
      '..KKKKKKKKKKKKK.',
      '..KKKKwwwwwwKKK.',
      '.KKKKwwwwewwwKK.',
      '.KKKwwwwwewwwuuu',
      '.KKKwwwwwwwwuuu.',
      '.KKKwwwwwwkkww..',
      '..KKKwwwwwwwwK..',
      '...KKKwwwwwwKK..',
      '....KKKKKKKKK...',
    ]),
  },
};

// Acessórios desenhados em pontos do corpo (em relação ao torso ou à cabeça).
export const ACCESSORIES = {
  bandana: { at: 'neck', dx: 0, dy: -1, t: T(['.aaaaaaa', 'AaaaaaaA', '...aaaa.', '....aa..']) },
  beard: { at: 'head', dx: 4, dy: 7, t: T(['.....hh.', '..hhhhhh', '.hhhhhhh', '..hhhhh.', '....hh..']) },
  moustache: { at: 'head', dx: 7, dy: 8, t: T(['hhhhh', 'h...h']) },
  eyepatch: { at: 'head', dx: 1, dy: 4, t: T(['K.......', '.K......', '..K...KK', '...KKKKK', '......KK']) },
  backpack: { at: 'torso', dx: -3, dy: 0, t: T(['.aa', 'aaa', 'aAa', 'aAa', 'aaa', '.aa']) },
  tank: { at: 'torso', dx: -3, dy: -1, t: T(['.xx', 'xxx', 'xXx', 'xXx', 'xXx', 'xxx', '.X.']) },
  tail: { at: 'hip', dx: -7, dy: -1, t: T(['.....cc', '...cccc', '.ccccC.', 'ccCC...']) },
  earbud: { at: 'head', dx: 3, dy: 6, t: T(['w']) },
  wristband: { at: 'none', dx: 0, dy: 0, t: T(['a']) },
};
