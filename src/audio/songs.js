// Músicas (padrões de 32 semicolcheias = 2 compassos). '.' = sustenta/pausa.
// Bateria: k bumbo, s caixa, h chimbal, o chimbal aberto, t tom.

const INST = {
  lead: { type: 'p25', vol: 0.12 },
  harm: { type: 'p12', vol: 0.05, len: 0.6 },
  bass: { type: 'triangle', vol: 0.22 },
};

export const SONGS = {
  menu: {
    bpm: 120,
    inst: INST,
    order: ['A', 'A', 'B', 'A'],
    patterns: {
      A: {
        lead: 'B5 . D6 . G5 . . .   G5 . B5 . E5 . . .   E5 . G5 . C6 . B5 .   A5 . F#5 . D5 . . .',
        bass: 'G2 . D3 . G2 . D3 .   E2 . B2 . E2 . B2 .   C3 . G2 . C3 . G2 .   D3 . A2 . D3 . A2 .',
        drums: 'k . h . s . h .   k . h . s . h .   k . h . s . h .   k . h h s . h .',
      },
      B: {
        lead: 'D6 . C6 . B5 . A5 .   G5 . . . B5 . . .   C6 . B5 . A5 . G5 .   F#5 . G5 . A5 . . .',
        harm: 'G4 B4 D5 B4 G4 B4 D5 B4   E4 G4 B4 G4 E4 G4 B4 G4   C5 E5 G5 E5 C5 E5 G5 E5   D5 F#5 A5 F#5 D5 F#5 A5 F#5',
        bass: 'G2 . D3 . G2 . D3 .   E2 . B2 . E2 . B2 .   C3 . G2 . C3 . G2 .   D3 . A2 . D3 . A2 .',
        drums: 'k . h . s . h .   k . h . s . h k   k . h . s . h .   k k h . s . s s',
      },
    },
  },
  ceu: {
    bpm: 132,
    inst: INST,
    order: ['A', 'A', 'B', 'A'],
    patterns: {
      A: {
        lead: 'E5 . G5 . C6 . G5 .   A5 . . . E5 . C5 .   F5 . A5 . C6 . A5 .   G5 . F5 . E5 . D5 .',
        harm: 'C5 E5 G5 E5 C5 E5 G5 E5   A4 C5 E5 C5 A4 C5 E5 C5   F4 A4 C5 A4 F4 A4 C5 A4   G4 B4 D5 B4 G4 B4 D5 B4',
        bass: 'C3 . G3 . C3 . G3 .   A2 . E3 . A2 . E3 .   F2 . C3 . F2 . C3 .   G2 . D3 . G2 . D3 .',
        drums: 'k . h . s . h .   k . h . s . h .   k . h . s . h .   k k h . s . h h',
      },
      B: {
        lead: 'C6 . B5 . A5 . G5 .   E5 . G5 . A5 . . .   F5 . E5 . D5 . C5 .   D5 . E5 . G5 . . .',
        harm: 'A4 C5 E5 C5 A4 C5 E5 C5   A4 C5 E5 C5 A4 C5 E5 C5   F4 A4 C5 A4 F4 A4 C5 A4   G4 B4 D5 B4 G4 B4 D5 B4',
        bass: 'A2 . E3 . A2 . E3 .   A2 . E3 . A2 . E3 .   F2 . C3 . F2 . C3 .   G2 . D3 . G2 . B2 .',
        drums: 'k . h . s . h k   k . h . s . h .   k . h . s . h k   k . h h s s s s',
      },
    },
  },
  gelo: {
    bpm: 118,
    inst: { lead: { type: 'p12', vol: 0.12 }, harm: { type: 'triangle', vol: 0.09, len: 0.5 }, bass: { type: 'triangle', vol: 0.22 } },
    order: ['A', 'A', 'B', 'A'],
    patterns: {
      A: {
        lead: 'A5 . C6 . E6 . C6 .   F5 . A5 . C6 . . .   E5 . G5 . C6 . G5 .   D5 . G5 . B5 . . .',
        harm: '. . A6 . . . E6 .   . . F6 . . . C6 .   . . E6 . . . C6 .   . . D6 . . . B5 .',
        bass: 'A2 . . . E3 . . .   F2 . . . C3 . . .   C3 . . . G2 . . .   G2 . . . D3 . . .',
        drums: 'k . . h s . . h   k . . h s . h h   k . . h s . . h   k . h h s . o .',
      },
      B: {
        lead: 'E6 . D6 . C6 . B5 .   A5 . . . C6 . . .   B5 . A5 . G5 . E5 .   G5 . A5 . . . . .',
        harm: '. . C6 . . . A5 .   . . F6 . . . C6 .   . . G6 . . . E6 .   . . B5 . . . G5 .',
        bass: 'A2 . . . E3 . . .   F2 . . . C3 . . .   G2 . . . D3 . . .   E2 . . . B2 . . .',
        drums: 'k . . h s . . h   k . . h s . h h   k . . h s . . h   k k h h s . o .',
      },
    },
  },
  vulcao: {
    bpm: 144,
    inst: { lead: { type: 'p50', vol: 0.1 }, harm: { type: 'p12', vol: 0.05, len: 0.5 }, bass: { type: 'triangle', vol: 0.25 } },
    order: ['A', 'A', 'B', 'A'],
    patterns: {
      A: {
        lead: 'E5 . F5 . G#5 . . .   A5 . G#5 . F5 . E5 .   B5 . . . A5 . G#5 .   F5 . E5 . . . . .',
        bass: 'E2 . E3 . E2 . E3 .   F2 . F3 . F2 . F3 .   E2 . E3 . E2 . E3 .   D2 . D3 . C2 . C3 .',
        drums: 'k . h . s . h k   k . h . s . h .   k . h . s . h k   k k h . s . s s',
      },
      B: {
        lead: 'C6 . B5 . A5 . G#5 .   A5 . . . E5 . . .   F5 . G#5 . A5 . B5 .   C6 . B5 . G#5 . . .',
        harm: 'E4 G#4 B4 G#4 E4 G#4 B4 G#4   F4 A4 C5 A4 F4 A4 C5 A4   E4 G#4 B4 G#4 E4 G#4 B4 G#4   D4 F4 A4 F4 C4 E4 G4 E4',
        bass: 'E2 . E3 . E2 . E3 .   F2 . F3 . F2 . F3 .   E2 . E3 . E2 . E3 .   D2 . D3 . C2 . C3 .',
        drums: 'k . h k s . h k   k . h . s . h .   k . h k s . h k   k k s . s s s s',
      },
    },
  },
  selva: {
    bpm: 126,
    inst: { lead: { type: 'p25', vol: 0.12, len: 0.45 }, harm: { type: 'p12', vol: 0.05, len: 0.4 }, bass: { type: 'triangle', vol: 0.22, len: 0.6 } },
    order: ['A', 'A', 'B', 'A'],
    patterns: {
      A: {
        lead: 'D5 . F5 . A5 . F5 .   C5 . E5 . G5 . E5 .   D5 F5 A5 C6 B5 . A5 .   G5 . F5 . E5 . D5 .',
        bass: 'D3 . . D3 . . A2 .   C3 . . C3 . . G2 .   D3 . . D3 . . A2 .   F2 . G2 . A2 . C3 .',
        drums: 't . . t k . t .   t . . t k . h .   t . . t k . t .   t t . t k . s .',
      },
      B: {
        lead: 'A5 . B5 . C6 . A5 .   G5 . . . E5 . . .   F5 . G5 . A5 . C6 .   B5 . A5 . F5 . . .',
        harm: 'D5 . A4 . D5 . A4 .   C5 . G4 . C5 . G4 .   D5 . A4 . D5 . A4 .   F4 . G4 . A4 . C5 .',
        bass: 'D3 . . D3 . . A2 .   C3 . . C3 . . G2 .   D3 . . D3 . . A2 .   F2 . G2 . A2 . C3 .',
        drums: 't . . t k . t .   t . h t k . h .   t . . t k . t .   t t t t k . s s',
      },
    },
  },
  espaco: {
    bpm: 108,
    inst: { lead: { type: 'p50', vol: 0.1, a: 0.04 }, harm: { type: 'p12', vol: 0.06, len: 0.7 }, bass: { type: 'triangle', vol: 0.22 } },
    order: ['A', 'A', 'B', 'A'],
    patterns: {
      A: {
        lead: 'C6 . . . . . B5 .   D6 . . . . . . .   C6 . . . A5 . . .   G5 . . . . . . .',
        harm: 'F4 A4 C5 E5 C5 A4 F4 A4   G4 B4 D5 G5 D5 B4 G4 B4   F4 A4 C5 E5 C5 A4 F4 A4   E4 G4 B4 E5 B4 G4 E4 G4',
        bass: 'F2 . . . . . . .   G2 . . . . . . .   F2 . . . . . . .   E2 . . . . . . .',
        drums: 'k . . . h . . .   s . . . h . . .   k . . . h . . h   s . . . h . o .',
      },
      B: {
        lead: 'E6 . . . D6 . . .   B5 . . . C6 . . .   A5 . . . B5 . . .   G5 . . . . . . .',
        harm: 'F4 A4 C5 E5 C5 A4 F4 A4   G4 B4 D5 G5 D5 B4 G4 B4   A4 C5 E5 A5 E5 C5 A4 C5   G4 B4 D5 G5 D5 B4 G4 B4',
        bass: 'F2 . . . . . . .   G2 . . . . . . .   A2 . . . . . . .   G2 . . . . . . .',
        drums: 'k . . . h . . .   s . . . h . . h   k . . . h . . .   s . s . h . o .',
      },
    },
  },
};
