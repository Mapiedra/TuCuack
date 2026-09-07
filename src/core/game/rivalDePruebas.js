// Un rival de mentira al otro lado de un canal de mentira.
//
// No pasa por Supabase: los dos gestores de salas se conectan por un tubo que
// entrega los mensajes con el retardo que se le pida y tira los que se le pida.
// Eso permite probar el protocolo ENTERO —huecos de secuencia, reenvíos,
// confirmaciones, abandono— en una sola instancia y sin red, que es justo lo que
// no se puede probar con dos patos de verdad: la red no falla cuando uno quiere.
//
// Sólo se carga en desarrollo (ver `config.isDev` en core/app.js).

import { crearGestorDeSalas } from './salas.js';

/**
 * Juega una partida entera contra un rival simulado y cuenta qué ha pasado.
 *
 * @param {Object} opciones
 * @param {number} [opciones.latencia=60]   ms de retardo en cada sentido
 * @param {number} [opciones.perdida=0]     proporción de mensajes que se tiran (0..1)
 * @param {number} [opciones.jugadas=6]     cuántas jugadas se intercambian
 * @param {boolean} [opciones.revancha]     al acabar, los dos piden otra
 * @param {boolean} [opciones.rivalAntiguo] B no sabe de canales por sala: ni los
 *   anuncia ni los abre. Es el pato que no se ha actualizado, y la partida tiene
 *   que jugarse igual por el canal común.
 * @param {number} [opciones.tope=15000]    ms antes de darlo por colgado
 * @returns {Promise<Object>} informe
 */
