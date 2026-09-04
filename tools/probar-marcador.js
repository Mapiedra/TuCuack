'use strict';

// Comprueba que el marcador global está bien montado en Supabase.
//
//   node tools/probar-marcador.js
//
// Se conecta con la MISMA clave publicable que lleva la app, así que lo que
// verifica es exactamente lo que va a poder hacer un pato: ni más ni menos.
//
// Y no escribe nada. Eso no es prudencia, es una consecuencia del diseño: no hay
// forma de borrar una fila con esta clave —ni la propia—, así que una fila de
// pruebas se quedaría en el marcador de todo el mundo para siempre. Se comprueba
// la puerta de escritura llamándola con un secreto corto, que es un camino que
// tiene que devolver `secreto-corto` SIN tocar la tabla.

const config = require('../src/main/config.js');

let createClient;
try {
  ({ createClient } = require('@supabase/supabase-js'));
} catch {
  console.error('Falta @supabase/supabase-js. Ejecuta `npm install` primero.');
  process.exit(1);
}

if (!config.isConfigured()) {
  console.error('No hay credenciales de Supabase. Ver README y supabase.example.json.');
  process.exit(1);
}

// Node no trae `WebSocket` hasta la 22, y sin él supabase-js ni siquiera crea
// el cliente —aunque aquí no se use Realtime para nada—. Es el mismo tropiezo
// que ya resolvió `main/chat.js`, y se resuelve igual: con el del paquete `ws`.
let Transporte;
try {
  Transporte = require('ws');
} catch { /* con Node 22+ no hace falta */ }

const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: Transporte ? { transport: Transporte } : undefined
});

let fallos = 0;
const comprobar = (que, bien, extra = '') => {
  console.log(`${bien ? 'OK  ' : 'FALLO'} ${que}${extra ? '  ' + extra : ''}`);
  if (!bien) fallos++;
};

(async () => {
  console.log(`Proyecto: ${config.SUPABASE_URL}  (credenciales: ${config.SOURCE})\n`);

  // ---- Leer el marcador ---------------------------------------------------
  const marcador = await supabase
    .from('records_publicos')
    .select('juego, nombre, marca, mejor_es')
    .limit(5);
  comprobar('la vista `records_publicos` se puede leer', !marcador.error,
    marcador.error ? marcador.error.message : `${marcador.data.length} filas`);

  // ---- Y la tabla, sólo por las columnas que se dan -----------------------
  const columnas = await supabase.from('records').select('juego, marca').limit(1);
  comprobar('la tabla se lee por las columnas públicas', !columnas.error,
    columnas.error ? columnas.error.message : '');

  const secreto = await supabase.from('records').select('dueno').limit(1);
  comprobar('pero el `dueno` NO se puede leer', !!secreto.error,
    secreto.error ? secreto.error.message.slice(0, 60) : 'lo ha devuelto, y no debería');

  // ---- Escribir, sólo por la puerta --------------------------------------
  const directo = await supabase.from('records').insert({
    dueno: 'f'.repeat(64), juego: 'prueba', nombre: 'Sonda', marca: 1, mejor_es: 'mas'
  });
  comprobar('escribir en la tabla de frente está prohibido', !!directo.error,
    directo.error ? directo.error.message.slice(0, 60) : 'ha escrito, y NO debería');

  const borrar = await supabase.from('records').delete().eq('juego', 'prueba');
  comprobar('borrar también', !!borrar.error || borrar.count === 0,
    borrar.error ? borrar.error.message.slice(0, 60) : 'sin error, pero no borró nada');

  // La función existe y valida. Con un secreto corto contesta y no toca nada.
  const corto = await supabase.rpc('guardar_record', {
    p_secreto: 'corto',
    p_juego: 'prueba',
    p_nombre: 'Sonda',
    p_marca: 1,
    p_mejor_es: 'mas'
  });
  comprobar('`guardar_record` responde y rechaza un secreto corto',
    !corto.error && corto.data === 'secreto-corto',
    corto.error ? corto.error.message.slice(0, 80) : `devolvió ${JSON.stringify(corto.data)}`);

  const direccion = await supabase.rpc('guardar_record', {
    p_secreto: 'x'.repeat(32),
    p_juego: 'prueba',
    p_nombre: 'Sonda',
    p_marca: 1,
    p_mejor_es: 'lo-que-sea'
  });
  comprobar('y rechaza una dirección de marca inventada',
    !direccion.error && direccion.data === 'direccion-mala',
    direccion.error ? direccion.error.message.slice(0, 80) : `devolvió ${JSON.stringify(direccion.data)}`);

  console.log(fallos ? `\n${fallos} FALLOS` : '\ntodo correcto');
  process.exit(fallos ? 1 : 0);
})();
