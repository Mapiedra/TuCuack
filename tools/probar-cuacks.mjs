// Comprueba el monedero sin tocar la red.
//
//   npm run cuacks:check
//
// ---- Por qué existe este fichero -------------------------------------------
//
// Los cuacks viven ahora en el servidor (ver `supabase/cuacks.sql`), y eso deja
// dos cosas que se pueden estropear sin que nadie se entere:
//
//   1. **Que el pato y el servidor no digan lo mismo.** La fórmula de lo que
//      paga una partida está escrita DOS veces: en `core/game/cuacks.js`, para
//      poder enseñar el premio en cuanto termina la partida, y en el SQL, que
//      es quien de verdad paga. Si se separan, el número cambia delante de las
//      narices del jugador medio segundo después de salir. Lo mismo con el
//      catálogo: si el SQL no conoce un juego, ni se puede comprar ni pagan sus
//      partidas.
//
//   2. **Que la cartera pierda cuacks.** Lo que se juega sin conexión se apunta
//      en una cola y sale al volver. Esa cola es justo la clase de cosa que
//      funciona hasta el día que no, y cuando no funciona lo que se pierde es el
//      dinero de alguien.
//
// Lo primero se comprueba leyendo los dos ficheros y comparando. Lo segundo, con
// una cartera de verdad contra un monedero de mentira al que se le puede cortar
// la línea cuando uno quiera — que es lo que no se puede hacer con la de verdad.
//
// Lo que NO se comprueba aquí es que el SQL esté lanzado en el proyecto: eso
// sólo se ve hablando con Supabase, y se nota en que el servidor contesta
// `juego-desconocido`.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

process.removeAllListeners('warning');
process.on('warning', (w) => {
  if (w.code !== 'MODULE_TYPELESS_PACKAGE_JSON') console.warn(w.stack);
});

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SQL = await readFile(path.join(AQUI, '..', 'supabase', 'cuacks.sql'), 'utf8');

const { MINIJUEGOS } = await import('../src/core/game/minijuegos/index.js');
const { Cartera, pagoDePartida, premioDeLaBroma, BROMA_SUELO, BROMA_POR_NIVEL }
  = await import('../src/core/game/cuacks.js');

let fallos = 0;
const comprobar = (que, bien, extra) => {
  console.log(`${bien ? 'OK  ' : 'FALLO'} ${que}${extra ? '  ·  ' + extra : ''}`);
  if (!bien) fallos++;
};

/** El número que devuelve una de las funciones de ajuste del SQL. */
function ajusteSql(nombre) {
  const re = new RegExp(
    `function public\\.${nombre}\\(\\)[\\s\\S]{0,200}?as \\$\\$ select (-?\\d+) \\$\\$`);
  const m = SQL.match(re);
  return m ? Number(m[1]) : null;
}

// ---- 1. Los dos lados dicen lo mismo --------------------------------------

console.log('-- el pato y el servidor, de acuerdo --');

// `pagoDePartida` no exporta sus constantes, así que se sacan de lo que paga:
// una partida perdida de un juego de nivel N vale round((suelo + N*paso) * 0.3),
// y con dos niveles se despeja. Así se comprueba lo que DE VERDAD se cobra y no
// una constante que podría haber dejado de usarse.
const conNivel = (nivel) => ({ id: 'de-mentira', nivel, precio: 0 });
const v1 = pagoDePartida(conNivel(1), 'victoria');
const v2 = pagoDePartida(conNivel(2), 'victoria');
const pasoJs = v2 - v1;
const sueloJs = v1 - pasoJs;

comprobar('el suelo de una partida', sueloJs === ajusteSql('cuacks_suelo'),
  `pato ${sueloJs} · servidor ${ajusteSql('cuacks_suelo')}`);
comprobar('lo que suma cada nivel', pasoJs === ajusteSql('cuacks_por_nivel'),
  `pato ${pasoJs} · servidor ${ajusteSql('cuacks_por_nivel')}`);
comprobar('el suelo del premio de la broma', BROMA_SUELO === ajusteSql('broma_suelo'),
  `pato ${BROMA_SUELO} · servidor ${ajusteSql('broma_suelo')}`);
comprobar('lo que suma cada nivel a la broma',
  BROMA_POR_NIVEL === ajusteSql('broma_por_nivel'),
  `pato ${BROMA_POR_NIVEL} · servidor ${ajusteSql('broma_por_nivel')}`);

