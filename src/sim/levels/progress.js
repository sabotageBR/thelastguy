// Progresso ao longo do percurso (para os bots). Por padrão é o x; dentro de uma zona de
// "elevador" (roda-gigante, cadeia de gêiseres...) subir é o que conta: a altura entre h0 e h1
// vira progresso entre x0 e xOut. Assim um horizonte curto enxerga que vale a pena subir.

/** level.lifts: [{ x0, x1, h0, h1, xOut }] (alturas acima da linha de base). */
export function progressOf(level, x, y) {
  const L = level.lifts;
  if (L) {
    const h = -y;
    for (let i = 0; i < L.length; i++) {
      const l = L[i];
      if (x < l.x0 || x > l.x1) continue;
      const f = Math.max(0, Math.min(1, (h - l.h0) / (l.h1 - l.h0)));
      return Math.max(x, l.x0 + f * (l.xOut - l.x0));
    }
  }
  return x;
}
