// Juega partidas enteras de los minijuegos EN RED, sin red y sin ventana.
//
//   npm run red:check
//
// ---- Por qué existe este fichero -------------------------------------------
//
// `tools/probar-salas.mjs` comprueba el gestor de salas: los turnos, la entrega,
// las reconexiones. Lo que NO comprueba es lo que cada juego hace con esos
// turnos, y ahí es donde han estado los fallos que más caros salen, porque son
// los que sólo aparecen **cuando hay dos jugando**.
//
// Un juego en red se prueba mal a mano: hacen falen dos ordenadores, dos
// personas y paciencia, y aun así sólo se prueba el camino que a los dos se les
// ocurra recorrer. Aquí se levantan **dos partidas de verdad**, se las une con
// una sala de mentira y se las hace jugar hasta el final unas cuantas veces.
//
// Lo que se mira en cada partida:
//
//   1. Que **termine**. Una partida en red que se queda muda no da ningún error:
//      los dos se quedan esperando al otro, para siempre.
//   2. Que los dos resultados **cuadren**. Uno gana y el otro pierde, o empatan
//      los dos. Que un lado diga victoria y el otro también es peor que un
//      fallo: es una partida que cada uno recuerda de una manera.
//   3. Que se juegue con **pantallas de distinto tamaño**, que es donde se
//      rompen las proporciones. Todo lo que viaja va en partes del campo
//      precisamente para esto, y si alguien manda un píxel se ve aquí.
//
// ---- Lo que ha encontrado ---------------------------------------------------
//
// En hundir la flota, dos de una vez y ninguno visible jugando solo: el botón de
// «Listo» seguía vivo con la partida empezada y mandaba una promesa nueva —o sea
// que el tablero prometido se podía cambiar DESPUÉS de ver dónde te disparan— y
// «Barajar» tampoco tenía guarda, así que recolocaba tu flota con los disparos
// del rival ya anotados encima.
//
// ---- Los bots ---------------------------------------------------------------
//
// No juegan bien y no hace falta: lo que se comprueba es que la partida llegue a
// su final y que los dos lados cuenten lo mismo. Un bot que juega regular pasa
// por más caminos raros que uno que juega bien.

import { crearSalaDeMentira } from './banco/sala.mjs';
import { crearEscenario, cursorPara } from './banco/escenario.mjs';
import { cargarPanel, crearPanel, pulsar, boton, respirar } from './banco/panel.mjs';

/** Partidas por juego. Con esto y las dos pantallas ya salen los fallos. */
const PARTIDAS = Number(process.env.RED_N || 8);
/** Tope de fotogramas por partida. A 60 por segundo, diez minutos. */
const TOPE_CUADROS = 60 * 60 * 10;
/** Y de pasos en los de panel, que van por clics y no por reloj. */
const TOPE_PASOS = 4000;

/**
 * Lo lejos que el bot pone el cursor para pedir el tiro más fuerte.
 *
 * Es un mando del BOT, no una constante de ningún juego: si un juego cambia su
 * alcance, el bot apunta peor y ya está. Lo que se mide aquí no es la puntería.
 */
const ALCANCE_BOT = 0.34;
const FUERZA_BOT = 1450;

// ---- Los de escenario ------------------------------------------------------

/**
 * Dos partidas de escenario, una contra otra.
 *
 * @param {Object} modulo el módulo del juego
 * @param {(banco:Object, medidas:Object) => {x:number,y:number}} apuntar
 *   dónde pone el cursor el bot cuando le toca
 */
async function duelarEscenario(modulo, apuntar, semilla, id) {
  const sala = crearSalaDeMentira();
  const bancos = [
    crearEscenario({ id, semilla, ancho: 1920, modo: 'turnos', anfitrion: true, sala: sala.a, yo: 'Yo', jugadores: ['Yo', 'Rival'] }),
    crearEscenario({ id, semilla, ancho: 1366, modo: 'turnos', anfitrion: false, sala: sala.b, yo: 'Rival', jugadores: ['Yo', 'Rival'] })
  ];
  const partidas = bancos.map((b) => modulo.crearPartida(b.ctx));

  const ciclo = [0, 0];
  let cuadros = 0;
  while (bancos.some((b) => !b.registro.fin) && cuadros < TOPE_CUADROS) {
    sala.repartir();
    bancos.forEach((banco, i) => {
      if (banco.registro.fin) return;
      if (!banco.registro.marcador.includes('te toca')) {
        ciclo[i] = 0;
        banco.entrada.pulsado = false;
        return;
      }
      ciclo[i]++;
      // Se pulsa y se suelta en cuadros distintos: estos juegos disparan al
      // SOLTAR, para poder corregir la puntería sin gastar el tiro.
      if (ciclo[i] % 4 === 1) {
        const p = apuntar(banco, banco.medidas);
        banco.entrada.x = p.x;
        banco.entrada.y = p.y;
        banco.entrada.pulsado = true;
      } else if (ciclo[i] % 4 === 2) {
        banco.entrada.pulsado = false;
      }
    });
    bancos.forEach((b, i) => { if (!b.registro.fin) partidas[i].actualizar(1 / 60, b.pista); });
    cuadros++;
  }
  partidas.forEach((p) => p.destroy());
  return { a: bancos[0].registro, b: bancos[1].registro, cuadros };
}

