// Formato futuro das mensagens de rede (v2). Nada aqui é usado na v1: é a especificação que a
// RemoteSession e o servidor (server/matchServer.mjs, importando src/sim sem mudanças) seguirão.
//
// Servidor autoritativo a 60 Hz; o cliente prevê só o próprio personagem e interpola os outros.
// Os obstáculos "puros" são funções do tempo da partida: o cliente só precisa do relógio.
//
// cliente → servidor
//   { t: 'join', name, skin }
//   { t: 'input', tick, bits }            2 bytes por tick: move (int8 −127..127) + flags
//                                          (bit0 jump, bit1 jumpHeld, bit2 dive, bits3-5 emote)
//   { t: 'ping', id }
//
// servidor → cliente
//   { t: 'match', cfg: { seed, levelId, rules, roster } }   basta para reconstruir a partida
//   { t: 'snap', tick, data }             snapshot (src/sim/snapshot.js) a 20 Hz, só estado dinâmico
//   { t: 'events', tick, list }           eventos (sons/HUD) desde o último envio
//   { t: 'result', standings, qualified }
//   { t: 'pong', id }

/** Empacota a entrada de um tick em 2 bytes (Uint16). */
export function packInput(inp) {
  const move = Math.max(-127, Math.min(127, Math.round(inp.move * 127))) & 255;
  const flags = (inp.jump ? 1 : 0) | (inp.jumpHeld ? 2 : 0) | (inp.dive ? 4 : 0) | ((inp.emote & 7) << 3);
  return (move << 8) | flags;
}

/** Desempacota (inverso de packInput). */
export function unpackInput(bits, out) {
  let move = (bits >> 8) & 255;
  if (move > 127) move -= 256;
  out.move = move / 127;
  out.jump = !!(bits & 1);
  out.jumpHeld = !!(bits & 2);
  out.dive = !!(bits & 4);
  out.emote = (bits >> 3) & 7;
  return out;
}
