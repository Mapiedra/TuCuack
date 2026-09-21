'use strict';

// Comprueba el guardia del ratón sin ventana, sin cursor y sin Linux.
//
//   npm run raton:check
//
// ---- Por qué existe este fichero -------------------------------------------
//
// `src/main/raton.js` es lo que hace que el pato se pueda tocar donde la ventana
// no reenvía el movimiento del cursor. Se escribió sin una Ubuntu delante y lo
// que decide no se puede mirar: o los clics atraviesan el overlay, o no, y la
// diferencia entre las dos cosas es un escritorio que responde y uno que no.
//
// Todo lo que necesita para decidir entra por tres sitios —dónde dice el sistema
// que está el cursor, qué caja publicó el pato y qué pidió el renderer—, así que
// se le puede contar lo que uno quiera y ver qué contesta. Eso es esto.
//
// Las escenas son las que de verdad pueden romper:
//
//   1. En Windows no se sondea nada: el guardia es un pasamanos y la ventana
//      sigue haciendo lo de siempre.
//   2. El cursor entra en la caja del pato y nadie ha pedido nada: hay que
//      capturar el ratón, porque ése es el trabajo.
//   3. Salvo en la barra de tareas. Ahí abajo está el icono de la bandeja, que
//      es la única forma de recuperar un pato escondido.
//   4. Si el pato pide el ratón (un panel abierto, una partida), manda él,
//      esté el cursor donde esté.
//   5. Soltarlo con el cursor todavía encima sería soltarlo para volver a
//      cogerlo 50 ms después, y por el hueco se cuela un clic. No se suelta
//      hasta que el cursor se va.
//   6. Si el pato deja de publicar dónde está —se apagó, se escondió, se quedó
//      a medias—, los clics vuelven a pasar. Un escritorio que no responde es
//      mucho peor que un pato al que hay que volver a acercarse.
//   7. Una ventana nueva empieza de cero. Dar por puesto en ella lo que se puso
//      en la anterior la dejaría capturando el escritorio entero.
//   8. Y la caja que el pato publica se voltea con el lienzo cuando mira a la
//      izquierda. Si no, respondería un palmo al otro lado y sólo mirando a la
//      derecha: la clase de cosa que se achaca a "va raro".

// ---- El decorado ----------------------------------------------------------

// El temporizador, en la mano: el sondeo se dispara cuando aquí se diga.
const sondas = [];
global.setInterval = (fn) => { sondas.push(fn); return sondas.length; };
global.clearInterval = (id) => { if (id) sondas[id - 1] = null; };
const latir = (veces = 1) => {
  for (let i = 0; i < veces; i++) for (const fn of sondas) if (fn) fn();
};

// El reloj, para poder dejar caducar una caja sin esperar tres segundos.
let ahora = 1700000000000;
Date.now = () => ahora;
const avanzar = (ms) => { ahora += ms; };

// Dónde está el cursor, según el sistema.
let cursor = { x: 0, y: 0 };

// El `screen` de Electron, que es lo único que `raton.js` le pide.
//
// Se intercepta la carga en vez de colarlo en la caché de `require` (como hacen
// las otras sondas con supabase-js y ws) porque eso obliga a RESOLVER el módulo
// primero, y aquí no tiene por qué existir: Electron es una dependencia de
// desarrollo y CI instala con `--omit=dev`. Esta sonda no necesita Electron
// —precisamente ésa es la gracia—, así que tampoco debe necesitar tenerlo
// instalado.
const Module = require('module');
const electronDeMentira = { screen: { getCursorScreenPoint: () => ({ ...cursor }) } };
const cargarDeVerdad = Module._load;
Module._load = function (peticion, ...resto) {
  if (peticion === 'electron') return electronDeMentira;
  return cargarDeVerdad.call(this, peticion, ...resto);
};

const { crearGuardiaDelRaton } = require('../src/main/raton.js');

// La ventana: un monitor de 1920x1080 en el origen, visible, y un cuaderno
// donde apunta todo lo que le manden.
function crearVentana() {
  return {
    ignorando: null,
    visible: true,
    destruida: false,
    ordenes: 0,
    isDestroyed() { return this.destruida; },
    isVisible() { return this.visible; },
    getBounds() { return { x: 0, y: 0, width: 1920, height: 1080 }; },
    setIgnoreMouseEvents(ignorar) { this.ignorando = ignorar; this.ordenes++; }
  };
}