// ---- Los de panel ----------------------------------------------------------

/**
 * Dos partidas de panel, una contra otra.
 *
 * @param {(banco:Object, lado:number) => void} jugar lo que hace el bot en su turno
 */
async function duelarPanel(modulo, jugar, semilla, id) {
  const sala = crearSalaDeMentira();
  const bancos = [
    crearPanel({ id, semilla, modo: 'turnos', anfitrion: true, sala: sala.a, yo: 'Yo', jugadores: ['Yo', 'Rival'] }),
    crearPanel({ id, semilla, modo: 'turnos', anfitrion: false, sala: sala.b, yo: 'Rival', jugadores: ['Yo', 'Rival'] })
  ];
  const partidas = bancos.map((b) => modulo.crearPartida(b.ctx));
  bancos.forEach((b, i) => b.montar(partidas[i].el));

  let pasos = 0;
  while (bancos.some((b) => !b.registro.fin) && pasos < TOPE_PASOS) {
    sala.repartir();
    bancos.forEach((banco, i) => { if (!banco.registro.fin) jugar(banco, i); });
    bancos.forEach((b) => b.avanzar(150));
    await respirar();
    pasos++;
  }
  partidas.forEach((p) => p.destroy());
  bancos.forEach((b) => b.matar());
  return { a: bancos[0].registro, b: bancos[1].registro, cuadros: pasos };
}

// ---- Un bot por juego ------------------------------------------------------

/** Letras por frecuencia, que es como empieza cualquiera. */
const LETRAS = 'AEOSRNILDTCUMPBGVYQHFZJXKWÑ'.split('');
const PALABRAS = ['PATO', 'ESTANQUE', 'PLUMA', 'CHARCO', 'GRAZNIDO', 'NENUFAR'];

async function bots() {
  const minigolf = await import('../src/core/game/minijuegos/minigolf.js');
  const pool = await import('../src/core/game/minijuegos/pool.js');
  const artilleria = await import('../src/core/game/minijuegos/artilleria.js');

  return [
    {
      id: 'minigolf', tipo: 'escenario', modulo: minigolf,
      // El cursor SOBRE el hoyo. El juego saca la dirección de bola->cursor, así
      // que apunta bien esté donde esté la bola, y la fuerza sale de la
      // distancia, que es justo lo que se quiere en un minigolf.
      apuntar(banco, medidas) {
        const campo = minigolf.medirCampo(medidas, (y) => medidas.alto - y);
        const n = Number((/Hoyo (\d+)/.exec(banco.registro.marcador) || [0, 1])[1]) - 1;
        const disenos = minigolf.disenarRecorrido(banco.ctx.semilla);
        const mapa = minigolf.aPixeles(disenos[Math.max(0, Math.min(disenos.length - 1, n))], campo);
        return {
          x: mapa.hoyo.x + (Math.random() * 2 - 1) * 60,
          y: mapa.hoyo.y + (Math.random() * 2 - 1) * 60
        };
      }
    },
    {
      id: 'pool', tipo: 'escenario', modulo: pool,
      // A un punto cualquiera de la mesa: un billar jugado al azar recorre más
      // situaciones raras que uno jugado bien, y lo que se mira es que los dos
      // tableros acaben iguales.
      apuntar(banco, medidas) {
        const campo = pool.medirCampo(medidas, (y) => medidas.alto - y);
        return {
          x: campo.x0 + Math.random() * campo.ancho,
          y: campo.y0 + Math.random() * campo.alto
        };
      }
    },
    {
      id: 'artilleria', tipo: 'escenario', modulo: artilleria,
      apuntar(banco, medidas) {
        // Se rehace el terreno limpio: el bot no ve los cráteres, así que
        // apunta peor a cada turno. Da igual, y hasta viene bien: así la
        // partida dura más y se cruzan más mensajes.
        const t = artilleria.generarTerreno(medidas, banco.ctx.semilla);
        const mio = medidas.ancho * 0.12;
        const suyo = medidas.ancho * 0.88;
        const desde = { x: mio, y: artilleria.alturaEn(t, mio, medidas) };
        const plan = artilleria.mejorDisparo(
          desde, { x: suyo + (Math.random() * 2 - 1) * 120, y: artilleria.alturaEn(t, suyo, medidas) },
          t, medidas, 0);
        return cursorPara({ x: desde.x, y: desde.y - medidas.patoAlto * 0.5 }, plan,
          { fuerzaMax: FUERZA_BOT, alcance: ALCANCE_BOT, ancho: medidas.ancho });
      }
    }
  ];
}

