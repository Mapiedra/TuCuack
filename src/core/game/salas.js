// Salas de partida: quién juega con quién, de quién es el turno y qué se ha
// jugado ya.
//
// No sabe jugar a nada. Lo que hace es disciplina de turnos y de entrega: numera
// las jugadas, descarta las repetidas, confirma las que llegan, reintenta las que
// no, y avisa cuando el rival desaparece. Las jugadas en sí las entiende el
// juego, que ya valida las suyas (ver minijuegos/tresEnRaya.js).
//
// Se construye contra un `transporte` inyectable en vez de contra la plataforma,
// por dos motivos: se puede probar el protocolo entero con un rival de mentira,
// sin red y provocando pérdidas a voluntad (ver rivalDePruebas.js), y si algún
// día las partidas dejan de ir por el canal común, el cambio se queda dentro del
// transporte.
//
// Sólo hay UNA sala a la vez: no se juegan dos partidas simultáneas.

import * as P from './protocolo.js';

/**
 * @param {Object} opciones
 * @param {{enviar:(m:object)=>boolean}} opciones.transporte
 * @param {() => {id:string, nombre:string}} opciones.yo
 * @param {() => Array<{clave:string, nombre:string, id:string}>} opciones.rivales
 * @param {() => boolean} opciones.hayCanal
 * @param {(fn:Function, ms:number) => (() => void)} opciones.cadaCierto
 *   El del pato, que se apaga solo: aquí no se crean relojes a mano.
 */