export function probarSalas(opciones = {}) {
  const latencia = opciones.latencia != null ? opciones.latencia : 60;
  const perdida = opciones.perdida || 0;
  const jugadasObjetivo = opciones.jugadas || 6;
  const tope = opciones.tope || 15000;

  const yoA = { id: 'p-aaaaaa000001', nombre: 'PatoA' };
  const yoB = { id: 'p-bbbbbb000002', nombre: 'PatoB' };
  const claveA = 'k-a';
  const claveB = 'k-b';

  const cuenta = { enviados: 0, perdidos: 0, entregados: 0, reenvios: 0, sincros: 0 };
  // Por dónde ha salido cada mensaje, y cuántos se han emitido en un canal donde
  // el otro no estaba. Lo segundo es lo que de verdad hay que vigilar: un canal
  // por sala mal sincronizado no da error, sencillamente deja la partida
  // hablando sola.
  const porCanal = { global: 0, sala: 0, aNadie: 0 };
  /** Quién mandó qué al vacío, para poder mirarlo cuando no cuadre. */
  const aNadieDetalle = [];
  /** En qué sala está cada lado, o null. Es lo que decide por dónde sale y a
   *  quién le llega, igual que en el transporte de verdad. */
  const enSala = { A: null, B: null };
  const relojes = [];
  /** Los gestores esperan el `cadaCierto` del pato; aquí se lleva la cuenta para
   *  poder pararlos todos al terminar. */
  const cadaCierto = (fn, ms) => {
    const id = setInterval(fn, ms);
    relojes.push(id);
    return () => clearInterval(id);
  };

  let gestorA = null;
  let gestorB = null;

  // El tubo. Cada mensaje sale con retardo, y a veces no sale.
  //
  // Y sale POR UN CANAL: por el de la sala si quien emite está dentro de esa
  // sala, y por el común si no. Al entregar se comprueba que el destinatario
  // también esté en ese canal — que es justo lo que no se puede dar por hecho y
  // lo único capaz de destapar una partida que se ha quedado hablando sola.
  const tubo = (haciaB) => {
    const mio = haciaB ? 'A' : 'B';
    const suyo = haciaB ? 'B' : 'A';
    return {
      enviar(m, porSala) {
        cuenta.enviados++;
        if (m.t === 'pedir-sincro') cuenta.sincros++;
        // Un mensaje con la misma secuencia que otro ya enviado es un reenvío.
        if (m.n && enviadosPorN.has(`${haciaB}:${m.t}:${m.n}`)) cuenta.reenvios++;
        else if (m.n) enviadosPorN.add(`${haciaB}:${m.t}:${m.n}`);

        // Por dónde sale lo dice quien manda, igual que en el transporte de
        // verdad. Y se comprueba que de verdad esté dentro: mandar por el canal
        // de una sala en la que no se ha entrado es un fallo, no una opción.
        const canal = (porSala && enSala[mio] === m.sala) ? 'sala' : 'global';
        porCanal[canal]++;

        if (Math.random() < perdida) { cuenta.perdidos++; return true; }
        setTimeout(() => {
          // Emitido en un canal donde el otro no está: nadie lo oye. No es una
          // pérdida de red, es un fallo de sincronización.
          if (canal === 'sala' && enSala[suyo] !== m.sala) {
            porCanal.aNadie++;
            aNadieDetalle.push(`${mio}:${m.t}`);
            return;
          }
          cuenta.entregados++;
          const destino = haciaB ? gestorB : gestorA;
          // El transporte real rellena estos tres; aquí se hace lo mismo.
          const llega = { ...m, deClave: haciaB ? claveA : claveB, de: haciaB ? yoA.id : yoB.id, ts: Date.now() };
          if (destino) destino.recibir(llega);
        }, latencia);
        return true;
      },
      entrar(salaId) { enSala[mio] = String(salaId); },
      salir() { enSala[mio] = null; },
      // B con `rivalAntiguo` es un pato sin actualizar: ni sabe abrir canales
      // ni lo anuncia. Las dos cosas van juntas porque en el pato de verdad
      // salen del mismo sitio, la carcasa.
      puedeSala: () => !(opciones.rivalAntiguo && mio === 'B')
    };
  };
  const enviadosPorN = new Set();

  // Lo que cada uno anuncia saber hacer. Es lo que mira el anfitrión para
  // decidir por dónde se juega, y nunca el número de versión.
  const capsDeB = opciones.rivalAntiguo ? [] : ['sala'];
  const presentesParaA = () => [{ clave: claveB, nombre: yoB.nombre, id: yoB.id, caps: capsDeB }];
  const presentesParaB = () => [{ clave: claveA, nombre: yoA.nombre, id: yoA.id, caps: ['sala'] }];

  gestorA = crearGestorDeSalas({
    transporte: tubo(true), yo: () => yoA, rivales: presentesParaA,
    hayCanal: () => true, cadaCierto
  });
  gestorB = crearGestorDeSalas({
    transporte: tubo(false), yo: () => yoB, rivales: presentesParaB,
    hayCanal: () => true, cadaCierto
  });

  return new Promise((resolver) => {
    const sucesos = [];
    let jugadasA = 0;
    let jugadasB = 0;
    let recibidasA = 0;
    let recibidasB = 0;
    let salaA = null;
    let salaB = null;
    let acabado = false;
    let empiezosA = 0;
    let empiezosB = 0;
    let revanchaPedida = false;
    let rechazoRecibido = false;
    /** Jugadas de la ronda en curso. Aparte del total, porque una revancha
     *  empieza el tablero de cero pero la partida sigue siendo la misma sala. */
    let jugadasRonda = 0;

    const terminar = (extra) => {
      if (acabado) return;
      acabado = true;
      for (const id of relojes) clearInterval(id);
      resolver({
        ok: !!extra.ok,
        ...extra,
        jugadasEnviadas: { A: jugadasA, B: jugadasB },
        jugadasRecibidas: { A: recibidasA, B: recibidasB },
        cuenta,
        porCanal,
        aNadieDetalle,
        // Al terminar los dos tienen que haber soltado el canal de la partida.
        // Quedarse dentro es una fuga: canales muertos acumulándose.
        salaAlFinal: { A: enSala.A, B: enSala.B },
        sucesos: sucesos.slice(0, 24)
      });
    };

    gestorA.alCambiar((s) => {
      sucesos.push('A:' + s.tipo);
      // Lo que busca la prueba de `rivalNoQuiere`: que A se entere de que no hay
      // revancha, en vez de quedarse esperando. Se comprueba al cerrar, no aquí,
      // porque `terminarSala` avisa del fin ANTES que del motivo.
      if (s.tipo === 'revancha-rechazada') rechazoRecibido = true;
      if (s.tipo === 'empieza') {
        empiezosA++;
        jugadasRonda = 0;
        salaA = gestorA.paraElJuego();
        salaA.alRecibir(() => { recibidasA++; turno(); });
        // Empieza el anfitrión.
        turno();
      }
      // El fin llega antes que su motivo: se deja pasar un latido para
      // recogerlo. Y lo bastante como para que la despedida cruce el tubo: con
      // 20 ms la prueba terminaba antes de que B se enterara de nada, y por eso
      // nunca se veía si el otro lado soltaba el canal de la partida.
      if (s.tipo === 'fin') setTimeout(comprobar, latencia * 3 + 60);
    });

    gestorB.alCambiar((s) => {
      sucesos.push('B:' + s.tipo);
      if (s.tipo === 'reto') gestorB.aceptar(s.reto.sala);
      if (s.tipo === 'empieza') {
        empiezosB++;
        jugadasRonda = 0;
        salaB = gestorB.paraElJuego();
        salaB.alRecibir(() => { recibidasB++; turno(); });
      }
      // B contesta en cuanto A lo pide: es el segundo paso de la negociación, y
      // sin él nadie reinicia nada. Puede decir que sí o que no.
      if (s.tipo === 'revancha-pedida') {
        if (opciones.rivalNoQuiere) gestorB.rechazarRevancha();
        else gestorB.proponerRevancha();
      }
    });

    /** Alterna jugadas hasta llegar al objetivo. */
    function turno() {
      if (acabado) return;
      if (jugadasRonda >= jugadasObjetivo) {
        // "¿Otra?": los dos tienen que quererla. A la pide, B contesta arriba, y
        // la partida nueva la reparte el anfitrión.
        // No se comprueba aquí: la segunda ronda se juega entera y el cierre
        // llega por el camino de siempre, cuando vuelva a agotarse.
        if (opciones.revancha && !revanchaPedida) {
          revanchaPedida = true;
          gestorA.proponerRevancha();
          return;
        }
        // Se cierra por abandono, que es la salida limpia que sí existe en el
        // protocolo (el resultado del juego lo decide el juego, no la sala).
        gestorA.abandonar();
        setTimeout(comprobar, latencia * 4 + 200);
        return;
      }
      const leTocaA = jugadasRonda % 2 === 0;
      if (leTocaA) { if (salaA) { salaA.enviar({ i: jugadasRonda }); jugadasA++; jugadasRonda++; } }
      else if (salaB) { salaB.enviar({ i: jugadasRonda }); jugadasB++; jugadasRonda++; }
    }

    function comprobar() {
      // Con `rivalNoQuiere` lo único que se mide es esto: que a quien pidió la
      // revancha le llegue el "no". Es el caso que dejaba el panel clavado en
      // "Esperando…" para siempre.
      if (opciones.rivalNoQuiere) {
        terminar({
          ok: rechazoRecibido,
          motivo: rechazoRecibido ? 'el rechazo llegó' : 'el rechazo NO llegó: se queda esperando'
        });
        return;
      }
      // La prueba pasa si TODAS las jugadas emitidas llegaron al otro lado, aun
      // con pérdidas: para eso están los reenvíos.
      const llegaronTodas = recibidasA === jugadasB && recibidasB === jugadasA
        && (jugadasA + jugadasB) >= jugadasObjetivo;
      // Y con revancha, si los DOS lados han empezado dos veces. Que empiece uno
      // solo es exactamente el fallo que la negociación evita.
      const revanchaOk = !opciones.revancha || (empiezosA >= 2 && empiezosB >= 2);
      const ok = llegaronTodas && revanchaOk;
      terminar({
        ok,
        motivo: ok ? 'completa' : (!llegaronTodas ? 'faltan jugadas' : 'la revancha no arrancó en los dos'),
        empiezos: { A: empiezosA, B: empiezosB }
      });
    }

    // Con `caps`, como el rival de verdad: es lo que mira el anfitrión para
    // decidir si la partida se va a su propio canal. Sin esto la prueba pasaba
    // igual... jugando siempre por el común, que es justo lo que no se quería.
    gestorA.retar({ clave: claveB, nombre: yoB.nombre, id: yoB.id, caps: capsDeB }, 'tresenraya');
    setTimeout(() => terminar({ ok: false, motivo: 'colgada' }), tope);
  });
}
