'use strict';

// Chat social entre patos con Supabase Realtime (canal global único).
// Se ejecuta en el proceso main porque Electron main no expone `WebSocket`
// global: pasamos `ws` como transporte. El renderer habla por IPC.
//
// Además del chat, el canal mantiene la PRESENCIA de cada pato conectado con su
// nombre, que es lo que permite comprobar que un nombre no esté ya en uso. Que
// esa lista se parezca a la realidad cuesta más de lo que parece: ver el LATIDO
// más abajo.
//
// Por el mismo canal viajan las VISITAS: un pato que se planta en la pantalla de
// otro. Van en un evento de broadcast aparte (`visita`) para no ensuciar la
// conversación, y llevan destinatario. Como el canal es un broadcast público, el
// recado llega a todos los clientes; el filtro por destinatario se hace AQUÍ, y
// no en el pato, para que lo dirigido a otro no llegue siquiera al renderer.

const tls = require('tls');
const { execFile } = require('child_process');
const config = require('./config');

let supabase = null;
/** Cómo se construye el cliente, para poder rehacerlo al reconectar. */
let crearCliente = null;
let channel = null;
let connected = false;
let myName = '';
let myKey = '';
/** Identidad estable de este pato (settings.patoId). A diferencia de `myKey`,
 *  sobrevive a las reconexiones: es lo que permite reconocer al rival a mitad
 *  de una partida aunque su clave de presencia haya cambiado. */
let myId = '';

/** Tope de un mensaje de partida. El más gordo previsible —un tablero de 10x10
 *  con su estado— ronda los 600 B, así que sobra por un factor de seis. */
const TOPE_JUEGO = 4096;

// ---- El canal de la partida ----------------------------------------------
//
// Hasta 0.28 las jugadas iban por el canal común: con veinte patos conectados,
// los veinte recibían cada golpe de minigolf de una pareja ajena y lo
// descartaban por su cuenta. Ahora, cuando los dos jugadores saben hacerlo, la
// partida se muda a un canal para ella sola.
//
// El reto y su respuesta siguen yendo por el común, y no es un detalle: al
// retar, el invitado no está todavía en ninguna sala. Quien decide qué sale por
// dónde es el gestor de salas, que lo dice en cada envío (ver `porSuCanal` en
// core/game/salas.js); aquí sólo se obedece.
//
// El nombre del canal es el mismo que en la extensión y en el núcleo
// (core/game/protocolo.js, `canalDeSala`). Ese fichero no se puede importar
// desde aquí —esto es CommonJS— y por eso la cadena está a mano.
const CANAL_DE_SALA = (salaId) => `sala:${salaId}`;

/** Lo que este pato anuncia saber hacer, para que el otro lo mire ANTES de
 *  retar o de escribirle. Capacidades, nunca números de versión. */
const CAPACIDADES = ['sala', 'privados', 'latido'];

/**
 * Nuestra DIRECCIÓN para los mensajes privados: `sha256(recordSecreto)`.
 *
 * Es la misma con la que se firma en el marcador y en el historial de partidas,
 * y se anuncia en la presencia porque para escribirle a alguien hace falta
 * saber a dónde. Publicarla no abre nada: escribir en las filas de alguien exige
 * su SECRETO, no su hash (ver supabase/records.sql y supabase/mensajes.sql).
 *
 * Va vacía si no hay secreto, y entonces este pato no recibe privados.
 */
let miDireccion = '';

let canalSala = null;
let salaActual = '';
let salaSuscrita = false;
let reintentoSala = null;
/**
 * Jugadas retenidas mientras el canal de la partida termina de suscribirse.
 *
 * Suscribirse tarda un viaje de ida y vuelta, y lo primero que se manda al
 * entrar —el inicio de la partida— sale en el acto. Sin esta cola se perdía y
 * había que esperar al reenvío: tres segundos de "conectando…" en cada partida.
 */
let colaDeSala = [];
const TOPE_COLA_SALA = 30;
// Si ya nos hemos anunciado en la presencia con el nombre actual. Repetir el
// anuncio deja una entrada de más, y el pato sale duplicado en la lista de
// conectados que ven los demás.
let anunciado = false;

// --- Que la lista de conectados se parezca a la realidad -------------------
//
// La presencia de Supabase es un estado que se construye a base de PARCHES: al
// entrar llega el censo entero y a partir de ahí sólo llegan los «ha entrado
// éste» y «se ha ido aquél». Eso tiene tres agujeros, y los tres se veían:
//
//   1. **Un anuncio que falla no se reintenta.** El `track` se hacía UNA vez al
//      conectar; si fallaba, se escribía el error en la consola y el pato se
//      quedaba invisible para todo el mundo PARA SIEMPRE, aunque chateara con
//      normalidad. Es justo el caso de «me habla alguien que no aparece».
//
//   2. **Un parche que se pierde no vuelve.** Si el «ha entrado éste» se cae
//      por el camino, ese pato no aparece nunca más: no hay nada que vuelva a
//      pedir el censo, y el estado local se queda desviado sin que nadie lo note.
//
//   3. **Un pato que muere sin despedirse tarda en irse.** El portátil que se
//      suspende o el proceso que se mata no cierran el socket: su entrada sigue
//      en el censo hasta que el servidor se cansa. Ahí la lista enseña a alguien
//      que no está, que es el mismo desajuste por el otro lado.
//
// El LATIDO tapa los tres de una vez. Cada pato se vuelve a anunciar cada
// `LATIDO_MS`, y volver a anunciarse es un parche más: quien se hubiera perdido
// el primero recibe éste. De paso, el anuncio que falló se reintenta solo, y
// cada entrada queda fechada —con lo que las que dejan de refrescarse se pueden
// dar por muertas sin esperar al servidor.
//
// No es caro: un anuncio cada tres cuartos de minuto por pato, contra los diez
// eventos por segundo que el canal tiene configurados.
const LATIDO_MS = 45000;

