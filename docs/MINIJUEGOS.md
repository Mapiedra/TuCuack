# Minijuegos

El pato tiene juegos. Se desbloquean por nivel, igual que los diseños, y se
abren desde `🎮 Juegos` en el menú del pato.

| Juego | Nivel | Modos | Superficie |
|---|---|---|---|
| ✌️ Piedra, papel o tijera | 1 | solo · red (2) | panel |
| 🔊 «Pato dice» | 2 | solo | panel |
| 🎲 Par o impar | 3 | solo · red (2) | panel |
| ⭕ Tres en raya | 5 | solo · red (2) | panel |
| 🏓 Toques con la paleta | 7 | solo | escenario |

La lista va de menos a más, y el nivel acompaña: primero los de decidir en un
segundo, después los de pensar, y al final los que piden pulso. Queda hueco por
delante para [los que faltan](#los-que-faltan).

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
el suelo y la pantalla entera. El que hay es
[**toques con la paleta**](../src/core/game/minijuegos/paleta.js), y sirve de
ejemplo de todo lo que sigue.

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
`entrada` (ratón con inercia y teclas), `marcador(texto)` y `salir()`.

Dimensiona con **`medidas.patoAncho`**, no en píxeles absolutos: un juego medido
a ojo sale distinto en el overlay de 1920 px y en el panel lateral de 350.

Para colisiones con el pato usa **`pato.cuerpo()`** (un círculo), no `hitTest`:
`hitTest` no deshace la rotación del vuelo, cuesta un `getImageData` por consulta
y deja que algo rápido atraviese al pato entre dos fotogramas.

Estos juegos sólo se ofrecen donde el pato tiene la pantalla para él
(`capacidades.juegosDeEscenario`): escritorio, panel lateral y banco de pruebas.
Sobre una página ajena, no.

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

## Los que faltan

Aprobados y por hacer, cada uno su propia tarea. El contrato está dimensionado
para todos: ninguno pide ampliarlo.

| Juego | Nivel | Modos | Superficie | Lo que estrena |
|---|---|---|---|---|
| 🕳️ El agujero | 9 | solo | escenario | varios cuerpos con la física a la vez; progresión dentro de la partida |
| ⚠️ No tocar | — | — | escenario | no es un juego: ver §*La broma* |
| 🎯 Puntería | 8 | solo | escenario | apuntar y soltar, sin nada que se mueva solo |
| 🔤 Ahorcado | 6 | red (2+) | panel | uno propone y los demás adivinan por turnos; teclado en el panel |
| 🚢 Hundir la flota | 11 | red (2) | panel | compromiso y revelación de verdad: el tablero secreto |
| 🃏 Memoria con skins | 4 | solo · red (2) | panel | las hojas de sprites como material de juego |
| 📈 Marcador de récords | — | — | — | no es un juego: ver §*Marcador global*, abajo |

### 🕳️ El agujero

Caen mascotas desde arriba y el ratón lleva un agujero por el suelo. La que cae
dentro, cae dentro. La que no, se queda en el suelo y **ahí se queda**.

Es el hermano de la paleta —escenario, ratón, física— con el signo cambiado: allí
se trata de que la mascota no toque el suelo rebotando; aquí, de que no lo toque
porque se la ha tragado el agujero. Y donde la paleta cuenta toques sueltos, éste
tiene una partida con forma:

- Una **barra** se llena con cada mascota recogida.
- Al llenarse, sube el **calibre**: en vez de caer de una en una, caen de dos en
  dos. Y de tres en tres. La barra se vacía y ahora pide más para volver a
  llenarse.
- Lo que no se recoge **se acumula en el suelo**. No desaparece, no se limpia
  entre calibres, y va tapando el sitio por donde se mueve el agujero.
- La partida **acaba cuando el suelo está lleno**. Eso hace que el incremental
  tenga freno: cada calibre nuevo es un regalo y una condena a la vez.
- La **marca** es el calibre más alto alcanzado, que es lo que de verdad se
  presume. `marca: { etiqueta: 'calibre', mejor: 'mas' }`.

Tres decisiones que conviene dejar dichas antes de escribirlo:

1. **Las que caen no son el pato.** Pato hay uno, y está ocupado: el pato lleva
   el agujero, caminando por el suelo detrás del ratón (con la inercia de
   [`pet/inercia.js`](../src/core/pet/inercia.js), para que arrastre y no
   teletransporte). Las que caen se dibujan en el lienzo con las hojas de
   [`skins.js`](../src/core/game/skins.js) — arte que ya existe, y además premia
   tener diseños desbloqueados con una partida más variada.
2. **Las acumuladas no se repintan.** Con calibre 8 y el suelo medio lleno hay
   cincuenta y pico sprites por fotograma en un lienzo a pantalla completa. Las
   que ya han aterrizado se pintan **una vez** a un lienzo de fondo y no se
   vuelven a tocar; sólo se animan las que están en el aire. Es la mitad de
   §*Amontonarse*, que es la decisión técnica que hay que tomar bien desde el
   principio.
3. **La barra va en el lienzo**, no en el marcador. `Pista.marcador` recibe
   texto, y una barra no es texto; pintarla con canvas evita tocar el contrato
   por un juego.

Va **solo**, porque un juego de reflejos no cabe en un canal por turnos. Si más
adelante se quiere de dos, la forma barata es un **duelo de marcas**: cada uno
juega su partida y al final se manda el resultado por la sala, que son dos
mensajes. Eso sí cabe.

Nivel 9: por encima de la paleta, que es el otro de escenario y bastante más
simple.

### Marcador global

Sin servidor propio, un "marcador global" por *broadcast* es en realidad **un
marcador de la sesión**: cada pato ve lo que se anunció mientras él estaba
conectado, y nada es verificable. Se puede entregar así, etiquetado con
honestidad y con el nombre de quien declara la marca al lado. Uno de verdad
necesita una tabla en Supabase con RLS, y eso sí es un cambio de arquitectura
—hoy ni `chat.js` ni `sw.js` usan nada que no sea Realtime—. Merece su propia
decisión, no colarse en la tarea de otro juego.

---

## Amontonarse

Las que no se recogen se quedan en el suelo, y cuando el suelo se acaba se ponen
unas encima de otras. La pregunta es si eso se hace con física de verdad —cuerpo
contra cuerpo, con sus rebotes— o no.

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

Eso da montones que se ven como montones —crecen en picos y se desparraman
cuando la pendiente es mucha— y sale más creíble que la simulación de verdad,
que como se ha dicho los dejaría planos. Lo N² desaparece con un **mapa de
alturas**: un array de "cuánto llega el montón en esta columna". Una mascota que
cae mira su columna y ya, sin comprobar contra nadie.

## La broma

`⚠️ No tocar`, al final de Ajustes y en su propia sección. Se pulsa, sale un
cartel que dice **«No debiste hacer eso»** y empiezan a caer patos. Si haces
clic en uno, se parte en dos más pequeños. Y otra vez. Y otra vez.

No es un juego: no da experiencia, no cuenta partidas, no guarda marca y no pasa
por `tam.play()`. Usa el escenario y poco más.

Aquí **sí** hay choques entre cuerpos, y al revés que en el agujero: es que la
gracia es el desorden. Un solucionador ingenuo de círculo contra círculo, sin
reposo ni solucionador iterativo, con una rejilla espacial para no morir de N².
Que tiemble, que se cuele uno por una pared, que el montón se sacuda: ahí eso no
son fallos, son el chiste. Es la única parte del proyecto donde la física mal
hecha es la especificación.

Tres cosas que hay que hacer bien para que sea una broma y no un parte de
incidencias:

1. **Se tiene que poder salir, siempre.** En el escritorio esto es un overlay a
   pantalla completa capturando el ratón: es el [riesgo número
   uno](#juegos-de-escenario) del proyecto con un cartel encima. `Esc` desde el
   primer momento y dicho en el cartel, un botón **Basta** que ningún pato pueda
   tapar, el tope de diez minutos de `escenario.js` de red, y `alApagar` como
   siempre. Cuantos más patos hay, más grande se pone el Basta: la gracia es
   agobiar, no secuestrar.
2. **«Sin fin» tiene que tener techo.** Partir en dos sin límite son veinte clics
   buenos hasta el millón de patos, y ahí la pestaña se muere de verdad. El techo
   va por **tamaño mínimo**: por debajo de cierto tamaño ya no se parte, revienta
   en una nubecilla y desaparece. Se siente infinito —nunca ganas, se multiplican
   más rápido de lo que los revientas— pero el número de bichos vivos está
   acotado. Y de paso da mecánica: *puedes* limpiarlo, pero no a ese ritmo.
3. **Sobre una página ajena, no.** Como todos los de escenario
   (`juegosDeEscenario`), y aquí con más motivo: llenar de patos la web que
   alguien está leyendo mientras se le captura el ratón no es una broma. En esa
   carcasa el botón ni aparece.

Y el pato de verdad se entera: `playOnce('sad')` y un bocadillo. *Te dije que
no.* Sin eso es un salvapantallas; con eso es suyo.
