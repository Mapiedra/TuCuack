// Vuelca el catálogo de minijuegos dentro de `supabase/cuacks.sql`.
//
//   npm run catalogo
//
// ---- Por qué existe este fichero -------------------------------------------
//
// El servidor calcula lo que paga una partida y lo que cuesta un juego, y para
// eso necesita saber el nivel y el precio de cada uno. O sea que hay DOS
// catálogos: el de verdad, en `core/game/minijuegos/index.js`, y una copia en la
// tabla `juegos_catalogo` de Supabase.
//
// Dos copias de lo mismo se separan siempre. Lo único que impide que aquí pase
// es que la segunda no se escriba a mano: este programa la saca de la primera y
// la pega entre las marcas del SQL. Cuando se añada un juego o cambie un precio:
//
//   1. `npm run catalogo`
//   2. Lanzar `supabase/cuacks.sql` otra vez en el editor SQL del panel.
//
// Si se olvida el paso 2, el juego nuevo no se podrá comprar y sus partidas no
// pagarán: el servidor contesta `juego-desconocido` a las dos cosas, que es
// exactamente lo que hay que ver para saber qué falta. `npm run cuacks:check`
// avisa del paso 1.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// El núcleo son módulos de navegador y este paquete no declara `"type":
// "module"`, así que Node avisa al cargarlos. Es esperado; cualquier otro aviso
// sí se enseña. (El mismo apaño que en tools/probar-salas.mjs.)
process.removeAllListeners('warning');
process.on('warning', (w) => {
  if (w.code !== 'MODULE_TYPELESS_PACKAGE_JSON') console.warn(w.stack);
});

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SQL = path.join(AQUI, '..', 'supabase', 'cuacks.sql');
const ABRE = '-- >>> CATALOGO <<<';
const CIERRA = '-- >>> FIN CATALOGO <<<';

const { MINIJUEGOS } = await import('../src/core/game/minijuegos/index.js');

/** Un id de juego tal y como puede ir dentro de una cadena de SQL. */
function comillas(id) {
  if (!/^[a-z0-9_]{1,40}$/.test(id)) {
    console.error(`El id "${id}" no es lo que el catálogo de SQL admite `
      + '(minúsculas, dígitos y guión bajo, hasta 40).');
    process.exit(1);
  }
  return `'${id}'`;
}

const filas = MINIJUEGOS.map((j) => {
  const nivel = Number(j.nivel) || 1;
  const precio = Math.max(0, Number(j.precio) || 0);
  return `  (${comillas(j.id)}, ${nivel}, ${precio})`;
}).join(',\n');

// La lista de ids para el borrado, envuelta a lo ancho para que se lea.
const ids = MINIJUEGOS.map((j) => comillas(j.id));
const lineas = [];
let grupo = [];
for (const id of ids) {
  grupo.push(id);
  if (`  ${grupo.join(', ')},`.length > 74) {
    lineas.push(`  ${grupo.join(', ')},`);
    grupo = [];
  }
}
if (grupo.length) lineas.push(`  ${grupo.join(', ')}`);
// La última línea no lleva coma, la haya cerrado el grupo o no.
lineas[lineas.length - 1] = lineas[lineas.length - 1].replace(/,$/, '');

const bloque = `${ABRE}
insert into public.juegos_catalogo (id, nivel, precio) values
${filas}
on conflict (id) do update
  set nivel = excluded.nivel, precio = excluded.precio;

delete from public.juegos_catalogo where id not in (
${lineas.join('\n')}
);
${CIERRA}`;

const antes = await readFile(SQL, 'utf8');
const i = antes.indexOf(ABRE);
const f = antes.indexOf(CIERRA);
if (i < 0 || f < 0) {
  console.error(`No encuentro las marcas ${ABRE} / ${CIERRA} en ${SQL}.`);
  process.exit(1);
}

const despues = antes.slice(0, i) + bloque + antes.slice(f + CIERRA.length);
if (despues === antes) {
  console.log(`El catálogo del SQL ya estaba al día (${MINIJUEGOS.length} juegos).`);
  process.exit(0);
}

await writeFile(SQL, despues, 'utf8');
console.log(`Catálogo volcado: ${MINIJUEGOS.length} juegos en supabase/cuacks.sql.`);
console.log('Acuérdate de lanzar ese fichero otra vez en el editor SQL del panel.');