// El techo del nivel para la broma sólo está en el SQL —el pato no lo necesita—,
// pero si alguien lo baja por debajo de lo que la gente ya juega, el premio que
// el pato anuncia deja de ser el que cae. Se avisa a partir de nivel 200.
const techo = ajusteSql('broma_nivel_tope');
comprobar('el techo del nivel de la broma existe y no es ridículo',
  Number.isFinite(techo) && techo >= 100,
  `${techo}, o sea hasta ${premioDeLaBroma(techo)} cuacks`);

// Los multiplicadores por resultado. Se comprueban contra lo que paga el pato,
// que es lo que el jugador ve.
const CASOS = [
  ['victoria', /when 'victoria' then (\S+)/],
  ['empate', /when 'empate'\s+then (\S+)/]
];
for (const [resultado, re] of CASOS) {
  const m = SQL.match(re);
  const sql = m ? Number(m[1]) : null;
  const pagoJs = pagoDePartida(conNivel(10), resultado);
  const esperado = Math.max(1, Math.round((sueloJs + 10 * pasoJs) * sql));
  comprobar(`ganar por ${resultado} paga lo mismo en los dos`, pagoJs === esperado,
    `pato ${pagoJs} · servidor ${esperado} (×${sql})`);
}
const porRed = pagoDePartida(conNivel(10), 'victoria', { enRed: true });
comprobar('jugar en red paga el doble en los dos',
  porRed === pagoDePartida(conNivel(10), 'victoria') * 2 && /else 1 end\)\s*\)/.test(SQL),
  `${porRed} contra ${pagoDePartida(conNivel(10), 'victoria')}`);

// ---- 2. El catálogo sembrado es el de verdad -------------------------------

console.log('\n-- el catálogo sembrado --');

const sembrado = new Map();
const bloque = SQL.slice(SQL.indexOf('-- >>> CATALOGO <<<'), SQL.indexOf('-- >>> FIN CATALOGO <<<'));
for (const m of bloque.matchAll(/\('([a-z0-9_]+)',\s*(\d+),\s*(\d+)\)/g)) {
  sembrado.set(m[1], { nivel: Number(m[2]), precio: Number(m[3]) });
}

comprobar('hay tantos juegos sembrados como en el catálogo',
  sembrado.size === MINIJUEGOS.length,
  `${sembrado.size} sembrados · ${MINIJUEGOS.length} en el catálogo`);

const desajustados = [];
for (const j of MINIJUEGOS) {
  const s = sembrado.get(j.id);
  if (!s) { desajustados.push(`${j.id}: no está sembrado`); continue; }
  if (s.nivel !== j.nivel) desajustados.push(`${j.id}: nivel ${j.nivel} vs ${s.nivel}`);
  if (s.precio !== (j.precio || 0)) {
    desajustados.push(`${j.id}: precio ${j.precio || 0} vs ${s.precio}`);
  }
}
comprobar('cada juego tiene el mismo nivel y el mismo precio en los dos',
  desajustados.length === 0,
  desajustados.length ? desajustados.join(' | ') : 'todos cuadran');
if (desajustados.length) console.log('     Arréglalo con `npm run catalogo`.');

// ---- 3. La cartera contra un monedero de mentira --------------------------
//
// El monedero de mentira lleva la cuenta como lo haría el SQL: paga con la misma
// fórmula, no paga dos veces la misma partida y cobra el precio del catálogo. Y
// además se le puede cortar la línea a voluntad, que es de lo que se trata.

console.log('\n-- la cartera, el espejo y la cola --');

