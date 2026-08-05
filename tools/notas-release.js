#!/usr/bin/env node
// Extrae de CHANGELOG.md la sección de una versión y la escribe por la salida
// estándar, para usarla como cuerpo del GitHub Release.
//
//   node tools/notas-release.js 0.3.2 > notas.md
//
// Sin argumento coge la versión de package.json. Si no encuentra la sección
// escribe un texto de recambio en vez de fallar: una nota de release pobre no
// debe tumbar la publicación.

const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const version = (process.argv[2] || require(path.join(raiz, 'package.json')).version).replace(/^v/, '');

const changelog = fs.readFileSync(path.join(raiz, 'CHANGELOG.md'), 'utf8');

// La sección va desde su cabecera hasta la siguiente "## [" o hasta las
// definiciones de enlace del final.
const lineas = changelog.split(/\r?\n/);
const inicio = lineas.findIndex((l) => l.startsWith(`## [${version}]`));

let cuerpo = '';
if (inicio !== -1) {
  const resto = lineas.slice(inicio + 1);
  const fin = resto.findIndex((l) => l.startsWith('## ['));
  cuerpo = (fin === -1 ? resto : resto.slice(0, fin)).join('\n').trim();
}

if (!cuerpo) {
  cuerpo = `Versión ${version}. Ver [CHANGELOG.md](https://github.com/Mapiedra/TuCuack/blob/main/CHANGELOG.md).`;
}

// Lo que publica de verdad el workflow de release, y nada más: anunciar una
// descarga que no está deja al Release prometiendo ficheros inexistentes.
const descargas = [
  '',
  '',
  '## Descargas',
  '',
  `- **Windows**: \`TuCuack-Setup-${version}.exe\``,
  `- **Cualquier sistema**: \`TuCuack-extension-${version}.zip\` (extensión de Chrome)`,
  '',
  'Si ya tienes la app instalada no hace falta descargar nada: se actualiza sola.',
  'La extensión se actualiza descomprimiendo el zip encima de la carpeta anterior.',
].join('\n');

process.stdout.write(cuerpo + descargas + '\n');
