// Comprueba que el monedero está bien montado en el Supabase de verdad.
//
//   npm run cuacks:servidor
//
// ---- Por qué existe este fichero -------------------------------------------
//
// Hay tres cosas distintas que comprobar del monedero, y cada una necesita lo
// suyo:
//
//   * `npm run cuacks:check` — que el pato y el SQL digan lo mismo. Lee ficheros,
//     no necesita nada más.
//   * `npm run cuacks:sql` — que el SQL haga lo que dice. Necesita Docker, y
//     corre contra un Postgres de usar y tirar.
//   * **esto** — que el SQL esté lanzado EN ESTE PROYECTO y con el catálogo al
//     día. Eso no se puede saber sin preguntárselo al servidor de verdad.
//
// Lo tercero es lo que más se olvida: añadir un juego, publicar, y descubrir
// semanas después que ni se puede comprar ni pagan sus partidas porque nadie
// volvió a pegar el fichero en el panel.
//
// ---- Y no escribe nada -----------------------------------------------------
//
// Igual que `probar-marcador.js`, y por un motivo más fuerte todavía: aquí
// escribir sería crear un monedero de pruebas en la tabla donde están los cuacks
// de la gente, y con esta clave no hay forma de borrarlo (limpiar se hace desde
// el panel, que va con `service_role`).
//
// Así que se llama a cada función con un secreto **demasiado corto**. Ése es un
// camino que todas tienen que recorrer entero —existe, se puede llamar como
// `anon`, valida lo que recibe— y que termina devolviendo `secreto-corto` SIN
// tocar ninguna fila. Se comprueba la puerta sin cruzarla.
//
// Se conecta con la MISMA clave publicable que lleva la app, así que lo que
// verifica es exactamente lo que va a poder hacer un pato.

import { createRequire } from 'node:module';

process.removeAllListeners('warning');
process.on('warning', (w) => {
  if (w.code !== 'MODULE_TYPELESS_PACKAGE_JSON') console.warn(w.stack);
});

const require = createRequire(import.meta.url);
const config = require('../src/main/config.js');

if (!config.isConfigured()) {
  console.error('No hay credenciales de Supabase. Ver docs/CONFIGURACION.md.');
  process.exit(2);
}

const { MINIJUEGOS } = await import('../src/core/game/minijuegos/index.js');

let fallos = 0;
const comprobar = (que, bien, extra) => {
  console.log(`${bien ? 'OK  ' : 'FALLO'} ${que}${extra ? '  ·  ' + extra : ''}`);
  if (!bien) fallos++;
};

const cabeceras = {
  apikey: config.SUPABASE_KEY,
  Authorization: `Bearer ${config.SUPABASE_KEY}`,
  'Content-Type': 'application/json'
};

async function pedir(ruta, opciones) {
  try {
    const res = await fetch(`${config.SUPABASE_URL}${ruta}`, {
      ...opciones, headers: cabeceras
    });
    const texto = await res.text();
    let datos = null;
    try { datos = texto ? JSON.parse(texto) : null; } catch { /* no era JSON */ }
    return { estado: res.status, ok: res.ok, texto, datos };
  } catch (err) {
    return { estado: 0, ok: false, texto: String(err.message || err), datos: null };
  }
}

/** Llama a una función del monedero con un secreto corto: mira, no toca. */
const llamar = (fn, cuerpo) => pedir(`/rest/v1/rpc/${fn}`, {
  method: 'POST',
  body: JSON.stringify({ p_secreto: 'corto', ...(cuerpo || {}) })
});

console.log(`Proyecto: ${config.SUPABASE_URL}  (credenciales: ${config.SOURCE})\n`);

// ---- 1. Las seis puertas existen y están abiertas para `anon` -------------

console.log('-- las funciones --');

const PUERTAS = [
  ['mis_cuacks', {}],
  ['estrenar_cuacks', { p_saldo: 0, p_ganado: 0, p_comprados: [], p_dia_broma: '' }],
  ['apuntar_partida_cuacks',
    { p_partida: 'de-mentira', p_juego: 'flappy', p_resultado: 'derrota', p_en_red: false }],
  ['comprar_juego', { p_juego: 'memoria' }],
  ['cobrar_broma', { p_nivel: 1 }],
  ['borrar_mis_cuacks', {}]
];

