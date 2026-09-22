// Ponto de entrada: carrega a fonte e inicia o app.
import { App } from './game/app.js';

async function boot() {
  try {
    if (document.fonts && document.fonts.load) {
      await Promise.race([document.fonts.load('700 16px "Pixelify Sans"'), new Promise((r) => setTimeout(r, 1500))]);
    }
  } catch {
    /* segue com a fonte reserva */
  }
  const app = new App();
  app.start();
  window.__app = app;
  // Depuração/automação: avança o jogo N segundos de forma síncrona (funciona com a aba oculta).
  window.__game = {
    app,
    run(sec = 1) {
      const n = Math.round(sec * 60);
      for (let i = 0; i < n; i++) {
        app.step();
        app.frame(1, 1 / 60);
      }
      const s = app.scene;
      return s && s.world ? { tick: s.world.tick, status: s.world.status, mode: app.mode } : { mode: app.mode };
    },
  };
}

boot();