/**
 * Cuánto se le aguanta a una entrada sin refrescarse antes de darla por muerta.
 *
 * Tres latidos y pico: con uno o dos se echaría de la lista a quien sólo ha
 * tenido un mal momento de red, y de los dos errores ese es el peor — de un
 * fantasma te enteras al escribirle, de un ausente no te enteras nunca.
 *
 * Sólo se le aplica a quien anuncia la capacidad `latido`: un pato de una
 * versión anterior se anuncia una vez y no vuelve, así que su fecha es la de
 * entrada y caducarla lo borraría de la lista estando perfectamente conectado.
 */
const CADUCIDAD_MS = 150000;

/** El temporizador del latido. Vive mientras el canal esté conectado. */
let latido = null;

/**
 * Quien acaba de hablar, aunque el censo no lo tenga.
 *
 * Es la otra mitad del arreglo, y la que se nota en el acto: un mensaje recién
 * llegado es la prueba más fuerte que hay de que alguien está ahí — más que el
 * censo, que es una copia local de algo que pasó antes—. Así que quien habla
 * entra en la lista aunque el censo todavía no se haya enterado, y se queda
 * mientras siga siendo creíble.
 *
 * Se vacía solo por edad: si de verdad se fue, deja de hablar y se cae.
 *
 * @type {Map<string, {nombre:string, id:string, caps:string[], dir:string, at:number}>}
 */
const vistos = new Map();

/** Cuánto vale lo que dijo alguien que no estaba en el censo. */
const VISTO_MS = 90000;
const TOPE_VISTOS = 200;

/**
 * @param {() => import('electron').BrowserWindow | null} getWin
 * @param {string} initialName
 * @param {string} [patoId]  identidad estable, de los ajustes
 * @param {string} [direccion]  `sha256(recordSecreto)`, la dirección para los
 *   privados. La calcula main.js, que es quien puede ver el secreto.
 */
