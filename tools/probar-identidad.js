'use strict';

// Comprueba el código con el que un pato se lleva su identidad.
//
//   npm run identidad:check
//
// ---- Por qué existe este fichero -------------------------------------------
//
// Este código es lo único que hay entre alguien y perder sus récords, su
// historial, sus privados y su monedero. Y tiene una propiedad incómoda: **el
// fallo no se ve**. Un código con un carácter cambiado es un secreto
// perfectamente válido de una persona que no existe, así que sin comprobación el
// pato se estrenaría a cero, sin dar ningún error, y quien lo hiciera pensaría
// que lo ha perdido todo.
//
// Así que lo que se prueba aquí no es tanto que funcione —eso se ve a la
// primera— como que **falle cuando tiene que fallar**.

const { codigoDe, leerCodigo, PREFIJO } = require('../src/main/identidad.js');

let fallos = 0;
const comprobar = (que, bien, extra) => {
  console.log(`${bien ? 'OK  ' : 'FALLO'} ${que}${extra ? '  ·  ' + extra : ''}`);
  if (!bien) fallos++;
};

/** Uno como los que genera `store.js`: 32 caracteres de dos tiradas. */
function secretoComoLosDeVerdad() {
  const trozo = () => Math.random().toString(36).slice(2).padEnd(16, '0').slice(0, 16);
  return `${trozo()}${trozo()}`;
}

const secreto = secretoComoLosDeVerdad();
const codigo = codigoDe(secreto);

// ---- Ida y vuelta ---------------------------------------------------------

console.log('-- el camino de siempre --');
console.log(`     ${codigo}`);

comprobar('el código lleva el prefijo por delante', codigo.startsWith(`${PREFIJO}-`));
comprobar('y va partido en grupos, que hay quien lo copia a mano',
  codigo.split('-').length >= 6, `${codigo.split('-').length} trozos`);
comprobar('no se enseña el secreto tal cual, sino con su comprobación detrás',
  codigo.toLowerCase().replace(/-/g, '').length > secreto.length + 3);

const vuelta = leerCodigo(codigo);
comprobar('y vuelve a salir el mismo secreto',
  vuelta.ok === true && vuelta.secreto === secreto);

// ---- Lo que hay que perdonar ----------------------------------------------

console.log('\n-- lo que se le perdona a quien lo copia --');

const formas = [
  ['en minúsculas', codigo.toLowerCase()],
  ['sin guiones', codigo.replace(/-/g, '')],
  ['con espacios en vez de guiones', codigo.replace(/-/g, ' ')],
  ['con espacios de sobra delante y detrás', `   ${codigo}   `],
  ['partido en dos líneas', codigo.replace('-', '-\n')],
  ['sin el prefijo', codigo.slice(PREFIJO.length + 1)],
  ['todo junto y en minúsculas', codigo.toLowerCase().replace(/-/g, '')]
];
for (const [como, texto] of formas) {
  const r = leerCodigo(texto);
  comprobar(`${como}`, r.ok === true && r.secreto === secreto,
    r.ok ? '' : r.error);
}

// ---- Lo que NO se le puede perdonar ---------------------------------------
//
// Ésta es la parte que importa. Cada uno de estos casos, aceptado, sería alguien
// estrenándose a cero y creyendo que ha perdido lo suyo.

console.log('\n-- lo que tiene que rechazar --');

/** Cambia un carácter por otro distinto del mismo alfabeto. */
function cambiarUno(txt, i) {
  const alfabeto = '0123456789abcdefghijklmnopqrstuvwxyz';
  const antes = txt[i].toLowerCase();
  const otro = alfabeto[(alfabeto.indexOf(antes) + 1) % alfabeto.length];
  return txt.slice(0, i) + otro + txt.slice(i + 1);
}

const pelado = codigo.slice(PREFIJO.length + 1).replace(/-/g, '');

// Un carácter cambiado, en TODAS las posiciones. Si alguna se colara, sería la
// que le toque a alguien el día que lo copie mal.
let colados = 0;
for (let i = 0; i < pelado.length; i++) {
  const r = leerCodigo(cambiarUno(pelado, i));
  if (r.ok) colados++;
}
comprobar('un carácter cambiado se rechaza, esté donde esté',
  colados === 0, `${pelado.length} posiciones probadas, ${colados} coladas`);

// Dos caracteres del medio intercambiados: el otro error clásico al copiar.
let bailes = 0;
let probados = 0;
for (let i = 0; i < pelado.length - 1; i++) {
  if (pelado[i] === pelado[i + 1]) continue;   // intercambiar iguales no cambia nada
  probados++;
  const texto = pelado.slice(0, i) + pelado[i + 1] + pelado[i] + pelado.slice(i + 2);
  if (leerCodigo(texto).ok) bailes++;
}
comprobar('dos caracteres bailados también',
  bailes === 0, `${probados} parejas probadas, ${bailes} coladas`);

const malos = [
  ['vacío', ''],
  ['sólo el prefijo', PREFIJO],
  ['un trozo suelto', codigo.slice(0, 20)],
  ['pegado dos veces', codigo + codigo],
  ['un texto cualquiera', 'esto no es un código de nada'],
  ['el secreto sin su comprobación', secreto],
  ['la comprobación de otro secreto',
    (secreto + codigoDe(secretoComoLosDeVerdad()).slice(-4)).toLowerCase()]
];
for (const [como, texto] of malos) {
  const r = leerCodigo(texto);
  comprobar(`${como}`, r.ok === false, r.ok ? '¡LO HA ACEPTADO!' : r.error);
}

// ---- Que no haya dos códigos iguales ---------------------------------------

console.log('\n-- y que cada pato tenga el suyo --');
const vistos = new Set();
let repetidos = 0;
for (let i = 0; i < 5000; i++) {
  const c = codigoDe(secretoComoLosDeVerdad());
  if (vistos.has(c)) repetidos++;
  vistos.add(c);
}
comprobar('cinco mil códigos y ninguno repetido', repetidos === 0,
  `${vistos.size} distintos`);

console.log(`\n${fallos === 0 ? 'Todo correcto' : `${fallos} comprobación(es) mal`}`);
process.exit(fallos === 0 ? 0 : 1);