async function botsDePanel() {
  const ahorcado = await import('../src/core/game/minijuegos/ahorcado.js');
  const flota = await import('../src/core/game/minijuegos/flota.js');

  return [
    {
      id: 'ahorcado', tipo: 'panel', modulo: ahorcado,
      preparar(semilla) {
        // Cada uno pone una palabra y tiene que adivinar la del otro. Se le da
        // la del otro a propósito: un bot que acierta por frecuencia no gana
        // nunca, y entonces no se prueban ni la victoria ni la revelación.
        const mias = [PALABRAS[semilla % PALABRAS.length], PALABRAS[(semilla + 3) % PALABRAS.length]];
        const puestas = [false, false];
        return (banco, i) => {
          const caja = banco.caja;
          if (!puestas[i]) {
            const campo = caja.querySelector('input');
            const enviar = boton(caja, 'adivine');
            if (campo && enviar && !enviar.disabled) {
              campo.value = mias[i];
              pulsar(enviar);
              puestas[i] = true;
            }
            return;
          }
          const teclas = new Map(Array.from(caja.querySelectorAll('button'))
            .filter((b) => /^[A-ZÑ]$/.test((b.textContent || '').trim()))
            .map((b) => [(b.textContent || '').trim(), b]));
          const suyas = Array.from(new Set(mias[1 - i].split('')));
          // Con torpeza: a veces prueba una que no está, para gastar fallos y
          // que alguna partida acabe en derrota y no siempre en victoria.
          const orden = Math.random() < 0.3
            ? LETRAS.filter((L) => !suyas.includes(L)).concat(suyas)
            : suyas.concat(LETRAS);
          for (const L of orden) {
            const b = teclas.get(L);
            if (b && !b.disabled) { pulsar(b); return; }
          }
        };
      }
    },
    {
      id: 'flota', tipo: 'panel', modulo: flota,
      preparar() {
        return (banco) => {
          const caja = banco.caja;
          // «Listo» manda sobre «Barajar»: al revés se baraja para siempre y no
          // se confirma la flota nunca.
          const listo = boton(caja, 'Listo');
          if (listo && !listo.disabled) { pulsar(listo); return; }
          const barajar = boton(caja, 'Barajar');
          if (barajar && !barajar.disabled) { pulsar(barajar); return; }

          const suMar = boton(caja, 'Su mar');
          if (suMar && !suMar.classList.contains('activa')) pulsar(suMar);
          const libres = Array.from(caja.querySelectorAll('.fl-casilla')).filter((c) =>
            !c.disabled && !c.classList.contains('agua')
            && !c.classList.contains('tocado') && !c.classList.contains('hundido'));
          if (libres.length) pulsar(libres[Math.floor(Math.random() * libres.length)]);
        };
      }
    }
  ];
}

// ---- El veredicto ----------------------------------------------------------

function cuadran(a, b) {
  if (!a || !b) return false;
  return (a.resultado === 'victoria' && b.resultado === 'derrota')
    || (a.resultado === 'derrota' && b.resultado === 'victoria')
    || (a.resultado === 'empate' && b.resultado === 'empate');
}

async function main() {
  const hayPanel = await cargarPanel();
  const lista = await bots();
  if (hayPanel) lista.push(...await botsDePanel());

  console.log(`Jugando ${PARTIDAS} partidas de cada juego, 1920 contra 1366.\n`);
  console.log('juego         termina  cuadra   se contradice  sin terminar');

  let malas = 0;
  for (const juego of lista) {
    let ok = 0;
    let chocan = 0;
    let colgadas = 0;
    const ejemplos = [];
    for (let s = 1; s <= PARTIDAS; s++) {
      const r = juego.tipo === 'escenario'
        ? await duelarEscenario(juego.modulo, (b, m) => juego.apuntar(b, m), s, juego.id)
        : await duelarPanel(juego.modulo, juego.preparar(s), s, juego.id);

      if (!r.a.fin || !r.b.fin) { colgadas++; continue; }
      if (cuadran(r.a.fin, r.b.fin)) ok++;
      else {
        chocan++;
        if (ejemplos.length < 2) {
          ejemplos.push(`    ${juego.id} #${s}: «${r.a.fin.resultado}» contra «${r.b.fin.resultado}»`);
        }
      }
    }
    const bien = chocan === 0 && colgadas === 0;
    if (!bien) malas++;
    console.log(juego.id.padEnd(14)
      + String(PARTIDAS - colgadas).padEnd(9)
      + String(ok).padEnd(9)
      + String(chocan).padEnd(15)
      + colgadas
      + (bien ? '' : '   <-- MAL'));
    for (const e of ejemplos) console.log(e);
  }

  console.log('');
  if (!hayPanel) {
    console.log('Los de panel se han saltado: falta `jsdom`.');
    console.log('Está en las dependencias de desarrollo, así que `npm ci --omit=dev` no la trae.');
    console.log('');
  }
  if (malas) {
    console.error(`FALLA: ${malas} juego(s) con partidas que no cuadran o que no terminan.`);
    process.exit(1);
  }
  console.log(`OK: ${lista.length} juegos, ${PARTIDAS} partidas cada uno, todas coherentes.`);
}

main().catch((e) => {
  console.error('FALLA:', e && e.stack ? e.stack : e);
  process.exit(1);
});