let faltaAlguna = false;
for (const [fn, cuerpo] of PUERTAS) {
  const r = await llamar(fn, cuerpo);
  // El camino del secreto corto: la función existe, se puede llamar, valida lo
  // que recibe y se planta antes de escribir nada.
  const bien = r.ok && r.datos && r.datos.motivo === 'secreto-corto' && r.datos.ok === false;
  if (!bien) faltaAlguna = true;
  comprobar(`\`${fn}\` responde y se planta sin tocar nada`, bien,
    bien ? '' : `${r.estado} ${String(r.texto).slice(0, 120)}`);
}

if (faltaAlguna) {
  console.log('\n     Si dice «Could not find the function», falta lanzar');
  console.log('     `supabase/cuacks.sql` en SQL Editor → Run.');
}

// ---- 2. El catálogo del servidor es el de verdad ---------------------------

console.log('\n-- el catálogo sembrado --');

const cat = await pedir('/rest/v1/juegos_catalogo?select=id,nivel,precio', { method: 'GET' });
if (!cat.ok || !Array.isArray(cat.datos)) {
  comprobar('la tabla `juegos_catalogo` se puede leer', false,
    `${cat.estado} ${String(cat.texto).slice(0, 120)}`);
} else {
  comprobar('la tabla `juegos_catalogo` se puede leer', true, `${cat.datos.length} filas`);

  const servidor = new Map(cat.datos.map((f) => [f.id, f]));
  const problemas = [];
  for (const j of MINIJUEGOS) {
    const s = servidor.get(j.id);
    if (!s) { problemas.push(`${j.id}: no está sembrado`); continue; }
    if (s.nivel !== j.nivel) problemas.push(`${j.id}: nivel ${j.nivel} aquí, ${s.nivel} allí`);
    if (s.precio !== (j.precio || 0)) {
      problemas.push(`${j.id}: precio ${j.precio || 0} aquí, ${s.precio} allí`);
    }
  }
  for (const id of servidor.keys()) {
    if (!MINIJUEGOS.some((j) => j.id === id)) problemas.push(`${id}: sobra en el servidor`);
  }

  comprobar('cada juego tiene el mismo nivel y el mismo precio que en el catálogo',
    problemas.length === 0, problemas.length ? problemas.join(' | ') : `${MINIJUEGOS.length} juegos`);
  if (problemas.length) {
    console.log('\n     `npm run catalogo` y vuelve a lanzar `supabase/cuacks.sql`.');
    console.log('     Hasta entonces, lo desajustado ni se compra ni paga.');
  }
}

// ---- 3. Y lo que NO se puede hacer con esta clave --------------------------
//
// Lo de arriba comprueba que el pato puede trabajar. Esto comprueba lo otro, que
// es la mitad que de verdad importa cuando encima vayan premios: que con la
// clave que lleva la app dentro no se llega al monedero de nadie.

console.log('\n-- lo que la clave publicable NO abre --');

const CERRADAS = [
  ['el saldo de todo el mundo', '/rest/v1/cuacks?select=dueno,saldo&limit=1', 'GET', null],
  ['quién ha jugado a qué', '/rest/v1/cuacks_partidas?select=dueno&limit=1', 'GET', null],
  ['poner los juegos a cero', '/rest/v1/juegos_catalogo?id=eq.memoria', 'PATCH',
    JSON.stringify({ precio: 0 })]
];

for (const [que, ruta, method, body] of CERRADAS) {
  const r = await pedir(ruta, { method, ...(body ? { body } : {}) });
  // Una tabla sin permisos contesta 401/403; una con RLS y sin política, 200 con
  // una lista vacía. Lo primero es lo que tiene que pasar aquí, y la diferencia
  // importa: «vacía» podría ser «hoy no hay nadie».
  const cerrada = r.estado === 401 || r.estado === 403 || r.estado === 404;
  comprobar(`no se puede leer ni tocar ${que}`, cerrada,
    `${r.estado} ${String(r.texto).slice(0, 80)}`);
}

console.log(`\n${fallos === 0
  ? 'Todo correcto: el monedero está montado en este proyecto.'
  : `${fallos} comprobación(es) mal`}`);
process.exit(fallos === 0 ? 0 : 1);
