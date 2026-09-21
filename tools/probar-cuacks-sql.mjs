// Lanza el SQL del monedero contra un Postgres de usar y tirar.
//
//   npm run cuacks:sql        (hace falta Docker)
//
// ---- Por qué existe este fichero -------------------------------------------
//
// `supabase/cuacks.sql` es la pieza del monedero que no tiene nada debajo. Ahí
// se decide cuánto paga una partida, cuánto cuesta un juego y quién puede tocar
// el saldo de quién; y a diferencia del resto del proyecto, no se puede probar
// ejecutándola sin más: la única base de datos que hay es la de verdad, donde
// están los cuacks de la gente.
//
// Así que se levanta una de mentira. Un contenedor de Postgres, el decorado que
// Supabase da por hecho —el esquema `extensions` y los roles `anon` y
// `authenticated`— y encima el fichero tal cual se le pega al panel. Después,
// `supabase/pruebas/cuacks.sql` ejercita las cinco funciones: estrenar, pagar,
// repetir la misma partida, comprar, cobrar la broma, pasarse del tope. Y al
// final repite las preguntas **como `anon`**, que es el rol con el que se conecta
// el pato con la clave publicable — o sea, lo que puede hacer cualquiera que
// mire dentro de la app.
//
// `npm run cuacks:check` no necesita Docker y comprueba otra cosa: que el pato y
// el servidor sigan diciendo lo mismo. Los dos hacen falta.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SUPABASE = path.join(AQUI, '..', 'supabase');

const CONTENEDOR = 'tucuack-sql-de-pruebas';
const IMAGEN = 'postgres:16';

/** Ejecuta un mandato y devuelve `{codigo, salida}`. Nunca lanza. */
function correr(mandato, args, { callado = false } = {}) {
  return new Promise((resolve) => {
    const p = spawn(mandato, args, { shell: false });
    let salida = '';
    const recoger = (d) => {
      salida += d;
      if (!callado) process.stdout.write(d);
    };
    p.stdout.on('data', recoger);
    p.stderr.on('data', recoger);
    p.on('error', (err) => resolve({ codigo: -1, salida: String(err.message) }));
    p.on('close', (codigo) => resolve({ codigo, salida }));
  });
}

const docker = (args, opciones) => correr('docker', args, opciones);

async function hayDocker() {
  const r = await docker(['info', '--format', '{{.ServerVersion}}'], { callado: true });
  return r.codigo === 0;
}

/** Espera a que Postgres acepte conexiones. Arrancar tarda unos segundos. */
async function esperarAPostgres() {
  for (let i = 0; i < 40; i++) {
    const r = await docker(['exec', CONTENEDOR, 'pg_isready', '-U', 'postgres'], { callado: true });
    if (r.codigo === 0) return true;
    await new Promise((r2) => setTimeout(r2, 1000));
  }
  return false;
}

async function main() {
  if (!await hayDocker()) {
    console.error('Hace falta Docker en marcha para esta comprobación.');
    console.error('Lo que NO necesita Docker es `npm run cuacks:check`, que comprueba');
    console.error('que el pato y el SQL sigan diciendo lo mismo.');
    process.exit(2);
  }

  // Uno limpio siempre: una tabla con restos de la vez anterior contesta cosas
  // que no son, y depurar eso cuesta más que arrancar de cero.
  await docker(['rm', '-f', CONTENEDOR], { callado: true });
  console.log(`Levantando ${IMAGEN}…`);
  const arranque = await docker([
    'run', '-d', '--name', CONTENEDOR,
    '-e', 'POSTGRES_PASSWORD=pato',
    IMAGEN
  ], { callado: true });
  if (arranque.codigo !== 0) {
    console.error('No se pudo levantar el contenedor:', arranque.salida.trim());
    process.exit(2);
  }

  let fallos = 0;
  try {
    if (!await esperarAPostgres()) {
      console.error('El contenedor no ha llegado a aceptar conexiones.');
      process.exit(2);
    }

    const ficheros = [
      ['pruebas/decorado.sql', 'lo que Supabase ya trae puesto'],
      ['cuacks.sql', 'el fichero que se le pega al panel'],
      ['pruebas/cuacks.sql', 'las comprobaciones']
    ];

    for (const [relativo, que] of ficheros) {
      const dentro = `/tmp/${path.basename(path.dirname(relativo))}-${path.basename(relativo)}`;
      const copia = await docker(['cp', path.join(SUPABASE, relativo), `${CONTENEDOR}:${dentro}`],
        { callado: true });
      if (copia.codigo !== 0) {
        console.error(`No se pudo copiar ${relativo}:`, copia.salida.trim());
        process.exit(2);
      }

      const esLaPrueba = relativo === 'pruebas/cuacks.sql';
      if (!esLaPrueba) console.log(`\nAplicando ${relativo} (${que})…`);
      else console.log('');

      const r = await docker([
        'exec', CONTENEDOR, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1',
        ...(esLaPrueba ? [] : ['-q']), '-f', dentro
      ], { callado: true });

      if (esLaPrueba) {
        // psql escupe las comprobaciones como NOTICE, con la ruta delante.
        for (const linea of r.salida.split(/\r?\n/)) {
          const m = linea.match(/NOTICE:\s+(.*)$/);
          if (m) console.log(m[1]);
        }
        fallos = (r.salida.match(/NOTICE:\s+FALLO/g) || []).length;
      }

      if (r.codigo !== 0) {
        console.error(`\n${relativo} no ha entrado:`);
        // La línea de ERROR de psql dice el número de línea exacto.
        for (const linea of r.salida.split(/\r?\n/)) {
          if (/ERROR|LINE|\^/.test(linea)) console.error('  ' + linea);
        }
        process.exit(1);
      }

      if (!esLaPrueba) console.log('  entra entero.');
    }
  } finally {
    // El contenedor se va siempre, haya salido bien o mal: dejarlo encendido
    // consumiendo memoria porque una comprobación falló sería lo peor de los dos
    // mundos.
    await docker(['rm', '-f', CONTENEDOR], { callado: true });
  }

  console.log(`\n${fallos === 0 ? 'Todo correcto' : `${fallos} comprobación(es) mal`}`);
  process.exit(fallos === 0 ? 0 : 1);
}

main();
