'use strict';

// El histórico del chat en el escritorio: `historial.json` en la carpeta de
// datos del usuario.
//
// Fichero propio y no un campo más de `pet-state.json` por dos motivos. Uno de
// tamaño: con el tope puesto son unos cientos de kilobytes, y el estado del
// Tamagotchi se reescribe entero cada pocos segundos. Y otro de listas: el
// estado va por lista blanca en tres sitios (ver store.js), y meter aquí una
// lista que crece sin parar es pedir que un día se pierda en silencio.
//
// El que escribe es siempre el pato, que es el único despierto: a diferencia de
// la extensión, aquí no hay service worker que apunte por su cuenta. Por eso
// `anotar` no comprueba si el mensaje estaba ya — quien llama lleva la cuenta
// (ver core/chat/historial.js) y no repite.

const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const FICHERO = 'historial.json';
/** El mismo tope que el del pato (core/chat/historial.js). */
const TOPE = 2000;
/**
 * Lo que se espera antes de escribir. Una conversación llega a ráfagas y el
 * fichero entero se reescribe cada vez: sin esta espera, tres mensajes seguidos
 * son tres volcados de varios cientos de kilobytes.
 */
const ESPERA_GUARDADO = 800;

/** @type {{mensajes:object[], leidoHasta:number} | null} */
let datos = null;
let temporizador = null;

function ruta() {
  return path.join(app.getPath('userData'), FICHERO);
}

function leer() {
  if (datos) return datos;
  try {
    const crudo = JSON.parse(fs.readFileSync(ruta(), 'utf8'));
    datos = {
      mensajes: Array.isArray(crudo.mensajes) ? crudo.mensajes.slice(-TOPE) : [],
      leidoHasta: Number(crudo.leidoHasta) || 0
    };
  } catch {
    // No haberlo es lo normal la primera vez.
    datos = { mensajes: [], leidoHasta: 0 };
  }
  return datos;
}

function programarGuardado() {
  if (temporizador) return;
  temporizador = setTimeout(guardarYa, ESPERA_GUARDADO);
}

function guardarYa() {
  if (temporizador) {
    clearTimeout(temporizador);
    temporizador = null;
  }
  if (!datos) return;
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.writeFileSync(ruta(), JSON.stringify(datos), 'utf8');
  } catch (err) {
    // Un histórico que no se puede guardar no puede tumbar al pato.
    console.error('[historial] no se pudo guardar:', err);
  }
}

module.exports = {
  /** Lo guardado, tal cual lo espera el pato. */
  cargar() {
    return leer();
  },

  anotar(mensaje) {
    if (!mensaje) return;
    const d = leer();
    d.mensajes.push(mensaje);
    if (d.mensajes.length > TOPE) d.mensajes = d.mensajes.slice(-TOPE);
    programarGuardado();
  },

  marcarLeido(ts) {
    const n = Number(ts);
    if (!Number.isFinite(n) || n <= 0) return;
    const d = leer();
    if (n <= d.leidoHasta) return;
    d.leidoHasta = n;
    programarGuardado();
  },

  /** Vuelca lo pendiente. Se llama al salir, que es cuando no hay más ocasiones. */
  guardarYa
};
