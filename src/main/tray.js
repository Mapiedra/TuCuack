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

  const send = (cmd) => {
    const win = getWin();
    if (win && !win.isDestroyed()) win.webContents.send('tray:command', cmd);
  };

  const rebuild = () => {
    const win = getWin();
    const visible = win && !win.isDestroyed() && win.isVisible();
    const menu = Menu.buildFromTemplate([
      {
        label: visible ? 'Ocultar pato' : 'Mostrar pato',
        click: () => {
          const w = getWin();
          if (!w || w.isDestroyed()) return;
          if (w.isVisible()) w.hide();
          else w.show();
          rebuild();
        }
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
