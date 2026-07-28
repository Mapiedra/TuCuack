'use strict';

// Auto-update vía electron-updater + GitHub Releases.
// Se activa solo en producción (no en `--dev`).
let autoUpdater = null;
try {
  ({ autoUpdater } = require('electron-updater'));
} catch {
  autoUpdater = null;
}

/**
 * @param {() => import('electron').BrowserWindow | null} getWin
 */
function initUpdater(getWin) {
  if (!autoUpdater) return;

  const notify = (evt) => {
    const win = getWin();
    if (win && !win.isDestroyed()) win.webContents.send('update:event', evt);
  };

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => notify({ type: 'checking' }));
  autoUpdater.on('update-available', (info) =>
    notify({ type: 'available', version: info && info.version })
  );
  autoUpdater.on('update-not-available', () => notify({ type: 'none' }));
  autoUpdater.on('download-progress', (p) =>
    notify({ type: 'progress', percent: Math.round(p.percent) })
  );
  autoUpdater.on('update-downloaded', (info) =>
    notify({ type: 'ready', version: info && info.version })
  );
  autoUpdater.on('error', (err) =>
    notify({ type: 'error', message: String(err && err.message ? err.message : err) })
  );

  // Comprobar al arrancar y notificar. Descarga en segundo plano; instala al salir.
  autoUpdater.checkForUpdatesAndNotify().catch(() => {});
}

module.exports = { initUpdater };
