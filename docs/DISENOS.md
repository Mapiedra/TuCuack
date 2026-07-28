# Diseños de pato

Cada diseño es un sprite sheet propio. Se desbloquean por nivel (ver
[`src/renderer/game/skins.js`](../src/renderer/game/skins.js)):

| Diseño | Nivel | Estado del arte |
|---|---|---|
| Patito | 1 | provisional (teñido) |
| Patita | 3 | provisional (teñido) |
| Pato duro | 6 | **definitivo** |
| Pato gánster | 10 | provisional (teñido) |
| Capo de la mafia | 15 | provisional (teñido) |

Los provisionales son el pato duro con otro color: sirven para probar el sistema,
pero siguen llevando sus mismas gafas y su mismo bate. Se sustituyen dejando el arte
de verdad en `assets/sprites/fuentes/<id>.webp` y ejecutando `npm run sprites`.

---

## Cómo debe ser el arte fuente

Una sola imagen con **todos los frames en una rejilla**, fondo transparente.

- **Celda**: 192 × 208 px exactos. Sin separación entre celdas.
- **El pato debe caber dentro de su celda**, sin tocar los bordes. Si se sale, el
  empaquetador lo recorta y el pato pierde la cola o una pata. (Al arte del pato duro
  le pasa en varias filas y hay que repararlo automáticamente.)
- **Mirando a la derecha** en todas las filas menos la de caminar, que mira a la
  izquierda. El empaquetador la voltea.
- Mismo personaje y mismo tamaño en todas las filas: la escala se normaliza sola, pero
  si cambia mucho la pose se nota.

### Filas necesarias

| Fila | Frames | Qué debe mostrar |
|---:|---:|---|
| 0 | 7 | **Quieto**: de pie, respirando, con ligeras variaciones |
| 1 | 8 | **Caminando** (ciclo completo, mirando a la izquierda) |
| 3 | 4 | **Saludando** con el ala levantada |
| 6 | 6 | **Hablando**: gesticula, mueve el ala |
| 7 | 6 | **Chulo**: se ajusta las gafas o similar |
| 8 | 6 | **Triste**: cabizbajo, ala en la cara |
| 9 | 8 | **Comiendo**: echa la cabeza atrás y traga |
| 10 | 8 | **Agachado**: sentado, en reposo (se usa para dormir) |

Las filas 2, 4 y 5 pueden ir vacías: no se usan. Las animaciones de **jugar**,
**dormir**, **aletear** y **colgar del cursor** se componen solas a partir de las
anteriores.

### Prompt de referencia

El arte del pato duro se generó con IA. Para que los demás encajen, conviene pedir
explícitamente la rejilla y el encuadre:

> Sprite sheet de un pato de dibujos, estilo pixel art, fondo transparente.
> Rejilla de celdas de 192×208 px, un frame por celda, **el personaje centrado y
> completo dentro de cada celda sin tocar los bordes**.
> Fila 1: 7 frames quieto. Fila 2: 8 frames caminando hacia la izquierda.
> Fila 4: 4 frames saludando con el ala. Fila 7: 6 frames hablando.
> Fila 8: 6 frames ajustándose las gafas. Fila 9: 6 frames triste.
> Fila 10: 8 frames comiendo con la cabeza hacia atrás. Fila 11: 8 frames agachado.
> El personaje mira a la derecha salvo en la fila de caminar.
> `<descripción del diseño concreto>`

Descripciones sugeridas para los que faltan:

- **Patito**: pato amarillo sencillo, sin accesorios, simpático.
- **Patita**: pata con lazo en la cabeza y pestañas largas.
- **Pato gánster**: traje a rayas, sombrero fedora, gesto de pocos amigos.
- **Capo de la mafia**: traje oscuro elegante, puro, anillo de oro, aire de jefe.

## Cómo generarlos

Ninguna IA respeta bien una rejilla, así que el flujo es **de uno en uno**: generar,
comprobar, integrar y mirarlo en pantalla. Así se aprende qué hay que pedirle antes de
gastar cuatro intentos.

1. **Genera un diseño** con el prompt de arriba. Lo más importante: pásale **el arte
   del pato duro como imagen de referencia** para que el estilo, el grosor de línea y
   el tamaño casen entre diseños. Sin esa referencia, cada pato parece de un juego
   distinto.
2. **Compruébalo** antes de nada:

   ```bash
   npm run sprites:check -- assets/sprites/fuentes/ganster.webp
   ```

   Dice si la rejilla cuadra, si falta alguna fila, si el personaje se sale de su celda
   y cuánto cambia de tamaño entre frames. Con `--guardar-contacto` deja además una
   hoja con todas las celdas numeradas, para ver de un vistazo qué salió mal.
3. **Repite el prompt** hasta que no haya problemas graves. Los avisos de "toca el
   borde" son corregibles automáticamente, pero cuantos menos, mejor sale.
4. **Empaqueta e integra** (siguiente apartado) y arranca la app para verlo andar.

Qué esperar: hasta el arte del pato duro, que es bueno, tiene dos frames recortados y
un 23 % de variación de tamaño entre celdas. Es normal; el empaquetador lo compensa.

### Después de añadirlo

```bash
npm run sprites     # empaqueta todas las fuentes que haya
```

El script comprueba solo que ninguna animación salte, cambie de tamaño ni se corte, e
imprime un aviso si algo no cuadra. Si el diseño ya tiene arte propio,
`make_placeholder_skins.py` deja de tocarlo.