function initChat(getWin, initialName, patoId, direccion) {
  myName = initialName || '';
  miDireccion = String(direccion || '');
  // Antes de cualquier `track`: si llegara después habría que volver a
  // anunciarse, y un `track` repetido AÑADE una entrada en la presencia en vez
  // de reemplazarla — el pato saldría duplicado en la lista de todo el mundo.
  myId = String(patoId || '');

  if (!config.isConfigured()) {
    // Sin credenciales: el chat queda deshabilitado pero la app funciona.
    notify(getWin, { type: 'status', connected: false, reason: 'not-configured' });
    return disabledChat();
  }

  let createClient;
  let WebSocketImpl;
  try {
    ({ createClient } = require('@supabase/supabase-js'));
    WebSocketImpl = require('ws');
  } catch (err) {
    console.error('[chat] dependencias no disponibles:', err);
    return disabledChat();
  }

  // Clave estable por instalación para identificar nuestra propia presencia.
  myKey = `pato-${Math.random().toString(36).slice(2, 10)}`;

  // El canal se levanta en cuanto se sepa de qué certificados fiarse (unos
  // cientos de ms). Hasta entonces la app va normal, sólo que sin chat.
  transporteQueSeFiaDelSistema(WebSocketImpl).then((Transporte) => {
    // Se guarda cómo se construye para poder rehacerlo si la reconexión se
    // atasca. El proceso main de Electron no trae `WebSocket`, así que hay que
    // pasarle el del paquete `ws`; sin él, supabase-js ni siquiera crea el
    // cliente.
    crearCliente = () => createClient(config.SUPABASE_URL, config.SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { transport: Transporte, params: { eventsPerSecond: 10 } }
    });

    supabase = crearCliente();

    channel = crearCanal(getWin);
    suscribir(getWin);
  });

  return {
    /**
     * Manda un mensaje al canal común.
     *
     * `mid` es el identificador del mensaje, y lo pone el pato. Viaja como
     * campo añadido del payload: un pato anterior a esto lo ignora sin
     * enterarse, y a los nuevos les evita apuntar dos veces el mismo mensaje
     * (ver core/chat/historial.js).
     */
    send(from, text, mid) {
      if (!channel || !connected) return false;
      const clean = String(text || '').slice(0, 280);
      if (!clean.trim()) return false;
      channel.send({
        type: 'broadcast',
        event: 'chat',
        payload: {
          from: String(from || 'Pato').slice(0, 40),
          text: clean,
          ts: Date.now(),
          mid: String(mid || '').slice(0, 40),
          // El remite. Va aquí para que quien reciba el mensaje pueda meter al
          // remitente en su lista de conectados aunque el censo no lo tenga
          // (ver `vistos`). Son los mismos campos que se anuncian en la
          // presencia, y un pato anterior a esto los ignora sin enterarse.
          clave: myKey,
          id: myId,
          caps: CAPACIDADES,
          dir: miDireccion
        }
      });
      return true;
    },

    /**
     * Manda el pato a la pantalla de otro. `destino` es la clave de presencia
     * del destinatario: los nombres se repiten, las claves no.
     */
    sendVisit(v) {
      if (!channel || !connected || !v || !v.aClave) return false;
      channel.send({
        type: 'broadcast',
        event: 'visita',
        payload: limpiarVisita({ ...v, deClave: myKey })
      });
      return true;
    },

    /**
     * Manda un mensaje de partida a otro pato.
     *
     * Va dirigido, como las visitas: el destinatario es una clave de presencia,
     * no una "sala" que todo el canal tenga que filtrar. Lo que llega a los
     * demás patos se descarta en su propio cliente sin llegar a subir.
     *
     * El contenido lo compone game/protocolo.js; aquí sólo se comprueba que
     * quepa. Un mensaje de juego que no cabe es un error de programación, no una
     * condición de red, así que se dice en voz alta.
     */
    sendGame(m, porSala) {
      if (!channel || !connected || !m || !m.aClave) return false;
      const payload = { ...m, deClave: myKey, de: myId, ts: Date.now() };
      const bruto = JSON.stringify(payload);
      if (bruto.length > TOPE_JUEGO) {
        console.warn(`[juego] mensaje descartado por tamaño (${bruto.length} B)`);
        return false;
      }
      // Por el canal de la partida sólo si de verdad estamos en ESA sala. Si no
      // cuadra, por el común: es de donde nunca falta nadie.
      if (porSala && salaActual && m.sala === salaActual) {
        emitirEnLaSala(payload);
        return true;
      }
      channel.send({ type: 'broadcast', event: 'juego', payload });
      return true;
    },

    entrarEnSala: (salaId) => entrarEnSala(getWin, salaId),
    salirDeSala,
    /** El escritorio sabe abrir canales por partida. */
    puedeSala: () => true,
    /** Nuestra dirección, para saber cuál de las conversaciones es con quién. */
    direccion: () => miDireccion,

    /**
     * Actualiza el nombre anunciado en la presencia.
     *
     * Si el canal aún no está conectado, basta con apuntarlo: al suscribirse se
     * anuncia con el nombre que haya. Y si el anuncio falla, tampoco se pierde
     * nada — el latido lo reintenta en menos de un minuto.
     */
    async setName(name) {
      const nuevo = String(name || '').slice(0, 40);
      if (nuevo === myName && anunciado) return;
      myName = nuevo;
      anunciado = false;   // el nombre cambió: lo anunciado ya no vale
      if (channel && connected) await anunciarse();
    },

    /**
     * Tira el canal a propósito, como si se hubiera caído la red.
     *
     * SÓLO en desarrollo: main.js no registra su IPC fuera de `--dev`. Existe
     * porque una caída a mitad de partida es de las cosas que más daño hacen y
     * de las que menos se pueden probar — la red no falla cuando uno quiere—, y
     * hasta que esto existió, el camino de reconexión estaba escrito y razonado
     * pero nunca visto funcionar.
     *
     * Hace exactamente lo que hace un fallo de verdad: dar el canal por caído,
     * avisar al pato —que suspende la partida— y programar el reintento, que es
     * quien rehace el canal común Y el de la sala.
     */
    caerAdrede() {
      if (!channel) return false;
      console.log('[chat] caída provocada a mano (sólo en --dev)');
      connected = false;
      pararLatido();
      notify(getWin, { type: 'status', connected: false, reason: 'CAIDA_DE_PRUEBA' });
      programarReintento(getWin);
      return true;
    },

    names: () => presentNames(),
    presentes: () => presentes(),
    /** Nuestra clave de presencia: es la dirección de vuelta de las visitas. */
    clave: () => myKey,
    /** Nuestra identidad estable: la dirección de vuelta de las partidas. */
    id: () => myId,
    isReady: () => connected
  };
}

// --- Visitas --------------------------------------------------------------

const GESTOS = ['saludo', 'regalo'];

/**
 * Deja una visita en lo que se puede enseñar sin sustos.
 *
 * Vale tanto para lo que se manda como para lo que llega: el canal es público y
 * cualquiera puede poner ahí lo que quiera. El diseño se comprueba más adelante,
 * ya en el pato, que es quien sabe qué diseños existen.
 */
function limpiarVisita(v) {
  return {
    id: String(v.id || '').slice(0, 40),
    de: String(v.de || 'Pato').slice(0, 40),
    deClave: String(v.deClave || '').slice(0, 40),
    aClave: String(v.aClave || '').slice(0, 40),
    skin: String(v.skin || '').slice(0, 24),
    gesto: GESTOS.includes(v.gesto) ? v.gesto : 'saludo',
    texto: String(v.texto || '').slice(0, 280),
    // Si la visita es el aviso de un privado. El contenido NO viaja aquí —el
    // privado sigue yendo a su tabla—: esto sólo dice «tienes correo», para
    // que el pato entre a avisar en vez de que te enteres al abrir el panel.
    // Campo añadido: un pato de una versión anterior lo recorta y ve una
    // visita normal, que es exactamente lo que debe pasar.
    privado: !!v.privado,
    ts: Number(v.ts) || Date.now()
  };
}

