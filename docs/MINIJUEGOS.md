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
| ⛳ Minigolf | 20 | solo · red (2) | escenario |
| 🏓 Pong | 24 | solo | escenario |
| 🧱 Ladrillos | 28 | solo | escenario |
| 🌋 El suelo es lava | 33 | solo | escenario |
| 👾 Invasores | 38 | solo | escenario |
| 🔤 Ahorcado | 43 | solo · red (2) | panel |
| 🚢 Hundir la flota | 49 | solo · red (2) | panel |
| 🎱 8 Pool | 55 | solo · red (2) | escenario |
| 🏹 «Angry {mascota}» | 61 | solo | escenario |
| 💥 Artillería | 68 | solo · red (2) | escenario |

La lista va de menos a más, y el nivel acompaña: primero los de decidir en un
segundo, después los de pensar, y al final los que piden pulso. Los huecos están
reservados para [los que faltan](#los-que-faltan) — ver [la
escalera](#la-escalera).

Se puede jugar **solo**, contra el pato, o **por turnos contra otro pato
conectado**, retándole desde el propio panel.

El ⛳ Minigolf es el primero que hay que **comprar** —900 cuacks, ver [Los
cuacks](#los-cuacks)— y el primero que puntúa **a menos**: gana quien acabe los
diez hoyos con menos golpes. El recorrido se sortea entero en cada partida —ver
[cómo se genera](#el-recorrido-del-minigolf)—.

Los 🧱 Ladrillos cierran el trío de «mantén la pelota en el aire con la
mascota», y la duda de si sobraba estaba anotada desde el principio. **Se hizo**,
porque en las manos no se parecen: en Jumping la mascota ES la pelota y se juega
en vertical; en el Pong es una pala **vertical** que sube y baja contra un rival;
en Ladrillos es una pala **horizontal** que va de lado contra un muro. Eje
distinto y objetivo distinto —el Pong es defenderse, esto es apuntar—. Y es el
único de los tres donde la mascota se queda en su suelo de siempre.

El 🏓 Pong es el primero con un **rival de verdad** en un juego de escenario, y
el primero donde **ganar y batir el récord son dos cosas distintas**: se gana el
partido —a siete— y lo que se guarda como marca es el peloteo más largo. Se puede
perder 7-3 y firmar la mejor marca de tu vida. Lo que cobra la partida es el
RESULTADO (ver [Los cuacks](#los-cuacks)); lo que sube al marcador global es la
MARCA. En los juegos anteriores coincidían porque no había a quién ganar.

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
  formato: 1,                  // sube esto si cambias cómo se puntúa (ver abajo)
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

## Cuatro reglas duras

Las tres primeras vienen de que el pato también vive **sobre páginas web
ajenas**, dentro de un Shadow DOM, y se muda de pestaña cada pocos segundos.

1. **Nunca escuches en `document` ni en `window`.** Robarle las teclas a quien
   está leyendo una web es inaceptable. El teclado se engancha al propio `el`,
   con `tabindex="-1"` y `focus()`.
2. **Nunca llames a `requestAnimationFrame`, `setInterval` ni
   `addEventListener` por tu cuenta.** Usa `ctx.cadaFrame`, `ctx.cadaCierto` y
   `ctx.escuchar`: se apagan solos. Un bucle suelto sigue dando vueltas sobre un
   documento muerto.
3. **Nunca `innerHTML` con datos de otro.** `textContent` siempre: los nombres
   de los rivales los escribe otra persona.
4. **Ni un `const` ni un `let` después del `return` de `crearPartida`.**

### La cuarta merece explicación, porque ya ha mordido tres veces

Los juegos de esta casa se escriben igual: el estado arriba, `return { ... }` en
medio, y debajo un montón de funciones. Eso funciona porque **las declaraciones
de función se izan**: se pueden usar antes de donde están escritas.

`const` y `let` **no**. Uno declarado ahí abajo entra en su zona muerta y no
llega a inicializarse nunca, porque la ejecución salió por el `return` antes de
alcanzarlo. La primera vez que alguien lo toca:

```
ReferenceError: Cannot access 'loQueSea' before initialization
```

Lo que lo hace peligroso no es el fallo, es **dónde aparece**: casi siempre
dentro de un callback —un clic, un mensaje del rival, el primer fotograma—, o
sea sin traza visible en pantalla. Y `node --check` pasa tan contento, porque
sintácticamente es válido.

| Dónde | Qué se vio |
|---|---|
| `memoria.js` | el juego se quedaba mudo tras la primera carta |
| Minigolf por turnos | reventaba al llegar el primer golpe del rival |
| `lava.js` | la escena ni abría |

Las tres se encontraron a mano, jugando. **Si hace falta un valor calculado
abajo, se declara arriba y se asigna abajo**; si es una función de una línea, se
escribe con `function`.

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

Las jugadas viajan en su propio evento y **dirigidas** a un pato concreto:
exactamente igual que las visitas. Lo que va para otro se descarta en quien
mantiene la conexión, sin llegar al pato.

Y viajan por **un canal de la partida**, no por el común. El reto y su respuesta
sí van por el común —al retar, el otro todavía no está en ninguna sala—, pero en
cuanto acepta, los dos se meten en `sala:<id>` y ahí no hay nadie más. Antes iba
todo por el canal común: con veinte patos conectados, los veinte recibían cada
golpe de minigolf de una pareja ajena para descartarlo por su cuenta.

Quién puede hacerlo se sabe por la **capacidad** que cada pato anuncia en la
presencia (`caps: ['sala']`), nunca por su número de versión. Contra un pato que
no la anuncie se juega por el canal común exactamente como antes: no hay ninguna
rama que trate a los antiguos como un caso especial, sencillamente no hay
capacidad y se toma el camino de siempre.

Al terminar, una partida por red deja **una fila en el historial** —el juego,
contra quién, el resultado, la marca y cuándo— que sólo ve quien la jugó. Las
jugadas no se guardan; el porqué está en
[`supabase/partidas.sql`](../supabase/partidas.sql). Un juego no tiene que hacer
nada para eso: lo apunta `anotarPartida` en core/app.js, por donde ya pasan los
dos finales posibles.

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

## Puntuación y cuesta de dificultad

Dos cosas distintas que conviene no mezclar: **el resultado** —que es lo que cobra
la partida en cuacks y experiencia— y **la marca** —que es lo que sube al marcador
global—.

### Qué guarda cada juego

| Nv | Juego | Marca | Resultado = «victoria» cuando… |
|---|---|---|---|
| 1 | ✌️ Piedra, papel o tijera | — | ganas el duelo |
| 2 | 🔊 «{mascota} dice» | ronda · más | bates tu récord |
| 3 | 🎲 Par o impar | — | ganas |
| 4 | 🃏 Memoria | — | ganas |
| 6 | ⭕ Tres en raya | — | ganas |
| 8 | 🌵 «{mascota} Runner» | metros · más | bates tu récord |
| 9 | 🎯 «{mascota} Hook» | puntos · más | limpias las cinco dianas |
| 12 | 🏓 «{mascota} Jumping» | toques · más | bates tu récord |
| 14 | 🪶 «Flappy {mascota}» | huecos · más | bates tu récord |
| 16 | 🕳️ The Hole | calibre · más | bates tu récord |
| 20 | ⛳ Minigolf | golpes · **menos** | bates tu récord — o **ganas la ronda**, en red |
| 24 | 🏓 Pong | peloteo · más | **ganas el partido** |
| 28 | 🧱 Ladrillos | ladrillos · más | bates tu récord |
| 33 | 🌋 El suelo es lava | segundos · más | bates tu récord |
| 38 | 👾 Invasores | oleada · más | bates tu récord |
| 43 | 🔤 Ahorcado | palabras · más | bates tu récord — o **la sacas con menos fallos**, en red |
| 49 | 🚢 Hundir la flota | disparos · **menos**, y sólo al ganar | hundes su flota antes |
| 55 | 🎱 8 Pool | seguidas · más | metes la negra con tu grupo limpio |
| 61 | 🏹 «Angry {mascota}» | estructuras · más | bates tu récord de estructuras derribadas |
| 68 | 💥 Artillería | disparos · **menos**, y sólo al ganar | dejas al otro sin vida |

Dos excepciones que merecen la pena:

- **El Minigolf es el único que puntúa a menos.** La dirección `mejor: 'menos'`
  estaba en el contrato desde el principio sin que la usara nadie.
- **En el Pong, ganar y batir el récord son cosas distintas.** En los demás
  juegos de marca, «victoria» ES el récord porque no hay a quién ganar. Ahí sí
  lo hay: se gana el partido a siete, y lo que se guarda es el peloteo más
  largo. Se puede perder 7-3 y firmar la mejor marca de tu vida.

### Los tres ejes por los que sube la dificultad

No todos los juegos aprietan por el mismo sitio, y conviene elegirlo a
conciencia al escribir uno nuevo:

| Eje | Quién lo usa | Qué se siente |
|---|---|---|
| **Dentro de la partida, con final** | ⛳ Minigolf (diez hoyos) | un recorrido con principio y fin |
| **Dentro de la partida, sin final** | 🧱 Ladrillos (muros), 🌋 El suelo es lava, 👾 Invasores (oleadas), The Hole, Runner, Flappy | aguantar hasta que fallas |
| **Con TU nivel** | 🏓 Pong, ⭕ Tres en raya | el rival aprende contigo |

El tercero es el delicado: el récord de un juego que se pone más difícil según
subes deja de ser comparable con el de ayer. Se acepta en el Pong porque un rival
mejor también alarga los peloteos, que es justo lo que se guarda.

### ⛳ Minigolf — la cuesta va por hoyo

El hoyo `n` lleva `n-1` piezas, y el TIPO va entrando escalonado. Par total del
recorrido: **38**. Cada hoyo se da por perdido a los `par + 3` golpes.

| Hoyo | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Piezas | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
| Par | 2 | 3 | 3 | 3 | 4 | 4 | 4 | 5 | 5 | 5 |
| Novedad | muro │ | | muro ─ | bloque | arena | | agua | tope | | |

### 🏓 Pong — la cuesta va por tu nivel

De batible en el 24 a muy fino en el 40, y ahí se queda. La dificultad vive en el
ERROR del rival, no en su velocidad.

| Tu nivel | 24 | 28 | 32 | 36 | 40+ |
|---|---|---|---|---|---|
| Velocidad del rival | 560 | 675 | 790 | 905 | 1020 px/s |
| Falla al sacar | 36 % | 25 % | 10 % | 0 % | 0 % |
| Falla con la pelota al tope | 55 % | 49 % | 43 % | 34 % | 22 % |

Tu pala va a 1150 px/s: **siempre eres más rápido que la máquina**.

### 🌋 El suelo es lava — la cuesta va por segundos

Todo se hunde más deprisa según pasa el tiempo (`HUNDE_POR_PARTIDA`), y lo que
decide si esto es un juego o una encerrona es **cuánto dura el bloque que estás
pisando**:

| Bloque | Vacío, al empezar | Pisado, al empezar | Vacío a los 60 s | Pisado a los 60 s |
|---|---|---|---|---|
| El de salida (183 px) | 10,5 s | **5,9 s** | 4,4 s | 2,0 s |
| Uno bajo (83 px) | 6,3 s | 3,4 s | 2,1 s | 0,9 s |
| Uno alto (432 px) | 17,6 s | 10,4 s | 9,3 s | 4,4 s |

La primera versión dejaba el de salida en **tres segundos** —medido, no estimado—
y no daba tiempo ni a mirar dónde saltar. Con seis, se elige; a los sesenta
segundos, se reacciona. Esa es toda la cuesta.

> **Y una lección de `pet/fisica.js` que vale para el próximo juego de
> plataformas:** `paso()` empieza con `if (!vuelo.volando) return`. La física **no
> mueve a la mascota mientras está posada**, así que un bloque que se hunde la
> dejaría flotando en el aire. Hay dos regímenes y se llevan a mano: posada, su
> `y` ES el techo del bloque copiado cada fotograma; en el aire manda `paso`, y
> el `suelo` que se le pasa no es el de la ventana sino el techo del bloque que
> tenga debajo —con eso el aterrizaje, el bote y el `posado` salen gratis—. Sin
> bloque debajo, el suelo es la lava, y ahí se acaba sin tener que matar a nadie
> a mano.

### 🧱 Ladrillos — la cuesta va por muro, y **no se acaba**

Dos cosas suben a la vez: **el tamaño** (una fila más por muro, hasta llenar la
pantalla en el sexto) y **la dureza**, que es la que no tiene techo.

La regla de la dureza es una sola y se repite para siempre: se van convirtiendo
filas **de arriba abajo** al siguiente número de golpes, cuatro muros por vuelta,
y **cuando el muro entero está en ese número, empieza otra vuelta con el
siguiente**.

| Muro | 1-2 | 3 | 4 | 5 | **6** | 7 | 8 | 9 | **10** | 11-13 | **14** | … |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Reparto | todo de 1 | ¼ de 2 | ½ de 2 | ¾ de 2 | **todo de 2** | ¼ de 3 | ½ de 3 | ¾ de 3 | **todo de 3** | van entrando los de 4 | **todo de 4** | sin techo |
| Golpes para limpiarlo | 42-56 | 84 | 126 | 168 | 224 | 252 | 280 | 308 | 336 | 364-420 | 448 | +28 por muro |
| Pelota (px/s) | 780-835 | 890 | 945 | 1000 | 1055 | 1110 | 1165 | 1220 | 1275 | 1330-1400 | 1400 | topa |

En el muro 26 el suelo es de siete golpes; en el 100, de veinticinco. Nadie va a
llegar —tres vidas y ocho minutos y medio—, y ese es justo el punto: **el juego
se acaba porque fallas, no porque se te acaben los muros**.

Los duros van **arriba** a propósito: si estuvieran abajo, el muro se limpiaría de
abajo a arriba de una pasada y nunca habría que apuntar. Arriba obligan a abrirse
un hueco y colar la pelota por él. Y desde el cuarto muro aparecen claros al azar
(10 %), que se lee mucho mejor que uno macizo y abre caminos.

Los puntos por ladrillo salen de una fórmula y no de una tabla, porque la dureza
ya no tiene techo: `5 × d × (d+1)` — 10, 30, 60, 100, 150… Crece más deprisa que
el esfuerzo, que es lo que hace que compense meterse con las filas de arriba.

> **Lo que venía antes**, y por qué se cambió: había tres escalones puestos a mano
> —dos golpes desde el muro 3, tres desde el 6— y ahí se acababa. Como las filas
> también topan en ocho, del muro 7 en adelante lo único que subía era la
> velocidad de la pelota… que topa en el 12. Del 12 en adelante el juego **no se
> ponía más difícil**.

### Los tres relojes

Los tres juegos nuevos llevan un presupuesto propio de **8 minutos y medio**,
porque el préstamo del escenario corta a los diez y lo hace **sin resultado** (ver
`TOPE_PARTIDA_MS` en escenario.js). Perder por lento es una derrota; perder la
partida entera y la marca, un fallo. Al llegar:

- **Minigolf**: los hoyos que falten se dan por perdidos a su tope y se apunta.
- **Pong**: gana quien vaya por delante.
- **Ladrillos**: se cierra con los ladrillos que lleves.

---

## El recorrido del minigolf

Diez hoyos, y **ninguno se repite**: el recorrido entero sale de `ctx.semilla`,
que es distinta en cada partida. Lo que está fijado es la cuesta, no el trazado.

### La cuesta

El número de piezas es literal: **el hoyo `n` lleva `n-1`**. El primero es una
recta para entender el golpe; el décimo tiene nueve cosas por medio. Un hoyo que
crece de uno en uno se nota mientras juegas, y sale más barato que inventarse una
curva de dificultad aparte.

Lo que cambia no es sólo cuántas piezas, es **cuáles**, y van entrando
escalonadas para que cada una se aprenda sola:

| Desde el hoyo | Aparece | Qué hace |
|---|---|---|
| 1 | muro vertical | cruza casi el campo, con hueco arriba o abajo |
| 3 | muro horizontal | corto: se rodea por un lado o por el otro |
| 4 | bloque suelto | rectángulo pequeño, en cualquier sitio |
| 5 | arena | no bloquea, pero frena cuatro veces más que el césped |
| 7 | agua | un golpe de penalización y a repetir desde donde saliste |
| 8 | tope | devuelve **más** de lo que recibe, y nunca deja la bola muerta |

Cada pieza sale con su sitio y su tamaño sorteados, y **hasta el lado al que se
juega**: la salida cae a la izquierda o a la derecha al cincuenta por ciento.
Jugar hacia el otro lado no es el mismo hoyo espejado, porque el brazo con el que
apuntas no es simétrico.

### Las tres reglas que lo mantienen sano

1. **Ninguna pieza sólida cruza el campo entero.** Los muros dejan siempre hueco
   a un lado y los bloques son pequeños, así que el hoyo se alcanza siempre sin
   tener que comprobarlo con un buscador de caminos —que para nueve rectángulos
   sería matar moscas a cañonazos—.
2. **Nada cae encima de la salida ni del hoyo.** Cuando el sorteo lo pone ahí, la
   pieza se descarta en vez de recolocarse: mover una para que no estorbe es como
   acaban amontonándose todas en el mismo sitio, y ese hoyo lleva una menos y ya.
3. **Cupo por tipo y por hoyo**: dos aguas, tres arenas, tres topes. Sin cupo, el
   sorteo puede sacar cinco charcos seguidos, y entonces el hoyo deja de ser
   difícil para ser un peaje —cada agua cuesta un golpe—. Los muros no llevan
   cupo, y por eso son también el recambio cuando otro se agota.

### Cambiar las reglas borra el récord

El paso de cinco hoyos a diez dejó las marcas viejas sin sentido: 24 golpes en
cinco hoyos no se comparan con nada de un recorrido de diez, y sobre todo **no se
pueden batir**, así que el juego se estropea para quien ya lo había jugado.

Para eso está `formato` en el descriptor. Al subirlo, `ProgresoJuegos` borra la
MARCA de ese juego la próxima vez que se carga el guardado —y sólo la marca: las
partidas y las victorias se jugaron de verdad—.

Eso arregla media casa. La fila que ya subió al marcador global sigue allí, y el
servidor sólo acepta mejoras, así que **hay que borrarla a mano** desde el panel
de Supabase antes de publicar:

```sql
delete from public.records where juego = 'minigolf';
```

### El reloj

El préstamo del escenario corta a los diez minutos y lo hace **sin resultado**
(`TOPE_PARTIDA_MS`), así que una ronda de diez hoyos podía acabar tirando la
partida entera. El juego se da a sí mismo **ocho minutos y medio**: al llegar,
cierra él, da por perdidos los hoyos que falten y apunta la marca. Perder por
lento es una derrota; perderlo todo, un fallo.

---

## Artillería: el que dispara manda, también el viento

El último de la escalera, y el que el catálogo señalaba como mejor candidato
porque traía un modo que no existía —por turnos con física compartida— y porque
las tres piezas que necesitaba ya estaban escritas: `salas.js` para los turnos,
`ctx.semilla` para que los dos vean lo mismo, y el mapa de alturas de [The
Hole](#amontonarse) para el terreno.

### La deriva numérica ya estaba resuelta

Era el riesgo apuntado: si los dos lados simulan por separado y uno redondea
distinto, los cráteres acaban en sitios distintos y la partida se parte sin que
nadie se entere.

No hizo falta inventar nada, porque **lo había resuelto el billar**: el que
dispara manda dónde cayó el huevo y cuánto daño hizo, igual que allí manda dónde
acabó cada bola. El otro repite el tiro para verlo —adorno— y luego cava el
cráter donde diga el mensaje. No hay dos simulaciones que comparar: hay una y una
repetición.

**El viento va por el mismo camino.** Sortearlo cada uno con la semilla
funcionaría mientras los dos lados gasten los mismos números en el mismo orden,
que es una promesa que se rompe el día que alguien meta un sorteo en medio. Lo
manda quien dispara, junto con el resultado.

### La mascota aprende, y eso hubo que arreglarlo

La idea era que jugara como juega una persona: tira, ve dónde ha caído y corrige.
La primera versión **sorteaba un fallo nuevo en cada disparo y luego lo
«corregía»**, que es corregir ruido: no converge. Medido, salía *peor* con tres
correcciones que con ninguna.

Lo que sí se puede aprender es un **sesgo**: se sortea uno al empezar la partida
y baja con cada tiro. Es además lo que le pasa a una persona —no sabes cuánto
empuja el viento hasta que ves caer el primero—. Encima queda un temblor que no
se corrige nunca, y que baja poco con el nivel: lo que mejora es el sesgo, no el
pulso.

| nivel | fallo del 1.er tiro | del 2.º | del 3.º | del 4.º | tiros que hacen daño |
|---|---|---|---|---|---|
| 68 | 188 px | 121 | 93 | 81 | 54 % |
| 80 | 160 | 92 | 75 | 72 | 61 % |
| 95 | 108 | 69 | 71 | 74 | 67 % |
| 110 | 72 | 66 | 69 | 74 | 74 % |

### Y un número que no era un número de dificultad

Con el disparo más fuerte a 1150 píxeles por segundo, el alcance de la parábola
—`v²/g`— eran 1469 píxeles y las dos mascotas están a 1460. Justo, justo. Con
viento de cara **no llegaba ningún disparo**, y la búsqueda de la mascota daba
248 píxeles de error medio: parecía que apuntaba mal y lo que pasaba es que no
existía un tiro bueno. Con 1450 el alcance sube a 2336 y el error medio baja a
**15 píxeles**.

Es el tipo de cosa que se ve en una tabla y no jugando: jugando sólo se nota que
«la mascota es un poco tonta».

### Probado a dos, de principio a fin

Diez duelos con dos instancias de verdad hablándose por una sala de mentira, y
con **pantallas de tamaños distintos**: diez de diez coherentes, las vidas
reflejadas exactas y el viento idéntico en las dos. De ahí salieron dos
descuadres que no se ven de otra forma: el marcador se quedaba una jugada
retrasado al acabar, y el que disparaba cambiaba el viento *después* de mirar si
alguien había muerto mientras el que recibía lo cambiaba *antes*.

---

## «Angry {mascota}»: una viga sin apoyo no se vence, se parte

### El riesgo estaba escrito antes de empezar

El catálogo avisaba: «que se parezca demasiado a Pato Hook. Si los derrumbes no
se disfrutan, es Pato Hook con decorado». Y el lanzamiento es, literalmente, el
de [Pato Hook](#-pato-hook): mismo `limitarLanzamiento`, mismo `arrancarVuelo`,
misma forma de apuntar. Eso es a propósito —quien sabe lanzar a su mascota ya
sabe jugar— pero obliga a que lo nuevo esté entero en la otra mitad:

> **En «Pato Hook» el tiro ES el juego. Aquí el tiro es la mitad: lo que cuenta
> pasa DESPUÉS de que la mascota se pare.**

De ahí sale todo. Las gaviotas están metidas en la estructura, casi nunca a tiro
directo, y la mayoría caen porque les cae encima lo que sostenía la columna que
has roto. La decisión no es «dónde está el bicho» sino «qué quito para que se le
venga el techo».

### El problema que no se ve hasta que dibujas el primer nivel

El plan era el del catálogo: rejilla de cajas, sin rotación, y lo que se queda
sin apoyo cae a plomo. Y no basta:

> **Una viga apoyada en dos columnas no puede caer nunca.** Le quitas una columna
> y la otra sigue justo debajo, así que no tiene sitio donde caer. En un motor de
> cuerpos rígidos se vencería hacia el lado vacío; sin rotación se queda ahí
> colgada y el derrumbe no ocurre.

La salida no es añadir rotación —eso es el motor entero que se decidió no
escribir en [§Amontonarse](#amontonarse)— sino cambiar qué hace una viga cuando
se queda sin apoyo: **se parte**. Una pieza de más de una casilla se rompe en
trozos de una, y cada trozo cae por su cuenta: los que estaban sobre el hueco se
van abajo y aplastan lo que haya, los que quedaban sobre la columna que aguanta
se quedan. Es lo que hace una viga de verdad, se lee de un vistazo, y da la
cadena entera sin un solo iterador de impulsos.

### Y la regla de apoyo, que se equivocó primero

**El centro de la pieza tiene que caer entre el apoyo más a la izquierda y el
más a la derecha.** Es la condición de verdad de una viga —si el centro de masas
se sale de los apoyos, vuelca— y con piezas uniformes no hace falta nada más.

La primera versión decía «por el centro, o por los dos extremos». Suena parecido
y no lo es: con eso una viga larga sobre varias columnas no se venía abajo por
mucho que le quitaras, porque siempre le quedaba el centro o los dos extremos.

### Medido, que es como se encontró

El derrumbe vive **fuera** de `crearPartida`, en funciones puras, por lo mismo que
la física del [billar](#8-pool-el-único-sitio-donde-la-física-exacta-sale-bien):
dentro del cierre no se puede comprobar sin abrir una ventana, y mirar no es
medir. Montando las diez estructuras en Node y rompiendo cada pieza de madera una
por una salieron tres fallos que jugando habrían tardado semanas:

| Con la regla vieja | Con la nueva |
|---|---|
| Dos estructuras se derrumbaban **solas**, sin tocarlas | Ninguna |
| En dos, romper madera no derribaba **ni una** gaviota | En nueve de diez, un solo golpe las derriba todas |
| Las generadas: **más grandes eran más fáciles** | Crecen en torres sueltas, y cada una pide su tiro |

Lo último merece explicación. El generador subía la dificultad haciendo torres
más altas, y una torre alta es un castillo de naipes: un golpe en la columna de
abajo se llevaba las nueve gaviotas. La cuesta iba hacia abajo. Ahora lo que
crece es **cuántas torres separadas hay**: con cuatro tiros por estructura y tres
torres, hay que acertar tres veces.

### La cuesta

Diez estructuras dibujadas a mano y, a partir de ahí, generadas. Los ladrillos ya
enseñaron que un juego con techo se acaba, y una marca con tope de diez la empata
todo el mundo. Las de a mano enseñan; las generadas no se acaban.

---

## 8 Pool: el único sitio donde la física exacta sale bien

### Por qué aquí sí

En este proyecto la física de cuerpo contra cuerpo ha dado siempre problemas.
[The Hole](#amontonarse) tiembla porque la gravedad empuja el montón unos contra
otros indefinidamente. Por eso el minigolf tiene UNA bola y no hay ningún juego
de apilar.

El billar es la excepción, y conviene saber por qué antes de copiarlo a ningún
sitio: son círculos **del mismo tamaño**, **sin gravedad**, en un plano y **sin
contactos en reposo**. En esas condiciones el choque elástico entre dos discos
iguales no necesita solucionador: se descompone la velocidad en la línea que une
los centros, se intercambian las componentes normales —masas iguales— y las
tangenciales se quedan como estaban. Son cuatro líneas, y son exactas.

Todo lo que hace difícil un motor de física de verdad —masas distintas, gravedad,
pilas que se sostienen, fricción de contacto— aquí no existe.

### El banco de pruebas, que es la mitad del trabajo

La física **no vive dentro de `crearPartida`**: está en funciones de módulo puras
que reciben las bolas, el campo y las troneras y no saben nada de la partida. No
es manía de orden. Encerrada en el cierre no habría forma de medirla sin abrir
una ventana, y con dieciocho constantes que ajustar eso son tardes de mirar.

Con ellas fuera se corren quinientas aperturas en Node en unos segundos, y aún
mejor: el contrato de un juego de escenario es tan pequeño que **se puede cumplir
a mano**. Una pista de mentira con un pintor que no pinta y un ratón que se mueve
por programa, y ya se juegan partidas enteras sin ventana —incluidas **dos
instancias en red, una contra otra**, que es algo que hasta ahora no se había
probado nunca de principio a fin en este proyecto—.

Lo que sacó esa medición, y que jugando no se habría encontrado en semanas:

| Lo medido | Lo que salió |
|---|---|
| Bolas fuera de la mesa | **214 fugas en 300 aperturas** con el paño rápido |
| Aperturas secas, ápice en 0,68 | 98 % |
| Aperturas secas, ápice en 0,79 | **89 %** |
| Lo que tarda en pararse la mesa más revuelta | 5,8 s (el tope de repetición son 8) |
| Tiros a toda velocidad que atraviesan una bola | 0 de 300 |

**Las fugas eran un fallo de verdad.** Venían de apagar la banda cerca de la
boca, por miedo a que la bola rebotara justo antes de colarse. Y el truco
sobraba: la captura se mira ANTES que la banda y la boca es más ancha que el
radio de la bola, así que rodando pegada a la banda hacia la esquina el centro
entra en la boca cuando todavía le faltan once píxeles para tocar la otra. Con la
banda puesta se gana además la mandíbula: la bola que llega abierta rebota y se
queda ahí, que es lo que hace en un billar.

**Y el triángulo al fondo no es adorno**: es la banda corta la que devuelve las
bolas hacia las troneras, que es exactamente por lo que en una mesa de verdad el
triángulo se pone donde se pone.

### La cuesta, que aquí es un rival

Como en el Pong: en un juego de dos no hay «más ladrillos», hay alguien que falla
menos. La mascota busca la **bola fantasma** —dónde tiene que estar la blanca en
el momento del contacto para que la suya salga hacia la tronera—, descarta los
cortes de más de 72° y los caminos con algo por medio, y lo que la hace fallar es
el desvío, no el cálculo: 0,075 radianes al nivel 55 y 0,012 al 100. Nunca cero.
Una mascota que no falla jamás no es un rival, es un muro.

Medido contra un jugador que tira al azar: al nivel 55 baja hasta una o cinco
bolas por meter; al 100 **limpia su grupo entero** y cierra con la negra.

### El tiempo agotado, en red, es empate

Contra la mascota gana quien lleve menos bolas por meter. En red, no: es empate.

Los dos lados no cuentan el reloj a la vez, así que uno puede cerrar con la
última tacada del otro todavía viajando —medido: dos tableros separados por una
bola—. Contar las que quedan daría victoria en una pantalla y empate en la otra,
y **un resultado que no cuadra entre las dos es peor que un empate romo**.
Arreglarlo de verdad pediría un apretón de manos al final que el protocolo no
tiene, y no lo merece un caso que sólo pasa cuando los dos han jugado ocho
minutos y medio sin llegar a la negra.

Lo que sí se arregló: el reloj **no corta a mitad de una tacada**. Espera a que la
mesa esté quieta y no quede nada del rival por aplicar. Con eso, los tableros de
los dos lados coinciden bola a bola —doce partidas de doce, y con pantallas de
tamaños distintos—.

### Las reglas que se quedaron fuera

- **Bola en mano.** Es lo que manda el reglamento tras una falta, y costaría una
  interfaz para colocarla y —peor— enseñarle a la mascota a usarla. La blanca
  vuelve a la cabecera, que es variante de billar de toda la vida y castiga igual.
- **La banda obligatoria tras el contacto.** Existe para que no se pueda jugar a
  no hacer nada, y contra una mascota que siempre intenta meter no hace falta.
- **Cantar la tronera.** Es un paso más en cada tiro de un juego que ya tiene
  bastantes.

---

## Hundir la flota: la revelación de verdad

### Las medidas, que aquí no son gusto

Un 10 × 10 no cabe: el tablero de un juego de panel no pasa de **280 × 300 px**, y
ahí una casilla saldría a 26 píxeles con las etiquetas. Y cien casillas por mar
son una partida larga, que es justo lo que un minijuego no debe ser.

**7 × 7, y flota de catorce casillas**: 4, 3, 3, 2, 2. Y los dos mares en
**pestañas**, porque dos rejillas de siete en alto no entran una encima de otra en
300 píxeles, y encogerlas hasta que entren deja un juego donde no se acierta a
pulsar.

Los barcos no pueden ir pegados: dos que se toquen se leen como uno solo, y
hundir el primero delataría al segundo sin haberlo buscado.

### Lo que estrena de verdad

El ahorcado estrenó el compromiso para una palabra. Aquí es para un tablero, y
con la vuelta que le faltaba:

1. Al empezar, cada uno manda el **hash** de `sal:flota`. La flota no viaja.
2. Cada tiro se contesta con agua, tocado o hundido.
3. Al acabar, los dos revelan. Y **no basta con que el hash cuadre**: eso sólo
   dice que el tablero no ha cambiado. Se **recomprueban todas las respuestas que
   dio** contra el tablero que revela, así que un tablero legítimo con una sola
   casilla mentida se caza igual, y se dice en qué casilla.

Sin un servidor que juegue la partida no se pueden impedir las trampas. Se pueden
dejar en evidencia, que entre amigos es lo que hace falta.

### La marca sólo se apunta al ganar

`disparos`, y **a menos**. Apuntarlos en una derrota registraría como récord el
haber tirado poco *porque te hundieron antes*. El contrato ya lo permite: `puntos`
es opcional en el resultado, y `ProgresoJuegos.anotar` sólo toca la marca cuando
llega un número. Es el primer juego que lo aprovecha.

---

## El ahorcado: a dos, y sin que nadie vea la palabra del otro

### Por qué a dos, si la tabla decía «2+»

Porque **`salas.js` está cableado a dos jugadores**, y no de refilón: hay un
único `sala.rival` y los doce envíos del módulo van a `sala.rival.clave`.
`sala.jugadores` es sólo una lista de nombres para enseñar.

Pasar de ahí no es añadir un bucle. Son **secuencias, confirmaciones, reenvíos y
plazos de ausencia por jugador**; un vestíbulo en vez de un reto, con aceptaciones
parciales; y que irse a mitad deje de ser el final de la partida y pase a ser
«seguid sin mí». Es reescribir el módulo más delicado del proyecto —el de la
máquina de reconexión que costó afinar— por un solo juego. El «2+» era
aspiracional; queda anotado que no se hace y por qué.

### Los dos proponen a la vez

Por turnos de verdad —uno propone, el otro adivina, y luego al revés— la mitad de
la partida es mirar. Así que las dos palabras se ponen a la vez y cada uno
adivina la del otro por su cuenta. No hay tiempos muertos, y contestar a las
letras del rival se puede hacer siempre, porque tu palabra la tienes tú.

Gana quien la saque con menos fallos; sacarla gana a no sacarla.

### El compromiso, que aquí sí se usa

`protocolo.js` trae `compromiso()` y `cumpleCompromiso()` desde el principio,
escritos para esto y sin estrenar hasta ahora. El que propone **no manda la
palabra**: manda su largo y el hash de `sal:palabra`. Después contesta a cada
letra con las posiciones donde está, y sólo al final revela palabra y sal.

| Mensaje | Lleva |
|---|---|
| `palabra` | `largo`, `prometido` — nunca la palabra |
| `letra` | la letra que se pide |
| `donde` | la letra y las posiciones donde estaba |
| `resultado` | `fallos`, `acerte` |
| `revelo` | `palabra`, `sal` — al terminar |

Sin esto la palabra viajaría al empezar y estaría en la memoria de quien tiene
que adivinarla: una pestaña de herramientas y se acabó el juego. Y con esto,
además, tampoco se puede ir cambiándola sobre la marcha para que no se acierte
nunca. Mentir sigue siendo posible; queda en evidencia, que entre amigos basta.

### El dibujo ES el contador

Los seis fallos son exactamente los seis trazos del muñeco —cabeza, cuerpo, dos
brazos y dos piernas—, así que cambiar `FALLOS` es cambiar `TRAZOS`. Las cuatro
maderas —base, poste, viga y cuerda— están desde el principio: son el escenario,
no la cuenta.

Va en **SVG y no en un lienzo** porque no hay nada que animar: son diez trazos
fijos y lo único que cambia es cuántos se ven. Se muestran con `visibility` y no
con `hidden` —que en SVG no pinta nada— ni con `display`, que reflowía el dibujo
entero en cada fallo.

### Dos detalles que costaron una pasada

- **`descubiertas` guarda la LETRA de cada hueco, no un sí/no.** Con booleanos no
  basta: por red este lado no tiene la palabra —de eso va el compromiso— y al
  acertar no sabría cuál pintar. Salía `_ ? _ _ ?`.
- **La Ñ se aparta antes de normalizar.** En NFD se descompone en N + virgulilla,
  y quitar los diacríticos convertiría «AÑO» en «ANO».

---

## Minigolf por turnos, y por qué el Pong no

Es el primer juego de **escenario** que se juega en red, y salió barato por dos
cosas que ya estaban ahí sin haberlas puesto para esto:

1. **El recorrido sale entero de `ctx.semilla`**, que en red reparte el
   anfitrión. Misma semilla, mismo campo en las dos máquinas.
2. **Y está en proporciones, no en píxeles.** Da igual que uno juegue en un
   monitor de 1920 y el otro en un portátil: el hoyo cae en el mismo sitio
   relativo. Por eso **todo lo que viaja por la red viaja en proporciones** y se
   convierte al llegar.

### Cómo se juega

Cada uno con su bola en el mismo hoyo y golpes alternos. Quien emboca —o llega
al tope— se queda mirando mientras el otro termina, y cuando los dos han acabado
pasan de hoyo a la vez. Gana quien acabe los diez con menos golpes.

Quién abre cada hoyo sale de la paridad (`anfitrion === (hoyo % 2 === 0)`): los
dos lados llegan a lo mismo sin mandarse nada, que es la clase de acuerdo que no
se rompe.

### Lo que viaja: un mensaje por golpe

```
{ t:'golpe', h, sx, sy, vx, vy, x, y, g, gt, fin }
```

**El que golpea manda DÓNDE acabó su bola, no sólo con qué fuerza la tiró.** La
física es determinista y el campo es el mismo, pero el `dt` de cada máquina no lo
es, y dos integraciones con pasos distintos acaban separándose. Así que la
posición final es autoritativa: el otro lado **repite** el golpe con la misma
física —para que se vea el recorrido y no una línea recta que atraviesa un muro—
y al parar clava la bola donde diga el mensaje.

Lo que no se repite es lo que cuesta golpes: el agua y el hoyo ya los resolvió la
máquina de quien tiró, y vienen dados en el `fin`.

El ritmo cabe de sobra:

| Ronda | Mensajes de los dos | Del presupuesto (`RITMO_MAX` = 4/s) |
|---|---|---|
| Al par | 76 | 5 % |
| Normal | 110 | 8 % |
| La peor posible | 136 | 9 % |

### Y el Pong se queda en solo

Se estudió y no sale. El transporte se autolimita a **cuatro mensajes de juego
por segundo** —de los diez del cliente Realtime, dejando seis para el chat, que
es lo que no puede romperse—. Con la pelota entre 560 y 1180 px/s:

| | Mensajes/s | Cada | La pelota se mueve |
|---|---|---|---|
| Hoy | 4 | 250 ms | 140-295 px |
| Robándole todo al chat | 10 | 100 ms | 56-118 px |
| Lo que pide un Pong | 30 | 33 ms | 19-39 px |

La pelota mide 18 px y la pala 80. Y hay tres cosas más, cada una un problema
por sí sola: el canal es **compartido** por todos los patos, `protocolo.js` está
hecho al revés de lo que hace falta —confirma y reintenta, cuando en tiempo real
lo que quieres es tirar lo viejo—, y harían falta predicción y reconciliación.

**Es posible, pero es otra arquitectura**: canal propio por sala, protocolo no
fiable y predicción. Por un juego, no compensa —y el Pong ya tiene rival—.

---

## El rival del Pong

Persigue la pelota; **no la predice**. Es lo más tonto que puede hacer una
máquina de Pong, y a propósito: con la pelota rebotando entre las bandas, quien
persigue la posición de ahora llega siempre un poco tarde y se queda del lado
equivocado del bote. Predecir el punto de llegada —que son cuatro líneas— la
volvería infalible de golpe.

Encima de eso, dos limitaciones:

- **Velocidad**, de 560 px/s en el nivel 24 a 1020 en el 40. Tu pala va a 1150,
  así que siempre eres más rápido.
- **Error de puntería**, que es donde vive de verdad la dificultad. Un rival
  lento no falla: sencillamente no llega, y eso se ve y no tiene gracia.

### El error tiene dos sumandos, y el segundo es el que importa

```
error = alto de pala × (0,50 − maña × 0,46 + rapidez de la pelota × 0,60)
```

El primer sumando es la dificultad según tu nivel. El segundo es **lo que hace
que un punto termine**, y sin él esto no funcionaba: a partir del nivel 32 el
error caía por debajo de media pala —o sea, la máquina no fallaba nunca— y como
además llegaba siempre a tiempo, el peloteo no se acababa. Medido antes de
arreglarlo: **0-0 con sesenta y dos golpes y subiendo**, hasta que cortó el reloj.

Con el segundo sumando, la pelota acelera 22 px/s por golpe y hasta el rival más
fino falla una de cada cinco cuando llega arriba. El punto se acaba porque la
pelota va demasiado deprisa para leerla, que es como se acaban los puntos en un
Pong.

| Tu nivel | Falla al sacar | A media velocidad | Con la pelota al tope |
|---|---|---|---|
| 24 | 36 % | 47 % | 55 % |
| 32 | 10 % | 30 % | 43 % |
| 40 | 0 % | 0 % | 22 % |

Probado con dos bots que leen el lienzo para localizar la pelota. Uno perfecto
—mueve el ratón a la pelota cada fotograma— gana 7-0 a cualquier nivel, y eso no
dice nada: un rastreador perfecto gana siempre a cualquier Pong. El que sí dice
algo es el otro, con 180 ms de reacción y ±34 px de error, que en el nivel 25
acabó **6-5**.

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
| 11 | 20 | ⛳ Minigolf | puntería fina y medir la fuerza | 8 | 900 |
| 12 | 24 | 🏓 Pong | reflejos contra un rival | 11 | 1075 |
| 13 | 28 | 🧱 Ladrillos | Pong con puntería | 14 | 1250 |
| 14 | 33 | 🌋 El suelo es lava | dos ejes y ritmo | 17 | 1475 |
| 15 | 38 | 👾 Invasores | reflejos y disparar | 21 | 1700 |
| 16 | 43 | 🔤 Ahorcado | vocabulario | 25 | 1925 |
| 17 | 49 | 🚢 Hundir la flota | deducción, partidas largas | 31 | 2200 |
| 18 | 55 | 🎱 8 Pool | tacto para la física | 36 | 2475 |
| 19 | 61 | 🏹 «Angry Pato» | puntería y leer estructuras | 42 | 2750 |
| 20 | 68 | 💥 Artillería | todo junto | 49 | 3050 |

Los días son de uso normal —unas 736 XP diarias entre convivencia, cuidados,
racha, chat y el tope de partidas—. **Están los veinte.** La escalera se cerró con
la artillería en la 0.35.0.

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

## Los que faltan: ninguno

**La escalera está completa.** Los veinte juegos aprobados están hechos, del
piedra-papel-tijera de nivel 1 a la artillería del 68, y el contrato aguantó los
veinte sin ampliarse: sigue siendo `crearPartida(ctx)` devolviendo `{el, destroy}`
o `{actualizar, destroy}`, como el primer día.

Lo único que se le añadió por el camino fue una **regla**, no una capacidad: la
cuarta, la de no declarar nada después del `return` (ver arriba), que salió de
haberse pegado el mismo tortazo tres veces.

El [ranking entre patos](#-ranking-entre-patos--hecho-en-la-0170) no está en esta
cuenta porque no es un juego, y además ya está hecho.

## Los cuacks: la moneda

**Hecha, en la 0.18.0**, y la regla de no quitarle nada a nadie en la 0.19.0.
Se deja escrito el razonamiento entero porque es lo que gobierna el precio de
cada juego nuevo.

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

### 🌐 Ranking entre patos — **hecho**, en la 0.17.0

**Global, permanente y para todos.** Se descarta la opción barata —anunciar las
marcas por el canal y quedarse con lo que se oyó mientras estabas conectado— y se
va a una **tabla en Supabase con RLS**. Es un cambio de arquitectura y conviene
decirlo entero antes de empezar: hasta hoy el proyecto usa de Supabase **sólo
Realtime**, que es un tubo por el que pasan mensajes y no guarda nada. Con la
primera tabla entran el esquema, las políticas de acceso y una identidad.

### Cómo quedó

| Pieza | Dónde |
|---|---|
| La tabla, la vista y la función | [`supabase/records.sql`](../supabase/records.sql), ya ejecutado en el panel |
| El secreto con el que se firma | `settings.recordSecreto`, al lado del `patoId` (ver [`main/store.js`](../src/main/store.js)) |
| El cliente del escritorio | [`main/marcador.js`](../src/main/marcador.js), con `fetch` a pelo |
| El gemelo de la extensión | dentro de [`extension/sw.js`](../src/extension/sw.js) |
| El contrato | `marcadorGlobal` y `marcador` en [`core/platform.js`](../src/core/platform.js) |
| La pantalla | dentro de 🏅 Tus récords: las filas con 🌐 llevan al marcador |
| La comprobación | `npm run marcador` |

> **El dueño de una fila es el sha256 del secreto, no el `patoId`.** Se corrigió
> antes de publicar: el `patoId` viaja en la presencia del canal, así que
> cualquiera podía ver el de otro y reclamar sus filas ANTES que él, para
> siempre. El secreto no sale nunca de la carcasa.

### La tabla y sus reglas

Están en [`supabase/records.sql`](../supabase/records.sql), que es idempotente:
se puede volver a lanzar entero las veces que haga falta.

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

> **Lo único que hubo que hacer a mano**, porque no lo puede hacer el pato: pegar
> ese SQL en el panel y darle a «Run». La clave que lleva la app es la
> publicable, y con ésa no se crean tablas ni funciones. Al añadir algo al
> esquema, lo mismo.

Para comprobar que quedó bien: **`npm run marcador`**. Se conecta con la misma
clave publicable que lleva la app, así que verifica exactamente lo que va a poder
hacer un pato. Y **no escribe nada**, que no es prudencia sino consecuencia del
diseño: con esta clave no se puede borrar una fila —ni la propia—, así que una de
pruebas se quedaría en el marcador de todo el mundo para siempre. La puerta de
escritura se comprueba llamándola mal a propósito, que es un camino que responde
sin tocar la tabla.

### En la interfaz

Vive dentro de [Tus récords](#-tus-récords--hecho): cada fila de un juego con
marca lleva al marcador de todos, y lo dice con un 🌐 al final. Esa pista se
añadió después, en la 0.17.0, porque sin ella el marcador **estaba y no se
encontraba**: la única puerta era pulsar la fila, y lo único que lo delataba era
el cursor al pasarle por encima. Nadie pasa el ratón por una lista que ha venido
a leer.

Los nombres los escribe otra gente, así que **`textContent` siempre**, como en el
chat.

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
