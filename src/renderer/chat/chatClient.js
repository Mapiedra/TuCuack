// Cliente de chat del renderer: envoltura fina sobre la API `window.pato`.
// La conexión real a Supabase Realtime vive en el proceso main (src/main/chat.js)
// porque Electron main necesita `ws` como transporte de WebSocket.

export class ChatClient {
  constructor() {
    this._onMessage = () => {};
    this._onStatus = () => {};
    this._onPresence = () => {};
    this.connected = false;
    this.names = [];        // nombres de los demás patos conectados

    window.pato.onChatEvent((evt) => {
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
   * Pregunta el estado actual al proceso principal.
   *
   * Hace falta porque el canal se conecta mientras el renderer aún está
   * cargando: el evento de estado se emite antes de que haya nadie
   * escuchando y se perdería, dejando el chat como "desconectado" pese a
   * estar funcionando.
   */
  async sync() {
    try {
      const st = await window.pato.chatStatus();
      if (!st) return;
      this.connected = !!st.connected;
      this.names = Array.isArray(st.names) ? st.names : [];
      this._onStatus({ connected: this.connected, reason: 'sync' });
      this._onPresence(this.names);
    } catch { /* el chat puede no estar disponible */ }
  }

  send(from, text) {
    window.pato.sendChat({ from, text });
  }

  /** Anuncia el nombre en la presencia del canal. */
  setName(name) {
    window.pato.setChatName(name);
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