// El pato, en medio de la pantalla y de pie sobre la barra de tareas.
const BARRA = 48;
const CAJA_DEL_PATO = { left: 900, top: 900, right: 1000, bottom: 1010 };
// Una caja que baja hasta dentro de la franja de la barra (1080 - 48 = 1032),
// para la escena 3.
const CAJA_HASTA_LA_BARRA = { left: 900, top: 900, right: 1000, bottom: 1060 };

let fallos = 0;
const comprobar = (que, bien, extra) => {
  console.log(`${bien ? 'OK  ' : 'FALLO'} ${que}${extra ? '  ·  ' + extra : ''}`);
  if (!bien) fallos++;
};

function montar(opciones = {}) {
  sondas.length = 0;
  const win = crearVentana();
  const guardia = crearGuardiaDelRaton({
    getWin: () => win,
    getGround: () => (opciones.suelo != null ? opciones.suelo : BARRA),
    sondear: opciones.sondear !== false
  });
  return { win, guardia };
}

// ---- 1. Windows: un pasamanos --------------------------------------------
{
  const { win, guardia } = montar({ sondear: false });
  guardia.pedirCaptura(false);
  const empiezaIgnorando = win.ignorando === true;
  guardia.anotarZona(CAJA_DEL_PATO);
  cursor = { x: 950, y: 950 };            // el cursor, encima del pato
  latir(5);
  comprobar('1. Windows: sin sondeo, el cursor encima no cambia nada',
    empiezaIgnorando && win.ignorando === true && sondas.length === 0,
    `ignorando=${win.ignorando}, sondas=${sondas.length}`);

  guardia.pedirCaptura(true);
  comprobar('1b. Windows: lo que pide el renderer se obedece y punto',
    win.ignorando === false);
}

// ---- 2. El cursor llega al pato ------------------------------------------
{
  const { win, guardia } = montar();
  guardia.pedirCaptura(false);
  guardia.anotarZona(CAJA_DEL_PATO);
  cursor = { x: 100, y: 100 };
  latir();
  const lejos = win.ignorando === true;
  cursor = { x: 950, y: 950 };
  latir();
  comprobar('2. El cursor entra en la caja: se captura el ratón sin que nadie lo pida',
    lejos && win.ignorando === false,
    `lejos=${lejos}, encima ignorando=${win.ignorando}`);

  // Y no se lo repite a la ventana veinte veces por segundo.
  const antes = win.ordenes;
  latir(10);
  comprobar('2b. Y no se le repite la orden a la ventana en cada sondeo',
    win.ordenes === antes, `órdenes de más: ${win.ordenes - antes}`);
}

// ---- 3. La barra de tareas se deja libre ---------------------------------
{
  const { win, guardia } = montar();
  guardia.pedirCaptura(false);
  guardia.anotarZona(CAJA_HASTA_LA_BARRA);
  cursor = { x: 950, y: 1050 };           // dentro de la caja, pero en la barra
  latir();
  comprobar('3. Sobre la barra de tareas no se captura: la bandeja se puede pulsar',
    win.ignorando === true, `ignorando=${win.ignorando}`);

  cursor = { x: 950, y: 1000 };           // justo encima de la barra
  latir();
  comprobar('3b. Un dedo por encima de la barra, sí',
    win.ignorando === false);
}

// ---- 4. Lo que pide el pato manda ----------------------------------------
{
  const { win, guardia } = montar();
  guardia.anotarZona(CAJA_DEL_PATO);
  cursor = { x: 100, y: 100 };            // lejísimos del pato
  guardia.pedirCaptura(true);             // un panel abierto
  latir(10);
  comprobar('4. Con un panel abierto se captura aunque el cursor esté lejos',
    win.ignorando === false, `ignorando=${win.ignorando}`);
}

