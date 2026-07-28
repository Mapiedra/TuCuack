# Changelog

Todos los cambios reseñables de TuCuack se documentan en este fichero.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
y el proyecto usa [Versionado Semántico](https://semver.org/lang/es/).

## [No publicado]

### Añadido

- **Sonidos**: un cuack al hablar por el chat (más grave cuando habla otro pato), un
  boing de muelle al rebotar —más agudo cuanto más fuerte el golpe— y un aleteo
  mientras planea. Al subir de nivel, dos cuacks encadenados.
- **Control de sonido en Ajustes**: volumen y botón de silencio, que se aplican al
  momento para poder ajustarlos de oído.

Los sonidos se sintetizan por código, así que no añaden ni un byte de audio al
instalador y se afinan cambiando números. Cada uno tiene un tiempo mínimo entre
repeticiones para que una ráfaga de mensajes o de rebotes no sea una tortura.


## [0.3.0] - 2026-07-29

Los cinco diseños de pato tienen ya su propio arte, y el formato del sprite queda
cerrado y documentado.

### Añadido

- **Arte propio para los cinco diseños**: Patito, Patita, Pato duro, Pato gánster y
  Capo de la mafia. Se acabaron los provisionales teñidos, que eran el mismo pato con
  otro color.
- El chat **se reconecta solo** si se cae la conexión, con esperas crecientes (5 s,
  10 s, 20 s… hasta 5 min). Antes, un corte de red o una caída del servicio dejaban el
  chat mudo hasta reiniciar la app, aunque el servicio volviera al momento.
- Herramientas para preparar el arte de un diseño nuevo, documentadas en
  [`docs/DISENOS.md`](docs/DISENOS.md):
  - `npm run sprites:check` — avisa de rejillas que no cuadran, filas que faltan,
    personajes que se salen de su celda o cambian de tamaño entre frames.
  - `npm run sprites:repair` — reconstruye los frames a los que les falta un trozo por
    el borde, copiándolo de un frame sano de la misma fila.
  - `npm run sprites:import` — recupera un sheet exportado sin transparencia,
    quitando el fondo de cuadros y limpiando los restos de la compresión.

### Cambiado

- **El formato del arte queda en 11 filas, una por animación**, todas dibujadas.
  Aletear y colgar del cursor se derivaban de la fila de "contento", así que tres
  acciones compartían dibujo y los diseños salían repetidos.
- El arte del pato duro se reordena a ese formato: venía con las acciones repartidas
  de forma irregular y tres filas sin usar. Ahora sirve de referencia para generar los
  demás.
- Cada diseño lleva **sus propios metadatos** (filas, frames y fps), en vez de ir
  escritos en el código: no todos tienen el mismo número de frames por animación.
- El generador cuenta solo los frames de cada fila, así que el arte no tiene que
  ajustarse a un número exacto por acción.
- El lienzo del sprite crece a 248x268, con más margen por abajo: el capo duerme en un
  sillón que sobresale por debajo de sus pies y se cortaba.

### Corregido

- La experiencia por chatear no tenía tope: el contador diario de mensajes se ponía a
  cero en cada envío, porque compartía la marca de día con la racha y esa sólo se
  actualiza al atender al pato. Quien únicamente chateaba subía de nivel sin límite.
- La ventana de escribir se abría desplazada a un lado del pato, en vez de centrada
  sobre él como el menú y los paneles.


## [0.2.2] - 2026-07-28

### Corregido

Repaso a la maquetación del bocadillo del chat, que tenía cuatro problemas:

- La **punta** eran dos triángulos superpuestos en posiciones fijas: ni quedaba
  centrada bajo el globo ni encajaba consigo misma, y dejaba una costura. Ahora es un
  cuadrado girado que continúa el contorno del globo.
- El **texto se partía palabra a palabra**: el globo cuelga de una capa sin ancho, así
  que se encogía al mínimo en lugar de ocupar lo que necesita.
- El globo **daba un salto al aparecer**, porque la animación de entrada sobrescribía
  el desplazamiento que lo centra sobre el pato.
- Se **salía de la pantalla** cuando el pato andaba cerca de un borde. Ahora se aparta
  lo justo y la punta se compensa para seguir señalándole.


## [0.2.1] - 2026-07-28

### Añadido

- **Botón de volver** en los paneles: al abrir Estadísticas, Diseños o Ajustes desde el
  menú del pato ya se puede regresar a él sin tener que hacer clic derecho otra vez.
- El **nivel se muestra junto al resto de indicadores**, tanto en el panel de
  estadísticas como en el globo que sale al pasar el ratón por encima del pato.
- Comprobador de arte fuente (`npm run sprites:check`): antes de empaquetar un diseño
  nuevo, avisa de si la rejilla no cuadra, falta alguna fila, el personaje se sale de
  su celda o cambia demasiado de tamaño entre frames. Con `--guardar-contacto` deja
  además una hoja con todas las celdas numeradas.

### Corregido

- Al desplegar la ayuda sobre los niveles, el panel crecía y se salía de la pantalla.
  Ahora se recoloca al cambiar de tamaño y, si aun así no cabe, hace scroll.


## [0.2.0] - 2026-07-28

### Añadido

- **Sistema de niveles**. Cuidar bien al pato da experiencia: sobre todo tenerlo
  contento con el tiempo (+1/min), y atender una necesidad **cuando estaba baja**
  (+10). Machacar los botones con las barras llenas no puntúa. También suman la
  primera atención del día, con bonus por días seguidos, y hablar por el chat.
  Nunca se pierde nivel, y con el ordenador apagado no se acumula experiencia.
- **Diseños de pato desbloqueables**: Patito (Nv 1), Patita (Nv 3), Pato duro (Nv 6),
  Pato gánster (Nv 10) y Capo de la mafia (Nv 15). Se ven todos desde el principio,
  los que faltan atenuados y con un candado que indica su nivel.
- Panel de **Diseños** en el menú, con el nivel, la barra de progreso y una
  explicación desplegable de cómo se gana experiencia.
- El **nivel acompaña al nombre en el chat**, para poder compararse con los demás.
- Aviso al subir de nivel, que indica si eso ha desbloqueado algún diseño.
- El generador de sprites procesa **varios diseños** a la vez, uno por cada arte en
  `assets/sprites/fuentes/`, y hay una guía para añadirlos en
  [`docs/DISENOS.md`](docs/DISENOS.md).

### Cambiado

- Los iconos que aparecen sobre el pato son ahora los mismos que los de sus barras de
  estado, para saber de un vistazo qué necesita. El de "triste" era una gota, que se
  confundía con suciedad; ahora es un corazón roto. El de hambre pasa de pan a carne,
  igual que en el panel.
- El pato de partida pasa a ser el **Patito**: el pato duro se convierte en una
  recompensa de nivel 6.

### Notas

- Cuatro de los cinco diseños son **provisionales**: por ahora son el pato duro teñido
  de otro color, a la espera de su arte propio. El sistema ya funciona con ellos.


## [0.1.3] - 2026-07-28

### Añadido

- **Las estadísticas aparecen al dejar el ratón sobre el pato**: un globo con
  comida, energía, higiene y ánimo, y su estado de ánimo. Mientras lo señalas el
  pato se para, en vez de seguir andando y escaparse del cursor.
- **El cursor pasa a ser una mano** al ponerlo encima, y se cierra al agarrarlo.

### Cambiado

- El pato vuelve a **caminar sobre la barra de tareas** en lugar de por el borde de la
  pantalla, sin renunciar a la altura completa: la ventana sigue cubriendo el monitor
  entero (se le puede lanzar hasta arriba) y lo que sube es la línea del suelo, que
  ahora es la altura de la barra. Si la barra está oculta o en un lateral, camina por
  el borde inferior.
- Los menús y paneles se abren **centrados sobre el pato y por encima de él**, en vez
  de taparle desde el punto del clic.

### Corregido

- El globo de estadísticas se colocaba mal porque se medía mientras entraba con la
  animación de escala, que devuelve un tamaño de 0.


## [0.1.2] - 2026-07-28

### Añadido

- **El pato se puede llevar de un monitor a otro arrastrándolo**. Mientras se arrastra
  se sigue el cursor a nivel de escritorio (los eventos de la ventana no bastan: dejan
  de llegar en cuanto el puntero sale de ella) y, al entrar en otro monitor, la ventana
  se muda allí con el pato bajo el cursor. Se descartó cubrir todo el escritorio con una
  única ventana gigante: penaliza el rendimiento y se comporta mal con monitores de
  distinta escala.

### Corregido

- La ventana no llegaba a cubrir la barra de tareas (Windows recorta al área de trabajo
  el tamaño pedido al crearla), así que el pato caminaba justo por encima en vez de
  sobre ella.
- Los releases se publicaban como borrador y había que sacarlos a mano.
- Si se soltaba el botón fuera de la ventana, el pato se quedaba pegado al cursor.

## [0.1.1] - 2026-07-28

### Añadido

- **Versión para macOS**: el workflow compila también en macOS y publica un DMG y un
  ZIP (Intel y Apple Silicon) en el mismo Release. La app vive en la barra de menús y
  no ocupa sitio en el Dock. No está firmada, así que la primera vez hay que abrirla
  con clic derecho → Abrir.

### Corregido

- Los iconos de estado (hambre, sueño, higiene…) quedaban ocultos tras el pato: se
  dibujaban antes que el sprite y a una altura que caía sobre su propio cuerpo. Ahora
  van por delante y por encima del dibujo, con un contorno que los hace legibles sobre
  cualquier fondo.

## [0.1.0] - 2026-07-28

Primera versión.

### Añadido

- **Mascota de escritorio**: el pato camina por su cuenta sobre la barra de tareas,
  en una ventana transparente siempre encima. El hit-test es por píxel, así que los
  clics alrededor del pato siguen llegando al escritorio.
- **Tamagotchi**: comida, energía, higiene y felicidad decaen con el tiempo (también
  con la app cerrada, hasta un tope). El estado de ánimo decide el comportamiento
  autónomo: pasear, aburrirse, entristecerse o dormir.
- **Cuidados**: alimentar, jugar, limpiar y dormir/despertar, desde el menú
  contextual, el panel de estadísticas o la bandeja del sistema.
- **Arrastrar y lanzar**: el pato se lleva a cualquier punto de la pantalla. Al
  soltarlo conserva la inercia del ratón y describe una parábola, rebotando en los
  lados y en el suelo; si se suelta casi quieto, planea aleteando hasta posarse.
- **Chat entre patos** con Supabase Realtime: un canal común donde lo que escribes
  aparece en bocadillo de cómic sobre tu pato y sobre los de los demás.
- **Nombre del pato**, configurable en Ajustes y validado contra los patos conectados
  para que no se repita.
- **Persistencia** del estado entre sesiones y **arranque con Windows** opcional.
- **Auto-actualización** por GitHub Releases y publicación automatizada al subir un
  tag `v*`.
- **Generación de sprites e iconos** desde el arte fuente (`tools/pack_sprites.py`,
  `tools/make_icons.py`), con verificación automática de alineación y recortes.
- **Guía de configuración** por entornos en
  [`docs/CONFIGURACION.md`](docs/CONFIGURACION.md), incluido cómo levantar dos patos
  en un mismo equipo para probar el chat.
- Registro, al arrancar, del estado del canal y del origen de las credenciales, para
  poder diagnosticar la conexión sin adivinar.

### Notas

- El chat requiere credenciales de Supabase (`supabase.json`); sin ellas la app
  funciona con normalidad pero sin chat.
- El instalador no está firmado, así que Windows SmartScreen mostrará un aviso.

[No publicado]: https://github.com/Mapiedra/TuCuack/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/Mapiedra/TuCuack/releases/tag/v0.3.0
[0.2.2]: https://github.com/Mapiedra/TuCuack/releases/tag/v0.2.2
[0.2.1]: https://github.com/Mapiedra/TuCuack/releases/tag/v0.2.1
[0.2.0]: https://github.com/Mapiedra/TuCuack/releases/tag/v0.2.0
[0.1.3]: https://github.com/Mapiedra/TuCuack/releases/tag/v0.1.3
[0.1.2]: https://github.com/Mapiedra/TuCuack/releases/tag/v0.1.2
[0.1.1]: https://github.com/Mapiedra/TuCuack/releases/tag/v0.1.1
[0.1.0]: https://github.com/Mapiedra/TuCuack/releases/tag/v0.1.0