// --- Certificados: convivir con los antivirus que inspeccionan el tráfico ---
//
// En Windows es corriente que un antivirus (AVG, Avast, ESET…) o un proxy de
// empresa se meta en medio del HTTPS: sustituye el certificado del servidor por
// uno suyo, firmado por una raíz que instala en el almacén de Windows. Chromium
// la da por buena, pero Node —y por tanto el proceso main de Electron, que es
// quien mantiene el chat— sólo se fía de la lista que trae compilada. De ahí el
// "unable to verify the first certificate" que tumbaba el canal una y otra vez.
//
// Los antivirus lo apañan poniendo NODE_EXTRA_CA_CERTS en el entorno, pero eso
// sólo alcanza a los procesos que arrancan después y heredan la variable: con
// una terminal abierta de antes, el pato se queda sin chat sin motivo aparente.
// Así que se leen las raíces del almacén de Windows y se le pasan al WebSocket,
// que es justo lo que haría el navegador.

/** Las raíces de confianza de Windows, en PEM. Vacío si no se pueden leer. */
function raicesDeWindows() {
  if (process.platform !== 'win32') return Promise.resolve([]);
  const guion = 'Get-ChildItem Cert:\\LocalMachine\\Root, Cert:\\CurrentUser\\Root '
    + '| ForEach-Object { [Convert]::ToBase64String($_.RawData) }';
  return new Promise((resolve) => {
    execFile('powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', guion],
      { timeout: 10000, maxBuffer: 16 * 1024 * 1024, windowsHide: true },
      (err, stdout) => {
        if (err) {
          console.warn('[chat] no se pudo leer el almacén de certificados:', err.message);
          return resolve([]);
        }
        const vistos = new Set();
        const pems = [];
        for (const linea of String(stdout).split(/\r?\n/)) {
          const b64 = linea.trim();
          if (!b64 || vistos.has(b64)) continue;
          vistos.add(b64);
          pems.push('-----BEGIN CERTIFICATE-----\n'
            + b64.replace(/(.{64})/g, '$1\n').replace(/\n$/, '')
            + '\n-----END CERTIFICATE-----');
        }
        resolve(pems);
      });
  });
}

/**
 * El transporte de siempre, pero fiándose además de las raíces de Windows.
 *
 * Si no se pueden leer, se devuelve `ws` tal cual: mejor el comportamiento de
 * antes que quedarse sin lista de certificados, que dejaría el chat inservible
 * incluso donde funcionaba.
 */
async function transporteQueSeFiaDelSistema(WebSocketImpl) {
  let extra = [];
  try {
    extra = await raicesDeWindows();
  } catch (err) {
    console.warn('[chat] no se pudieron reunir los certificados:', err.message);
  }
  if (!extra.length) return WebSocketImpl;

  // Pasar `ca` REEMPLAZA la lista, no la amplía: hay que incluir las de siempre.
  const ca = [...tls.rootCertificates, ...extra];
  console.log(`[chat] ${extra.length} certificados raíz del sistema añadidos a los de Node`);

  return class WebSocketConRaicesDelSistema extends WebSocketImpl {
    constructor(direccion, protocolos, opciones) {
      super(direccion, protocolos, { ...(opciones || {}), ca });
    }
  };
}

/** Crea el canal con sus escuchas. Se rehace entero en cada reconexión. */
function crearCanal(getWin) {
  anunciado = false;   // canal nuevo, presencia nueva
  const ch = supabase.channel(config.CHANNEL, {
    config: {
      broadcast: { self: false },
      presence: { key: myKey }
    }
  });

  ch.on('broadcast', { event: 'chat' }, ({ payload }) => {
    if (!payload) return;
    // Quien habla está. Si el censo no lo tiene —porque su anuncio se perdió o
    // porque nunca llegó—, entra en la lista por la puerta de atrás y se avisa
    // en el acto: es exactamente el caso de «me escribe alguien que no aparece».
    if (apuntarVisto(payload.clave, payload.from, payload.id, payload.caps, payload.dir)) {
      notify(getWin, { type: 'presence', names: presentNames(), presentes: presentes() });
    }
    notify(getWin, {
      type: 'message',
      from: String(payload.from || 'Pato'),
      text: String(payload.text || ''),
      ts: payload.ts || Date.now(),
      // Va vacío si lo manda un pato anterior a los identificadores; el
      // histórico sabe apañárselas sin él.
      mid: String(payload.mid || '').slice(0, 40)
    });
  });

  // Visitas: un pato que viene a la pantalla de otro. Llegan a todo el canal,
  // así que lo que no venga dirigido a nosotros se descarta aquí mismo.
  ch.on('broadcast', { event: 'visita' }, ({ payload }) => {
    if (!payload) return;
    // Se apunta ANTES de descartar lo que va dirigido a otro: una visita que
    // pasa de largo sigue probando que quien la manda está conectado.
    if (apuntarVisto(payload.deClave, payload.de, '', [], '')) {
      notify(getWin, { type: 'presence', names: presentNames(), presentes: presentes() });
    }
    if (payload.aClave !== myKey) return;
    notify(getWin, { type: 'visita', visita: limpiarVisita(payload) });
  });

  // Partidas: igual que las visitas, van dirigidas y lo de los demás se descarta
  // aquí, sin llegar al pato. Viaja por el mismo `chat:event` que todo lo demás,
  // así que no hace falta ni un canal IPC nuevo ni un puente aparte.
  ch.on('broadcast', { event: 'juego' }, ({ payload }) => {
    if (!payload) return;
    // Aquí sólo se refresca: un mensaje de partida lleva el id del rival, no su
    // nombre, y sin nombre no hay nada que poner en la lista. Vale para que a
    // alguien con quien se está jugando no se le eche por caducidad.
    refrescarVisto(payload.deClave);
    if (payload.aClave !== myKey) return;
    notify(getWin, { type: 'juego', mensaje: payload });
  });

  // Presencia: quién está conectado y con qué nombre.
  for (const evento of ['sync', 'join', 'leave']) {
    ch.on('presence', { event: evento }, () => {
      notify(getWin, { type: 'presence', names: presentNames(), presentes: presentes() });
    });
  }
  return ch;
}

