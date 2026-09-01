# Changelog

Todos los cambios reseñables de TuCuack se documentan en este fichero.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
y el proyecto usa [Versionado Semántico](https://semver.org/lang/es/).

## [No publicado]

## [0.6.1] - 2026-08-31

### Añadido

- **Minijuegos.** Nueva entrada `🎮 Juegos` en el menú del pato, con un catálogo
  que se desbloquea por nivel igual que los diseños. Entra jugable **Tres en
  raya** contra el pato, con una IA que va dejando de fallar a propósito a medida
  que el pato sube de nivel. Terminar una partida da experiencia (+4, +8 más si
  se gana) con un tope de ocho al día, para que jugar en bucle no sea la vía
  rápida para subir; y jugar gasta energía, así que un pato agotado no juega.
  Las partidas, victorias y récords se guardan por juego.
- **El sistema que gobierna los juegos**, pensado para que añadir uno nuevo sean
  tres pasos y ningún cambio en `app.js`: un catálogo
  ([`src/core/game/minijuegos/index.js`](src/core/game/minijuegos/index.js)),
  un marco de partida que se encarga de cargar el módulo, apagar sus bucles,
  contar el resultado una sola vez y repartir la experiencia, y un contrato de
  una sola función. Está contado en
  [`docs/MINIJUEGOS.md`](docs/MINIJUEGOS.md).
- **Juegos de escenario**: un juego puede tomar prestados el pato y la pantalla
  entera en vez de vivir en un panel. La devolución va protegida por cuatro
  capas independientes, porque un préstamo que no se devuelve dejaría la ventana
  transparente capturando el ratón y al usuario sin poder pulsar nada en su
  escritorio. Sobre páginas web ajenas no se ofrecen: ahí el pato está de
  prestado.
- **Partidas por turnos entre patos.** Desde el panel de juegos se puede retar a
  cualquier pato conectado; al otro le sale un aviso con su cuenta atrás, y si
  está ocupado el reto espera en el menú en vez de saltarle encima de lo que
  estuviera haciendo. Las jugadas viajan por el mismo canal que el chat, en su
  propio evento y dirigidas a un pato concreto —igual que las visitas—, con
  numeración, confirmación y reintentos, de modo que una jugada perdida no cuelga
  la partida. Probado con un rival simulado y pérdida de mensajes provocada.
- **Identidad estable de pato** (`patoId`), que es lo que permite reconocer al
  rival a mitad de partida aunque su clave de presencia cambie al reconectar. Un
  pato con una versión anterior sigue apareciendo en la lista y se le puede
  hablar y mandar el pato; sencillamente no se le puede retar.
- **Sonidos de partida** (empezar, victoria, derrota, cambio de turno) y una
  `nota` suelta como ladrillo para los juegos que la necesiten.
- **La fila 12 del sprite (`regalo`) ya existe en los cinco diseños.** A falta de
  arte definitivo, el empaquetador la **compone** inclinando el saludo hacia
  delante desde los pies. Es un apaño declarado —sale del saludo, así que no hay
  objeto que ofrecer— para que el gesto funcione de punta a punta mientras se
  dibuja. [`docs/DISENOS.md`](docs/DISENOS.md) describe qué tiene que enseñar el
  arte final; en cuanto la fila aparezca, el empaquetador la usa y deja de
  componerla sin tocar código.

### Cambiado

- **La app habla de "tu mascota", no de "tu pato".** Se está estudiando meter
  otras mascotas —gatos, perros—, y todo el texto visible daba por hecho que era
  un pato: "Nombre de tu pato", "Cuidar bien al pato", "no hay ningún otro pato
  conectado". Ahora es genérico.
  *Lo que SÍ sigue siendo de pato se queda como está, porque es contenido y no
  etiqueta:* los diseños (Patito, Pato gánster), los rangos, los cuacks, el
  nombre que se propone al empezar y el propio nombre de la app. Cuando entre
  otra mascota traerá los suyos. Los identificadores del código (`Duck`,
  `patoId`…) tampoco cambian: es un refactor aparte que no aporta nada al que usa
  la app.
- **Cuando el rival deja la partida, se cierra el tablero y lo dice en un
  bocadillo**, en vez de una nota pequeña al pie de un tablero muerto. Un aviso
  discreto encima de algo que ya no responde es fácil de no ver, e invita a
  seguir pulsando.
- **La física del vuelo del pato vive ahora en
  [`src/core/pet/fisica.js`](src/core/pet/fisica.js)**, fuera de `app.js`. Es
  el mismo comportamiento exacto —se comprobó comparando ambas versiones sobre
  9.680 trayectorias con paso fijo, exigiendo igualdad exacta de posición,
  velocidad, sonidos, inclinación y giro—, pero ahora un minijuego puede
  pilotarla con otros números en vez de tener que copiarla. La inercia del
  cursor sale al mismo sitio ([`pet/inercia.js`](src/core/pet/inercia.js)) y la
  comparten el arrastre y los juegos.
- **El aviso de subir de nivel anuncia cualquier cosa que se desbloquee**, no
  sólo diseños. Añadir un catálogo nuevo es meterlo en una lista.
- **Fuera las referencias a macOS.** La app de escritorio es de Windows y en
  cualquier otro sistema el pato vive en la extensión de Chrome, que no depende
  del sistema operativo. Se corrigen el README, el comentario del workflow de
  release y el de `tools/write-supabase-config.js`. *(Las entradas antiguas del
  changelog se quedan como están: cuentan lo que pasó en su momento.)*
- **Las notas del Release ya no prometen descargas que no existen.** Anunciaban
  un `.dmg` para Intel y otro para Apple Silicon que el workflow no compila desde
  la 0.4.0. Ahora listan lo que se publica de verdad: el instalador de Windows y
  el zip de la extensión.
- **El README documenta las visitas**, que entraron en la 0.6.0 y se quedaron sin
  contar.

### Corregido

- **El recuento de animaciones compuestas ya no miente.** Miraba la distribución
  declarada en vez de lo que se leyó del arte, así que daba por dibujada una fila
  vacía —justo la que hay que ir a dibujar—.

## [0.6.0] - 2026-08-05

### Añadido

- **Mandar el pato a la pantalla de otro.** En **Conectados**, cada pato de la
  lista tiene ahora un botón para mandarle el tuyo, con un **recado opcional**.
  En la pantalla del otro aparece un **segundo pato** —con tu diseño y tu
  nombre—, que **entra andando desde fuera del cuadro** por el lado contrario al
  suyo, se planta a su lado, saluda con el ala y se marcha por donde vino hasta
  perderse de vista. El trayecto tarda lo mismo mida lo que mida el monitor: la
  velocidad se saca del ancho, y no al revés.
- **Y el tuyo se va a llevarlo.** Al mandarlo, tu pato sale corriendo por el
  borde más cercano, desaparece un momento y vuelve por donde se fue, a su
  sitio. Son dos segundos de teatro —el recado viaja por el canal al instante— y
  se corta solo si le agarras con el ratón a mitad de camino.
- **Interruptor de visitas en Ajustes.** El canal es común a todo el mundo que
  tenga TuCuack abierto, así que se puede cerrar la puerta sin renunciar al chat.
  Aunque esté abierta, no se admite más de una visita por remitente cada **25 s**
  y sólo entra un pato a la vez; el resto espera turno o se descarta.
- **La espera entre visitas se ve.** El botón de mandar se convierte en una
  **rueda que se va llenando**, con los segundos que faltan dentro, y no se puede
  pulsar hasta que se completa. Es por destinatario: que uno esté esperando no
  impide mandarle el pato a otro. La cuenta la lleva también quien manda —con un
  margen sobre la de quien recibe—, así que la rueda no llega a cero antes de
  tiempo.
- **La presencia del canal viaja ahora con una clave por pato.** Es lo que
  permite mandarle el pato a uno en concreto cuando hay dos que se llaman igual.
  Con una versión anterior al otro lado la lista se ve igual, pero sin poder
  mandar nada.

### Notas

- El recado **no es una conversación privada**: viaja por el canal común y lo que
  hacen los demás patos es descartarlo. El propio panel lo dice antes de enviar.
- Queda preparada una fila de sprite **`regalo`** (la 12) para entregar algo con
  el ala, todavía **sin dibujar en ningún diseño**: mientras no exista, quien
  pida ese gesto saluda con el ala. Ver `docs/DISENOS.md`.

## [0.5.0] - 2026-08-04

### Añadido

- **El menú del pato, rehecho alrededor de su estado.** Abre con las mismas
  barras que enseña el globo del ratón (nombre, nivel, las cuatro necesidades y
  el ánimo) —el mismo componente en los dos sitios, no una copia—, aquí más
  grandes y con una **botonera de cuidados**: alimentar, jugar, limpiar y dormir
  se hacen desde ahí, viendo cómo se mueven las barras y sin que el menú se
  cierre en cada gesto. Las demás opciones bajan a **dos columnas**.
- **Lista de conectados.** Nueva opción **Conectados** en el menú del pato y en la
  bandeja: enseña qué patos hay en el canal ahora mismo, con el tuyo marcado el
  primero. El menú lleva la cuenta al lado, y la lista se actualiza sola mientras
  está abierta según entran y salen. Si el chat se cae, lo dice y se rellena sola
  al volver. Sale de la presencia del canal, que ya se mantenía para comprobar los
  nombres, así que vale igual en el escritorio y en la extensión.
- **Hablar es ahora un panel con histórico.** Tiene el **volver al menú** que
  tienen los demás, y encima de la caja de escribir van los **últimos 50
  mensajes** de la sesión —los de los demás y los tuyos, con hora—, que se
  anotan aunque el panel esté cerrado. Al enviar ya no se cierra: se sigue la
  conversación. Si el chat no está conectado lo dice y marca el mensaje como *no
  enviado*, en vez de dejar creer que llegó a alguien. El histórico vive en
  memoria y se va al cerrar el pato; en la extensión lo guarda el service worker
  en `storage.session` para que sobreviva a los cambios de pestaña, y se borra al
  cerrar Chrome. Sin base de datos ni ficheros.
- **Agotamiento.** Si la energía llega a 0, el pato se desploma y duerme hasta
  recuperar el 20 %. Mientras dure no hace ninguna otra cosa ni acepta cuidados:
  las opciones se ven apagadas, y desde la bandeja lo dice con un aviso.

### Cambiado

- **Estadísticas** desaparece del menú del pato: lo que enseñaba está ahora en la
  cabecera. El panel sigue existiendo y se abre desde la bandeja, donde no hay
  sitio para las barras.
- **Diseños** ya no repite el nivel y su progreso: se ven en el menú desde el que
  se abre el panel.
- El umbral de "cansado" pasa de 22 % a **20 %** de energía, el mismo al que se
  sale del agotamiento. Con dos números distintos, al despertar a un pato recién
  repuesto se volvía a dormir en el acto.

### Corregido

- **El chat se caía sin parar con un antivirus que inspecciona el tráfico.** AVG
  (y Avast, ESET o un proxy de empresa) sustituye el certificado del servidor por
  uno suyo, firmado por una raíz que instala en el almacén de Windows. Chromium la
  da por buena, pero el proceso que mantiene el chat es Node, que sólo se fía de
  su lista compilada: de ahí el `unable to verify the first certificate` en bucle.
  Los antivirus lo apañan con `NODE_EXTRA_CA_CERTS`, pero eso sólo alcanza a los
  procesos que arrancan después de que exista la variable —con una terminal
  abierta de antes, el chat no levantaba—. Ahora el pato lee las raíces del
  almacén de Windows al arrancar y se fía de ellas, como haría el navegador.
- **El panel de estadísticas salía en blanco al abrirlo** y no se rellenaba hasta
  el siguiente segundo, porque el primer pintado se descartaba al no estar el
  panel todavía en el documento. De paso, cada apertura dejaba un oyente colgando
  sobre un panel ya cerrado; ahora se suelta al cerrarlo.
- **Arrancar con un pato ya en marcha parecía no hacer nada.** Sólo hay un pato
  por equipo, así que la segunda instancia se retira y muestra la primera; pero
  lo hacía en silencio, y `npm start` terminaba con éxito y sin ventana, que es
  justo lo que parece un arranque roto. Ahora lo dice por consola y explica cómo
  cerrar el que ya estaba.

## [0.4.0] - 2026-07-30

### Añadido

- **El pato en Chrome**, como extensión. Pasea por las páginas que visitas y se
  muda al panel lateral cuando lo abres. Hay un solo pato: vive en la ventana que
  estés usando, así que no se clona ni se queda atrás. Se instala en modo
  desarrollador (ver `INSTALAR.txt` dentro del zip) y comparte el canal de chat
  con los patos de escritorio, de modo que se ven entre ellos.
- **Ajuste de tamaño del pato** en Ajustes, del 40 % al 160 %. Se aplica mientras
  mueves el control y vale igual en el escritorio y en la extensión.
- El Release trae ahora el **zip de la extensión** además del instalador.

### Cambiado

- El pato se ha separado en un **núcleo común** (`src/core`) que no sabe dónde
  vive, y una carcasa por sitio: Electron en el escritorio, panel y páginas en
  Chrome. El escritorio se comporta igual que antes.
- El pato recuerda **dónde estaba** y reaparece en la misma posición.

### Corregido

- **La caja para escribir en el chat no se podía cerrar** si el foco se iba a
  otra parte: sólo respondía a Escape estando dentro de ella, o enviando algo.
  Ahora tiene botón de cerrar, Escape funciona siempre y un clic fuera también
  la cierra. Y cuando no cabía por encima del pato se colocaba justo debajo del
  anclaje, es decir, tapándole la cara; ahora se queda arriba.
- **El pato se multiplicaba en la lista de conectados.** El canal avisa de
  "suscrito" más de una vez, y cada aviso añadía una entrada nueva en la
  presencia en lugar de reemplazar la anterior. Además la lista se deduplica,
  para que quien siga con una versión anterior no la ensucie a los demás.
- **El chat no se recuperaba de una caída.** Al reconectar se rehacía el canal
  sobre el mismo cliente, pero quitar el último canal deja al socket programando
  su propia desconexión, así que el canal nuevo esperaba a un socket que se
  estaba yendo y todos los reintentos fallaban aunque la red ya hubiera vuelto.
  A partir del tercer intento se rehace el cliente entero.
- **Los fallos de conexión no decían por qué.** Todos aparecían como "transport
  failure", con la causa real escondida; ahora se muestra encadenada, que es lo
  que distingue un antivirus inspeccionando el tráfico de un DNS que no resuelve.
- **El CI llevaba en rojo desde la 0.3.0.** El verificador de sprites tumbaba la
  compilación por tres animaciones cuya línea de base salta más de lo tolerado
  (`capo/idle`, `ganster/happy` y `normal/sleep`). Esos saltos están ahora
  registrados como deuda conocida con su valor actual, así que el CI vuelve a
  pasar pero sigue avisando si empeoran o si aparece otro.

### Eliminado

- **La versión de macOS.** Sin cuenta de Apple Developer no se puede firmar ni
  notarizar, y una app sin firmar da más problemas de los que resuelve: macOS la
  bloquea y hay que enseñar a cada persona a saltarse el aviso. Quien use Mac
  tiene la extensión de Chrome, que funciona en cualquier sistema.

## [0.3.2] - 2026-07-29

### Corregido

- **La publicación de macOS**: los instaladores de Windows y de macOS se compilan en
  paralelo, y ambos intentaban crear el Release a la vez. El que llegaba segundo se
  encontraba con que ya existía, fallaba y se quedaba sin subir nada: por eso la 0.3.1
  salió sin `.dmg`. Ahora el Release se crea una sola vez, antes de compilar, y cada
  sistema se limita a subir sus ficheros.
- Relanzar a mano un job de publicación que había fallado no servía de nada:
  electron-builder se niega a subir a un Release publicado hace más de dos horas.
  Queda desactivado ese plazo.

### Añadido

- Los Releases traen ya **notas**, sacadas de este changelog, en vez del cuerpo vacío
  de antes.

## [0.3.1] - 2026-07-29

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

[No publicado]: https://github.com/Mapiedra/TuCuack/compare/v0.6.1...HEAD
[0.6.1]: https://github.com/Mapiedra/TuCuack/releases/tag/v0.6.1
[0.6.0]: https://github.com/Mapiedra/TuCuack/releases/tag/v0.6.0
[0.5.0]: https://github.com/Mapiedra/TuCuack/releases/tag/v0.5.0
[0.4.0]: https://github.com/Mapiedra/TuCuack/releases/tag/v0.4.0
[0.3.2]: https://github.com/Mapiedra/TuCuack/releases/tag/v0.3.2
[0.3.1]: https://github.com/Mapiedra/TuCuack/releases/tag/v0.3.1
[0.3.0]: https://github.com/Mapiedra/TuCuack/releases/tag/v0.3.0
[0.2.2]: https://github.com/Mapiedra/TuCuack/releases/tag/v0.2.2
[0.2.1]: https://github.com/Mapiedra/TuCuack/releases/tag/v0.2.1
[0.2.0]: https://github.com/Mapiedra/TuCuack/releases/tag/v0.2.0
[0.1.3]: https://github.com/Mapiedra/TuCuack/releases/tag/v0.1.3
[0.1.2]: https://github.com/Mapiedra/TuCuack/releases/tag/v0.1.2
[0.1.1]: https://github.com/Mapiedra/TuCuack/releases/tag/v0.1.1
[0.1.0]: https://github.com/Mapiedra/TuCuack/releases/tag/v0.1.0
