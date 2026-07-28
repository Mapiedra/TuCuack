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

## Formato del sprite sheet

Una sola imagen con **todos los frames en una rejilla**, fondo transparente.

- **Celda**: 192 × 208 px exactos, sin separación entre celdas.
- **Una acción por fila**, empezando arriba, en el orden de la tabla de abajo.
- **Los frames de cada fila van seguidos** desde la izquierda. Puede haber más o
  menos según la acción: se cuentan solos, no hace falta un número exacto (mínimo 3).
- **El personaje debe caber dentro de su celda**, sin tocar los bordes. Si se sale, se
  recorta y el pato pierde la cola o una pata.
- **Mira siempre a la derecha**, en todas las filas.
- Mismo personaje y mismo tamaño en todas las filas.

### Qué va en cada fila

| Fila | Acción | Qué debe mostrar | Frames |
|---:|---|---|---:|
| **1** | Quieto | De pie, sin hacer nada, respirando; variaciones mínimas | 6-8 |
| **2** | Andar | Ciclo completo de caminar, moviendo las patas | 8 |
| **3** | Comer | Picotea o echa la cabeza atrás para tragar | 6-8 |
| **4** | Jugar | Se divierte: da saltos, agita lo que lleve, hace el tonto | 6-8 |
| **5** | Dormir | Acurrucado o sentado, ojos cerrados, respirando despacio | 4-8 |
| **6** | Contento | Celebra: saluda con el ala, da un brinco de alegría | 4-6 |
| **7** | Hablar | Gesticula mientras habla, mueve el pico y las alas | 4-6 |
| **8** | Triste | Cabizbajo, hombros caídos, ala en la cara | 4-6 |
| **9** | Chulesco | Pose de sobrado: se ajusta las gafas, se cruza de alas | 4-6 |
| **10** | Aletear | En el aire, agitando las alas para sostenerse | 4-6 |
| **11** | Colgando | Sujeto por arriba, pataleando o balanceándose | 4-6 |

Son **11 filas seguidas, sin huecos**: una por animación, todas dibujadas.

Las dos últimas son para cuando se le arrastra y se le lanza por la pantalla. Podrían
sacarse de la fila 6 moviendo el dibujo, y así se hacía al principio, pero entonces dos
acciones distintas comparten el mismo dibujo y el diseño se nota repetido. Mejor
dibujarlas.

**El arte del pato duro ya está en este formato**, así que sirve de ejemplo de
referencia. Venía con las acciones repartidas de forma irregular, con duplicados que no
se usaban, y se reordenó con `tools/migrate_source_layout.py`.

En su caso, las filas 10 y 11 están derivadas del saludo, porque aquel arte no las
traía. En un diseño nuevo conviene dibujarlas: es justo lo que evita que dos acciones
se parezcan.

### Prompt para generarlo

> Sprite sheet de un pato de dibujos animados, estilo pixel art, **fondo
> transparente**.
> Rejilla de **11 filas × 8 columnas**, celdas de **192×208 px** exactos, un frame por
> celda, sin separación entre celdas.
> El personaje **centrado y completo dentro de cada celda, sin tocar los bordes**, del
> **mismo tamaño en todas**, y **mirando siempre a la derecha**.
> Cada fila es una animación, con los frames seguidos desde la izquierda:
> fila 1, quieto de pie respirando;
> fila 2, ciclo de caminar;
> fila 3, comiendo;
> fila 4, jugando y dando saltos;
> fila 5, durmiendo acurrucado;
> fila 6, contento saludando con el ala;
> fila 7, hablando y gesticulando;
> fila 8, triste y cabizbajo;
> fila 9, en pose chulesca;
> fila 10, aleteando en el aire para sostenerse;
> fila 11, colgando de arriba, pataleando.
> El personaje es: `<descripción del diseño>`

Descripciones para los que faltan:

- **Patito** (`normal.webp`): pato amarillo sencillo, sin accesorios, simpático.
- **Patita** (`hembra.webp`): pata con lazo en la cabeza y pestañas largas.
- **Pato gánster** (`ganster.webp`): traje a rayas, sombrero fedora, cara de pocos amigos.
- **Capo de la mafia** (`capo.webp`): traje oscuro elegante, puro, anillo de oro, aire de jefe.

**Pásale también el arte del pato duro como imagen de referencia**
(`assets/sprites/fuentes/duro.webp`) para que el estilo, el grosor de línea y las
proporciones casen entre diseños. Sin esa referencia, cada pato parece de un juego
distinto — y se ven los cinco juntos en el panel.

---

## Cómo generarlos

Ninguna IA respeta bien una rejilla, así que el flujo es **de uno en uno**: generar,
comprobar, integrar y mirarlo en pantalla. Así se aprende qué hay que pedirle antes de
gastar cuatro intentos.

1. **Genera un diseño** con el prompt de arriba.
2. **Compruébalo** antes de nada:

   ```bash
   npm run sprites:check -- assets/sprites/fuentes/ganster.webp
   ```

   Dice si la rejilla cuadra, cuántos frames tiene cada fila, si falta alguna, si el
   personaje se sale de su celda y cuánto cambia de tamaño entre frames. Con
   `--guardar-contacto` deja además una hoja con todas las celdas numeradas, para ver
   de un vistazo qué salió mal.
3. **Repite el prompt** hasta que no haya problemas graves.

   Si sólo quedan avisos de contorno recortado (al personaje le falta un trozo por
   un lado), se pueden arreglar sin volver a generar:

   ```bash
   npm run sprites:repair -- assets/sprites/fuentes/ganster.webp
   ```

   Reconstruye el trozo que falta copiándolo de un frame sano de la misma fila. Como
   dentro de una animación el personaje apenas cambia de forma, el parche es su propio
   dibujo. Vuelve a pasar el comprobador después.
4. **Empaqueta e integra**:

   ```bash
   npm run sprites     # empaqueta todas las fuentes que haya
   ```

   El script comprueba solo que ninguna animación salte, cambie de tamaño ni se corte,
   e imprime un aviso si algo no cuadra. Si el diseño ya tiene arte propio,
   `make_placeholder_skins.py` deja de tocarlo.
5. **Arranca la app** y míralo andar.

Qué esperar: el arte del pato duro, que es bueno, llegó con dos frames recortados (ya
reparados) y sigue teniendo un 23 % de variación de tamaño entre celdas. Es normal; el
empaquetador lo compensa normalizando la escala y alineando por los pies, así que no
hay que perseguir la perfección en el arte.