// --- El canal de la partida ----------------------------------------------

/**
 * Mete al pato en el canal privado de una partida.
 *
 * Idempotente: entrar donde ya se está no hace nada. Entrar en otra sala sale
 * de la anterior, que es lo que hace falta cuando una partida sigue a otra.
 */
function entrarEnSala(getWin, salaId) {
  const id = String(salaId || '').slice(0, 60);
  if (!id || !supabase) return;
  if (salaActual === id && canalSala) return;
  salirDeSala();
  salaActual = id;
  canalSala = crearCanalDeSala(getWin, id);
  suscribirSala(getWin);
}

/** Deja el canal de la partida. Vale aunque no se estuviera en ninguno. */
function salirDeSala() {
  if (reintentoSala) { clearTimeout(reintentoSala); reintentoSala = null; }
  salaActual = '';
  salaSuscrita = false;
  colaDeSala = [];
  if (!canalSala) return;
  const iba = canalSala;
  canalSala = null;
  try {
    if (supabase) supabase.removeChannel(iba);
  } catch (err) {
    console.warn('[juego] no se pudo soltar el canal de la partida:', err.message);
  }
}

/**
 * El canal de una sala: sólo broadcast, sin presencia.
 *
 * La presencia sigue viviendo en el canal común y es la única: la dirección de
 * un pato (`aClave`) es su clave allí, y aquí se sigue filtrando por ella igual
 * que en el común. Sólo estamos los dos, así que el filtro no quita casi nada;
 * se mantiene porque es exactamente el mismo camino que ya se sabe que funciona.
 */
function crearCanalDeSala(getWin, salaId) {
  const ch = supabase.channel(CANAL_DE_SALA(salaId), {
    config: { broadcast: { self: false } }
  });
  ch.on('broadcast', { event: 'juego' }, ({ payload }) => {
    if (!payload) return;
    // Aquí sólo se refresca: un mensaje de partida lleva el id del rival, no su
    // nombre, y sin nombre no hay nada que poner en la lista. Vale para que a
    // alguien con quien se está jugando no se le eche por caducidad.
    refrescarVisto(payload.deClave);
    if (payload.aClave !== myKey) return;
    notify(getWin, { type: 'juego', mensaje: payload });
  });
  return ch;
}

function suscribirSala(getWin) {
  if (!canalSala) return;
  const mia = salaActual;
  const mio = canalSala;
  canalSala.subscribe((status, err) => {
    // La escucha es de ESTE canal, no del que haya en cada momento. Un canal al
    // que ya se ha renunciado —porque se cambió de sala, o porque se rehizo tras
    // un fallo— no tiene nada que decir: su despedida no es un fallo nuevo.
    if (mio !== canalSala) return;
    if (status === 'SUBSCRIBED') {
      salaSuscrita = true;
      // Y se cancela el reintento en camino: un canal conectado no necesita
      // que lo reconecten, y el reintento lo tiraría para rehacerlo. Es el
      // mismo bucle que se comía el canal común.
      if (reintentoSala) { clearTimeout(reintentoSala); reintentoSala = null; }
      console.log(`[juego] canal de la partida "${mia}": conectado`);
      vaciarColaDeSala();
      return;
    }
    salaSuscrita = false;
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      console.log(`[juego] canal de la partida: ${status}${err ? ` (${describirError(err)})` : ''}`);
      // Se reintenta a ritmo fijo y sin rendirse: mientras haya partida, quedarse
      // fuera del canal es quedarse sin partida. El gestor de salas tiene sus
      // propios plazos para darla por perdida si esto no se arregla.
      if (!reintentoSala) {
        reintentoSala = setTimeout(() => {
          reintentoSala = null;
          if (!salaActual || !supabase) return;
          const id = salaActual;
          salirDeSala();
          entrarEnSala(getWin, id);
        }, 3000);
      }
    }
  });
}

/** Emite en el canal de la partida, o lo guarda si aún no está suscrito. */
function emitirEnLaSala(payload) {
  if (canalSala && salaSuscrita) {
    canalSala.send({ type: 'broadcast', event: 'juego', payload });
    return;
  }
  colaDeSala.push(payload);
  if (colaDeSala.length > TOPE_COLA_SALA) colaDeSala.shift();
}

