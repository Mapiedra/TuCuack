'use strict';

// Utilidad de desarrollo: captura fotogramas de la ventana para revisar las
// animaciones sin tener que mirar la pantalla. Se activa con `--capture`.
// No forma parte de la app en producción.

const fs = require('fs');

/**
 * Modo sonda: ejecuta una expresión en el renderer y muestra su resultado (si
 * devuelve una promesa, espera a que resuelva). Sirve para medir la física sin
 * depender de capturas de pantalla, que son lentas y de intervalo irregular.
 *   npx electron . --dev --probe "new Promise(r => ...)"
 */
async function probe(win, app) {
  const idx = process.argv.indexOf('--probe');
  const script = process.argv[idx + 1];
  try {
    const result = await win.webContents.executeJavaScript(script);
    console.log('PROBE_RESULT ' + JSON.stringify(result));
  } catch (e) {
    console.error('PROBE_ERROR', e && e.message ? e.message : e);
  }
  app.quit();
}

function run(win, app, path) {
  if (process.argv.includes('--probe')) {
    setTimeout(() => probe(win, app), 2000);
    return;
  }
  const dir = path.join(__dirname, '..', '..', 'scratch_caps');
  fs.mkdirSync(dir, { recursive: true });
  // Acción opcional a ejecutar en el renderer antes de capturar, p. ej.
  //   --capture --script "__pato.dropFrom(700)"
  const idx = process.argv.indexOf('--script');
  const script = idx >= 0 ? process.argv[idx + 1] : null;
  const every = Number(process.env.CAP_EVERY || 260);
  const total = Number(process.env.CAP_N || 12);

  let n = 0;
  const shoot = async () => {
    try {
      const img = await win.capturePage();
      fs.writeFileSync(path.join(dir, `cap_${String(n).padStart(2, '0')}.png`), img.toPNG());
    } catch (e) {
      console.error('capture error', e);
    }
    if (++n < total) setTimeout(shoot, every);
    else app.quit();
  };

  setTimeout(async () => {
    if (script) {
      try {
        await win.webContents.executeJavaScript(script);
      } catch (e) {
        console.error('script error', e);
      }
    }
    shoot();
  }, 2500);
}

module.exports = { run };
