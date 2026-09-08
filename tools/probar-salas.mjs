// Comprueba el gestor de salas sin tocar la red.
//
//   npm run salas:check
//
// ---- Por qué existe este fichero -------------------------------------------
//
// `src/core/game/salas.js` lleva lo que no se puede ver a simple vista: la
// disciplina de turnos y de entrega de una partida entre dos ordenadores. Y lo
// que hace cuando algo va mal —que el rival se calle, que el pato se mude de
// pestaña a mitad, que se caiga la conexión— es justo lo que nadie prueba,
// porque **la red no falla cuando uno quiere**.
//
// Aquí sí. El gestor es JavaScript puro: no toca ni la red ni el DOM, así que se
// le puede parar el reloj y contarle mentiras sobre el canal. Lo que se prueba
// son las dos cosas que ya han costado un fallo cada una:
//
//   1. REHACER una partida tras mudarse de pestaña (la extensión hace esto cada
//      vez que cambias de pestaña, o sea cada pocos segundos). Si al rehacerla
//      se equivoca de canal, las jugadas se van a un sitio donde no hay nadie y
//      la partida se queda muda sin dar ningún error.
//
//   2. AGUANTAR una caída del canal. Aquí apareció que el pato reconectaba y se
//      volvía a caer cada cinco segundos para siempre, funcionando lo justo para
//      que nadie lo mirara.
//
// Lo que NO se prueba aquí es que las carcasas rehagan de verdad sus canales:
// eso vive en src/main/chat.js y src/extension/sw.js, y para verlo hay que
// levantar el pato (ver `caerAdrede` y las sondas `--probe`).
//
// ---- Sobre el aviso de Node ------------------------------------------------
//
// El núcleo son módulos de navegador —ficheros `.js` con `import`— y este
// paquete no declara `"type": "module"`, así que Node los detecta y avisa. Es
// esperado y se silencia abajo; cualquier otro aviso sí se enseña.

// Ojo con dos detalles, que a la primera no salió: escuchar 'warning' NO quita
// el impresor por defecto de Node —hay que retirarlo— y lo que identifica al
// aviso es su `code`, no su `name`, que es «Warning» a secas.
process.removeAllListeners('warning');
process.on('warning', (w) => {
  if (w.code !== 'MODULE_TYPELESS_PACKAGE_JSON') console.warn(w.stack);
});

const { crearGestorDeSalas } = await import('../src/core/game/salas.js');
const P = await import('../src/core/game/protocolo.js');

const YO = 'p-yo0001';
const RIVAL = 'p-rival01';
const CLAVE = 'k-rival';
const SALA = 's-abc1234';

let hechas = 0;
let fallos = 0;
const ok = (que, bien, extra = '') => {
  hechas++;
  console.log(`${bien ? 'OK   ' : 'FALLO'} ${que}${extra ? '  ·  ' + extra : ''}`);
  if (!bien) fallos++;
};

/**
 * Un gestor con la red de mentira.
 *
 * El transporte apunta lo que sale y por dónde; `tic` dispara a mano el latido
 * que en el pato va cada segundo, para no tener que esperarlo.
 */
function montar() {
  const salidas = [];
  const sucesos = [];
  const puerta = [];
  let latir = () => {};
  let hayCanal = true;

  const g = crearGestorDeSalas({
    transporte: {
      enviar: (m, porSala) => { salidas.push({ t: m.t, porSala: !!porSala, n: m.n }); return true; },
      entrar: (id) => puerta.push('entrar:' + id),
      salir: () => puerta.push('salir'),
      puedeSala: () => true
    },
    yo: () => ({ id: YO, nombre: 'Yo' }),
    rivales: () => [{ clave: CLAVE, nombre: 'Rival', id: RIVAL, caps: ['sala'] }],
    hayCanal: () => hayCanal,
    cadaCierto: (fn) => { latir = fn; return () => {}; }
  });

  g.alCambiar((e) => sucesos.push(e.tipo));
  return { g, salidas, sucesos, puerta, tic: () => latir(), red: (v) => { hayCanal = v; } };
}

/** Una partida ya empezada: se reta, el rival acepta y el anfitrión reparte. */
function enMarcha() {
  const m = montar();
  m.g.retar({ clave: CLAVE, nombre: 'Rival', id: RIVAL, caps: ['sala'] }, 'tresenraya');
  m.g.recibir({
    pv: P.PV, t: P.TIPOS.RESPUESTA, sala: m.g.sala().id, mid: 'r1', n: 0,
    de: RIVAL, deClave: CLAVE, d: { ok: true, nombre: 'Rival' }
  });
  return m;
}

/** Los mensajes que el service worker le devuelve al pato al mudarse de pestaña. */
function guardado(via) {
  const d = { juego: 'tresenraya', semilla: 7, jugadores: ['Anfitrión', 'Yo'] };
  if (via) d.via = via;
  return {
    sala: SALA,
    mensajes: [
      { pv: 1, t: 'reto', sala: SALA, mid: 'm1', n: 0, de: RIVAL, deClave: CLAVE,
        d: { juego: 'tresenraya', nombre: 'Anfitrión', via } },
      { pv: 1, t: 'respuesta', sala: SALA, mid: 'm2', n: 0, de: YO, deClave: 'k-yo',
        d: { ok: true, nombre: 'Yo' } },
      { pv: 1, t: 'inicio', sala: SALA, mid: 'm3', n: 1, de: RIVAL, deClave: CLAVE, d },
      { pv: 1, t: 'jugada', sala: SALA, mid: 'm4', n: 2, de: RIVAL, deClave: CLAVE,
        d: { jugada: { c: 4 } } }
    ]
  };
}