function vaciarColaDeSala() {
  if (!canalSala || !salaSuscrita) return;
  const pendiente = colaDeSala;
  colaDeSala = [];
  for (const payload of pendiente) {
    try {
      canalSala.send({ type: 'broadcast', event: 'juego', payload });
    } catch (err) {
      console.warn('[juego] no salió una jugada retenida:', err.message);
    }
  }
}

// --- Conexión con reintentos ---------------------------------------------
//
// El canal puede caerse por algo ajeno a la app (una caída del servicio, la red
// del portátil al suspenderse, un cambio de wifi). Sin reintentar, el chat se
// quedaba muerto hasta reiniciar la app, aunque el servicio volviera enseguida.

let reintentos = 0;
let temporizador = null;
const ESPERA_MIN = 5000;
/**
 * Cuánto tiene que AGUANTAR el canal para darlo por bueno.
 *
 * El contador de reintentos no se pone a cero al conectar, sino cuando la
 * conexión se sostiene. Parece un matiz y no lo es: un canal que conecta y se
 * cae un segundo después ponía el contador a cero cada vez, así que nunca
 * llegaba al tercer intento — que es el único que rehace el cliente entero, y
 * justo la salida que existe para este caso.
 *
 * El resultado era un canal que conectaba y se caía cada cinco segundos para
 * siempre: la partida suspendiéndose y reanudándose sin parar, los mensajes
 * enviados en los huecos perdidos, y el pato entrando y saliendo de la lista de
 * conectados de todos los demás. Se descubrió pudiendo tirar el canal a
 * voluntad (ver `caerAdrede`); antes no había forma de verlo.
 */
const ESTABLE_MS = 30000;
/** El temporizador que dará la conexión por buena, si llega a cumplirse. */
let estable = null;

const ESPERA_MAX = 5 * 60 * 1000;

/**
 * Saca el motivo de verdad de un error del canal.
 *
 * Supabase envuelve los fallos de transporte en un "channel error: transport
 * failure" que no dice nada, y deja el error original en `cause`. Ahí es donde
 * aparece lo que hace falta saber: un certificado que no se pudo verificar (un
 * antivirus que inspecciona el tráfico), un DNS que no resuelve, un proxy que
 * corta. Sin esto, todos los fallos de red se parecen.
 */
function describirError(err) {
  if (!err) return '';
  const partes = [err.message || String(err)];
  let causa = err.cause;
  let vueltas = 0;
  while (causa && vueltas++ < 4) {
    const texto = causa.message || causa.code || causa.type
      || (typeof causa === 'string' ? causa : null);
    if (texto) partes.push(String(texto));
    causa = causa.cause || (causa.error && causa.error.message ? causa.error : null);
  }
  return partes.join(' ← ');
}

function suscribir(getWin) {
  if (!channel) return;
  // La escucha es DE ESTE canal, no del que haya en cada momento.
  //
  // Al reconectar se quita el canal anterior, y quitarlo dispara su propio
  // `CLOSED` — que llegaba aquí como si fuera un fallo nuevo y programaba otro
  // reintento, que a su vez quitaba el canal recién creado. El canal conectaba y
  // se caía cada cinco segundos para siempre: la presencia parpadeando para todo
  // el mundo, la partida suspendiéndose sin parar y los mensajes de los huecos
  // perdidos.
  //
  // Un canal al que ya se ha renunciado no tiene nada que decir: su despedida no
  // es un fallo. Es la misma comprobación que ya hacía el canal de la sala.
  const mio = channel;
  channel.subscribe(async (status, err) => {
    if (mio !== channel) return;
    const antes = connected;
    connected = status === 'SUBSCRIBED';
    const detalle = err ? ` (${describirError(err)})` : '';
    if (connected) {
      // Y se cancela el reintento que hubiera en camino.
      //
      // Sin esto no había forma de salir del bucle: un canal recién creado pasa
      // por CLOSED mientras se une, eso se tomaba por un fallo y programaba otro
      // reintento, y ese reintento llegaba cuando el canal YA estaba conectado y
      // lo tiraba para rehacerlo. Conectaba y se caía cada cinco segundos para
      // siempre, con la presencia parpadeando para todo el mundo y la partida
      // suspendiéndose sin parar.
      //
      // Un canal conectado no necesita que lo reconecten. Si vuelve a caerse, su
      // propia escucha programará otro.
      if (temporizador) { clearTimeout(temporizador); temporizador = null; }
      // El contador todavía NO se perdona: hay que aguantar (ver ESTABLE_MS).
      if (!estable) {
        estable = setTimeout(() => { estable = null; reintentos = 0; }, ESTABLE_MS);
      }
      if (!antes) console.log('[chat] canal: conectado');
      notify(getWin, { type: 'status', connected: true, reason: status });
      // Sólo una vez por canal. Supabase puede avisar de SUBSCRIBED más de una
      // vez sobre el mismo canal, y cada anuncio deja una entrada NUEVA en la
      // presencia en vez de reemplazar la anterior: el pato se va multiplicando
      // en la lista de conectados de todos los demás.
      if (!anunciado) await anunciarse();
      // Y a partir de aquí, uno cada `LATIDO_MS`. Es lo que reintenta el anuncio
      // si acaba de fallar, lo que vuelve a colocar a este pato en el censo de
      // quien se perdiera el primero, y lo que fecha la entrada para que los
      // demás puedan distinguir a un conectado de un fantasma.
      arrancarLatido(getWin);
      notify(getWin, { type: 'presence', names: presentNames(), presentes: presentes() });
      return;
    }

    // Se ha caído antes de aguantar: el intento no cuenta como bueno.
    if (estable) { clearTimeout(estable); estable = null; }
    // Sin canal no hay a quién anunciarse: el latido se reanuda al reconectar.
    pararLatido();
    console.log(`[chat] canal: ${status}${detalle}`);
    notify(getWin, { type: 'status', connected: false, reason: status });
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      programarReintento(getWin);
    }
  });
}