// ---- 5. No se suelta con el cursor encima --------------------------------
{
  const { win, guardia } = montar();
  guardia.anotarZona(CAJA_DEL_PATO);
  cursor = { x: 950, y: 950 };
  guardia.pedirCaptura(true);
  guardia.pedirCaptura(false);            // el renderer cree que ya no hace falta
  const sigue = win.ignorando === false;
  latir();
  const sigueTrasSondeo = win.ignorando === false;
  cursor = { x: 100, y: 100 };            // ahora sí se va
  latir();
  comprobar('5. No se suelta el ratón mientras el cursor sigue sobre el pato',
    sigue && sigueTrasSondeo && win.ignorando === true,
    `al soltar=${sigue}, tras sondeo=${sigueTrasSondeo}, al irse ignorando=${win.ignorando}`);
}

// ---- 6. La caja caduca ---------------------------------------------------
{
  const { win, guardia } = montar();
  guardia.pedirCaptura(false);
  guardia.anotarZona(CAJA_DEL_PATO);
  cursor = { x: 950, y: 950 };
  latir();
  const capturaba = win.ignorando === false;
  avanzar(3500);                          // el pato lleva 3,5 s sin decir nada
  latir();
  comprobar('6. Sin noticias del pato, los clics vuelven a pasar',
    capturaba && win.ignorando === true,
    `capturaba=${capturaba}, después ignorando=${win.ignorando}`);
}

// ---- 6b. Una ventana escondida no captura nada ---------------------------
{
  const { win, guardia } = montar();
  guardia.pedirCaptura(false);
  guardia.anotarZona(CAJA_DEL_PATO);
  win.visible = false;                    // recogido en la bandeja
  cursor = { x: 950, y: 950 };
  latir();
  comprobar('6b. Un pato escondido no captura el ratón donde estaba',
    win.ignorando === true, `ignorando=${win.ignorando}`);
}

// ---- 7. Una ventana nueva empieza de cero --------------------------------
{
  const { win, guardia } = montar();
  guardia.pedirCaptura(true);             // la vieja acabó capturando
  comprobar('7. (preparación) la ventana de antes capturaba', win.ignorando === false);

  // Se cierra y se abre otra: es lo que pasa al volver de `activate`.
  guardia.reiniciar();
  const nueva = crearVentana();
  const guardia2 = crearGuardiaDelRaton({
    getWin: () => nueva,
    getGround: () => BARRA,
    sondear: true
  });
  guardia2.pedirCaptura(false);
  comprobar('7b. La ventana nueva arranca dejando pasar los clics',
    nueva.ignorando === true, `ignorando=${nueva.ignorando}`);
}

// ---- 8. La caja que se publica, del lienzo a la pantalla -----------------
//
// El lienzo del pato se VOLTEA cuando mira a la izquierda (ver `hitTest`), así
// que la caja del dibujo hay que darle la vuelta también. Si no, el pato sólo
// respondería mirando a la derecha —y mirando a la izquierda respondería un
// palmo al otro lado—, que es la clase de cosa que se achaca a "va raro".
import('../src/core/pet/Duck.js').then(({ cajaEnCliente }) => {
  // Un pato de 100x100 en (500, 800), con el dibujo pegado a la izquierda del
  // lienzo: del 10 % al 40 % de ancho, y del 20 % al 90 % de alto.
  const r = { left: 500, top: 800, right: 600, bottom: 900, width: 100, height: 100 };
  const caja = { x0: 0.1, x1: 0.4, y0: 0.2, y1: 0.9 };

  const mirandoDerecha = cajaEnCliente(r, caja, false);
  comprobar('8. Mirando a la derecha, la caja cae donde está el dibujo',
    mirandoDerecha.left === 510 && mirandoDerecha.right === 540
    && mirandoDerecha.top === 820 && mirandoDerecha.bottom === 890,
    JSON.stringify(mirandoDerecha));

  const mirandoIzquierda = cajaEnCliente(r, caja, true);
  comprobar('8b. Mirando a la izquierda, la caja se voltea con el lienzo',
    mirandoIzquierda.left === 560 && mirandoIzquierda.right === 590
    && mirandoIzquierda.top === 820 && mirandoIzquierda.bottom === 890,
    JSON.stringify(mirandoIzquierda));

  const sinCaja = cajaEnCliente(r, null, true);
  comprobar('8c. Sin caja (arte sin cargar, frame en blanco) se da el lienzo entero',
    sinCaja.left === 500 && sinCaja.right === 600
    && sinCaja.top === 800 && sinCaja.bottom === 900,
    JSON.stringify(sinCaja));

  console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo en orden.');
  process.exit(fallos ? 1 : 0);
});