// ===========================================================================
console.log('\n--- Rehacer una partida al mudarse de pestaña ---');
// ===========================================================================

{
  const { g, salidas } = montar();
  const rehecha = g.reanudar(guardado('sala'));
  ok('la partida se rehace', rehecha);
  ok('y sigue hablando por el canal de la sala',
    g.sala().via === 'sala' && salidas.length > 0 && salidas.every((s) => s.porSala),
    `via=${g.sala() && g.sala().via}`);
}
{
  const { g, salidas } = montar();
  g.reanudar(guardado(null));
  // Un anfitrión sin la capacidad no manda `via`, y entonces la partida iba y
  // sigue yendo por el canal común.
  ok('rehecha desde el canal común, sigue por el común',
    g.sala().via === 'global' && salidas.length > 0 && salidas.every((s) => !s.porSala),
    `via=${g.sala() && g.sala().via}`);
}
{
  const { g, puerta } = montar();
  g.reanudar(guardado('sala'));
  g.abandonar();
  ok('al terminar se suelta el canal de la partida', puerta.includes('salir'));
}
{
  const { g, salidas, puerta } = montar();
  g.retar({ clave: CLAVE, nombre: 'Rival', id: RIVAL, caps: ['sala'] }, 'tresenraya');
  const reto = salidas.find((s) => s.t === P.TIPOS.RETO);
  // El invitado todavía no está en ninguna sala: mandarle el reto por el canal
  // de la partida sería hablarle a una habitación vacía.
  ok('el reto sale por el canal común', !!reto && reto.porSala === false);
  ok('y al retar todavía no se entra en ningún canal', puerta.length === 0, puerta.join(','));
}
{
  const { g, puerta } = montar();
  g.retar({ clave: CLAVE, nombre: 'Rival', id: RIVAL, caps: [] }, 'tresenraya');
  ok('contra un rival que no anuncia la capacidad, se juega por el común',
    g.sala().via === 'global' && puerta.length === 0, `via=${g.sala().via}`);
}

// ===========================================================================
console.log('\n--- Aguantar una caída del canal ---');
// ===========================================================================

{
  const { g, salidas, sucesos, tic } = enMarcha();
  ok('la partida está en marcha', g.sala().fase === 'jugando', g.sala().fase);

  const antes = salidas.length;
  g.canalCambio(false);
  ok('se avisa de que está suspendida', sucesos.includes('suspendida'));
  ok('y la sala NO se da por terminada', g.sala().fase === 'jugando', g.sala().fase);

  for (let i = 0; i < 5; i++) tic();
  ok('con el canal caído no se reintenta nada', salidas.length === antes,
    `${salidas.length - antes} mensajes`);
}
{
  const { g, salidas, sucesos, tic } = enMarcha();
  g.canalCambio(false);
  for (let i = 0; i < 3; i++) tic();
  const antes = salidas.length;

  g.canalCambio(true);
  ok('al volver se avisa', sucesos.includes('reanudada'));
  ok('y lo primero es pedir lo que falta',
    salidas.slice(antes).some((s) => s.t === P.TIPOS.PEDIR_SINCRO),
    salidas.slice(antes).map((s) => s.t).join(',') || '(nada)');

  const sincro = salidas.filter((s) => s.t === P.TIPOS.PEDIR_SINCRO).pop();
  ok('y esa petición sale por el canal de la sala, no por el común',
    !!sincro && sincro.porSala === true);

  tic();
  ok('se vuelve a reintentar lo pendiente', salidas.length > antes + 1);
  ok('y la partida sigue viva', g.sala().fase === 'jugando');
}
{
  const { g, sucesos, tic } = enMarcha();
  g.canalCambio(false);
  // Se envejece la suspensión hasta pasarse del tope.
  g.sala().suspendidaDesde = Date.now() - P.SUSPENSION_MAX_MS - 1000;
  tic();
  ok('pasado el tope de suspensión, la partida se da por perdida',
    g.sala().fase === 'terminada' && g.sala().motivoFin === 'desconexion',
    `${g.sala().fase}/${g.sala().motivoFin}`);
  ok('y se avisa del fin', sucesos.includes('fin'));
}
{
  const { g, tic } = enMarcha();
  g.canalCambio(false);
  g.sala().suspendidaDesde = Date.now() - P.SUSPENSION_MAX_MS + 5000;
  tic();
  // El tope es generoso a propósito: una reconexión de wifi tarda más de lo que
  // parece, y rendirse pronto tira partidas que se habrían salvado solas.
  ok(`cinco segundos antes del tope (${P.SUSPENSION_MAX_MS / 1000} s) todavía aguanta`,
    g.sala().fase === 'jugando', g.sala().fase);
}

console.log(`\n${hechas} comprobaciones · ${fallos ? fallos + ' FALLOS' : 'todo correcto'}`);
process.exit(fallos ? 1 : 0);
