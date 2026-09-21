'use strict';

// Comprueba la lista de conectados sin tocar la red.
//
//   npm run presencia:check
//
// ---- Por qué existe este fichero -------------------------------------------
//
// «A veces te habla alguien que no aparece como conectado». Ese fallo vivió
// meses porque para verlo hacen falta dos patos, mala suerte con un paquete
// perdido y mirar en el momento justo: la clase de cosa que no se reproduce a
// voluntad y que, cuando se arregla, nadie puede demostrar que siga arreglada.
//
// Lo que se prueba aquí es el trozo de `src/main/chat.js` que decide QUIÉN sale
// en la lista. No hace falta Supabase para eso: basta con contarle mentiras
// sobre el censo y pararle el reloj. Las seis situaciones son las que de verdad
// desajustaban la lista:
//
//   1. El anuncio falla al conectar. Antes eso dejaba al pato invisible para
//      todos PARA SIEMPRE; ahora le cuesta un latido.
//   2. Habla alguien que el censo no tiene. Tiene que aparecer, y en el acto.
//   3. Un pato que dice latir y lleva rato sin hacerlo es un fantasma: fuera.
//   4. Un pato de una versión anterior NO late, así que su fecha es la de
//      entrada. A ése hay que creerle, o se esconde a alguien conectado.
//   5. Lo oído también caduca. Si de verdad se fue, deja de hablar y se cae.
//   6. El censo y lo oído no se pisan: nadie sale dos veces.
//
// No se prueba aquí el gemelo de la extensión (src/extension/sw.js), que es el
// mismo código con otros nombres: vive en un service worker y no se puede
// cargar desde Node. Cuando se toque uno hay que tocar el otro, y los números
// —latido, caducidad— tienen que seguir siendo LOS MISMOS: si un extremo late
// cada 45 s y el otro caducara a los 30, cada uno vería al otro parpadear.

const path = require('path');

// ---- El decorado ----------------------------------------------------------
//
// Credenciales de mentira ANTES de cargar nada: `config.js` las resuelve al
// importarse, y sin ellas el chat se apaga solo y no hay nada que probar. No
// apuntan a ningún sitio: aquí no se abre ninguna conexión.
process.env.SUPABASE_URL = 'https://ejemplo.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_de_mentira';

// En Windows, el chat lee las raíces de certificados con PowerShell antes de
// levantar el canal (ver `raicesDeWindows`). Aquí no hay canal que levantar y
// esa llamada tarda segundos, así que se le dice que no estamos en Windows.
const plataformaDeVerdad = process.platform;
Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });

// El reloj, para poder envejecer el censo sin esperar.
const T0 = 1700000000000;
let ahora = T0;
const relojDeVerdad = Date.now;
Date.now = () => ahora;
const avanzar = (ms) => { ahora += ms; };

// El latido, para poder dispararlo a mano en vez de esperar tres cuartos de
// minuto por cada uno.
const intervaloDeVerdad = global.setInterval;
const quitarIntervaloDeVerdad = global.clearInterval;
let latidoRegistrado = null;
global.setInterval = (fn) => { latidoRegistrado = fn; return { falso: true }; };
global.clearInterval = (id) => { if (id && id.falso) latidoRegistrado = null; };
const latir = async () => { if (latidoRegistrado) await latidoRegistrado(); };

// ---- El canal de mentira --------------------------------------------------
//
// Lo justo para que `chat.js` se crea que habla con Supabase: guarda los
// manejadores para poder dispararlos y deja que la prueba escriba el censo a
// mano. `censo` es lo que devolvería `presenceState()`: la clave de cada pato
// con su lista de anuncios.

const censo = {};
/** Si el próximo anuncio va a fallar, como falla uno de verdad a veces. */
let fallaElAnuncio = false;
let anunciosHechos = 0;

/** La clave que `chat.js` se ha inventado para sí mismo. Se sabe al conectar. */
let clavePropia = '(todavía no)';

const manejadores = { broadcast: {}, presence: {} };
let avisarSuscripcion = null;

const canalFalso = {
  on(tipo, filtro, cb) {
    manejadores[tipo][filtro.event] = cb;
    return canalFalso;
  },
  subscribe(cb) { avisarSuscripcion = cb; return canalFalso; },
  async track(meta) {
    anunciosHechos++;
    if (fallaElAnuncio) throw new Error('de mentira: el anuncio no ha salido');
    censo[clavePropia] = [meta];
  },
  presenceState() { return censo; },
  send() { return 'ok'; },
  unsubscribe() {}
};

const clienteFalso = {
  channel() { return canalFalso; },
  removeChannel() {},
  removeAllChannels() {},
  realtime: { disconnect() {} }
};

// Se cuelan en la caché de `require` para que `chat.js` los encuentre en vez de
// los de verdad. Hay que resolverlos con la misma ruta que usaría él.
function colar(nombre, exportado) {
  const ruta = require.resolve(nombre, { paths: [path.join(__dirname, '..', 'src', 'main')] });
  require.cache[ruta] = { id: ruta, filename: ruta, loaded: true, exports: exportado };
}
colar('@supabase/supabase-js', { createClient: () => clienteFalso });
colar('ws', class WebSocketDeMentira {});

// ---- La prueba ------------------------------------------------------------

let fallos = 0;
const comprobar = (que, bien, extra) => {
  console.log(`${bien ? 'OK  ' : 'FALLO'} ${que}${extra ? '  ·  ' + extra : ''}`);
  if (!bien) fallos++;
};

