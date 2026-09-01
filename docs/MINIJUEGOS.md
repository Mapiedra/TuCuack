# Minijuegos

El pato tiene juegos. Se desbloquean por nivel, igual que los diseños, y se
abren desde `🎮 Juegos` en el menú del pato.

| Juego | Nivel | Modos | Superficie |
|---|---|---|---|
| ⭕ Tres en raya | 1 | solo · red (2) | panel |

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
el suelo y la pantalla entera. Recibe una `pista` en `ctx.escenario`:

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

**Límite conocido:** en la extensión, el pato se muda de pestaña continuamente.
El service worker ya guarda los mensajes de la partida y se los devuelve al pato
cuando reaparece, pero **rehacer el estado (`salas.reanudar`) está pendiente**:
de momento el pato avisa de que la partida se quedó atrás y la suelta limpiamente.
En el escritorio esto no pasa, porque el pato no se muda a ninguna parte.

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