export function crearGestorDeSalas({ transporte, yo, rivales, hayCanal, cadaCierto }) {
  /** @type {Object|null} */
  let sala = null;
  /** Retos recibidos y sin contestar, por id de sala. */
  const retos = new Map();
  const oyentes = new Set();

  // Mensajes emitidos y aún sin confirmar, por `mid`.
  //
  // Entra aquí todo lo que, si se pierde, deja la partida colgada: el reto, la
  // respuesta, el inicio y las jugadas. Lo demás —confirmaciones, latidos,
  // peticiones de sincronía— es prescindible por definición: si se pierde, el
  // siguiente tic lo vuelve a intentar por su cuenta.
  //
  // Va por `mid` y no por número de secuencia porque el reto y la respuesta son
  // anteriores a que haya secuencia (ambos van con n = 0) y se pisarían.
  const pendientes = new Map();
  // Los últimos `mid` vistos, para descartar reenvíos. Con tope: la lista no
  // puede crecer sin fin en una partida larga.
  const vistos = [];
  const TOPE_VISTOS = 120;

  // Cola de salida. El canal Realtime admite 10 mensajes por segundo entre todo
  // y el chat tiene preferencia, así que las partidas se autolimitan a RITMO_MAX.
  //
  // Va por crédito y no comparando relojes: comparar contra la hora del último
  // envío deja salir un solo mensaje por llamada —dentro del mismo milisegundo
  // ya no se cumple el intervalo—, y con reenvíos de por medio la cola se
  // atasca en vez de limitarse. El crédito se recarga en cada tic.
  const cola = [];
  let credito = P.RITMO_MAX;

  cadaCierto(latir, 1000);

  return {
    sala: () => sala,
    ocupado: () => !!sala && sala.fase !== 'terminada',
    retos: () => [...retos.values()],

    retar,
    aceptar,
    rechazar,
    proponerRevancha,
    rechazarRevancha,
    abandonar,
    recibir,
    presenciaCambio,
    canalCambio,
    cerrar,

    /** Lo que se le pasa al juego como `ctx.sala`. */
    paraElJuego: () => interfazDeJuego(),

    /** @param {(s:{tipo:string, [k:string]:any}) => void} cb */
    alCambiar(cb) {
      oyentes.add(cb);
      return () => oyentes.delete(cb);
    }
  };

  // ---- Sucesos -----------------------------------------------------------

  function avisar(suceso) {
    for (const cb of oyentes) {
      try { cb(suceso); } catch (err) { console.warn('[sala] oyente falló', err); }
    }
  }

  // ---- Retos -------------------------------------------------------------

  /**
   * Reta a un pato concreto.
   * @param {{clave:string, nombre:string, id:string}} rival
   * @param {string} juegoId
   * @returns {boolean} si el reto ha salido
   */
  function retar(rival, juegoId) {
    if (!rival || !rival.clave || !rival.id) return false;
    if (!hayCanal()) return false;
    if (sala && sala.fase !== 'terminada') return false;

    sala = nuevaSala(P.nuevaSala(), juegoId, rival, true, 'invitando');
    mandarSeguro(P.sobre(P.TIPOS.RETO, sala.id, rival.clave, {
      juego: juegoId,
      nombre: yo().nombre
    }));
    sala.caduca = Date.now() + P.RETO_MS;
    avisar({ tipo: 'retando', sala });
    return true;
  }

  /** Acepta un reto pendiente. La partida no arranca hasta que el anfitrión
   *  reparte el `inicio`: así no puede haber dos estados iniciales distintos. */
  function aceptar(salaId) {
    const reto = retos.get(salaId);
    if (!reto) return false;
    retos.delete(salaId);
    if (sala && sala.fase !== 'terminada') { rechazarPorOcupado(reto); return false; }

    sala = nuevaSala(reto.sala, reto.juego, reto.rival, false, 'esperando-inicio');
    mandarSeguro(P.sobre(P.TIPOS.RESPUESTA, sala.id, reto.rival.clave, {
      ok: true, nombre: yo().nombre
    }));
    avisar({ tipo: 'aceptado', sala });
    return true;
  }

  function rechazar(salaId, motivo = 'no') {
    const reto = retos.get(salaId);
    if (!reto) return false;
    retos.delete(salaId);
    mandar(P.sobre(P.TIPOS.RESPUESTA, reto.sala, reto.rival.clave, {
      ok: false, motivo, nombre: yo().nombre
    }));
    avisar({ tipo: 'reto-retirado', salaId });
    return true;
  }

  function rechazarPorOcupado(reto) {
    mandar(P.sobre(P.TIPOS.RESPUESTA, reto.sala, reto.rival.clave, {
      ok: false, motivo: 'ocupado', nombre: yo().nombre
    }));
  }

  // ---- Partida -----------------------------------------------------------

  /** La cara que ve el juego: enviar jugadas, recibirlas y enterarse de que el
   *  rival se ha ido. Nada más. */
  function interfazDeJuego() {
    const alRecibirCbs = new Set();
    const alIrseCbs = new Set();
    if (sala) {
      sala.alRecibirJugada = (jugada, de) => {
        for (const cb of alRecibirCbs) cb(jugada, de);
      };
      sala.alIrseElRival = (quien) => {
        for (const cb of alIrseCbs) cb(quien);
      };
    }
    return {
      enviar(jugada) {
        if (!sala || sala.fase !== 'jugando') return false;
        sala.n++;
        mandarSeguro(P.sobre(P.TIPOS.JUGADA, sala.id, sala.rival.clave, { jugada }, sala.n));
        sala.ultimoContacto = Date.now();
        return true;
      },
      alRecibir(cb) { alRecibirCbs.add(cb); return () => alRecibirCbs.delete(cb); },
      alIrseUnJugador(cb) { alIrseCbs.add(cb); return () => alIrseCbs.delete(cb); }
    };
  }

  // ---- Revancha ----------------------------------------------------------
  //
  // La partida ha terminado, pero la SALA sigue viva: el gestor no sabe quién ha
  // ganado —eso es cosa del juego— y lo único que le consta es que los dos
  // siguen ahí. Reiniciar es, por tanto, una negociación de dos pasos.

  /** "Yo quiero otra". Si el rival ya lo había dicho, empieza en el momento. */
  function proponerRevancha() {
    if (!sala || sala.fase !== 'jugando') return false;
    if (sala.quieroRevancha) return true;      // ya estaba dicho
    sala.quieroRevancha = true;
    mandarSeguro(P.sobre(P.TIPOS.REVANCHA, sala.id, sala.rival.clave, { quiere: true }, sala.n));
    if (sala.rivalQuiereRevancha) empezarOtra();
    else avisar({ tipo: 'revancha-esperando', nombre: sala.rival.nombre });
    return true;
  }

  /** "Yo lo dejo". Se dice en voz alta y se cierra la sala. */
  function rechazarRevancha() {
    if (!sala || sala.fase !== 'jugando') return;
    // Directo, sin pasar por la cola: `terminarSala` la vacía, y era justo este
    // mensaje el que se quedaba dentro. Sin él, el otro se queda esperando una
    // respuesta que ya nadie va a mandar.
    mandarYa(P.sobre(P.TIPOS.REVANCHA, sala.id, sala.rival.clave, { quiere: false }, sala.n));
    terminarSala('sin-revancha');
  }

  function recibirRevancha(m) {
    if (sala.fase !== 'jugando') return false;
    if (!m.d.quiere) {
      const nombre = sala.rival.nombre;
      terminarSala('sin-revancha');
      avisar({ tipo: 'revancha-rechazada', nombre });
      return true;
    }
    sala.rivalQuiereRevancha = true;
    if (sala.quieroRevancha) empezarOtra();
    else avisar({ tipo: 'revancha-pedida', nombre: sala.rival.nombre });
    return true;
  }

  /**
   * Los dos quieren. Reparte el anfitrión, como en la primera: la semilla y el
   * orden tienen que salir de un solo sitio.
   *
   * La secuencia NO se reinicia: sigue subiendo entre partidas, y así un mensaje
   * rezagado de la anterior no se puede confundir con uno de la nueva.
   */
  function empezarOtra() {
    sala.quieroRevancha = false;
    sala.rivalQuiereRevancha = false;
    if (!sala.anfitrion) {
      avisar({ tipo: 'revancha-esperando', nombre: sala.rival.nombre });
      return;   // el invitado espera el inicio del anfitrión
    }
    sala.n++;
    sala.semilla = (Math.random() * 2 ** 31) | 0;
    mandarSeguro(P.sobre(P.TIPOS.INICIO, sala.id, sala.rival.clave, {
      juego: sala.juego,
      jugadores: sala.jugadores,
      semilla: sala.semilla
    }, sala.n));
    avisar({ tipo: 'empieza', sala, revancha: true });
  }

  function abandonar() {
    if (!sala || sala.fase === 'terminada') return;
    // Igual que la despedida de la revancha: sale ya, porque lo siguiente que se
    // hace es vaciar la cola.
    mandarYa(P.sobre(P.TIPOS.ABANDONO, sala.id, sala.rival.clave, { motivo: 'rendicion' }, sala.n));
    terminarSala('abandono');
  }

  function cerrar() {
    if (!sala || sala.fase === 'terminada') return;
    // Se manda directo, sin pasar por la cola: el pato se está apagando y no va
    // a haber otra oportunidad. Aun así el otro extremo no depende de recibirlo:
    // tiene sus propios plazos de ausencia.
    mandarYa(P.sobre(P.TIPOS.ABANDONO, sala.id, sala.rival.clave, { motivo: 'cierre' }, sala.n));
    terminarSala('cierre');
  }

  function terminarSala(motivo) {
    if (!sala) return;
    sala.fase = 'terminada';
    sala.motivoFin = motivo;
    pendientes.clear();
    cola.length = 0;
    avisar({ tipo: 'fin', sala, motivo });
  }

  // ---- Recepción ---------------------------------------------------------

  /** Lo llama app.js con cada mensaje de juego que llega del canal. */
  function recibir(m) {
    if (P.esDeOtraVersion(m)) {
      avisar({ tipo: 'aviso', texto: 'Alguien te ha retado desde otra versión de TuCuack.' });
      return;
    }
    if (!P.esValido(m)) return;

    // Duplicados: el reenvío es normal, no un error.
    if (vistos.includes(m.mid)) {
      // Se vuelve a confirmar: es justo lo que el otro está esperando.
      if (m.t === P.TIPOS.JUGADA && sala && sala.id === m.sala) confirmar(m.n);
      return;
    }

    // OJO: sólo se da por visto lo que de verdad se ha aplicado.
    //
    // Un mensaje puede llegar antes de tiempo —una jugada antes que el `inicio`,
    // si el inicio se perdió— y entonces no se puede atender todavía. Si se
    // apuntara igual, el reenvío que viene detrás se descartaría por duplicado y
    // esa jugada se perdería para siempre: la partida se quedaría colgada sin
    // que nadie pudiera explicar por qué.
    if (!despachar(m)) return;

    vistos.push(m.mid);
    if (vistos.length > TOPE_VISTOS) vistos.shift();
  }

  /** @returns {boolean} si el mensaje se ha atendido de verdad */
  function despachar(m) {
    if (m.t === P.TIPOS.RETO) return recibirReto(m);
    if (!sala || sala.id !== m.sala) return true;  // de una partida que ya no existe

    sala.ultimoContacto = Date.now();

    switch (m.t) {
      case P.TIPOS.RESPUESTA: return recibirRespuesta(m);
      case P.TIPOS.INICIO: return recibirInicio(m);
      case P.TIPOS.JUGADA: return recibirJugada(m);
      case P.TIPOS.ACK: olvidarHasta(m.d.hasta); return true;
      case P.TIPOS.PEDIR_SINCRO: responderSincro(); return true;
      case P.TIPOS.LATIDO: return true;
      case P.TIPOS.REVANCHA: return recibirRevancha(m);
      case P.TIPOS.ABANDONO:
        if (sala.alIrseElRival) sala.alIrseElRival(sala.rival.nombre);
        terminarSala('abandono-rival');
        return true;
      case P.TIPOS.FIN:
        terminarSala('fin-rival');
        return true;
      default:
        return true;
    }
  }

  function recibirReto(m) {
    const rival = {
      clave: String(m.deClave || ''),
      id: String(m.de || ''),
      nombre: String((m.d && m.d.nombre) || 'Pato').slice(0, 40)
    };
    if (!rival.clave || !rival.id) return true;

    const reto = { sala: m.sala, juego: String(m.d.juego || ''), rival, caduca: Date.now() + P.RETO_MS };

    // Retándose a la vez: gana el reto de quien tenga el id menor. Es
    // determinista y lo calculan igual los dos, así que no hace falta negociar.
    if (sala && sala.fase === 'invitando' && sala.rival.id === rival.id) {
      if (rival.id < yo().id) {
        sala = null;
        retos.set(reto.sala, reto);
        avisar({ tipo: 'reto', reto });
      }
      return true;
    }
    if (sala && sala.fase !== 'terminada') { rechazarPorOcupado(reto); return true; }

    retos.set(reto.sala, reto);
    avisar({ tipo: 'reto', reto });
    return true;
  }

  function recibirRespuesta(m) {
    // Todavía no toca: se deja sin marcar para que el reenvío vuelva a intentarlo.
    if (sala.fase !== 'invitando') return false;
    olvidarTipo(P.TIPOS.RETO);   // ya contestó: no hay que insistir más
    if (!m.d.ok) {
      const motivo = String(m.d.motivo || 'no');
      const nombre = sala.rival.nombre;
      terminarSala('rechazado');
      avisar({ tipo: 'rechazado', motivo, nombre });
      return true;
    }
    // El anfitrión reparte el estado inicial: quién empieza y con qué semilla.
    sala.rival.nombre = String(m.d.nombre || sala.rival.nombre).slice(0, 40);
    sala.fase = 'jugando';
    sala.n = 1;
    sala.semilla = (Math.random() * 2 ** 31) | 0;
    // El anfitrión es `jugadores[0]`: el orden tiene que ser el mismo en los dos
    // lados, y es lo único que se decide una sola vez.
    sala.jugadores = [yo().nombre, sala.rival.nombre];
    mandarSeguro(P.sobre(P.TIPOS.INICIO, sala.id, sala.rival.clave, {
      juego: sala.juego,
      jugadores: sala.jugadores,
      semilla: sala.semilla
    }, 1));
    avisar({ tipo: 'empieza', sala });
    return true;
  }

  function recibirInicio(m) {
    // Un inicio repetido —su confirmación se perdió— se reconfirma y ya está.
    // Se distingue del inicio de una REVANCHA por la secuencia: la del anfitrión
    // sube en cada partida, así que un inicio con n mayor es una partida nueva.
    if (sala.fase === 'jugando' && m.n <= sala.n) { confirmar(m.n); return true; }
    if (sala.fase !== 'esperando-inicio' && sala.fase !== 'jugando') return false;

    const esRevancha = sala.fase === 'jugando';
    olvidarTipo(P.TIPOS.RESPUESTA);   // el inicio ES la confirmación de la respuesta
    sala.fase = 'jugando';
    sala.n = m.n;
    sala.semilla = Number(m.d.semilla) || 1;
    sala.jugadores = Array.isArray(m.d.jugadores) ? m.d.jugadores.slice(0, 8) : [];
    sala.quieroRevancha = false;
    sala.rivalQuiereRevancha = false;
    confirmar(m.n);
    avisar({ tipo: 'empieza', sala, revancha: esRevancha });
    return true;
  }

  function recibirJugada(m) {
    // Ha llegado antes que el inicio: no se marca como vista, para que el
    // reenvío la traiga otra vez cuando ya se pueda atender.
    if (sala.fase !== 'jugando') return false;

    // Fuera de orden: falta algo por el camino. Se pide y se espera, sin
    // marcarla, que todavía hay que aplicarla.
    if (m.n > sala.n + 1) {
      pedirSincro();
      return false;
    }
    if (m.n <= sala.n) { confirmar(m.n); return true; }   // ya aplicada

    sala.n = m.n;
    confirmar(m.n);
    if (sala.alRecibirJugada) sala.alRecibirJugada(m.d.jugada, sala.rival.nombre);
    return true;
  }

  function confirmar(n) {
    if (!sala) return;
    mandar(P.sobre(P.TIPOS.ACK, sala.id, sala.rival.clave, { hasta: n }));
  }

  function pedirSincro() {
    if (!sala) return;
    const ahora = Date.now();
    if (sala.ultimoSincro && ahora - sala.ultimoSincro < 2000) return;
    sala.ultimoSincro = ahora;
    mandar(P.sobre(P.TIPOS.PEDIR_SINCRO, sala.id, sala.rival.clave, { desde: sala.n + 1 }));
  }

  /**
   * Alguien nos pide lo que le falta. Se reenvía lo que aún esté sin confirmar;
   * lo que ya se confirmó, por definición, le llegó.
   */
  function responderSincro() {
    for (const p of pendientes.values()) mandar(p.mensaje);
  }

  // ---- Relojes -----------------------------------------------------------

  /** Un tic por segundo: caducidades, reenvíos y latido. */
  function latir() {
    const ahora = Date.now();
    credito = P.RITMO_MAX;

    for (const [id, reto] of retos) {
      if (ahora > reto.caduca) {
        retos.delete(id);
        avisar({ tipo: 'reto-caducado', salaId: id });
      }
    }

    vaciarCola();

    if (!sala || sala.fase === 'terminada') return;

    if (sala.fase === 'invitando' && ahora > sala.caduca) {
      terminarSala('sin-respuesta');
      avisar({ tipo: 'sin-respuesta', nombre: sala.rival.nombre });
      return;
    }

    if (sala.suspendidaDesde && ahora - sala.suspendidaDesde > P.SUSPENSION_MAX_MS) {
      terminarSala('desconexion');
      return;
    }
    if (sala.suspendidaDesde) return;   // sin canal no se reintenta nada

    for (const [mid, p] of pendientes) {
      if (ahora < p.siguiente) continue;
      if (p.intentos >= P.REENVIOS_MAX) {
        pendientes.delete(mid);
        avisar({ tipo: 'aviso', texto: 'No se está pudiendo hablar con la otra mascota.' });
        continue;
      }
      p.intentos++;
      p.siguiente = ahora + P.REENVIO_MS;
      mandar(p.mensaje);
    }

    if (sala.fase === 'jugando') {
      if (!sala.ultimoLatido || ahora - sala.ultimoLatido > P.LATIDO_MS) {
        sala.ultimoLatido = ahora;
        mandar(P.sobre(P.TIPOS.LATIDO, sala.id, sala.rival.clave, {}, sala.n));
      }
      if (sala.ultimoContacto && ahora - sala.ultimoContacto > P.AUSENTE_MS) {
        avisar({ tipo: 'rival-ausente', sala });
        sala.ultimoContacto = ahora;   // se avisa una vez cada tanto, no cada segundo
      }
    }
  }

  /**
   * Quién sigue conectado.
   *
   * La clave de presencia del rival cambia cuando reconecta —en la extensión se
   * regenera en cada intento—, así que se le busca por su identidad estable y se
   * le actualiza la dirección. Sin esto, una reconexión del rival dejaría la
   * partida mandando mensajes a un buzón que ya no existe.
   */
  function presenciaCambio(lista) {
    if (!sala || sala.fase === 'terminada') return;
    const encontrado = (lista || []).find((p) => p && p.id && p.id === sala.rival.id);
    if (encontrado) {
      if (encontrado.clave !== sala.rival.clave) sala.rival.clave = encontrado.clave;
      sala.ausenteDesde = 0;
      return;
    }
    // Se le da un margen: la presencia parpadea en cada reconexión.
    if (!sala.ausenteDesde) { sala.ausenteDesde = Date.now(); return; }
    if (Date.now() - sala.ausenteDesde > P.GRACIA_PRESENCIA_MS) {
      if (sala.alIrseElRival) sala.alIrseElRival(sala.rival.nombre);
      terminarSala('rival-desconectado');
    }
  }

  function canalCambio(conectado) {
    if (!sala || sala.fase === 'terminada') return;
    if (!conectado && !sala.suspendidaDesde) {
      sala.suspendidaDesde = Date.now();
      avisar({ tipo: 'suspendida' });
      return;
    }
    if (conectado && sala.suspendidaDesde) {
      sala.suspendidaDesde = 0;
      sala.ultimoContacto = Date.now();
      pedirSincro();
      avisar({ tipo: 'reanudada' });
    }
  }

  // ---- Salida ------------------------------------------------------------

  function mandar(m) {
    cola.push(m);
    vaciarCola();
  }

  /**
   * Una despedida: abandono, "no quiero revancha" o cierre.
   *
   * Sale ahora mismo, saltándose la cola y su límite de ritmo, porque detrás de
   * ella se vacía la cola y encolarla sería tirarla.
   *
   * Y sale por TRIPLICADO. No es un capricho: una despedida es lo único que
   * nadie puede confirmar —quien la manda deja de escuchar en ese instante—, así
   * que no hay reintento posible. Si se pierde, el otro se queda mirando un
   * "Esperando…" durante minuto y medio, hasta que salte su plazo de ausencia.
   * Las copias llevan el mismo `mid`, así que el que las recibe descarta las
   * repetidas y sólo atiende la primera que llegue.
   */
  function mandarYa(m) {
    for (let i = 0; i < 3; i++) {
      try { transporte.enviar(m); } catch (err) {
        console.warn('[sala] no salió la despedida', err);
        return;
      }
    }
  }

  /** Manda algo que no puede perderse: se reintenta hasta que lo confirmen. */
  function mandarSeguro(m) {
    pendientes.set(m.mid, { mensaje: m, intentos: 0, siguiente: Date.now() + P.REENVIO_MS });
    mandar(m);
  }

  /** Lo de ese tipo ya llegó: su respuesta es la confirmación. */
  function olvidarTipo(tipo) {
    for (const [mid, p] of pendientes) if (p.mensaje.t === tipo) pendientes.delete(mid);
  }

  /** Confirmadas todas las jugadas hasta `n` inclusive. */
  function olvidarHasta(n) {
    const hasta = Number(n) || 0;
    for (const [mid, p] of pendientes) {
      if ((p.mensaje.t === P.TIPOS.JUGADA || p.mensaje.t === P.TIPOS.INICIO)
          && p.mensaje.n <= hasta) pendientes.delete(mid);
    }
  }

  function vaciarCola() {
    while (cola.length && credito > 0) {
      credito--;
      const m = cola.shift();
      try { transporte.enviar(m); } catch (err) { console.warn('[sala] no salió', err); }
    }
  }

  function nuevaSala(id, juego, rival, anfitrion, fase) {
    return {
      id, juego, rival, anfitrion, fase,
      n: 0,
      semilla: 0,
      jugadores: [],
      ultimoContacto: Date.now(),
      ultimoLatido: 0,
      ausenteDesde: 0,
      suspendidaDesde: 0,
      caduca: 0,
      quieroRevancha: false,
      rivalQuiereRevancha: false
    };
  }
}
