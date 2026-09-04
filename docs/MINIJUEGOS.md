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
| 🏓 «Pato Jumping» | 9 | solo | escenario |
| 🎯 «Pato Hook» | 12 | solo | escenario |
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
3. Ya está. El panel de selección, el candado por nivel, la experiencia, el
   progreso guardado y el aviso al subir de nivel salen todos de esa lista.

```js
{
  id: 'ahorcado',              // no se renombra NUNCA: da nombre al fichero
  nombre: 'Ahorcado',          //   y al progreso guardado
  icono: '🔤',                 // un emoji: nada de arte que empaquetar
  descripcion: 'Uno piensa la palabra y los demás la adivinan.',
  nivel: 4,                    // a qué nivel se desbloquea
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
- `__pato.probarEscena({revienta: true})` — presta el escenario a un juego que
  falla, para comprobar que el pato vuelve igualmente

Y en la extensión, la prueba que sólo se puede hacer ahí: abrir una partida sobre
una página cualquiera y **cambiar de pestaña a mitad**. El pato se muda; no debe
quedar ni un bucle ni un error en la consola.

---

## La escalera

Los juegos se reparten **hasta el nivel 50**, no hasta el 10. El motivo es de
uso: hay gente que lleva meses con el pato y ya no tiene nada que desbloquear,
así que la cuesta se estira y las piezas grandes se ponen arriba del todo.

Lo que cuesta llegar, con un día activo normal (unas 736 XP entre convivencia,
cuidados, racha, chat y el tope diario de partidas):

| Nivel | 4 | 8 | 12 | 16 | 21 | 28 | 32 | 40 | 50 |
|---|---|---|---|---|---|---|---|---|---|
| Días | 0,6 | 2 | 4 | 6 | 9 | 14 | 17 | 23 | 32 |

Los niveles se eligen para que **caiga algo cada dos o tres niveles al principio
y cada cinco o seis al final**, alternando con los diseños de
[`skins.js`](../src/core/game/skins.js), que están en 1, 3, 6, 10 y 15.

La escalera entera, con lo hecho y lo que falta:

| Nivel | | Estado |
|---|---|---|
| 1 | ✌️ Piedra, papel o tijera | hecho |
| 2 | 🔊 «Pato dice» | hecho |
| 3 | 🎲 Par o impar | hecho |
| 4 | 🃏 Memoria | hecho |
| 6 | ⭕ Tres en raya | hecho |
| 8 | 🌵 «Pato Runner» | hecho |
| 9 | 🏓 «Pato Jumping» | hecho |
| 12 | 🎯 «Pato Hook» | hecho |
| 14 | 🪶 «Flappy Pato» | hecho |
| 16 | 🕳️ The Hole | hecho |
| 18 | 🏓 Pong | falta |
| 21 | 🧱 Ladrillos | falta |
| 22 | 🌋 El suelo es lava | falta |
| 24 | 🔤 Ahorcado | falta |
| 26 | ⛳ Minigolf | falta |
| 28 | 👾 Invasores | falta |
| 32 | 🚢 Hundir la flota | falta |
| 36 | 🎱 8 Pool | falta |
| 40 | 🏹 «Angry Pato» | por confirmar |
| 50 | 💥 Artillería | por confirmar |

**Los rangos acompañan.** Se acababan en «Leyenda» al 20, que era el techo de
cuando lo único que se desbloqueaba eran diseños; ahora siguen cada cinco
niveles hasta «Cuack supremo» al 50. Es lo único que se ve en la cabecera del
panel de cuidados y en el aviso de subir de nivel, así que sin eso la mitad del
camino no daba señal ninguna.

> **Al repartir, un juego no debería subir más de lo imprescindible.** Subirlo se
> lo quita a quien ya lo tenía. En este reparto sólo se movieron cuatro —tres en
> raya 5→6, paleta 7→9, puntería 8→12 y The Hole 9→16, que es el más largo de
> todos y estaba demasiado abajo—. El progreso guardado NO se pierde aunque el
> juego se vuelva a bloquear: `ProgresoJuegos.toJSON` no filtra por catálogo, y
> es a propósito.


---

## Los que faltan

Aprobados y por hacer, cada uno su propia tarea. El contrato está dimensionado
para todos: ninguno pide ampliarlo.

| Juego | Nivel | Modos | Superficie | Lo que estrena |
|---|---|---|---|---|
| 🏓 Pong | 18 | solo | escenario | la mascota ES la pala, y enfrente hay otra |
| 🧱 Ladrillos | 21 | solo | escenario | un muro que se rompe, sobre el Pong |
| 🌋 El suelo es lava | 22 | solo | escenario | plataformas que se mueven y se hunden |
| ⛳ Minigolf | 26 | solo | escenario | el primero que puntúa a MENOS |
| 🔤 Ahorcado | 24 | red (2+) | panel | uno propone y los demás adivinan por turnos; teclado en el panel |
| 👾 Invasores | 28 | solo | escenario | disparar hacia arriba, y algo que baja |
| 🚢 Hundir la flota | 32 | red (2) | panel | compromiso y revelación de verdad: el tablero secreto |
| 🎱 8 Pool | 36 | solo · red (2) | escenario | choques entre bolas: el único caso donde la física exacta sale bien |

Y tres [por confirmar](#en-el-tintero): «Angry {mascota}» (nivel 40), artillería
por turnos (nivel 50) y el ranking entre patos, que no es un juego sino una
decisión de arquitectura.

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

### 🌐 Ranking entre patos — necesita una decisión antes

Aquí es donde hay que elegir, y la elección es de arquitectura, no de interfaz.

**Hoy no hay servidor propio.** Ni `chat.js` ni `sw.js` usan de Supabase nada más
que Realtime, que es un tubo por el que pasan mensajes y no guarda nada. Con eso,
un «ranking» es en realidad **un ranking de la sesión**: cada pato anuncia sus
marcas al conectarse, y cada uno ve lo que se anunció mientras él estaba
delante. Nadie ve a quien no coincidió con él, nada sobrevive a cerrar el pato, y
**nada es verificable**: quien quiera decir que ha hecho un millón, lo dice.

- **Opción A — el de la sesión.** Se puede entregar tal cual, con el nombre de
  quien declara cada marca al lado y dicho en voz alta que es de la sesión. Coste
  bajo: reutiliza el evento dirigido del canal, como las visitas y las jugadas.
  Sirve para picarse entre dos que están conectados a la vez, que es el 90 % del
  uso real.
- **Opción B — el de verdad.** Una tabla en Supabase con RLS: cada pato escribe
  sus marcas y lee el top. Persiste, es global y aguanta cerrar la app. Coste
  alto y **cambia la arquitectura**: hoy el proyecto no tiene ni una tabla, y con
  la primera entran las migraciones, las políticas de acceso y un modo de
  identificar al pato que hoy no existe más allá del `patoId` local. Tampoco
  arregla lo de las trampas: sin servidor que valide la partida, quien manda la
  marca es el cliente.

**Recomendación:** hacer primero *Tus récords*, que es gratis y resuelve la
pregunta que más se hace («¿cuál era mi mejor?»). Y si después se quiere el
ranking, ir por la **opción A** etiquetada con honestidad; la B sólo si el
marcador se convierte en el motivo por el que se abre el pato.

---

## En el tintero

Ideas con forma pero sin aprobar. Se apuntan con lo que costarían, que es la
mitad de la decisión.

### 🏹 «Angry {mascota}» (tipo Angry Birds) — nivel 40

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
- **Recomendación:** después del de artillería, y sólo si al jugar a «Pato Hook» se
  echa de menos que las cosas se rompan.

### 💥 Artillería (tipo Worms) — nivel 50

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
- **Recomendación:** es el mejor candidato a juego de nivel 50. Un arma sola —el
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

   Lo que **no** se negocia son las salidas involuntarias, y son las que
   convierten esto en una broma y no en un secuestro:

   - El **tope de diez minutos** de `escenario.js`: se acaba sola, se resuelva o
     no.
   - El **icono de la bandeja**, junto al reloj. La franja de la barra de tareas
     [nunca captura el ratón](#juegos-de-escenario), tampoco durante la broma, así
     que se puede cerrar el pato desde ahí en cualquier momento.
   - El **apagado del pato** y el **fallo del propio juego**.

   Y el peaje está hecho para poder pasarlo: fallar repite LA MISMA cuenta —ni
   reinicia ni castiga—, no hay reloj, y hay un botón de «Vale, sigo» para
   cerrarlo y seguir jugando.
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
