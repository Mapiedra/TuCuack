// Arranque de la versión de escritorio: instala la plataforma de Electron y
// suelta al pato.

import { arrancarPato } from '../core/app.js';
import { crearPlataformaElectron } from './platform.js';

// ---- El ratón que entra por la otra puerta --------------------------------
//
// Donde el overlay no recibe nada mientras deja pasar los clics (Linux), quien
// oye al cursor es una ventanita puesta encima del pato: el timbre
// (`src/main/sensor.js`). Lo que oye llega aquí, y aquí se suelta en el
// documento como lo que es —un ratón que se mueve, pulsa y suelta— para que el
// pato lo reciba por donde lo recibe siempre.
//
// Está en la carcasa y no en el núcleo a propósito: el pato no tiene que saber
// que existe una puerta de atrás. Para él es el mismo `mousemove` de siempre,
// con su hit-test al píxel, su arrastre y su menú.
if (window.pato && window.pato.alSentirElPuntero) {
  window.pato.alSentirElPuntero((p) => {
    if (!p) return;
    const destino = document.elementFromPoint(p.x, p.y) || document;
    destino.dispatchEvent(new MouseEvent(p.tipo === 'mouseleave' ? 'mousemove' : p.tipo, {
      clientX: p.x,
      clientY: p.y,
      // Sin esto, un `mousemove` con el botón pulsado parece un botón soltado y
      // el pato daría el arrastre por terminado a mitad (ver `setupInteraction`).
      buttons: p.botones || 0,
      button: p.boton || 0,
      bubbles: true,
      cancelable: true,
      composed: true
    }));
  });
}

arrancarPato(crearPlataformaElectron())
  .catch((err) => console.error('[pato] error al arrancar', err));
