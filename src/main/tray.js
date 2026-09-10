'use strict';

const { Tray, Menu, nativeImage, app } = require('electron');
const path = require('path');
const fs = require('fs');

// Icono de bandeja. Usa el .png de assets si existe; si no, un icono vacío
// (Electron muestra un hueco, suficiente para desarrollo).
function trayImage() {
  const p = path.join(__dirname, '..', '..', 'assets', 'icons', 'tray.png');
  if (fs.existsSync(p)) return nativeImage.createFromPath(p);
  return nativeImage.createEmpty();
}

/**
 * @param {() => import('electron').BrowserWindow | null} getWin
 */
function createTray(getWin, opts = {}) {
  const tray = new Tray(trayImage());
  tray.setToolTip('TuCuack');

  // Estado del modo concentración, tal como lo manda `focus:tick`. Vive aquí
  // (y no se pregunta al pato cada vez) porque el tooltip se actualiza una vez
  // por segundo y reconstruir el menú con esa frecuencia parpadearía sin
  // necesidad: el menú sólo se rehace cuando `activo` cambia de verdad.
  let foco = { activo: false };

  const send = (cmd) => {
    const win = getWin();
    if (win && !win.isDestroyed()) win.webContents.send('tray:command', cmd);
  };

  const etiquetaFase = { focusing: 'Concentración', shortBreak: 'Descanso', longBreak: 'Descanso largo' };

  const rebuild = () => {
    const win = getWin();
    const visible = win && !win.isDestroyed() && win.isVisible();
    const menu = Menu.buildFromTemplate([
      {
        label: visible ? 'Ocultar mascota' : 'Mostrar mascota',
        click: () => {
          const w = getWin();
          if (!w || w.isDestroyed()) return;
          if (w.isVisible()) w.hide();
          else w.show();
          rebuild();
        }
      },
      {
        label: foco.activo ? '⏹️ Cancelar concentración' : '🍅 Iniciar concentración',
        click: () => send(foco.activo ? 'focus:cancel' : 'focus:start')
      },
      { type: 'separator' },
      { label: 'Alimentar', click: () => send('feed') },
      { label: 'Jugar', click: () => send('play') },
      { label: 'Limpiar', click: () => send('clean') },
      { label: 'Dormir / Despertar', click: () => send('sleep') },
      { label: 'Conectados', click: () => send('online') },
      { label: 'Estadísticas', click: () => send('stats') },
      { label: 'Ajustes…', click: () => send('settings') },
      { type: 'separator' },
      { label: 'Salir', click: () => app.quit() }
    ]);
    tray.setContextMenu(menu);
  };

  rebuild();

  /**
   * Refresca el tooltip con la cuenta atrás y, si `activo` cambia de estado,
   * también el menú. Sólo se toca lo justo: `main.js` llama a esto una vez por
   * segundo desde `focus:tick`.
   */
  tray.actualizarFoco = (estado) => {
    const activo = !!(estado && estado.activo);
    const cambioDeEstado = activo !== foco.activo;
    foco = estado || { activo: false };
    if (activo) {
      const mm = String(Math.floor(foco.remainingMs / 60000)).padStart(2, '0');
      const ss = String(Math.floor((foco.remainingMs / 1000) % 60)).padStart(2, '0');
      tray.setToolTip(`TuCuack — ${etiquetaFase[foco.fase] || 'Concentración'} ${mm}:${ss}`);
    } else {
      tray.setToolTip('TuCuack');
    }
    if (cambioDeEstado) rebuild();
  };

  // El pato puede esconderse por su cuenta, desde su propio menú. Sin esto, la
  // bandeja seguiría ofreciendo "Ocultar mascota" con el pato ya escondido.
  const ventana = getWin();
  if (ventana && !ventana.isDestroyed()) {
    ventana.on('hide', rebuild);
    ventana.on('show', rebuild);
  }

  tray.on('double-click', () => {
    const w = getWin();
    if (w && !w.isDestroyed()) {
      if (w.isVisible()) w.hide();
      else w.show();
      rebuild();
    }
  });

  return tray;
}

module.exports = { createTray };
