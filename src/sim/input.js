// Estado de entrada por tick, igual para humano, bot e (no futuro) rede.
//   move: -1..1 (quantizado em 1/127), jump: borda de pressionar neste tick,
//   jumpHeld: botão seguro, dive: borda do botão de mergulho (opcional).

export function makeInput() {
  return { move: 0, jump: false, jumpHeld: false, dive: false, emote: 0 };
}

export function clearInput(i) {
  i.move = 0;
  i.jump = false;
  i.jumpHeld = false;
  i.dive = false;
  i.emote = 0;
  return i;
}

export function copyInput(dst, src) {
  dst.move = src.move;
  dst.jump = src.jump;
  dst.jumpHeld = src.jumpHeld;
  dst.dive = src.dive;
  dst.emote = src.emote || 0;
  return dst;
}

export function quantizeMove(m) {
  if (!(m === m)) return 0; // NaN
  const c = m < -1 ? -1 : m > 1 ? 1 : m;
  return Math.round(c * 127) / 127;
}

/** Codifica em 2 bytes (formato futuro de rede): [int8 move, bits]. */
export function packInput(i, pressSeq = 0, diveSeq = 0) {
  const move = Math.round(i.move * 127) & 0xff;
  const bits = (i.jumpHeld ? 1 : 0) | ((pressSeq & 7) << 1) | ((diveSeq & 7) << 4);
  return (move << 8) | bits;
}