function programarReintento(getWin) {
  if (temporizador) return;   // ya hay uno en marcha
  const espera = Math.min(ESPERA_MAX, ESPERA_MIN * Math.pow(2, reintentos));
  reintentos++;
  // A partir del tercer intento no basta con rehacer el canal: se rehace el
  // cliente entero. Quitar el último canal deja al socket programando su propia
  // desconexión, y el canal nuevo puede quedarse esperando a un socket que se
  // está yendo — con lo que los reintentos fallan uno tras otro para siempre,
  // aunque la red ya haya vuelto.
  const desdeCero = reintentos >= 3;
  console.log(`[chat] reintentando en ${Math.round(espera / 1000)}s `
    + `(intento ${reintentos}${desdeCero ? ', reconectando desde cero' : ''})`);

  temporizador = setTimeout(() => {
    temporizador = null;
    if (!supabase) return;
    try {
      if (desdeCero) {
        try {
          supabase.removeAllChannels();
          if (supabase.realtime && typeof supabase.realtime.disconnect === 'function') {
            supabase.realtime.disconnect();
          }
        } catch { /* el cliente viejo ya estaba para el arrastre */ }
        supabase = crearCliente();
      } else if (channel) {
        // Reutilizar un canal que ya falló no vuelve a conectar.
        supabase.removeChannel(channel);
      }
      channel = crearCanal(getWin);
      suscribir(getWin);
      // El canal de la partida cuelga del mismo socket: si se ha rehecho el
      // cliente entero, el suyo se ha ido con él y hay que volver a entrar. Sin
      // esto, una reconexión a mitad de partida dejaba al pato mandando jugadas
      // a un canal que ya no existía.
      if (salaActual) {
        const id = salaActual;
        salirDeSala();
        entrarEnSala(getWin, id);
      }
    } catch (e) {
      console.error('[chat] fallo al reconectar:', e.message);
      programarReintento(getWin);
    }
  }, espera);
}

function disabledChat() {
  return {
    send() { return false; },
    sendVisit() { return false; },
    sendGame() { return false; },
    entrarEnSala() {},
    salirDeSala() {},
    puedeSala: () => false,
    direccion: () => '',
    caerAdrede: () => false,
    async setName() {},
    names: () => [],
    presentes: () => [],
    clave: () => '',
    id: () => '',
    isReady: () => false
  };
}

/**
 * Se anuncia en la presencia con lo que somos ahora mismo.
 *
 * Devuelve si ha salido. Falla en silencio a propósito salvo por el aviso en
 * consola: quien llama no puede hacer nada mejor que volver a intentarlo, y de
 * eso ya se encarga el latido.
 */
async function anunciarse() {
  if (!channel || !connected) return false;
  try {
    await channel.track({
      name: myName,
      // La fecha es lo que convierte la entrada en algo comprobable: sin ella,
      // un pato que murió sin despedirse y uno que acaba de entrar son iguales.
      at: Date.now(),
      id: myId,
      caps: CAPACIDADES,
      dir: miDireccion
    });
    anunciado = true;
    return true;
  } catch (err) {
    // Antes esto dejaba al pato invisible para siempre. Ahora sólo cuesta un
    // latido.
    console.error('[chat] no se pudo anunciar la presencia:', err.message || err);
    anunciado = false;
    return false;
  }
}

/** Arranca el latido. Idempotente: llamarlo dos veces no deja dos. */
function arrancarLatido(getWin) {
  if (latido) return;
  latido = setInterval(async () => {
    if (!channel || !connected) return;
    await anunciarse();
    // El censo de los demás también envejece entre latidos: aunque no llegue
    // ningún parche, lo que ha caducado tiene que dejar de salir en la lista.
    notify(getWin, { type: 'presence', names: presentNames(), presentes: presentes() });
  }, LATIDO_MS);
}

function pararLatido() {
  if (latido) { clearInterval(latido); latido = null; }
}

/**
 * Apunta que alguien acaba de hablar.
 *
 * @returns {boolean} si esto cambia lo que se enseña —o sea, si hay que
 *   repintar la lista de conectados—. Refrescar a alguien que ya salía no lo es.
 */