/** Lo que el pato recibiría por IPC. Se vacía entre escenas. */
let recibidos = [];
const ventanaFalsa = {
  isDestroyed: () => false,
  webContents: { send: (_canal, evt) => recibidos.push(evt) }
};

const { initChat } = require('../src/main/chat.js');

/** Un anuncio en el censo, tal y como lo dejaría `track`. */
function anuncio(nombre, opciones) {
  const o = opciones || {};
  const late = o.late !== false;
  return {
    name: nombre,
    at: ahora - (o.edad || 0),
    id: o.id || 'p-rival',
    caps: late ? ['sala', 'privados', 'latido'] : ['sala', 'privados'],
    dir: o.dir || ''
  };
}

const nombres = (api) => api.presentes().map((p) => p.nombre).sort();

(async () => {
  const chat = initChat(() => ventanaFalsa, 'Yo', 'p-yo', '');
  // El canal se levanta tras una promesa —la de los certificados—: un respiro.
  await new Promise((r) => setImmediate(r));

  // ---- 1. Un anuncio que falla se reintenta --------------------------------
  console.log('\n-- el anuncio que falla al conectar --');
  fallaElAnuncio = true;
  clavePropia = chat.clave();
  await avisarSuscripcion('SUBSCRIBED', null);

  comprobar('se ha intentado anunciar al conectar', anunciosHechos === 1,
    `${anunciosHechos} intento(s)`);
  comprobar('y como ha fallado, este pato no está en el censo de nadie',
    !censo[clavePropia]);

  fallaElAnuncio = false;
  await latir();
  comprobar('el latido lo reintenta solo', anunciosHechos === 2,
    `${anunciosHechos} intentos`);
  comprobar('y esta vez sí sale',
    Boolean(censo[clavePropia]) && censo[clavePropia][0].name === 'Yo');

  // ---- 2. Habla alguien que el censo no tiene ------------------------------
  console.log('\n-- alguien habla y el censo no lo tiene --');
  comprobar('de partida no hay nadie más', nombres(chat).length === 0);

  recibidos = [];
  manejadores.broadcast.chat({
    payload: {
      from: 'Ausente', text: 'hola', ts: ahora, mid: 'm1',
      clave: 'pato-ausente', id: 'p-ausente',
      caps: ['sala', 'privados', 'latido'], dir: 'f'.repeat(64)
    }
  });
  comprobar('quien habla aparece en la lista',
    nombres(chat).join() === 'Ausente', nombres(chat).join() || '(vacía)');
  comprobar('y se avisa en el acto, sin esperar al siguiente latido',
    recibidos.some((e) => e.type === 'presence' && e.names.includes('Ausente')));

  const ausente = chat.presentes().find((p) => p.nombre === 'Ausente');
  comprobar('con lo que hace falta para escribirle y para retarle',
    Boolean(ausente && ausente.id === 'p-ausente' && ausente.dir === 'f'.repeat(64)));

  // ---- 3. El fantasma del censo -------------------------------------------
  console.log('\n-- el que dice latir y hace rato que no late --');
  censo['pato-fantasma'] = [anuncio('Fantasma', { edad: 0 })];
  comprobar('recién anunciado, sale', nombres(chat).includes('Fantasma'));

  avanzar(160000);   // más de la caducidad (150 s) sin refrescarse
  comprobar('pasada la caducidad, deja de salir',
    !nombres(chat).includes('Fantasma'), nombres(chat).join() || '(vacía)');

  // ---- 4. Al que no late hay que creerle ----------------------------------
  console.log('\n-- el pato de una versión anterior, que no late --');
  censo['pato-antiguo'] = [anuncio('Antiguo', { late: false, edad: 3600000 })];
  comprobar('lleva una hora sin refrescarse y AUN ASÍ sale',
    nombres(chat).includes('Antiguo'),
    'su fecha es la de entrada: echarlo sería esconder a un conectado');

  // ---- 5. Lo oído también caduca ------------------------------------------
  console.log('\n-- lo oído caduca solo --');
  // En la escena 3 se avanzaron 160 s, así que «Ausente» lleva eso sin hablar y
  // lo oído vale 90: ya debería haberse caído por su cuenta.
  comprobar('quien habló hace rato y no ha vuelto a hablar deja de salir',
    !nombres(chat).includes('Ausente'), nombres(chat).join() || '(vacía)');

  manejadores.broadcast.chat({
    payload: { from: 'Ausente', text: 'sigo aquí', ts: ahora, mid: 'm2', clave: 'pato-ausente' }
  });
  comprobar('y vuelve en cuanto habla otra vez', nombres(chat).includes('Ausente'));

  // ---- 6. El censo y lo oído no se pisan ----------------------------------
  console.log('\n-- el mismo pato por los dos caminos --');
  censo['pato-ausente'] = [anuncio('Ausente', { edad: 0, id: 'p-ausente' })];
  const veces = chat.presentes().filter((p) => p.nombre === 'Ausente').length;
  comprobar('quien está en el censo Y ha hablado sale una sola vez', veces === 1,
    `${veces} vez/veces`);

  // ---- Y a recoger --------------------------------------------------------
  Date.now = relojDeVerdad;
  global.setInterval = intervaloDeVerdad;
  global.clearInterval = quitarIntervaloDeVerdad;
  Object.defineProperty(process, 'platform', { value: plataformaDeVerdad });

  const bien = fallos === 0;
  console.log(`\n${bien ? 'Todo correcto' : `${fallos} comprobación(es) mal`}`);
  process.exit(bien ? 0 : 1);
})();
