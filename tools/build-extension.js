'use strict';

// Ensambla la extensión de Chrome en `dist/extension/`.
//
// Hace falta un paso de copia porque una extensión no puede salir de su carpeta
// raíz: desde `src/extension/` no se alcanzan ni `src/core/` ni `assets/`. Y el
// repo entero tampoco puede ser la raíz, porque Chrome rechaza la carga si
// encuentra ficheros o carpetas que empiecen por `_` (y `node_modules` está
// lleno de ellos).
//
//   node tools/build-extension.js            una vez
//   node tools/build-extension.js --watch    y se queda copiando lo que cambie
//
// En modo watch, cambiar código del pato y pulsar "recargar" en
// chrome://extensions basta: no hay compilación de por medio.

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const DESTINO = path.join(RAIZ, 'dist', 'extension');

// De dónde sale cada cosa y dónde acaba dentro de la extensión.
const COPIAS = [
  { desde: 'src/extension', hasta: '.', excluir: ['manifest.json'] },
  { desde: 'src/core', hasta: 'core' },
  { desde: 'assets/sprites', hasta: 'assets/sprites', soloExt: ['.png', '.json'] },
  { desde: 'assets/icons', hasta: 'assets/icons', soloExt: ['.png'] }
];

function copiarArbol(desde, hasta, opciones = {}) {
  const { excluir = [], soloExt = null } = opciones;
  if (!fs.existsSync(desde)) return 0;

  let copiados = 0;
  for (const entrada of fs.readdirSync(desde, { withFileTypes: true })) {
    if (excluir.includes(entrada.name)) continue;
    const origen = path.join(desde, entrada.name);
    const objetivo = path.join(hasta, entrada.name);

    if (entrada.isDirectory()) {
      copiados += copiarArbol(origen, objetivo, opciones);
    } else {
      if (soloExt && !soloExt.includes(path.extname(entrada.name))) continue;
      fs.mkdirSync(path.dirname(objetivo), { recursive: true });
      fs.copyFileSync(origen, objetivo);
      copiados++;
    }
  }
  return copiados;
}

// La versión vive en package.json; el manifest la recibe al ensamblar para que
// no haya dos sitios que puedan discrepar.
function escribirManifest() {
  const pkg = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8'));
  const manifest = JSON.parse(
    fs.readFileSync(path.join(RAIZ, 'src', 'extension', 'manifest.json'), 'utf8')
  );
  manifest.version = pkg.version;
  fs.mkdirSync(DESTINO, { recursive: true });
  fs.writeFileSync(
    path.join(DESTINO, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n'
  );
  return manifest.version;
}

// supabase-js empaquetado: Manifest V3 no deja cargar código de fuera de la
// extensión, así que el bundle viaja dentro. Se coge el UMD que ya publica el
// propio paquete —es autocontenido— en vez de montar un empaquetador.
function copiarSupabase() {
  const origen = path.join(
    RAIZ, 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js'
  );
  if (!fs.existsSync(origen)) {
    console.error(
      '[extension] falta el bundle de supabase-js. Ejecuta `npm install`.\n' +
      `           esperado en ${path.relative(RAIZ, origen)}`
    );
    process.exitCode = 1;
    return false;
  }
  const destino = path.join(DESTINO, 'vendor', 'supabase.js');
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.copyFileSync(origen, destino);
  return true;
}

// Las credenciales del chat no se versionan (ver docs/CONFIGURACION.md). Si hay
// un supabase.json en la raíz, viaja con la extensión; si no, el pato funciona
// igual pero mudo.
function copiarCredenciales() {
  const origen = path.join(RAIZ, 'supabase.json');
  if (!fs.existsSync(origen)) return false;
  fs.copyFileSync(origen, path.join(DESTINO, 'supabase.json'));
  return true;
}

function construir() {
  // Se vacía antes de copiar: si no, un fichero que desaparece del proyecto se
  // queda para siempre en la extensión ensamblada, y el zip acabaría llevando
  // restos de versiones anteriores.
  fs.rmSync(DESTINO, { recursive: true, force: true });

  let total = 0;
  for (const { desde, hasta, ...opciones } of COPIAS) {
    total += copiarArbol(path.join(RAIZ, desde), path.join(DESTINO, hasta), opciones);
  }
  const version = escribirManifest();
  copiarSupabase();
  const conChat = copiarCredenciales();
  console.log(
    `[extension] v${version} · ${total} ficheros → dist/extension` +
    (conChat ? '' : ' · sin supabase.json: el chat quedará desactivado')
  );
}

function vigilar() {
  const dirs = ['src/extension', 'src/core', 'assets/sprites'];
  let pendiente = null;
  for (const d of dirs) {
    fs.watch(path.join(RAIZ, d), { recursive: true }, () => {
      // Un guardado puede disparar varios eventos: se agrupan.
      clearTimeout(pendiente);
      pendiente = setTimeout(construir, 120);
    });
  }
  console.log('[extension] vigilando cambios. Recarga la extensión en chrome://extensions para verlos.');
}

construir();
if (process.argv.includes('--watch')) vigilar();
