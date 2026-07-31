// Cliente de chat del pato: envoltura fina sobre el canal que le pase la
// plataforma. Todos los patos —de escritorio y de navegador— comparten el mismo
// canal de Supabase Realtime; lo que cambia es dónde vive la conexión: en el
// proceso main de Electron (src/main/chat.js, que necesita `ws` como transporte)
// o en la propia extensión, donde el navegador ya trae `WebSocket`.

export class ChatClient {
  /** @param {import('../platform.js').Plataforma['chat']} canal */
  constructor(canal) {
    this.canal = canal;
    this._onMessage = () => {};
    this._onStatus = () => {};
    this._onPresence = () => {};
    this.connected = false;
    this.names = [];        // nombres de los demás patos conectados

    this.canal.alRecibirEvento((evt) => {
      if (!evt) return;
      if (evt.type === 'message') {
        this._onMessage({ from: evt.from, text: evt.text, ts: evt.ts });
      } else if (evt.type === 'status') {
        this.connected = !!evt.connected;
        this._onStatus({ connected: this.connected, reason: evt.reason });
      } else if (evt.type === 'presence') {
        this.names = Array.isArray(evt.names) ? evt.names : [];
        this._onPresence(this.names);
      }
    });
  }

  onMessage(cb) { this._onMessage = cb; }
  onStatus(cb) { this._onStatus = cb; }
  onPresence(cb) { this._onPresence = cb; }

  /**
   * Pregunta el estado actual a quien mantenga la conexión.
   *
   * Hace falta porque el canal se conecta mientras el pato aún está
   * cargando: el evento de estado se emite antes de que haya nadie
   * escuchando y se perdería, dejando el chat como "desconectado" pese a
   * estar funcionando.
   */
  async sync() {
    try {
      const st = await this.canal.estado();
      if (!st) return;
      this.connected = !!st.connected;
      this.names = Array.isArray(st.names) ? st.names : [];
      this._onStatus({ connected: this.connected, reason: 'sync' });
      this._onPresence(this.names);
    } catch { /* el chat puede no estar disponible */ }
  }

  send(from, text) {
    this.canal.enviar({ from, text });
  }

  /** Anuncia el nombre en la presencia del canal. */
  setName(name) {
    this.canal.ponerNombre(name);
  }

  /**
   * ¿Hay ya otro pato conectado con ese nombre? La comparación ignora
   * mayúsculas y espacios sobrantes.
   */
  isNameTaken(name) {
    const n = String(name || '').trim().toLowerCase();
    if (!n) return false;
    return this.names.some((o) => String(o).trim().toLowerCase() === n);
  }
}
