'use strict';

// El código con el que un pato se lleva su identidad a otra máquina.
//
// Lectura previa: `supabase/records.sql`. Ahí está por qué el dueño de una fila
// es `sha256(secreto)` y por qué ese secreto no sale del disco de nadie.
//
// ---- Qué problema resuelve -------------------------------------------------
//
// El secreto se genera solo la primera vez y se guarda en los ajustes. Eso
// compra algo importante —no hay que registrarse para jugar— al precio de que
// **perder los ajustes es perderlo todo**: los récords del marcador, el
// historial de partidas, los privados y el monedero, que van los cuatro con esa
// misma firma. No hay a quién reclamar, porque no hay cuenta, ni correo, ni
// servidor que sepa quién eres.
//
// Mientras los cuacks sólo compraran minijuegos, eso era una pega asumible. Con
// premios o dinero de por medio deja de serlo: alguien paga, cambia de
// ordenador y se queda sin lo que compró, y no hay forma de devolvérselo ni de
// comprobar que era él.
//
// Esto es el término medio: **no hay registro, pero sí hay copia**. El pato
// enseña un código, tú lo guardas donde quieras, y con él vuelves a ser el mismo
// en otra máquina.
//
// ---- Y la consecuencia, que hay que decir en voz alta -----------------------
//
// **Quien tenga tu código, es tú.** No hay contraseña detrás, ni segundo factor,
// ni forma de invalidarlo. Es exactamente la misma propiedad que ya tenía el
// secreto —quien pudiera leer tus ajustes ya podía hacerse pasar por ti—, sólo
// que ahora cabe en un papel. La interfaz tiene que decirlo donde se enseña, no
// aquí.
//
// ---- Por qué lleva una suma de comprobación --------------------------------
//
// Porque el fallo de teclear mal un carácter es **silencioso y definitivo**: sin
// comprobación, un código con una letra cambiada es un secreto perfectamente
// válido... de nadie. El pato se estrenaría como alguien nuevo, con el monedero
// a cero y sin récords, y no habría ningún error que mirar. Con la suma, un
// código mal copiado se rechaza en el acto y el pato se queda como estaba.

const crypto = require('crypto');

/** Lo que se le pone delante para que se reconozca de un vistazo. */
const PREFIJO = 'PATO';
/** De cuánto son los grupos con los que se parte, para poder leerlo. */
const GRUPO = 6;
/** Cuántos caracteres de la huella se llevan como comprobación. */
const COMPROBACION = 4;

/**
 * La huella del secreto, de la que salen los caracteres de comprobación.
 *
 * Es el mismo `sha256` que ya identifica al dueño en las tablas, y por eso no
 * añade nada que no estuviera: de los cuatro caracteres que se publican en el
 * código no se saca el secreto, y el secreto ya viaja entero al lado.
 */
function comprobacionDe(secreto) {
  return crypto.createHash('sha256').update(secreto).digest('hex').slice(0, COMPROBACION);
}

/**
 * El código que se le enseña a la persona.
 *
 * En mayúsculas y por grupos porque hay quien lo va a copiar a mano de una
 * pantalla a otra. Se admite en cualquier forma al volver (ver `leerCodigo`).
 *
 * @param {string} secreto  el de los ajustes
 * @returns {string} vacío si no hay secreto que enseñar
 */
function codigoDe(secreto) {
  const s = String(secreto || '');
  if (!s) return '';
  const cuerpo = (s + comprobacionDe(s)).toUpperCase();
  const trozos = [];
  for (let i = 0; i < cuerpo.length; i += GRUPO) trozos.push(cuerpo.slice(i, i + GRUPO));
  return [PREFIJO, ...trozos].join('-');
}

/**
 * Saca el secreto de un código escrito por una persona.
 *
 * Perdona todo lo que se puede perdonar sin arriesgar nada: mayúsculas, espacios
 * de más, guiones puestos donde sea o no puestos, y el prefijo delante o
 * ausente. Lo que NO perdona es un carácter cambiado, que es justo el fallo que
 * no se puede dejar pasar.
 *
 * @param {string} codigo
 * @returns {{ok:true, secreto:string} | {ok:false, error:string}}
 */
function leerCodigo(codigo) {
  // Se queda sólo con lo que puede formar parte del código: así da igual cómo
  // lo hayan separado, y da igual que venga pegado de un correo con saltos.
  let limpio = String(codigo || '').replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
  if (limpio.startsWith(PREFIJO.toLowerCase())) limpio = limpio.slice(PREFIJO.length);

  if (!limpio) return { ok: false, error: 'vacio' };

  // El secreto es todo menos los últimos caracteres, que son la comprobación.
  // Se acepta cualquier longitud que deje un secreto válido, porque los secretos
  // de instalaciones viejas no tienen por qué medir lo mismo que los de hoy.
  if (limpio.length < 24 + COMPROBACION) return { ok: false, error: 'corto' };
  if (limpio.length > 64 + COMPROBACION) return { ok: false, error: 'largo' };

  const secreto = limpio.slice(0, limpio.length - COMPROBACION);
  const suma = limpio.slice(-COMPROBACION);
  if (comprobacionDe(secreto) !== suma) return { ok: false, error: 'no-cuadra' };

  return { ok: true, secreto };
}

/** Lo que se le dice a la persona de cada forma de estar mal. */
const MOTIVOS = {
  vacio: 'Pega aquí el código de tu otra mascota.',
  corto: 'Ese código se ha quedado corto: parece que falta un trozo.',
  largo: 'Ese código es más largo de lo que debería. ¿Se ha pegado dos veces?',
  'no-cuadra': 'Ese código no cuadra. Repásalo: basta un carácter cambiado.'
};

function explicar(error) {
  return MOTIVOS[error] || 'Ese código no vale.';
}

module.exports = { codigoDe, leerCodigo, explicar, PREFIJO };