function monederoDeMentira() {
  const libro = { saldo: 0, ganado: 0, comprados: [], diaDeLaBroma: '', existe: false };
  const pagadas = new Set();
  const m = {
    /** Cuando está cortada, todo contesta «no hay línea», como una red caída. */
    cortada: false,
    /** Cuántas veces se le ha pedido apuntar una partida, repeticiones incluidas. */
    intentos: 0,
    libro,
    estado(motivo, cuacks) {
      return { ok: true, datos: { ...libro, comprados: [...libro.comprados], motivo, cuacks } };
    },
    sinLinea: () => ({ ok: false, error: 'sin respuesta' }),

    async mios() {
      return m.cortada ? m.sinLinea() : m.estado('ok', 0);
    },
    async estrenar(local) {
      if (m.cortada) return m.sinLinea();
      if (libro.existe) return m.estado('ya-estaba', 0);
      libro.existe = true;
      libro.saldo = local.saldo;
      libro.ganado = Math.max(local.ganado, local.saldo);
      libro.comprados = [...local.comprados];
      libro.diaDeLaBroma = local.diaDeLaBroma || '';
      return m.estado('estrenado', 0);
    },
    async partida(p) {
      if (m.cortada) return m.sinLinea();
      m.intentos++;
      if (pagadas.has(p.id)) return m.estado('ya-estaba', 0);
      pagadas.add(p.id);
      const juego = MINIJUEGOS.find((j) => j.id === p.juego) || conNivel(1);
      const pago = pagoDePartida(juego, p.resultado, { enRed: p.enRed });
      libro.existe = true;
      libro.saldo += pago;
      libro.ganado += pago;
      return m.estado('pagada', pago);
    },
    async comprar(id) {
      if (m.cortada) return m.sinLinea();
      const juego = MINIJUEGOS.find((j) => j.id === id);
      if (!juego) return m.estado('juego-desconocido', 0);
      if (libro.comprados.includes(id)) return m.estado('ya-lo-tienes', 0);
      if (libro.saldo < juego.precio) return m.estado('no-llega', 0);
      libro.saldo -= juego.precio;
      libro.comprados.push(id);
      return m.estado('comprado', -juego.precio);
    },
    async broma() { return m.cortada ? m.sinLinea() : m.estado('cobrada', 0); }
  };
  return m;
}

const barato = MINIJUEGOS.find((j) => j.precio > 0);
const caro = [...MINIJUEGOS].sort((a, b) => b.precio - a.precio)[0];

// -- estrena con lo que había en el disco
{
  const servidor = monederoDeMentira();
  const cartera = new Cartera({ saldo: 300, ganado: 400, comprados: [barato.id] },
    {}, servidor);
  await cartera.sincronizar();
  comprobar('el monedero nace con la cifra del disco',
    servidor.libro.saldo === 300 && servidor.libro.ganado === 400,
    `saldo ${servidor.libro.saldo} · ganado ${servidor.libro.ganado}`);
  comprobar('y con lo que ya estaba comprado',
    servidor.libro.comprados.join() === barato.id);
  comprobar('la cartera queda confirmada por el servidor', cartera.confirmada === true);
}

// -- lo que dice el servidor pisa a lo del disco
{
  const servidor = monederoDeMentira();
  Object.assign(servidor.libro, { existe: true, saldo: 42, ganado: 99, comprados: [] });
  const cartera = new Cartera({ saldo: 999999, ganado: 999999, comprados: [caro.id] },
    {}, servidor);
  await cartera.sincronizar();
  comprobar('un saldo local inflado no sobrevive a la primera sincronización',
    cartera.saldo === 42, `${cartera.saldo}`);
  comprobar('ni los juegos que alguien se hubiera puesto a mano',
    cartera.tiene(caro) === false);
  comprobar('y el cartel de bienvenida no sale si el monedero ya existía',
    cartera.estrenada === false);
}

// -- una partida paga en el acto y el servidor lo confirma
{
  const servidor = monederoDeMentira();
  const cartera = new Cartera({ saldo: 0, ganado: 0, comprados: [] }, {}, servidor);
  await cartera.sincronizar();

  const cuacks = cartera.apuntarPartida(barato, 'victoria', { id: 'p1' });
  comprobar('el premio se ve sin esperar al servidor', cartera.saldo === cuacks,
    `+${cuacks} al instante`);

  await esperar();
  comprobar('y cuando contesta, el saldo no se cuenta dos veces',
    cartera.saldo === cuacks && servidor.libro.saldo === cuacks,
    `pato ${cartera.saldo} · servidor ${servidor.libro.saldo}`);
  comprobar('la cola queda vacía', cartera.pendientes.length === 0);
}

