# Minijuegos

El pato tiene juegos. Se desbloquean por nivel, igual que los diseños, y se
abren desde `🎮 Juegos` en el menú del pato.

| Juego | Nivel | Modos | Superficie |
|---|---|---|---|
| ✌️ Piedra, papel o tijera | 1 | solo · red (2) | panel |
| 🔊 «Pato dice» | 2 | solo | panel |
| 🃏 Memoria | 4 | solo · red (2) | panel |
| 🎲 Par o impar | 3 | solo · red (2) | panel |
| ⭕ Tres en raya | 6 | solo · red (2) | panel |
| 🌵 «Pato Runner» | 8 | solo | escenario |
| 🎯 «Pato Hook» | 9 | solo | escenario |
| 🏓 «Pato Jumping» | 12 | solo | escenario |
| 🪶 «Flappy Pato» | 14 | solo | escenario |
| 🕳️ The Hole | 16 | solo | escenario |

La lista va de menos a más, y el nivel acompaña: primero los de decidir en un
segundo, después los de pensar, y al final los que piden pulso. Los huecos están
reservados para [los que faltan](#los-que-faltan) — ver [la
escalera](#la-escalera).

Se puede jugar **solo**, contra el pato, o **por turnos contra otro pato
conectado**, retándole desde el propio panel.

---

## Añadir uno nuevo

Tres pasos, y ninguno toca `app.js`:

1. Escribe `src/core/game/minijuegos/<id>.js` exportando `crearPartida(ctx)`.
2. Añade su entrada al array `MINIJUEGOS` de
   [`src/core/game/minijuegos/index.js`](../src/core/game/minijuegos/index.js).
3. Ya está. El panel de selección, el candado por nivel, **la tienda**, la
   experiencia, el progreso guardado y el aviso al subir de nivel salen todos de
   esa lista.

El `precio` sale de `precioSugerido(nivel)` en
[`cuacks.js`](../src/core/game/cuacks.js) —ver [Los cuacks](#los-cuacks)—. El
nivel ABRE el juego; el precio lo COMPRA. Lo llevan todos menos el de nivel 1.

```js
{
  id: 'ahorcado',              // no se renombra NUNCA: da nombre al fichero
  nombre: 'Ahorcado',          //   y al progreso guardado
  icono: '🔤',                 // un emoji: nada de arte que empaquetar
  descripcion: 'Uno piensa la palabra y los demás la adivinan.',
  nivel: 4,                    // a qué nivel se desbloquea
  precio: 175,                 // y lo que cuesta comprarlo, en cuacks
  modos: ['turnos'],           // 'solo' | 'turnos'
  jugadores: { min: 2, max: 4 },
  superficie: 'panel',         // 'panel' | 'escenario'
  marca: null,                 // o {etiqueta:'aciertos', mejor:'mas'}
  cargar: () => import('./ahorcado.js')
}
```

El módulo se trae con `import()` **cuando alguien va a jugar**, no al arrancar el
pato.

### El nombre puede llevar dentro el de la mascota

Si en `nombre` pones `{mascota}`, se cambia por el nombre que haya en Ajustes:
`'{mascota} dice'` sale como **«Pato dice»** o **«Cuacky dice»**. Lo hace
`nombreDeJuego(juego, mascota)`, y por ahí pasan los tres sitios donde se ve un
título —la tarjeta, la cabecera del panel y el aviso de subir de nivel—, así que
un juego no tiene que hacer nada.

Se recorta a 14 caracteres: en Ajustes caben 24, y «Cuackenstein el Grande dice»
no entra en una tarjeta. Y en el aviso de nivel se escapa, porque ahí el nombre
va por `innerHTML` y lo escribe el usuario.

---

## El contrato

Un juego exporta **una sola cosa**:

```js
export function crearPartida(ctx) {
  // ...
  return { el, destroy };
}
```

- `el` es el tablero. El marco lo monta dentro del panel. En un juego de
  escenario aquí va sólo el marcador, o `null`.
- `destroy()` suelta lo que el juego haya cogido por su cuenta.
- Un juego de **escenario** devuelve además `actualizar(dt, pista)`: un
  fotograma, con el lienzo ya limpio.

**No guardes estado a nivel de módulo.** `crearPartida` se vuelve a llamar en
cada "¿Otra?", y una variable del módulo se filtraría de una partida a la
siguiente.

### Lo que trae `ctx`

| Campo | Qué es |
|---|---|
| `modo` | `'solo'` o `'turnos'` |
| `nivel` | nivel del pato, por si el juego se ajusta |
| `yo` | nombre de este pato |
| `jugadores` | nombres en orden de turno, incluido `yo` |
| `anfitrion` | quién decide lo que se decide una sola vez |
| `semilla` | aleatoriedad compartida: los dos lados barajan igual |
| `marcas` | progreso guardado de este juego (sólo lectura) |
| `sprites` | medidas y filas de cada hoja de diseño (ver abajo) |
| `sala` | `null` en `'solo'`; en red, `{enviar, alRecibir, alIrseUnJugador}` |
| `escenario` | `null` salvo superficie `'escenario'` |
| `sonido` | `nota`, `victoria`, `derrota`, `turno`, `cuack`… |
| `pato.animar(estado, dur)` | gestos del pato durante la partida |
| `decir(texto)` | un cartelito |
| `alTerminar(resultado)` | **una** vez por partida |
| `cadaFrame`, `cadaCierto`, `escuchar`, `alDestruir` | ciclo de vida |

Y el resultado:

```js
ctx.alTerminar({ resultado: 'victoria', puntos: 14, detalle: '4 seguidas' });
```

`resultado` es `'victoria'`, `'derrota'` o `'empate'`. **No hay `'abandono'`**:
cerrar el panel no es un resultado. Si lo fuera, abrir y cerrar sería una fuente
de partidas y, en la extensión, mudarse de pestaña anotaría una derrota fantasma
cada vez.

### Dibujar mascotas

`ctx.sprites` es `{ <skinId>: {frameW, frameH, animations: {<nombre>: {row, frames}}} }`
—lo mismo que usa el pato para animarse—, y con `rutaSheet`/`cargarSheet` de
[`skins.js`](../src/core/game/skins.js) y [`assets.js`](../src/core/assets.js) se
recorta cualquier pose de cualquier diseño.

**La imagen se pide con `cargarSheet`, no se pone de fondo con CSS.** Sobre una
página con CSP estricto un `background-image` se lo come el `img-src` de esa
página y el dibujo sale en blanco; `cargarSheet` pasa por el cargador que instale
la carcasa, que en la extensión lo baja con `fetch` bajo el CSP de la extensión.
Y como es asíncrono, conviene tener debajo algo que valga mientras llega —en la
memoria, un emoji por pose— para que el juego no dependa de que llegue.

---

## Tres reglas duras

Las tres vienen de que el pato también vive **sobre páginas web ajenas**, dentro
de un Shadow DOM, y se muda de pestaña cada pocos segundos.

1. **Nunca escuches en `document` ni en `window`.** Robarle las teclas a quien
   está leyendo una web es inaceptable. El teclado se engancha al propio `el`,
   con `tabindex="-1"` y `focus()`.
2. **Nunca llames a `requestAnimationFrame`, `setInterval` ni
   `addEventListener` por tu cuenta.** Usa `ctx.cadaFrame`, `ctx.cadaCierto` y
   `ctx.escuchar`: se apagan solos. Un bucle suelto sigue dando vueltas sobre un
   documento muerto.
3. **Nunca `innerHTML` con datos de otro.** `textContent` siempre: los nombres
   de los rivales los escribe otra persona.

Y una medida: el tablero no debería pasar de **280 × 300 px**. Por encima, el
panel se coloca debajo del pato y entra en scroll.

---

## Juegos de escenario

Un juego de superficie `'escenario'` no vive en un panel: toma prestado el pato,
el suelo y la pantalla entera. Hay tres —[Malabares](../src/core/game/minijuegos/paleta.js),
[«Pato Hook»](../src/core/game/minijuegos/punteria.js) y [The
Hole](../src/core/game/minijuegos/agujero.js)— y Malabares sirve de ejemplo de
todo lo que sigue.

Recibe una `pista` en `ctx.escenario`:

```js
export function crearPartida(ctx) {
  const p = ctx.escenario;
  p.ajustes = p.fisica.conAjustes({ GRAVEDAD: 1100, REBOTE_SUELO: 0 });
  return {
    actualizar(dt, pista) {
      const s = pista.fisica.paso(pista.vuelo, dt, pista.limites(), pista.ajustes);
      if (s.posado) ctx.alTerminar({ resultado: 'derrota' });
      pista.fisica.aplicar(pista.pato, pista.vuelo, pista.ajustes);
      pista.pintor.fillRect(/* … */);
    },
    destroy() {}
  };
}
```

La `pista` trae `pato`, `fisica`, `vuelo`, `ajustes`, `limites()`, `medidas`,
`pintor` (canvas a pantalla completa, detrás del pato), `aPantalla(y)`,
`entrada` (ratón con inercia y teclas), `marcador(texto)`,
`esconderMascota(si)`, `cursor(css)`, `panel(el)`, `alPedirSalir(fn)` y
`salir()`.

- **`cursor(css)`** — el puntero mientras dure la partida. Se va con el lienzo,
  así que no hay que acordarse de deshacerlo.
- **`panel(el)`** — monta un trozo de interfaz **por encima** del lienzo, para lo
  que no se puede pintar en un canvas: un campo de texto, un botón. Con `null` lo
  quita, y se desmonta solo al devolver el escenario. Sólo cabe uno.
- **`alPedirSalir(fn)`** — se queda con el Esc y con el botón de salir. Sin esto
  los dos terminan la partida, que es lo que quiere cualquier juego. **Es la
  única forma de que un juego se quede sin salida voluntaria**, así que lo único
  que lo usa es la broma. Lo que NO se puede tocar por ahí son las salidas
  involuntarias: el tope de diez minutos, el apagado y el fallo del propio juego
  siguen terminando la partida pase lo que pase.

`esconderMascota` la quita de la vista sin quitarla del sitio —`cuerpo()` y las
medidas siguen valiendo—, para los juegos donde la mascota no es un personaje
sino un mando: en The Hole, verla plantada en medio de lo que maneja estorba.
No hay que acordarse de deshacerlo: el escenario la devuelve a la vista al
terminar, pase lo que pase.

Dimensiona con **`medidas.patoAncho`**, no en píxeles absolutos: un juego medido
a ojo sale distinto en el overlay de 1920 px y en el panel lateral de 350.

Para colisiones con el pato usa **`pato.cuerpo()`** (un círculo), no `hitTest`:
`hitTest` no deshace la rotación del vuelo, cuesta un `getImageData` por consulta
y deja que algo rápido atraviese al pato entre dos fotogramas.

Estos juegos sólo se ofrecen donde el pato tiene la pantalla para él
(`capacidades.juegosDeEscenario`): escritorio, panel lateral y banco de pruebas.
Sobre una página ajena, no.

**Antes de empezar hay cinco segundos de presentación.** El escenario enseña el
nombre del juego, su `descripcion` del catálogo —la misma línea que sale al pasar
por encima del botón— y una cuenta atrás. En pantalla completa no hay panel donde
leer de qué va la cosa, y un juego de reflejos que arranca de golpe no se entiende
la primera vez.

Durante la cuenta **el juego no corre**: no se le llama a `actualizar` ni con `dt`
a cero. Con cero tampoco es inofensivo —«Pato Hook» dispararía al soltar el ratón
y Malabares podría dar un toque—, así que sencillamente se espera. Lo controla
`PRESENTACION_S` en [`escenario.js`](../src/core/game/minijuegos/escenario.js), y
sólo aparece si quien presta el escenario pasa `descripcion`: lo que no viene del
catálogo —la broma del «No tocar»— ya trae su propio cartel, y una cuenta atrás
delante le quitaría la gracia.

**La franja de la barra de tareas queda libre.** En el escritorio la ventana
cubre el monitor entero —barra incluida, que es por donde el pato camina— y
durante una partida el ratón está capturado de principio a fin. Eso dejaría el
icono de la bandeja debajo de una ventana transparente durante hasta diez
minutos, y por ahí es por donde se cierra el pato. Así que `updateMouseCapture`
suelta el ratón siempre que el cursor está sobre esa franja, con partida o sin
ella. Arrastrando sí se mantiene: soltar al pato sobre la barra tiene que poder
hacerse. Donde no hay barra (`ground` es 0) esto no hace nada.

---

## Partidas por red

Las jugadas viajan por el **mismo canal que el chat**, en su propio evento y
**dirigidas** a un pato concreto: exactamente igual que las visitas. Lo que va
para otro se descarta en quien mantiene la conexión, sin llegar al pato.

Un juego no ve nada de eso. Recibe `ctx.sala` con tres cosas:

```js
ctx.sala.enviar({ i: 4 });                  // una jugada
ctx.sala.alRecibir((jugada, de) => { … });  // la del rival
ctx.sala.alIrseUnJugador((quien) => { … }); // se ha ido
```

De la disciplina se encarga [`game/salas.js`](../src/core/game/salas.js):
numera las jugadas, descarta las repetidas, confirma las que llegan, reintenta
las que no y avisa cuando el rival desaparece. Un juego sólo tiene que validar
que la jugada del rival tenga sentido en su tablero — que es algo que ya hace
para las suyas.

**Con quién se puede jugar.** Sólo con patos que anuncien identidad estable
(`patoId`). A un pato con una versión anterior se le puede escribir y mandarle el
pato, pero no retarle: una partida tiene que aguantar que al otro le cambie la
clave de presencia al reconectar, y sin identidad estable no hay forma de
reconocerlo después.

**Qué se ha probado.** El protocolo se prueba sin red y sin segunda máquina, con
un rival simulado al otro lado de un tubo que pierde mensajes a voluntad:

```bash
npx electron . --dev --probe "__pato.pruebaDeSalas({perdida:0.3})"
```

Pasa de forma consistente con 0 %, 15 % y 30 % de pérdida. Con 50 % sostenido la
partida se alarga más de lo que dura la prueba: el protocolo sigue reintentando,
pero conviene saber que ése es el límite medido.

Lo que **no** está probado por ahí es la resincronización por huecos de
secuencia: con turnos estrictamente alternos nunca se produce un hueco. El
camino existe (`pedir-sincro`), pero no se ejercita.

## Mudarse de pestaña no es abandonar

En la extensión el pato se muda cada vez que el usuario cambia de pestaña, y en
cada página estrena documento con la memoria en blanco. Si eso terminara la
partida, el multijugador sería inservible en Chrome. En el escritorio no pasa:
el pato no se muda a ninguna parte.

Tres piezas, y ninguna sabe de las otras:

1. **`apagar(motivo)`** ([core/app.js](../src/core/app.js)). El motivo `'mudanza'`
   —lo mandan `extension/boot.js` y `extension/content.js`— hace que NO se avise
   al rival ni al cerrar la sala ni al cerrar el panel. Sin esto el pato se
   rendiría cada vez que su dueño mira otra pestaña.
2. **El worker se acuerda.** `sw.js` apunta los mensajes de la sala —los que
   llegan **y los que salen**— en `chrome.storage.session`, y se los devuelve al
   pato en cuanto reaparece. No guarda el estado del juego: el worker no sabe
   jugar a nada y no debe saberlo.
3. **`salas.reanudar(guardado)`** rehace la sala con eso: quién juega, por dónde
   iba la numeración y a quién hay que hablarle. Da por vistos los mensajes del
   rival que ya se atendieron —si no, su último reenvío se aplicaría dos veces— y
   le confirma lo último, que es lo que le hace dejar de reenviar. Lo jugado se
   lo pasa al juego en `ctx.previas`, que es el único que sabe qué hacer con ello.

**Qué se recupera y qué no.** El tablero de tres en raya, entero: una casilla
puesta es una casilla puesta. El marcador de piedra-papel-tijera y par o impar,
también. Lo que **no** se recupera es la ronda en vuelo de esos dos: el
compromiso se firmó con una sal que sólo vivía en memoria y se fue con el
documento anterior, así que esa ronda se vuelve a elegir. Lo que el rival hubiera
mandado de ella se le devuelve a la ronda nueva por la misma puerta que el canal
(`repartirPrevias`), de modo que él no tiene que repetir nada ni enterarse de que
nos hemos movido.

Un juego que no mire `ctx.previas` no se rompe: empieza de cero. Se pierde el
tablero, no la partida.

## Jugadas a la vez

Piedra-papel-tijera y par o impar tienen un problema que tres en raya no tiene:
**los dos eligen al mismo tiempo**. Si mando mi jugada antes que el otro, el otro
la ve y gana siempre.

Y no vale con "enviar a la vez": la sala lleva **un solo contador de secuencia**,
así que dos envíos simultáneos se pisan —los dos suben a la misma `n`, y cada
lado descarta la del otro por "ya aplicada", encima confirmándosela—. Es un fallo
silencioso, de los peores.

Para eso está
[`minijuegos/rondaSimultanea.js`](../src/core/game/minijuegos/rondaSimultanea.js).
Un juego le pide una ronda y se despreocupa:

```js
const ronda = crearRondaSimultanea(ctx, {
  eligeLaMascota: () => unoDe(OPCIONES, azar).id,   // el rival en modo solo
  alResolver: ({ mio, suyo, tramposo, plantado }) => { … }
});
ronda.elegir('piedra');
```

Por debajo es **compromiso y revelación**: primero cada uno manda el *hash* de su
jugada, que no dice nada, y sólo cuando los dos están comprometidos se revelan
los valores. Quien cambie su jugada al revelar no cuadra con lo que prometió, y
sale `tramposo: true`. Como el canal alterna, el intercambio también:

```
1. anfitrión → compromiso      3. anfitrión → revelación
2. invitado  → compromiso      4. invitado  → revelación
```

Queda una rendija, y conviene saberla: **el invitado ve la revelación del
anfitrión antes de mandar la suya**. No puede cambiarla —está comprometido— pero
sí puede callarse si ve que pierde. Por eso hay un plazo: quien no revela a
tiempo, pierde la ronda (`plantado: true`).

Un detalle que cuesta un bug si se pasa por alto: **la ronda siguiente se abre en
cuanto la anterior se resuelve**, no cuando termina la pausa de "mira lo que ha
salido". Si se esperara, el compromiso de un rival más rápido llegaría sin nadie
escuchando y se perdería, porque la sala ya lo habría confirmado.

En modo solo no hay nada de esto: la mascota elige y se resuelve al momento.

## Experiencia

La fija `Level`, igual para todos los juegos, y con **tope diario**:

| | XP |
|---|---|
| Terminar una partida | +4 |
| Ganarla | +8 más |
| Empatar | +4 más |

Ocho partidas al día como mucho. Sin tope, jugar en bucle sería la vía rápida
para subir de nivel; por eso **no hay campo de XP por juego** en el descriptor.
Jugar también gasta energía del pato (`tam.play()`), y un pato agotado no juega.

---

## Los cuacks

La moneda. Se ganan jugando y se gastan en comprar juegos, y viven en
[`core/game/cuacks.js`](../src/core/game/cuacks.js).

### Lo que paga una partida

`valor(juego) = 5 + nivel × 3`, y encima el final:

| | × |
|---|---|
| Perder, pero terminar | 0,3 |
| Empatar | 0,6 |
| Ganar | 1 |
| Contra otra mascota | × 2 encima de lo anterior |

En los juegos de marca no hay bonus aparte por batir el récord, y no hace falta:
esos juegos declaran `victoria` **sólo cuando se bate** (mira el `esRecord` de
cualquiera de ellos), o sea que el premio por el récord ES el ×1 de ganar frente
al 0,3 de perder. Un solo multiplicador y ninguna cuenta doble.

### No hay tope diario, y es a propósito

La experiencia lo lleva porque no hay nada más que la pare. Los cuacks no lo
necesitan: cada partida gasta diez de energía de la mascota, así que de ochenta
se juegan ocho y a dormir. **El cuello de botella son las partidas, no los
minutos** —y por eso el pago va por partida—. Si fuera por tiempo, «piedra, papel
o tijera» pagaría más por minuto que The Hole sólo por durar quince segundos, que
es justo lo contrario de lo que se busca.

### Lo que cuesta el siguiente juego

`precioSugerido(nivel) = redondear(nivel × 45 a múltiplos de 25)`. Calibrado
para que salga por unas **cuarenta partidas del último juego que tengas** —y esa
cifra se mantiene en toda la escalera, del 20 al 68—. Machacando el más tonto en
vez del más alto, la misma compra pide de 180 a 610 partidas. Eso es todo el
mecanismo: no hay nada que lo prohíba, simplemente no sale a cuenta.

### Lo que ya se tenía no se cobra

**Todos los juegos llevan precio menos el de nivel 1**, que es la puerta: sin uno
con el que empezar a ganar no habría forma de comprar el segundo.

Y a la vez, **nadie paga por lo que ya había conseguido**. Al estrenar el
monedero se regalan de golpe todos los juegos que el nivel de ese pato ya tenía
abiertos, y a partir de ahí son compras como cualquier otra. Las dos cosas no se
contradicen: la diferencia no es el juego, es CUÁNDO se abrió. Lo que estaba
abierto el día que llegó la moneda estaba conseguido, y eso no se quita.

La consecuencia es deliberada: los juegos que aún **no** se habían abierto por
nivel sí se pagan, también para quien ya venía jugando. Un juego que todavía no
tenías no es tuyo, y ahí no se le quita nada a nadie.

| Quién | Se le regalan | Paga |
|---|---|---|
| Instala hoy, nivel 1 | sólo el de nivel 1 | los otros nueve |
| Venía jugando, nivel 10 | siete | Jumping, Flappy y The Hole |
| Venía jugando, nivel 16+ | los diez | nada |

Y al estrenar la cartera se abona un saldo de arranque: cinco cuacks por partida
ya jugada, con tope de 500. No es por lo de atrás —eso ya se cubre con el
regalo—, es para lo de delante: al de nivel 10 le quedan tres juegos que ahora se
compran, y llegar ahí sin un cuack sería cambiarle las reglas a mitad de partida.
Se paga una sola vez y sale de las partidas guardadas, no de un número
inventado.

### La broma también paga

Pasar las diez cuentas del peaje del «No tocar» da `120 + nivel × 10`, **una vez
al día**. Una al día y no una por peaje porque el peaje se puede repetir: fallar
devuelve a la primera pregunta, pero pasarlo dos veces seguidas es cuestión de
paciencia, y entonces la broma sería una máquina de hacer cuacks.

La cifra se dice en Ajustes **antes** de que nadie lo pulse, porque es la mitad
del trato y esconderla sería hacer trampa. Lo que no se adorna es la otra mitad,
así que el consejo se mantiene tal cual: no lo pulses.

---

## Cómo se prueba

```bash
npm run banco
```

El núcleo en un navegador normal, en `http://127.0.0.1:8777/tools/banco/`. Es el
sitio más cómodo para desarrollar: recarga instantánea y DevTools.

Con la app de escritorio, sondas sobre `window.__pato` (sólo en `--dev`):

```bash
npx electron . --dev --probe "(__pato.verJuegos(), document.querySelectorAll('.juego-card').length)"
```

- `__pato.verJuegos()` — abre el panel
- `__pato.verPartida('tresenraya', 'solo')` — abre una partida
- `__pato.juegos()` — el progreso guardado
- `__pato.darXp(700)` — para ver el aviso de desbloqueo
- `__pato.cuacks()` — saldo, ganado, comprados y el día que se cobró la broma
- `__pato.darCuacks(1000)` — para probar la tienda sin jugar cuarenta partidas
- `__pato.probarEscena({revienta: true})` — presta el escenario a un juego que
  falla, para comprobar que el pato vuelve igualmente

Y en la extensión, la prueba que sólo se puede hacer ahí: abrir una partida sobre
una página cualquiera y **cambiar de pestaña a mitad**. El pato se muda; no debe
quedar ni un bucle ni un error en la consola.

---

## La escalera

**No hay tope.** La escalera no cabe en cincuenta niveles ni en cien: cada juego
nuevo se coloca por encima del anterior y los niveles se amplían con él. Lo que
está fijado es la REGLA, no el final.

### La regla

> El hueco entre un juego y el siguiente crece de tres en tres:
> `hueco(n) = 1 + ⌊(n − 1) / 3⌋`, siendo `n` el número de orden del juego.

Los tres primeros van seguidos, los tres siguientes de dos en dos, los tres
siguientes de tres en tres, y así. Sale de que cada nivel cuesta más que el
anterior: con hueco constante, los últimos juegos caerían todos encima.

Al añadir un juego se aplica la regla y ya está; si eso pide un nivel que no
existía, se amplía. Y con él, los rangos de [`Level.js`](../src/core/game/Level.js),
que son una línea en un array.

### Dónde cae cada uno

| # | Nivel | Juego | Qué pide | Días | Precio |
|---|---|---|---|---|---|
| 1 | 1 | ✌️ Piedra, papel o tijera | suerte | 0 | gratis |
| 2 | 2 | 🔊 «Pato dice» | memoria corta | 0 | 100 |
| 3 | 3 | 🎲 Par o impar | suerte y una apuesta | 0 | 125 |
| 4 | 4 | 🃏 Memoria | memoria espacial | 1 | 175 |
| 5 | 6 | ⭕ Tres en raya | pensar | 1 | 275 |
| 6 | 8 | 🌵 «Pato Runner» | reflejos, un botón | 2 | 350 |
| 7 | 9 | 🎯 «Pato Hook» | puntería, sin prisa | 3 | 400 |
| 8 | 12 | 🏓 «Pato Jumping» | reflejos y ratón continuo | 4 | 550 |
| 9 | 14 | 🪶 «Flappy Pato» | reflejos finos, castiga | 5 | 625 |
| 10 | 16 | 🕳️ The Hole | varias cosas a la vez | 6 | 725 |
| 11 | 20 | ⛳ Minigolf | puntería fina, sin prisa | 8 | 900 |
| 12 | 24 | 🏓 Pong | reflejos contra un rival | 11 | 1075 |
| 13 | 28 | 🧱 Ladrillos | Pong con puntería | 14 | 1250 |
| 14 | 33 | 🌋 El suelo es lava | dos ejes y ritmo | 17 | 1475 |
| 15 | 38 | 👾 Invasores | reflejos y disparar | 21 | 1700 |
| 16 | 43 | 🔤 Ahorcado | vocabulario, y hacen falta dos | 25 | 1925 |
| 17 | 49 | 🚢 Hundir la flota | deducción, partidas largas | 31 | 2200 |
| 18 | 55 | 🎱 8 Pool | tacto para la física | 36 | 2475 |
| 19 | 61 | 🏹 «Angry Pato» | puntería y leer estructuras | 42 | 2750 |
| 20 | 68 | 💥 Artillería | todo junto | 49 | 3050 |

Los días son de uso normal —unas 736 XP diarias entre convivencia, cuidados,
racha, chat y el tope de partidas—. Los diez primeros están **hechos**; del 11 en
adelante, [por hacer](#los-que-faltan).

El nivel ABRE un juego y el precio lo COMPRA. Quien ya lo tuviera abierto el día
que llegó la moneda no paga por él —ver [Los cuacks](#los-cuacks)—.

### Ordenados por dificultad, no por antigüedad

La columna que manda es «qué pide», no cuándo se escribió. Por eso «Pato Hook» y
«Pato Jumping» **se han intercambiado**: apuntar sin prisa es más fácil que
seguir una pelota con el ratón, y estaban al revés.

> **Al reordenar, bajar es gratis y subir cuesta.** Bajar un juego se lo da a más
> gente; subirlo se lo quita a quien ya lo tenía. En este cambio sólo sube uno
> —«Pato Jumping», del 9 al 12— y afecta a quien esté justo entre esos niveles.
> El progreso guardado no se pierde en ningún caso: `ProgresoJuegos.toJSON` no
> filtra por catálogo.

## Los que faltan

Aprobados y por hacer, cada uno su propia tarea. El contrato está dimensionado
para todos: ninguno pide ampliarlo.

| Juego | Nivel | Modos | Superficie | Lo que estrena |
|---|---|---|---|---|
| ⛳ Minigolf | 20 | solo | escenario | el primero que puntúa a MENOS |
| 🏓 Pong | 24 | solo | escenario | la mascota ES la pala, y enfrente hay otra |
| 🧱 Ladrillos | 28 | solo | escenario | un muro que se rompe, sobre el Pong |
| 🌋 El suelo es lava | 33 | solo | escenario | plataformas que se mueven y se hunden |
| 👾 Invasores | 38 | solo | escenario | disparar hacia arriba, y algo que baja |
| 🔤 Ahorcado | 43 | red (2+) | panel | uno propone y los demás adivinan por turnos; teclado en el panel |
| 🚢 Hundir la flota | 49 | red (2) | panel | compromiso y revelación de verdad: el tablero secreto |
| 🎱 8 Pool | 55 | solo · red (2) | escenario | choques entre bolas: el único caso donde la física exacta sale bien |
| 🏹 «Angry {mascota}» | 61 | solo | escenario | estructuras que se vienen abajo |
| 💥 Artillería | 68 | red (2) | escenario | terreno destructible y turnos con física compartida |

Los dos últimos estaban en el tintero y **están confirmados**: se hacen, y se
hacen al final. El [ranking entre patos](#-ranking-entre-patos) tampoco está en
esta tabla porque no es un juego: es lo siguiente que se ejecuta.

### 🧱 Ladrillos

Arkanoid: la mascota abajo de pala, un muro de ladrillos arriba, y la pelota
rompiendo. **Es el Pong con el rival cambiado por un muro**, así que hacerlo
justo después sale casi por el precio del cambio: misma pelota, mismo rebote
contra `pato.cuerpo()`, mismo bucle. Lo nuevo es una rejilla de ladrillos y una
colisión de círculo contra rectángulo.

Se gana limpiando el muro y se pierde al dejar caer la pelota tres veces. Los
muros van por niveles: cuando limpias uno, entra el siguiente más apretado, y la
marca es hasta qué muro llegaste.

> **Aviso de repetirse.** Malabares, Pong y Ladrillos son los tres «mantén la
> pelota en el aire con la mascota». Tres es el límite: si al jugar seguido se
> notan iguales, el que sobra es éste, que es el que menos aporta. Conviene
> escribirlo **después** del Pong y decidir entonces.

### 👾 Invasores

Space Invaders. La mascota se mueve por abajo y lanza huevos hacia arriba;
enfrente, filas de gaviotas que bajan un escalón cada vez que llegan a un borde,
y aceleran según quedan menos. Te alcanzan y se acabó.

Es el único de los de escenario que **dispara**, así que trae algo que no hay:
proyectiles propios, en las dos direcciones. Sigue sin necesitar arte —las
gaviotas se pintan con un emoji en el lienzo, como el resto del catálogo— y el
huevo es un círculo.

- **Marca:** `{ etiqueta: 'oleada', mejor: 'mas' }`. No se gana: se aguanta.
- La barra espaciadora dispara, o sea que necesita el mismo arreglo de
  `escenario.js` que «Pato Runner» y «Flappy Pato». Ya está hecho.

### 🌋 El suelo es lava

El suelo es lava. Del techo caen bloques que flotan un momento y **se van
hundiendo porque la lava los derrite**, así que hay que ir saltando de uno a otro
antes de que el que pisas desaparezca. Se cuenta lo que aguantas.

Es el primero que pide **moverse en dos ejes**: hasta ahora la mascota o corría
en el sitio (Runner), o subía y bajaba (Flappy), o no se movía (Hook). Aquí hay
izquierda, derecha y salto.

Y trae lo único de verdad nuevo: **plataformas que se mueven**. `fisica.paso`
sabe chocar contra un suelo fijo, no contra cajas que bajan; «estoy de pie sobre
ese bloque, y bajo con él» hay que resolverlo a mano. Es media tarea, y conviene
saberlo antes de empezar:

- Cada bloque tiene su altura y su velocidad de hundimiento, que crece con el
  tiempo que lleva pisado.
- La mascota se apoya en el bloque cuyo techo tenga justo debajo, y hereda su
  bajada mientras siga encima.
- El salto es el del [Runner](../src/core/game/minijuegos/obstaculos.js), pero
  desde el bloque en vez de desde el suelo.

`marca: { etiqueta: 'segundos', mejor: 'mas' }`.

### ⛳ Minigolf

Un hoyo, unos obstáculos y los golpes contados. Apuntas y das fuerza igual que en
[«Pato Hook»](../src/core/game/minijuegos/punteria.js) —de hecho, ahí está toda
la interfaz de apuntar hecha, con su previa de trayectoria—, pero lo que sale
rodando es una bola por el suelo y no la mascota por el aire.

Es el primero que **puntúa a menos**: `marca: { etiqueta: 'golpes', mejor:
'menos' }`. Esa dirección está en el contrato desde el principio y no la ha usado
nadie todavía, así que de paso la estrena.

Técnicamente es lo más barato de los tres: la bola es un `vuelo` sin gravedad y
con mucho rozamiento, los obstáculos son rectángulos y el hoyo es un círculo. La
mascota mira y celebra.

### 🎱 8 Pool

Billar americano: la mesa, las bolas, las troneras. Un tiro son dos números
—ángulo y fuerza—, así que **encaja en la sala por turnos** exactamente igual que
la [artillería](#-artillería-tipo-worms--nivel-50): se manda la jugada y los dos
lados simulan lo mismo.

Y aquí sí hace falta física de cuerpo contra cuerpo, pero es **el único caso del
proyecto donde sale bien**, y conviene entender por qué: son círculos del MISMO
tamaño, sin gravedad, en un plano y sin contactos en reposo. El choque elástico
entre dos discos iguales es exacto en una línea de código y no necesita
solucionador. Es justo lo contrario del montón de [The
Hole](#amontonarse), que temblaba porque la gravedad los empujaba unos contra
otros indefinidamente.

- **Superficie:** escenario. Una mesa de billar en 280 × 300 px no se ve.
- **Riesgo:** la deriva numérica en red, el mismo de la artillería. Se ataja
  mandando también dónde acabó cada bola, con el anfitrión de árbitro.

---

## Los cuacks: la moneda

**Propuesta, no implementada.** Se apunta entera porque la decisión de fondo ya
está tomada y conviene que no se pierda.

Además del nivel, los juegos se **compran**. Así jugar da algo más que un número
y hay que jugar para poder jugar más; y como cada juego paga según su nivel,
comprarse el caro machacando el barato es posible pero absurdo.

### La regla que manda sobre todas

> **Lo que ya está desbloqueado no se toca.** La moneda es para los juegos que
> vengan a partir de ahora. Al actualizar, todo juego con nivel ≤ tu nivel queda
> comprado, gratis y para siempre.

Es la tercera vez que aparece esta misma lección —con el reparto de niveles y con
las marcas guardadas— y va escrita aquí para que no haya una cuarta: quitarle a
alguien algo que ya tenía no es una mecánica, es un parte de incidencias.

### Cómo se ganan

Base por partida terminada: `2 + nivel del juego`. Ahí está lo de que un juego
mayor pague más: piedra papel tijera da 3, The Hole 18, la artillería 52.

| Multiplicador | |
|---|---|
| Ganar | ×2 |
| Contra otro pato, en red | ×2 |
| Récord nuevo | +50 % de la base, una vez |

Y dos fuentes que no son partidas, y son las que impiden el bloqueo:

- **Subir de nivel**: `nivel × 10`. Importa más de lo que parece: significa que
  **cuidar al pato también paga**, así que el Tamagotchi no se queda de adorno
  mientras se juega.
- **La racha del día**: +25 la primera partida de cada día.

### El freno: rinde menos por juego repetido

Cada juego paga completo sus **3 primeras partidas del día**; de la cuarta en
adelante, el 20 %. Es lo que hace que machacar el barato no compense:

| Doce partidas | Cuacks |
|---|---|
| Doce de piedra papel tijera | ~14 |
| Tres de cada uno de cuatro juegos (niveles 1, 6, 9 y 16) | ~130 |

Diez veces más por jugar variado, sin prohibir nada.

### Lo que paga la broma

Pasar el [peaje del «No tocar»](#la-broma) entero da **`120 + nivel × 10`
cuacks**, una vez al día. A nivel 16 son 280, más de la mitad de lo que cuesta
The Hole.

**Y se dice en el botón, con la cifra puesta.** Es el mejor cebo que tiene la
broma: saber lo que hay dentro es justo lo que hace que la gente entre a por
ello. Pero **no se miente en ningún sitio** —ni en el botón, ni en el cartel—:

> ⚠️ **No tocar**
> Dan 280 cuacks si pasas el peaje. No lo pulses.

Las dos frases son verdad. Da 280, y la recomendación sigue siendo no entrar,
porque el peaje tiene reloj y cualquier fallo devuelve a la primera. Que alguien
lo pulse igualmente sabiendo las dos cosas es exactamente el chiste; engañarle
para que lo pulse, no.

Y cuando ya se ha cobrado hoy, el botón lo dice: *«Hoy ya lo has cobrado. Sigue
sin ser buena idea.»* Un cebo que promete algo que no va a llegar es una mentira
aunque el número fuera cierto ayer.



Paga tanto porque cuesta tanto: hay reloj en cada cuenta y cualquier fallo
devuelve a la primera, así que no es un trámite que se despacha en treinta
segundos. Y una vez al día porque, si no, sería la mejor forma de ganar cuacks
del juego, y la broma dejaría de ser una broma para convertirse en el trabajo.

### Cuánto cuestan

`precio = 12 × nivel^1.35`, y el de nivel 1 es gratis —si no, un pato recién
nacido no tiene nada que hacer—.

| Nivel | 1 | 4 | 8 | 16 | 26 | 36 | 50 |
|---|---|---|---|---|---|---|---|
| Precio | 0 | 78 | 199 | 505 | 962 | 1.470 | 2.296 |

Están calculados para que cada juego cueste **entre dos y cuatro días** de juego
normal en el momento en que el nivel te lo abre, porque los ingresos suben a la
vez que los precios.

### Lo que NO se hace

- **Comprar cuacks con dinero.** Obvio, pero mejor escrito.
- **Perder cuacks al perder una partida.** Ya has perdido; castigar dos veces es
  feo.
- **Que caduquen.**

### Un riesgo conocido

El ×2 de red se puede granjear entre dos que se turnen para dejarse ganar. El
tope de tres partidas al día por juego lo acota —dos personas con ocho juegos
sacan haciendo trampa poco más que jugando de verdad—, así que no compensa el
aburrimiento, pero no es imposible. Si molesta, la respuesta barata es que el ×2
de red sólo cuente las seis primeras partidas en red del día, en total.

---

## Récords y ranking

Dos cosas distintas que suenan igual, y conviene no mezclarlas: **lo tuyo** y
**lo de todos**.

### 🏅 Tus récords — hecho

Botón **🏅 Tus récords** debajo de la rejilla del panel de juegos, con el número
de partidas al lado. Se entra a una **tercera vista dentro del mismo panel** —el
`‹` vuelve a la rejilla— igual que ya hace la vista de modo: es el patrón que
había, y no hace falta un panel nuevo.

Arriba, tres totales: partidas, ganadas y **cuántas de las de hoy han puntuado**,
de las ocho que caben. Debajo, una fila por juego con su mejor marca, sus
partidas y sus victorias.

Es una vista de **lectura**: no calcula nada que no esté en `ProgresoJuegos`
—`de(id)` por juego y `totales()` para la suma—. Salen **todos** los juegos,
también los que aún no tienes por nivel («se abre en el nivel N») y los que no
has tocado («sin estrenar»), porque un marcador vacío es una invitación. Y
también las marcas de un juego que se te haya vuelto a bloquear, porque `toJSON`
no filtra por catálogo.

Lo único que hubo que añadir fuera del panel es `Level.partidasQuePuntuanHoy()`.
No vale leer `juegosHoy` a secas: ese contador se pone a cero al anotar la
primera partida del día, no a medianoche, así que a alguien que acaba de empezar
la mañana le habría dicho «8 de 8».

La lista se desplaza, por lo mismo que la rejilla: con los juegos que hay, el
panel entero se iba a 500 px.

### 🌐 Ranking entre patos — decidido, y es lo siguiente

**Global, permanente y para todos.** Se descarta la opción barata —anunciar las
marcas por el canal y quedarse con lo que se oyó mientras estabas conectado— y se
va a una **tabla en Supabase con RLS**. Es un cambio de arquitectura y conviene
decirlo entero antes de empezar: hasta hoy el proyecto usa de Supabase **sólo
Realtime**, que es un tubo por el que pasan mensajes y no guarda nada. Con la
primera tabla entran el esquema, las políticas de acceso y una identidad.

### Lo que hace falta

| Pieza | Estado |
|---|---|
| Proyecto de Supabase y clave publicable | **Ya está.** `supabase.json`, ver [`main/config.js`](../src/main/config.js) |
| Cliente `@supabase/supabase-js` | **Ya está**, lo usa el chat |
| Identidad estable del pato | **Ya está**: `settings.patoId`, el mismo que usan las salas |
| El secreto por pato, para reclamar sus filas | **Falta**, y es una línea al lado del `patoId` |
| La tabla, la vista y la función | **Escritas** en [`supabase/records.sql`](../supabase/records.sql); falta **ejecutarlas** en el panel |

### La tabla y sus reglas

Están escritas y listas para pegar en el editor SQL del panel:
[`supabase/records.sql`](../supabase/records.sql). Es idempotente, así que se
puede lanzar entero las veces que haga falta.

Una fila por pato y juego —no una por partida—: lo que se enseña es el récord, y
guardar cada partida sería un histórico que nadie va a leer y que crece sin
freno.

**Y aquí hay que corregir lo que decía antes este documento.** Se apuntó que la
política compararía «la `pato_id` de la fila con la que manda el cliente». **Eso
no se puede.** Con la clave publicable no hay `auth.uid()` contra el que
comparar: el cliente dice quién es y el servidor se lo cree. Una política así no
protege nada, y como las marcas sólo suben, un solo aburrido podría inflar el
marcador de todos de forma permanente.

Lo que sí funciona, y es lo que está escrito:

- **A la tabla no llega nadie.** RLS encendido y sin políticas, y los permisos
  revocados. No hace falta escribir un «prohibido»: la ausencia ya lo es.
- **Se lee una vista**, `records_publicos`, que no lleva el hash del secreto.
- **Se escribe por una función** `security definer`, `guardar_record`, que es la
  única puerta.
- **Cada fila la reclama quien la crea**, con un secreto que el pato genera la
  primera vez y guarda en sus ajustes al lado del `patoId`. Después, sólo se
  toca presentando el mismo secreto.
- **La marca sólo sube.** El nombre sí se actualiza siempre: cambiarle el nombre
  al pato no debería obligar a batir un récord para que se note.
- **Nadie borra nada.** Ni su propia fila.

Así, lo peor que puede hacer alguien es mentir sobre lo suyo. No puede tocar lo
de los demás, ni borrarlo, ni bajarlo.

> **Lo que hay que hacer a mano, y no lo puede hacer el pato:** ejecutar ese SQL
> en el panel. La clave que lleva la app es la publicable, y con ésa no se crean
> tablas ni funciones —para eso hace falta la `service_role` o entrar al panel—.
> Es un pegar y darle a «Run».

Para comprobar que quedó bien: **`npm run marcador`**. Se conecta con la misma
clave publicable que lleva la app, así que verifica exactamente lo que va a poder
hacer un pato. Y **no escribe nada**, que no es prudencia sino consecuencia del
diseño: con esta clave no se puede borrar una fila —ni la propia—, así que una de
pruebas se quedaría en el marcador de todo el mundo para siempre. La puerta de
escritura se comprueba llamándola mal a propósito, que es un camino que responde
sin tocar la tabla.

### En la interfaz

Va donde ya está [Tus récords](#-tus-récords--hecho): una pestaña más, o una
columna al lado de tu marca con el mejor de todos y quién lo tiene. Los nombres
los escribe otra gente, así que **`textContent` siempre**, como en el chat.

### Lo que hay que decir en voz alta

Sin servidor que valide, **una marca es lo que su dueño dice que es**. El
marcador tiene que enseñarlo sin disimulo —con el nombre de quien la declara al
lado— porque presentarlo como verificado sería mentir. Entre amigos, con eso
basta; y si algún día deja de bastar, lo que hace falta no es otra política, es
un servidor que juegue la partida.

---

## Los dos grandes

Aprobados, y los últimos de la escalera. Se apuntan con lo que costarían, que es
la mitad de la decisión.

### 🏹 «Angry {mascota}» (tipo Angry Birds) — nivel 61

Lanzas a la mascota contra **estructuras que se vienen abajo**. Ojo, porque el
lanzamiento ya lo tenemos: **eso es «Pato Hook»**. Lo único que aportaría de nuevo
es justo la cara del juego, que lo golpeado se derrumbe.

Y ahí está el problema. El derrumbe de verdad —cajas que giran, se apoyan unas en
otras y se vencen de lado— es un motor de cuerpos rígidos: contactos en reposo,
rotación, fricción y un solucionador iterativo. Es exactamente lo que se decidió
NO escribir en [§Amontonarse](#amontonarse), y por los mismos motivos.

**La versión que sí se puede hacer** es un derrumbe *por bloques*: la estructura
es una rejilla de cajas, un impacto quita las que pilla en un radio, y las que se
quedan sin nada debajo caen **en vertical**, sin girar. Se ve bien, se lee bien y
no hace falta motor ninguno. A cambio, no habrá torres que se venzan hacia un
lado: caen a plomo.

- **Coste:** medio-alto. La física de tiro está hecha; lo nuevo son los bloques,
  la propagación del derrumbe y unos cuantos niveles dibujados a mano.
- **Riesgo:** que se parezca demasiado a «Pato Hook». Si los derrumbes no se
  disfrutan, es «Pato Hook» con decorado.
- **Orden:** después del de artillería. Los dos están aprobados; éste va el
  penúltimo porque es el que más se parece a algo que ya se puede jugar.

### 💥 Artillería (tipo Worms) — nivel 68

Dos mascotas, una en cada punta, y terreno destructible en medio. Por turnos:
eliges ángulo y fuerza, sale un huevo describiendo una parábola, y donde cae abre
un cráter y hace daño según lo cerca que quedara. Gana quien deje al otro sin
vida.

**Es el que mejor encaja de los dos**, y no por gusto: las tres piezas que
necesita ya están escritas.

| Lo que necesita | Lo que ya hay |
|---|---|
| Un turno = una jugada | `salas.js`, que es exactamente eso |
| Que los dos vean el mismo tiro | `ctx.semilla` + física determinista |
| Terreno destructible | el mapa de alturas de [The Hole](../src/core/game/minijuegos/agujero.js) |

El terreno es un mapa de alturas por columna —lo mismo que el montón de The Hole— y un cráter es restarle una campana centrada en el impacto. El disparo
viaja por la sala como `{t:'disparo', angulo, fuerza}`: dos números, y los dos
extremos simulan lo mismo.

- **Coste:** alto, pero repartido en cosas conocidas. Lo nuevo de verdad es el
  terreno y la interfaz de apuntar.
- **Riesgo:** la **deriva numérica**. Si los dos lados simulan por separado y uno
  redondea distinto, los cráteres acaban en sitios distintos y la partida se
  parte sin que nadie se entere. Se ataja mandando también el resultado —dónde
  cayó y cuánto daño— y dejando de árbitro al anfitrión, como ya hace con la
  sincronía.
- **Recomendación:** es el mejor candidato a juego de nivel 68. Un arma sola —el
  huevo—, viento, y tres o cuatro turnos por partida. Nada de inventario.

**Si hubiera que elegir uno: el de artillería.** Trae un modo que no existe
todavía —por turnos con física compartida— mientras que el de derribos es una
variante de algo que ya se puede jugar.

---

## Amontonarse

Las que no se recogen se quedan en el suelo, y cuando el suelo se acaba se ponen
unas encima de otras. Está en
[`agujero.js`](../src/core/game/minijuegos/agujero.js), y la pregunta que
contesta es si eso se hace con física de verdad —cuerpo contra cuerpo, con sus
rebotes— o no.

**Con física de verdad, no.** No por falta de ganas, sino porque el montón es
justo el caso que la física ingenua hace mal:

- Detectar que dos círculos se solapan y separarlos es trivial. Lo difícil es el
  **contacto en reposo**: cada fotograma la gravedad los mete uno dentro de otro
  y la separación los vuelve a sacar. Un montón así tiembla, se hunde o revienta.
  Que no lo haga es lo que resuelven los motores de verdad, con un solucionador
  iterativo de impulsos —diez pasadas por fotograma— y detección de reposo. Eso
  es un motor de física, y aquí no hace falta ninguno.
- **Los círculos no se apilan.** Aunque el solucionador fuera perfecto, un montón
  de círculos bajo gravedad se desparrama hasta quedar en una sola capa: ruedan
  unos sobre otros. Saldría una alfombra, no un montón.
- Y son N²: doscientos cuerpos son veinte mil comprobaciones por fotograma.

**Lo que sí, y además queda mejor.** Una mascota está en uno de dos estados, y
nunca en los dos:

1. **En el aire** — física entera, `fisica.paso()` como ahora, un cuerpo contra
   las paredes y el suelo. No sabe que existen las demás.
2. **Posada** — ya no se mueve nunca más. Se pinta una vez en el lienzo de fondo
   y se olvida.

El paso de uno a otro es lo único que hay que escribir, y son unas quince líneas:
al tocar el suelo o a una posada, mira si a su izquierda o a su derecha hay hueco
más abajo; si lo hay, **rueda hacia allí** y sigue cayendo. Si no, se queda.

Y un montón se puede deshacer: pasar el agujero de The Hole por debajo se va tragando lo
posado de una en una. **Eso no puntúa**, y es media regla del juego: si contara,
lo rentable sería aparcarse sobre un montón a esperar. Limpiar quita el estorbo,
que ya es premio de sobra; para subir de calibre hay que cazarlas cayendo.

Eso da montones que se ven como montones —crecen en picos y se desparraman
cuando la pendiente es mucha— y sale más creíble que la simulación de verdad,
que como se ha dicho los dejaría planos. Lo N² desaparece con un **mapa de
alturas**: un array de "cuánto llega el montón en esta columna". Una mascota que
cae mira su columna y ya, sin comprobar contra nadie.

## La broma

`⚠️ No tocar`, al final de Ajustes y en su propia sección, con su separador y en
rojo. Se pulsa, se cierra Ajustes, sale un cartel que dice **«No debiste hacer
eso»** y empiezan a caer patos. Si haces clic en uno, se parte en dos más
pequeños. Y otra vez. Y otra vez.

Está en [`core/game/broma.js`](../src/core/game/broma.js), **fuera del
catálogo**: no es un minijuego, no da experiencia, no cuenta partidas, no guarda
marca y no cansa a la mascota. Lo único que comparte con ellos es el préstamo del
escenario, que es la pieza que sabe pedir la pantalla y —sobre todo—
devolverla.

Aquí **sí** hay choques entre cuerpos, y al revés que en [The
Hole](../src/core/game/minijuegos/agujero.js): la gracia es el desorden. Círculo
contra círculo, sin contactos en reposo ni solucionador iterativo. Que tiemble,
que se cuele uno por una pared, que el montón se sacuda: ahí eso no son fallos,
son el chiste. Es la única parte del proyecto donde la física mal hecha es la
especificación.

Tres cosas que hay que hacer bien para que sea una broma y no un parte de
incidencias:

1. **La partida siempre termina** — ojo al matiz, que es donde vive el chiste.
   La salida **voluntaria** tiene un peaje: pulsar `Esc` o el botón de salir no
   te saca, te abre [`peaje.js`](../src/core/game/peaje.js) y te pone **diez
   cuentas**, cada una más gorda que la anterior y cada una con su reprimenda
   («Te dije que no tocaras», «Había un cartel», «¿Por qué tocas?»…). Al
   resolver la décima, sales.

   Las cuentas suben hasta lo absurdo: se empieza en `8 + 9` y se acaba en
   `16³ + √1600 − 808`, pasando por raíces y cuadrados. Salen todas enteras —los
   radicandos son cuadrados perfectos y las divisiones exactas— así que con la
   calculadora del sistema se resuelven; las tres primeras, de cabeza.

   **Y no es un trámite: hay reloj, y fallar cuesta la tanda entera.** Cada
   cuenta tiene su tiempo —de 7 s la primera a 25 s la última, que sube con la
   dificultad porque para un cubo hay que ir a por la calculadora— y quedarse sin
   él, o contestar mal, **devuelve a la primera**. Es a propósito: el peaje
   [paga](#los-cuacks-la-moneda), y un premio que se cobra sin riesgo no es un
   premio.

   **No se puede memorizar.** Los números ya salían al azar dentro de cada nivel;
   ahora además **el orden se baraja en cada tanda**, y se vuelve a barajar cada
   vez que se empieza de cero. La cuesta es siempre la misma —tres fáciles, tres
   medias, tres de potencias y el remate— pero cuál toca en cada puesto, no. Sin
   eso, volver a empezar sería una lata en vez de un castigo, porque a la tercera
   ya te la sabrías.

   Lo que **no** se negocia son las salidas involuntarias, y son las que
   convierten esto en una broma y no en un secuestro:

   - El **tope de diez minutos** de `escenario.js`: se acaba sola, se resuelva o
     no.
   - El **icono de la bandeja**, junto al reloj. La franja de la barra de tareas
     [nunca captura el ratón](#juegos-de-escenario), tampoco durante la broma, así
     que se puede cerrar el pato desde ahí en cualquier momento.
   - El **apagado del pato** y el **fallo del propio juego**.

   Y sigue habiendo una puerta que no pasa por las cuentas: el botón de **«Vale,
   sigo»** cierra el peaje y te devuelve a los patos. El peaje bloquea la salida
   voluntaria, no el juego.
2. **«Sin fin» tiene que tener techo**, y son dos. Por **tamaño**: cada partición
   encoge un 32 %, y por debajo del mínimo ya no se parte, revienta en una
   nubecilla y desaparece —cuatro clics matan a un pato, pero por el camino ha
   dejado ocho—. Y por **número**: 150 vivos como mucho. Se siente infinito
   —nunca ganas, se multiplican más rápido de lo que los revientas— pero la
   pestaña no se muere.
3. **Sobre una página ajena, no.** Como todos los de escenario
   (`juegosDeEscenario`), y aquí con más motivo: llenar de patos la web que
   alguien está leyendo mientras se le captura el ratón no es una broma. En esa
   carcasa el botón ni aparece.

**El puntero dice lo que va a pasar.** Una mira en toda la pantalla y una
explosión encima de un pato, para que se vea que eso se puede reventar. Van como
SVG en la propia URL —sin arte que empaquetar, y el `img-src 'self' data:` del
escritorio los admite— y con el cursor de siempre detrás de la coma, por si
alguna carcasa los bloqueara. Se mira **cada fotograma** y no al mover el ratón:
aquí los patos se mueven solos y el de debajo cambia sin que tú hagas nada.

**Los choques son N² y no hace falta más.** Con el tope de 150 son unas 11.000
comprobaciones por fotograma, y medido sale a **0,38 ms** —de los 16,7 que hay—,
así que no hay rejilla espacial ni la necesita. Lo que sí importa es no crear
objetos dentro del bucle: los centros se calculan una vez por fotograma en dos
arrays, porque once mil objetos por fotograma sí se notan.

Y el pato de verdad se entera: se pone `sad` y suelta un *«Te dije que no»*. Ojo
con esto, que tiene truco: mientras el escenario está prestado, `behavior` está
**bloqueado** y `playOnce` no hace nada a propósito. Se le habla al sprite
directamente con `pista.pato.setState`, que es lo que puede hacer un juego de
escenario y no puede hacer uno de panel.
