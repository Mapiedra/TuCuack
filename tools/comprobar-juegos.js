'use strict';

// Comprueba la cuarta regla dura del contrato de los minijuegos:
//
//   > Ni un `const` ni un `let` después del `return` de `crearPartida`.
//
// ---- Por qué existe este fichero -------------------------------------------
//
// Los juegos de esta casa se escriben todos igual: el estado arriba, el `return`
// en medio, y debajo un montón de funciones. Eso funciona porque las
// DECLARACIONES DE FUNCIÓN se izan. `const` y `let` no: uno declarado ahí abajo
// entra en su zona muerta y no llega a inicializarse nunca, porque la ejecución
// salió por el `return` antes de alcanzarlo.
//
// Lo que lo hace peligroso no es el fallo, es dónde aparece: casi siempre dentro
// de un callback —un clic, un mensaje del rival, el primer fotograma—, o sea sin
// traza visible. Y `node --check` pasa tan contento, porque sintácticamente es
// válido.
//
// Ha mordido tres veces: en `memoria.js` el juego se quedaba mudo tras la
// primera carta, en el minigolf por turnos reventaba al llegar el primer golpe
// del rival, y en `lava.js` la escena ni abría. Las tres se encontraron a mano,
// jugando. La cuarta la encuentra esto.
//
// ---- Cómo lo mira ----------------------------------------------------------
//
// Sin analizador sintáctico, y a propósito: el cuerpo de `crearPartida` va a dos
// espacios de sangría y todo lo que hay dentro de sus funciones, a cuatro o más.
// Así que basta con buscar el `return` de dos espacios y mirar si por debajo
// aparece un `const` o un `let` a esa misma altura. Un analizador de verdad
// tendría que arrastrar una dependencia para comprobar una regla de estilo.
//
// Con un cuidado que la primera versión no tenía y que la dejó inservible: **hay
// que parar donde acaba `crearPartida`**. Debajo suele haber funciones de módulo
// exportadas —`repartirDianas`, `disenarHoyo`, `durezaDe`— cuyos cuerpos van
// también a dos espacios, y sin ese corte salían sesenta avisos de los que
// cincuenta y siete eran mentira. El corte es la primera llave en la columna 0.

const fs = require('fs');
const path = require('path');

const CARPETA = path.join(__dirname, '..', 'src', 'core', 'game', 'minijuegos');

/** Los que no son juegos: son la maquinaria que usan. */
const NO_SON_JUEGOS = new Set([
  'index.js', 'progreso.js', 'escenario.js', 'lienzo.js', 'entrada.js', 'azar.js'
]);

/** El `return` que cierra la parte de arriba de `crearPartida`. */
const RETORNO = /^ {2}return \{/;
/** Un `const` o un `let` al mismo nivel: el cuerpo de la función. */
const DECLARACION = /^ {2}(const|let)\s+([A-Za-z_$][\w$]*)/;
/** Y la llave que cierra `crearPartida`. A partir de ahí ya no es asunto suyo. */
const CIERRE = /^\}/;

function revisar(fichero) {
  const lineas = fs.readFileSync(path.join(CARPETA, fichero), 'utf8').split(/\r?\n/);
  const desde = lineas.findIndex((l) => RETORNO.test(l));
  if (desde < 0) return [];   // no todos los ficheros tienen esa forma

  const fallos = [];
  for (let i = desde + 1; i < lineas.length; i++) {
    if (CIERRE.test(lineas[i])) break;   // se acabó `crearPartida`
    const m = DECLARACION.exec(lineas[i]);
    if (m) fallos.push({ linea: i + 1, tipo: m[1], nombre: m[2] });
  }
  return fallos;
}

function main() {
  const ficheros = fs.readdirSync(CARPETA)
    .filter((f) => f.endsWith('.js') && !NO_SON_JUEGOS.has(f))
    .sort();

  let malos = 0;
  for (const f of ficheros) {
    for (const fallo of revisar(f)) {
      malos++;
      console.error(
        `::error file=src/core/game/minijuegos/${f},line=${fallo.linea}::`
        + `\`${fallo.tipo} ${fallo.nombre}\` está después del \`return\` de crearPartida. `
        + 'Ahí no se iza y nunca llega a inicializarse: súbelo con el resto del estado, '
        + 'o escríbelo como `function` si es una función.'
      );
    }
  }

  if (malos) {
    console.error(`\n${malos} declaración(es) en zona muerta. Ver la regla 4 en minijuegos/index.js.`);
    process.exit(1);
  }
  console.log(`OK: ${ficheros.length} juegos revisados, ninguna declaración en zona muerta.`);
}

main();
