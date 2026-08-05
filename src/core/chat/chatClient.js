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
    this._onHistorial = () => {};
    this._onVisita = () => {};
    this.connected = false;
    this.names = [];        // nombres de los demás patos conectados
    // Los mismos, con su clave de presencia: dos patos pueden llamarse igual,
    // así que para mandarle el pato a uno en concreto hace falta la clave.
    this.presentes = [];
    this.miClave = '';      // nuestra dirección, la que lleva la visita de vuelta

    this.canal.alRecibirEvento((evt) => {
      if (!evt) return;
      if (evt.type === 'message') {
        this._onMessage({ from: evt.from, text: evt.text, ts: evt.ts });
      } else if (evt.type === 'status') {
        this.connected = !!evt.connected;
        this._onStatus({ connected: this.connected, reason: evt.reason });
      } else if (evt.type === 'presence') {
        this._anotarPresencia(evt);
        this._onPresence(this.names);
      } else if (evt.type === 'visita') {
        // Quien mantiene la conexión ya ha descartado las visitas dirigidas a
        // otro: aquí sólo llega lo nuestro.
        if (evt.visita) this._onVisita(evt.visita);
      } else if (evt.type === 'historial') {
        // Sólo llega donde el canal vive fuera del pato y sobrevive a sus
        // mudanzas: la extensión de Chrome. En el escritorio el histórico se
        // queda en el propio pato, que no se muda a ninguna parte.
        this._onHistorial(Array.isArray(evt.mensajes) ? evt.mensajes : []);
      }
    });
  }

  onMessage(cb) { this._onMessage = cb; }
  onStatus(cb) { this._onStatus = cb; }
  onPresence(cb) { this._onPresence = cb; }
  onHistorial(cb) { this._onHistorial = cb; }
  onVisita(cb) { this._onVisita = cb; }

  /**
   * Guarda quién anda por el canal.
   *
   * `presentes` es lo que se usa; `names` se deriva de ahí. Se acepta que llegue
   * sólo `names` porque el canal puede estar servido por una versión anterior
   * —el pato de escritorio y el de la extensión se actualizan por su cuenta—, y
   * entonces se puede listar a la gente aunque no se le pueda mandar el pato.
   */
  _anotarPresencia(evt) {
    if (Array.isArray(evt.presentes)) {
      this.presentes = evt.presentes;
      this.names = this.presentes.map((p) => p.nombre);
    } else {
      this.names = Array.isArray(evt.names) ? evt.names : [];
      this.presentes = [];
    }
    if (evt.clave) this.miClave = String(evt.clave);
  }

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
      this._anotarPresencia(st);
      this._onStatus({ connected: this.connected, reason: 'sync' });
      this._onPresence(this.names);
      // Donde el canal viva fuera del pato, el histórico de la sesión también
      // está ahí (ver ChatClient.onHistorial).
      if (Array.isArray(st.historial)) this._onHistorial(st.historial);
    } catch { /* el chat puede no estar disponible */ }
  }

  send(from, text) {
    this.canal.enviar({ from, text });
  }

  /**
   * Manda el pato a la pantalla de otro.
   *
   * @param {{aClave:string, de:string, skin:string, gesto:string, texto?:string}} visita
   * @returns {boolean} si ha salido de verdad.
   */
  enviarVisita(visita) {
    if (!this.connected || !visita || !visita.aClave) return false;
    this.canal.enviarVisita({ ...visita, ts: Date.now() });
    return true;
  }

  /** ¿Se le puede mandar el pato a alguien? Hace falta saber su clave. */
  puedeVisitar() {
    return this.connected && this.presentes.length > 0;
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
