'use strict';

// Levanta un pato de escritorio APARTE, con su propio perfil y nivel alto.
//
// Para qué: probar el multijugador hace falta ser dos, y el pato de verdad no
// vale —tiene tu nivel, tu nombre y tus stats, y sólo puede haber uno—. Esto
// prepara un perfil desechable y arranca Electron contra él.
//
// El truco está en `--user-data-dir`: el cerrojo de instancia única va asociado
// al directorio de datos, así que uno distinto convive con el pato normal sin
// pelearse, y además no le toca ni el estado ni los ajustes.
//
//   node tools/pato-de-pruebas.js                       (nombre y nivel por defecto)
//   node tools/pato-de-pruebas.js --nombre Rival --nivel 20
//   node tools/pato-de-pruebas.js --solo-preparar       (sin arrancar)
//
// No forma parte de la app: es una herramienta de desarrollo.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

// La misma curva que core/game/Level.js. Va copiada —tres líneas— porque este
// script es CommonJS y aquello es un módulo ESM del navegador; importarlo desde
// aquí obligaría a montar un puente para calcular una potencia.
const BASE = 100;
const EXP = 1.4;
function xpParaNivel(n) {
  return n <= 1 ? 0 : Math.round(BASE * Math.pow(n - 1, EXP));
}

function argumento(nombre, porDefecto) {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : porDefecto;
}

const nombre = argumento('nombre', 'Rival');
const nivel = Number(argumento('nivel', '20'));
// Un poco por encima del umbral, para que no se quede justo en la frontera.
const xp = xpParaNivel(nivel) + 50;

const perfil = argumento('perfil',
  path.join(os.tmpdir(), 'tucuack-pruebas', nombre.toLowerCase().replace(/[^a-z0-9]/g, '')));

fs.mkdirSync(perfil, { recursive: true });

// Mismo formato que src/main/store.js. Si algún día cambia allí, esto se queda
// corto y el pato de pruebas arrancará con lo que falte por defecto: es un
// perfil desechable, no hay nada que migrar.
const hoy = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(perfil, 'pet-state.json'), JSON.stringify({
  stats: { hunger: 95, energy: 95, hygiene: 95, happiness: 95 },
  level: { xp, racha: 1, ultimoDia: hoy, diaDelChat: '', chatHoy: 0, diaDelJuego: '', juegosHoy: 0 },
  minijuegos: {},
  x: 0.35,
  savedAt: Date.now()
}, null, 2));

fs.writeFileSync(path.join(perfil, 'settings.json'), JSON.stringify({
  displayName: nombre,
  autoLaunch: false,
  skin: 'capo',          // el último que se desbloquea, para que se note el nivel
  volumen: 0.5,
  silenciado: false,
  escala: 100,
  patoId: `p-prueba${Math.random().toString(36).slice(2, 8)}`
}, null, 2));

console.log(`[pruebas] perfil de "${nombre}" · nivel ${nivel} (${xp} XP)`);
console.log(`[pruebas] en ${perfil}`);

if (process.argv.includes('--solo-preparar')) process.exit(0);

if (!fs.existsSync(path.join(__dirname, '..', 'supabase.json'))) {
  console.warn('[pruebas] AVISO: sin supabase.json no hay chat, y sin chat no hay '
    + 'partidas en red. Ver docs/CONFIGURACION.md.');
}

const electron = require('electron');
spawn(electron, ['.', '--dev', `--user-data-dir=${perfil}`], {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
  detached: false
});
