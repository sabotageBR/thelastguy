// Transporte (v2): leva mensagens entre cliente e servidor. A v1 não usa rede; a interface fica
// definida para que uma RemoteSession possa ser escrita sem mexer na simulação.
//
// interface Transport {
//   send(msg: object): void            envia (o formato está em protocol.js)
//   onMessage(fn: (msg) => void): () => void   registra um ouvinte; devolve o "desinscrever"
//   close(): void
//   get latencyMs(): number            estimativa (ping) para ajustar a previsão
// }

/** Transporte em memória (testes e partidas locais "em rede" na mesma página). */
export class LoopbackTransport {
  constructor(delayTicks = 0) {
    this.peer = null;
    this.fns = new Set();
    this.queue = [];
    this.delay = delayTicks;
    this.latencyMs = (delayTicks * 1000) / 60;
  }

  static pair(delayTicks = 0) {
    const a = new LoopbackTransport(delayTicks);
    const b = new LoopbackTransport(delayTicks);
    a.peer = b;
    b.peer = a;
    return [a, b];
  }

  send(msg) {
    if (this.peer) this.peer.queue.push({ msg: JSON.parse(JSON.stringify(msg)), at: this.delay });
  }

  onMessage(fn) {
    this.fns.add(fn);
    return () => this.fns.delete(fn);
  }

  /** Entrega o que já "chegou" (chame uma vez por tick). */
  pump() {
    const keep = [];
    for (const q of this.queue) {
      if (q.at-- > 0) keep.push(q);
      else for (const fn of this.fns) fn(q.msg);
    }
    this.queue = keep;
  }

  close() {
    this.fns.clear();
    this.peer = null;
  }
}
