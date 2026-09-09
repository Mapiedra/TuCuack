// Banco de pruebas para un minijuego de ESCENARIO, sin abrir ventana.
//
// El contrato de un juego de escenario es pequeño —`ctx.escenario` con la pista,
// y `actualizar(dt, pista)` una vez por fotograma— así que se puede cumplir a
// mano. Con eso se juegan partidas enteras en Node, y una partida entera en Node
// tarda menos que abrir la app.
//
// Lo que NO es de mentira es la física: `src/core/pet/fisica.js` no toca ni el
// DOM ni el sonido —sólo números, y está escrito así a propósito— así que se
// importa tal cual. La mascota de aquí es un objeto que guarda dónde está y sabe
// decir su cuerpo, que es lo único que un juego le pide.
//
// El pintor sí es de mentira, y da igual: lo que se comprueba aquí es lo que
// pasa, no lo que se ve. Para lo que se ve están las capturas.

import * as fisica from '../../src/core/pet/fisica.js';

/**
 * Un lienzo que no pinta.
 *
 * Tiene que aceptar TODO lo que un juego pueda llamar: si falta un método, el
 * juego revienta en mitad de la prueba y parece un fallo del juego. Los campos
 * numéricos existen porque algún juego los lee para colocar cosas (`lineWidth`).
 */
function pintorMudo() {
  const nada = () => {};
  return {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', globalAlpha: 1,
    textAlign: '', textBaseline: '', lineCap: '', lineJoin: '',
    save: nada, restore: nada, beginPath: nada, closePath: nada,
    arc: nada, ellipse: nada, fill: nada, stroke: nada, clip: nada,
    fillRect: nada, strokeRect: nada, clearRect: nada,
    moveTo: nada, lineTo: nada, quadraticCurveTo: nada, bezierCurveTo: nada,
    rect: nada, setLineDash: nada, fillText: nada, strokeText: nada,
    translate: nada, rotate: nada, scale: nada, drawImage: nada,
    measureText: () => ({ width: 10 }),
    createLinearGradient: () => ({ addColorStop: nada }),
    createRadialGradient: () => ({ addColorStop: nada })
  };
}

/**
 * @param {Object} [opciones] `ancho`, `alto`, `semilla`, `nivel`, `modo`,
 *   `anfitrion`, `sala`, `yo`, `jugadores`, `marcas`
 * @returns {{ctx:Object, pista:Object, pato:Object, entrada:Object,
 *            registro:Object, medidas:Object}}
 */
export function crearEscenario(opciones = {}) {
  const ancho = opciones.ancho || 1920;
  const alto = opciones.alto || 1080;
  // `suelo` va en coordenadas de VUELO, que crecen hacia arriba desde abajo: es
  // la altura de la barra de tareas, no una Y de pantalla.
  const medidas = {
    ancho, alto, suelo: opciones.suelo || 48,
    patoAncho: 90, patoAlto: 110
  };

  const pato = {
    x: 0, y: medidas.suelo,
    width: medidas.patoAncho, height: medidas.patoAlto,
    ground: medidas.suelo,
    setX(v) { this.x = Math.max(0, Math.min(ancho - this.width, v)); },
    setY(v) { this.y = Math.max(this.ground, v); },
    setState() {}, setTilt() {}, setFacing() {},
    cuerpo() {
      const arriba = alto - this.y - this.height;
      return {
        cx: this.x + this.width / 2,
        cy: arriba + this.height * 0.67,
        radio: this.width * 0.29
      };
    }
  };

  const entrada = { x: 0, y: 0, pulsado: false, teclas: new Set() };
  const registro = { marcador: '', dichos: [], fin: null, notas: 0 };

  const pista = {
    pato, fisica, medidas, entrada,
    vuelo: fisica.crearVuelo({ x: 0, y: medidas.suelo }),
    ajustes: fisica.AJUSTES,
    limites: () => ({
      izquierda: 0, derecha: ancho - pato.width,
      suelo: medidas.suelo, techo: alto - pato.height
    }),
    pintor: pintorMudo(),
    // La misma conversión que hace `escenario.js`: la Y del pato crece hacia
    // arriba y la del lienzo hacia abajo.
    aPantalla: (y) => alto - y,
    marcador: (t) => { registro.marcador = t == null ? '' : String(t); },
    cursor: () => {},
    panel: () => {},
    alPedirSalir: () => {},
    esconderMascota: () => {},
    salir: (motivo) => { if (!registro.fin) registro.fin = { resultado: 'salida', motivo }; }
  };

  const ctx = {
    juego: { id: opciones.id || 'x', nombre: opciones.id || 'x' },
    modo: opciones.modo || 'solo',
    nivel: opciones.nivel || 50,
    yo: opciones.yo || 'Yo',
    jugadores: opciones.jugadores || ['Yo'],
    anfitrion: opciones.anfitrion !== false,
    semilla: opciones.semilla || 1,
    marcas: opciones.marcas || {},
    sprites: {},
    sala: opciones.sala || null,
    escenario: pista,
    sonido: { nota: () => { registro.notas++; }, boing: () => {}, victoria: () => {}, derrota: () => {} },
    pato: { animar: () => {} },
    decir: (t) => registro.dichos.push(String(t)),
    // Una sola vez, como manda el contrato: si un juego llamara dos veces, lo
    // que se guarda es lo primero, y así se nota.
    alTerminar: (r) => { if (!registro.fin) registro.fin = r; },
    cadaFrame: () => () => {},
    cadaCierto: () => () => {},
    escuchar: (objetivo, evento, fn, op) => {
      if (objetivo && objetivo.addEventListener) objetivo.addEventListener(evento, fn, op);
    },
    alDestruir: () => {}
  };

  return { ctx, pista, pato, entrada, registro, medidas };
}

/**
 * Pone el cursor donde haga falta para pedir un tiro concreto.
 *
 * Los juegos de apuntar de esta casa miran HACIA el cursor y sacan la fuerza de
 * lo lejos que esté, medida contra el ancho de la pantalla. Así que para pedir
 * una velocidad hay que deshacer esa cuenta, y conviene hacerlo en un solo sitio
 * y no en cada prueba.
 *
 * @param {{x:number,y:number}} desde  de dónde sale el tiro, en pantalla
 * @param {{vx:number,vy:number}} tiro la velocidad que se quiere
 * @param {{fuerzaMax:number, alcance:number, ancho:number}} regla
 */
export function cursorPara(desde, tiro, regla) {
  const v = Math.hypot(tiro.vx, tiro.vy);
  if (v < 0.001) return { x: desde.x, y: desde.y };
  const lejos = (v / regla.fuerzaMax) * regla.ancho * regla.alcance;
  return { x: desde.x + (tiro.vx / v) * lejos, y: desde.y + (tiro.vy / v) * lejos };
}