// -- sin línea: se juega, se apunta y se cobra al volver
{
  const servidor = monederoDeMentira();
  const cartera = new Cartera({ saldo: 0, ganado: 0, comprados: [] }, {}, servidor);
  await cartera.sincronizar();

  servidor.cortada = true;
  const a = cartera.apuntarPartida(barato, 'victoria', { id: 'sin-red-1' });
  const b = cartera.apuntarPartida(barato, 'derrota', { id: 'sin-red-2' });
  await esperar();
  comprobar('sin línea, el saldo sube igual', cartera.saldo === a + b, `${cartera.saldo}`);
  comprobar('y lo jugado queda apuntado', cartera.pendientes.length === 2);
  comprobar('el servidor no se ha enterado de nada', servidor.libro.saldo === 0);

  // Apagar y volver mañana: la cola tiene que estar en lo que se guarda.
  const guardado = JSON.parse(JSON.stringify(cartera.toJSON()));
  comprobar('la cola sobrevive al apagado', guardado.pendientes.length === 2);

  const servidor2 = monederoDeMentira();
  Object.assign(servidor2.libro, { existe: true });
  const mañana = new Cartera(guardado, {}, servidor2);
  await mañana.sincronizar();
  comprobar('y al volver la línea se cobra sola',
    servidor2.libro.saldo === a + b && mañana.saldo === a + b,
    `servidor ${servidor2.libro.saldo} · pato ${mañana.saldo}`);
  comprobar('sin dejar nada pendiente', mañana.pendientes.length === 0);
}

// -- reintentar no cobra dos veces
{
  const servidor = monederoDeMentira();
  const cartera = new Cartera({ saldo: 0, ganado: 0, comprados: [] }, {}, servidor);
  await cartera.sincronizar();

  // La misma partida dos veces: es lo que pasa cuando la respuesta se pierde por
  // el camino y el pato reintenta. Aquí se fuerza a mano.
  const cuacks = cartera.apuntarPartida(barato, 'victoria', { id: 'repetida' });
  await esperar();
  cartera.pendientes.push({
    id: 'repetida', juego: barato.id, resultado: 'victoria', enRed: false, cuacks
  });
  await cartera._soltarLaCola();
  comprobar('mandar dos veces la misma partida sólo paga una',
    servidor.libro.saldo === cuacks && cartera.saldo === cuacks,
    `servidor ${servidor.libro.saldo} · pato ${cartera.saldo}`);
  comprobar('y el servidor ha recibido las dos, o sea que se probó de verdad',
    servidor.intentos === 2, `${servidor.intentos} envíos`);
}

// -- comprar exige servidor
{
  const servidor = monederoDeMentira();
  const cartera = new Cartera({ saldo: caro.precio + 100, ganado: 0, comprados: [] },
    {}, servidor);
  await cartera.sincronizar();

  servidor.cortada = true;
  const sinRed = await cartera.comprar(caro);
  comprobar('sin línea no se compra', sinRed.hecho === false, sinRed.motivo);
  comprobar('y no se descuenta nada por el camino',
    cartera.saldo === caro.precio + 100, `${cartera.saldo}`);

  servidor.cortada = false;
  const conRed = await cartera.comprar(caro);
  comprobar('con línea sí', conRed.hecho === true && cartera.tiene(caro), conRed.motivo);
  comprobar('y lo cobra el servidor, no el pato',
    servidor.libro.saldo === 100 && cartera.saldo === 100, `${cartera.saldo}`);
}

// -- la broma no se apunta en la cola
{
  const servidor = monederoDeMentira();
  const cartera = new Cartera({ saldo: 0, ganado: 0, comprados: [] }, {}, servidor);
  await cartera.sincronizar();
  servidor.cortada = true;
  const r = await cartera.cobrarLaBroma(5);
  comprobar('sin línea, el peaje de la broma se dice en vez de apuntarse',
    r.sinConexion === true && r.cuacks === 0);
  comprobar('y el día no se marca, así que se puede volver a intentar',
    cartera.diaDeLaBroma === '');
}

// -- sin servidor, todo sigue como antes
{
  const cartera = new Cartera({ saldo: caro.precio, ganado: 0, comprados: [] }, {}, null);
  const cuacks = cartera.apuntarPartida(barato, 'victoria', {});
  comprobar('sin monedero en el servidor, una partida paga igual',
    cartera.saldo === caro.precio + cuacks, `${cartera.saldo}`);
  const compra = await cartera.comprar(caro);
  comprobar('y se puede comprar contra el disco', compra.hecho === true);
}

// ---- Y a recoger ----------------------------------------------------------

function esperar() {
  // Dos vueltas de microtareas: lo que tarda `_soltarLaCola` en ir y volver
  // contra un monedero que no sale de la memoria.
  return new Promise((r) => setTimeout(r, 0));
}

console.log(`\n${fallos === 0 ? 'Todo correcto' : `${fallos} comprobación(es) mal`}`);
process.exit(fallos === 0 ? 0 : 1);