function apuntarVisto(clave, nombre, id, caps, dir) {
  const k = String(clave || '').slice(0, 40);
  const n = String(nombre || '').slice(0, 40);
  // Sin clave no hay a quién apuntar, y sin nombre no hay nada que enseñar: eso
  // es un pato de una versión anterior a que el chat llevara remite. Se le sigue
  // oyendo, sencillamente no se le puede añadir a la lista por esta vía.
  if (!k || !n || k === myKey) return false;

  const antes = vistos.get(k);
  vistos.set(k, {
    nombre: n,
    id: String(id || (antes && antes.id) || '').slice(0, 40),
    caps: Array.isArray(caps) ? caps.slice(0, 8).map(String) : ((antes && antes.caps) || []),
    dir: /^[0-9a-f]{64}$/.test(String(dir || '')) ? String(dir) : ((antes && antes.dir) || ''),
    at: Date.now()
  });

  // El canal es público y esto crece con lo que manden otros: con tope, y se
  // suelta lo más viejo, que es lo que menos prueba.
  if (vistos.size > TOPE_VISTOS) {
    let masViejo = null;
    let cuando = Infinity;
    for (const [clv, v] of vistos) if (v.at < cuando) { cuando = v.at; masViejo = clv; }
    if (masViejo) vistos.delete(masViejo);
  }

  // Repintar sólo si de verdad cambia algo: el censo puede tenerlo ya, y
  // entonces esto no añade nada que ver.
  if (antes && antes.nombre === n) return false;
  return !enElCenso(k);
}

/** Refresca a alguien del que ya se sabía, sin poder crear la entrada. */
function refrescarVisto(clave) {
  const k = String(clave || '').slice(0, 40);
  const v = k && vistos.get(k);
  if (v) v.at = Date.now();
}

/** Si el censo de Supabase tiene a este pato ahora mismo. */
function enElCenso(clave) {
  if (!channel || !connected) return false;
  try {
    const metas = (channel.presenceState() || {})[clave];
    return Array.isArray(metas) && metas.some((m) => m && m.name);
  } catch {
    return false;
  }
}

/** Tira lo que ya no prueba nada. */
function purgarVistos(ahora) {
  for (const [clave, v] of vistos) {
    if (ahora - v.at > VISTO_MS) vistos.delete(clave);
  }
}

/**
 * Los demás patos conectados, con su clave de presencia (excluye el propio).
 *
 * La clave hace falta para dirigirle una visita a uno en concreto: dos patos
 * pueden llamarse igual, pero cada uno tiene su clave.
 *
 * `id` es la identidad estable del otro (settings.patoId), y va vacía si al otro
 * lado hay una versión que todavía no la anuncia: a ése se le puede escribir y
 * mandarle el pato, pero no jugar, porque una partida tiene que sobrevivir a que
 * su clave cambie al reconectar.
 *
 * Sale de DOS sitios, y no es redundancia: el censo de Supabase —que puede
 * llegar tarde, perderse un parche o quedarse con un fantasma— y quien ha
 * hablado hace nada, que es la prueba más fuerte de que alguien está ahí. El
 * censo manda donde tiene datos; lo oído rellena los huecos. Ver `vistos`.
 *
 * @returns {{clave:string, nombre:string, id:string, caps:string[], dir:string}[]}
 */
function presentes() {
  if (!channel || !connected) return [];
  const ahora = Date.now();
  purgarVistos(ahora);

  const lista = new Map();
  try {
    const state = channel.presenceState() || {};
    for (const [key, metas] of Object.entries(state)) {
      if (key === myKey) continue;
      for (const m of metas) {
        // Un mismo pato puede figurar varias veces: le pasa a quien siga con una
        // versión que se anunciaba de más.
        if (!m || !m.name || lista.has(key)) continue;
        // Lo que ese pato dice saber hacer. Viene vacío si es de una versión
        // anterior a las capacidades, y una lista vacía significa "el camino
        // de siempre": ni un `if` especial para los antiguos.
        const caps = Array.isArray(m.caps) ? m.caps.slice(0, 8).map(String) : [];
        // Caducidad: una entrada que hace rato que no se refresca es de alguien
        // que se fue sin despedirse —el portátil que se suspende, el proceso que
        // se mata— y el servidor todavía no lo ha echado.
        //
        // Sólo se les mira la fecha a los que dicen latir. Al resto se les cree,
        // porque su fecha es la de entrada y no significa nada: echarlos sería
        // esconder a alguien que está perfectamente conectado.
        const fecha = Number(m.at) || 0;
        if (caps.includes('latido') && fecha && ahora - fecha > CADUCIDAD_MS) continue;
        lista.set(key, {
          clave: String(key),
          nombre: String(m.name),
          id: String(m.id || ''),
          caps,
          // Su dirección para los privados. Vacía si es de una versión anterior,
          // y entonces no se le puede escribir: la interfaz tiene que decirlo,
          // no fallar en silencio.
          dir: /^[0-9a-f]{64}$/.test(String(m.dir || '')) ? String(m.dir) : ''
        });
      }
    }
  } catch { /* sin censo se sigue con lo que se haya oído */ }

  // Y encima, quien ha hablado hace nada. El censo manda cuando tiene a alguien
  // —ahí los datos son suyos, de primera mano—; esto es para los que faltan.
  for (const [clave, v] of vistos) {
    if (lista.has(clave)) continue;
    lista.set(clave, { clave, nombre: v.nombre, id: v.id, caps: v.caps, dir: v.dir });
  }

  return [...lista.values()];
}

/** Nombres de los demás patos conectados (excluye el propio). */
function presentNames() {
  return presentes().map((p) => p.nombre);
}

function notify(getWin, evt) {
  const win = getWin();
  if (win && !win.isDestroyed()) win.webContents.send('chat:event', evt);
}

module.exports = { initChat };
