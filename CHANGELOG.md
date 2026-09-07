# Changelog

Todos los cambios reseñables de TuCuack se documentan en este fichero.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
y el proyecto usa [Versionado Semántico](https://semver.org/lang/es/).

## [No publicado]

## [0.30.0] - 2026-09-07

### Añadido

- **⚔️ Tus partidas.** El historial de las partidas jugadas **contra otras
  mascotas**: contra quién, cómo acabó, la marca de aquel día y cuándo fue. Está
  en **Juegos**, junto a «Tus récords» y «Marcador global».

  Las partidas contra tu propia mascota no entran: de ésas ya lleva la cuenta
  «Tus récords», y lo que aquí tiene valor es contra quién jugaste.

  Se guardan en el mismo sitio que el marcador, pero **sólo las ves tú**: el
  marcador es una tabla de máximas y se lee entera; con quién juegas y cuándo,
  no. Leer el historial exige el secreto que vive en tus ajustes, así que
  perderlos es perderlo, igual que pasa con tus récords.

  Cada mascota apunta su propia fila con el nombre de la otra dentro, de modo
  que no hay una verdad compartida que defender sino el cuaderno de cada cual. Y
  el servidor recorta a las cien últimas por dueño, así que esto no crece sin
  fin.

  **Las jugadas no se guardan**, y no es un olvido: está razonado en
  [`supabase/partidas.sql`](supabase/partidas.sql).

### Notas

- Esta versión estrena una tabla en Supabase. Quien tenga su propia instancia
  tiene que ejecutar [`supabase/partidas.sql`](supabase/partidas.sql) en el
  editor SQL del panel; es idempotente y no toca nada de lo que ya haya. Sin
  ella, el panel dice que no se ha podido consultar y el resto de la app
  funciona con normalidad.
- Una mascota con esta versión y otra sin ella siguen jugando entre sí
  exactamente igual: el historial es cosa de cada una y no viaja por el canal.

## [0.29.0] - 2026-09-07

### Añadido

- **🌐 Marcador global, en una pantalla.** En **Juegos** hay ahora dos botones a
  la misma altura: **🏅 Tus récords**, que es lo tuyo, y **🌐 Marcador global**,
  que es lo de todos. El segundo enseña de un vistazo, juego a juego, quién
  manda y cuánta gente ha marcado, con lo último que se ha movido arriba; desde
  ahí se entra al detalle de cada juego.

  Había marcas de gente de verdad desde hacía días y no las veía nadie: el
  marcador de todos sólo existía dentro de «Tus récords», detrás de un icono, y
  con trece juegos con marca enterarse de dónde había movimiento costaba trece
  pantallas. Ahora es una sola petición que trae la tabla entera.

- **El chat recuerda.** El histórico ya no se va al cerrar la mascota: se guarda
  en tu equipo —un fichero propio en el escritorio, el almacenamiento del
  navegador en la extensión— y sube de 50 mensajes a 2000.

  Con eso llegan los **no leídos**: el menú de la mascota lleva la cuenta al
  lado de **💬 Chat**, el panel se abre por la raya de «nuevos» en vez de por el
  final, y de lo antiguo se pinta el último trozo y el resto se trae subiendo.

  Se guardan **en tu equipo y en ningún sitio más**. Los mensajes viajan por
  broadcast y no quedan en ningún servidor, así que lo que se dijera con la
  mascota apagada no lo tiene nadie.

### Cambiado

- **Las partidas por red se juegan en su propio canal.** Hasta ahora todas las
  jugadas de todas las partidas iban por el canal común: con veinte mascotas
  conectadas, las veinte recibían cada golpe de minigolf de una pareja ajena
  para descartarlo por su cuenta. Ahora los dos jugadores se van a un canal para
  ellos solos.

  El reto sigue saliendo por el común —hasta que alguien reta no hay sala a la
  que ir— y contra una mascota que todavía no sepa hacerlo se juega por el común
  exactamente como antes. Quién puede se sabe por lo que cada una anuncia saber
  hacer, nunca por su número de versión, así que las dos versiones conviven sin
  que nadie se quede sin jugar.

- **«Hablar» se llama ahora «Chat».** Tenía sentido cuando era una caja para
  soltar una frase; con conversación que sigue ahí mañana y mensajes por leer,
  lo que hay detrás es un chat.

### Corregido

- **Volver desde el marcador de un juego vuelve por donde entraste.** Llevaba
  siempre a «Tus récords», así que entrar por el marcador global y salir por el
  otro lado parecía que el panel se hubiera perdido.

### Notas

- La extensión de Chrome se actualiza descomprimiendo el zip encima de la
  carpeta anterior; la app de escritorio se actualiza sola.
- Las marcas del marcador **las declara cada mascota y nadie las comprueba**:
  sin un servidor que juegue la partida eso no se puede verificar, y por eso
  siempre se enseña el nombre de quien la declara.

## [0.28.1] - 2026-09-07

### Corregido

- **El chat se abre por el último mensaje.** Se abría por el primero y había
  que bajar a mano para ver lo último dicho, que es justo a lo que uno va. La
  orden de ir al fondo estaba puesta desde siempre, pero se perdía: el panel se
  construye antes de meterlo en la página, y hasta entonces la lista no tiene
  alturas que medir.

### Cambiado

- **Y el fondo deja de ser obligatorio.** Si has subido a releer algo, un mensaje
  nuevo ya no te devuelve abajo de un tirón; sólo sigue al fondo quien ya estaba
  al fondo.

## [0.28.0] - 2026-09-07

### Añadido

- **🚢 Hundir la flota.** Nivel 49, 2200 cuacks. Mar de 7 × 7 y cinco barcos:
  uno de cuatro, dos de tres y dos de dos. Los colocas tú —con botón de girar y
  previa al pasar por encima, o «Barajar» si no quieres pensarlo— y luego a
  buscar. **Acierto, repites.** Los dos mares van en pestañas.

  Contra tu mascota, que caza y remata; o contra otro pato.

  Y en red **la flota no viaja**: se manda sellada, se contesta tiro a tiro, y al
  acabar se revela. Entonces no sólo se comprueba que sea la que había prometido,
  sino que **todas las respuestas cuadran con ella**: mentir en una sola casilla
  se ve, y te dice en cuál.

  La marca son los **disparos** —menos es mejor— y sólo se apunta si ganas: si
  pierdes, haber tirado poco es que te hundieron antes, no un récord.

## [0.27.1] - 2026-09-07

### Cambiado

- **En el 🔤 Ahorcado, los fallos dibujan la horca.** Antes se gastaban plumas.
  La figura es el juego: cada fallo añade un trazo —cabeza, cuerpo, dos brazos y
  dos piernas— y al sexto se acabó. La base, el poste, la viga y la cuerda están
  desde el principio.

## [0.27.0] - 2026-09-07

### Añadido

- **🔤 Ahorcado.** Nivel 43, 1925 cuacks. Adivina la palabra letra a letra;
  seis fallos y se acabó.

  **Contra tu mascota**, que va sacando palabras —todas de patos y de agua, y te
  lo dice— y las encadena hasta que una se te resiste. La marca es cuántas
  llevas seguidas.

  **O contra otra mascota**, y ahí los dos ponéis palabra a la vez y cada uno
  adivina la del otro: nadie se queda mirando. Gana quien la saque con menos
  fallos.

  Y en red **nadie ve la palabra del otro**: no viaja. Se manda su largo y una
  promesa sellada, se contesta letra a letra, y al final se revela para que el
  otro compruebe que era la que había prometido. Cambiarla a mitad para que no
  se acierte nunca deja rastro.

## [0.26.0] - 2026-09-07

### Añadido

- **👾 Invasores.** Nivel 38, 1700 cuacks, en la pantalla entera. Tu mascota se
  mueve por abajo con **← →** y pone huevos hacia arriba con **espacio**;
  enfrente, filas de gaviotas que van de lado, bajan un escalón al tocar un
  borde y aceleran según quedan menos. Que lleguen a tu altura es el final.

  **Sólo dos huevos en el aire a la vez**, como manda el género: aporrear el
  espacio no sirve, hay que apuntar. Ellas también disparan —siempre la de más
  abajo de cada columna— y cada impacto cuesta una de tus **tres vidas**.

  Se guarda **la oleada a la que llegas**. Cada una trae una fila más, empieza
  más abajo y va más rápida; en la duodécima, la última gaviota corre más que
  tú.

### Cambiado

- **Una regla más en el contrato de los minijuegos, y comprobada por el CI.** Ni
  un `const` ni un `let` después del `return` de `crearPartida`: ahí no se izan y
  revientan dentro de un callback, sin traza visible. Había mordido tres veces
  —Memoria se quedaba muda tras la primera carta, el Minigolf por turnos
  reventaba al llegar el primer golpe del rival, y El suelo es lava ni abría—.
  A la cuarta la encuentra `npm run juegos:check`.

## [0.25.0] - 2026-09-07

### Añadido

- **🌋 El suelo es lava.** Nivel 33, 1475 cuacks, en la pantalla entera. Del
  techo caen bloques que flotan un momento y **se van hundiendo porque la lava
  los derrite**. Hay que ir saltando de uno a otro: el que pisas baja más
  deprisa que los demás, así que quedarse quieto no es una opción.

  Se mueve con **← →** (o A y D) y se salta con **espacio** —mantenerlo pulsado
  salta más alto—. Es el primero que se juega con las dos manos.

  Se guarda **los segundos que aguantas**. Al empezar, el bloque que pisas te da
  unos seis segundos para elegir el siguiente; al minuto de partida, dos. Los
  más altos duran más, y se les nota el calor: cuanto más rojo, menos le queda.

## [0.24.0] - 2026-09-07

### Añadido

- **⛳ Minigolf contra otra mascota, por turnos.** El primero de pantalla
  completa que se juega en red: se reta desde el propio panel del juego, como el
  tres en raya.

  Cada uno con su bola **en el mismo recorrido** —sale de la misma semilla, así
  que los dos veis el mismo campo aunque uno juegue en un monitor grande y el
  otro en un portátil— y los golpes se alternan. Quien emboca se queda mirando
  mientras el otro termina el hoyo, y cuando los dos han acabado pasáis al
  siguiente. **Gana quien acabe los diez con menos golpes.**

  Verás su bola —azul, con su inicial— haciendo el recorrido de verdad de cada
  golpe suyo, no apareciendo de golpe en el destino.

  Contra alguien, lo que decide la partida es el marcador y no el récord; tus
  golpes siguen subiendo al marcador global igual.

### Corregido

- **Un juego de pantalla completa en red se quedaba colgado si el rival se iba.**
  No tenía panel que cerrar —tiene la pantalla prestada— y nadie sabía
  devolverla. Ahora se cierra y te lo cuenta.
- **Y no pagaba el doble.** Las partidas contra otra mascota pagan el doble de
  cuacks, pero las de pantalla completa se cobraban como si fueran en solitario.

## [0.23.1] - 2026-09-04

### Cambiado

- **Los 🧱 Ladrillos ya no se quedan sin cuesta.** Tenían tres escalones de
  dureza puestos a mano y ahí se acababan: pasado el muro 12 el juego no se
  ponía más difícil. Ahora la dureza sube sola y **sin techo**.

  Se van convirtiendo filas de arriba abajo al siguiente número de golpes, y
  cuando el muro entero está en ese número, empieza otra vuelta con el
  siguiente: todo de un golpe hasta el segundo muro, **todo de dos en el sexto**,
  **todo de tres en el décimo**, de cuatro en el catorce… En el muro 26 hacen
  falta siete golpes por ladrillo.

  Los duros siguen yendo arriba, que es lo que obliga a abrirse un hueco y colar
  la pelota por él en vez de barrer de abajo a arriba.

- **Y pagan más.** Los puntos por ladrillo pasan a 10, 30, 60, 100, 150… según
  lo que costara tirarlo. Suben más deprisa que el esfuerzo, a propósito: así
  compensa meterse con las filas de arriba.

## [0.23.0] - 2026-09-04

### Añadido

- **🧱 Ladrillos.** Nivel 28, 1250 cuacks, en la pantalla entera. Tu mascota
  hace de pala abajo del todo y se mueve a izquierda y derecha con el ratón;
  arriba, un muro de ladrillos que hay que tirar. **Tres vidas.**

  Cada muro que limpias trae otro con una fila más y la pelota más rápida, y a
  partir del tercero aparecen ladrillos que aguantan dos golpes —y tres desde el
  sexto—. Los duros van arriba a propósito: obligan a abrirse un hueco y colar la
  pelota por él en vez de barrer de abajo a arriba.

  Se guarda como marca el total de **ladrillos rotos**, no el muro al que
  llegaste: los muros se cuentan con los dedos de una mano y un marcador donde
  todo el mundo empata en «4» no compara nada.

  Con éste son tres juegos de mantener la pelota en el aire, y hacía falta que se
  notaran distintos: en «{mascota} Jumping» la mascota **es** la pelota, en el
  Pong es una pala **vertical** contra un rival, y aquí una pala **horizontal**
  contra un muro. El Pong es defenderse; esto es apuntar.

## [0.22.0] - 2026-09-04

### Añadido

- **🏓 Pong.** Nivel 24, 1075 cuacks, en la pantalla entera. Tu mascota es la
  pala de la izquierda y sigue al ratón —pero no al instante: tiene su
  velocidad, y llegar a tiempo es medio juego—. Enfrente, la máquina. Gana quien
  llegue a **siete**.

  Es el primero donde **ganar y batir el récord son dos cosas distintas**: lo que
  se guarda como marca es el **peloteo más largo**, no el resultado. Se puede
  perder 7-3 y firmar la mejor marca de tu vida.

  La máquina aprende con tu nivel: en el 24 falla una de cada tres y en el 40 no
  falla casi nunca —hasta que la pelota se pone seria—. Porque la pelota acelera
  con cada golpe, y llega un momento en que va demasiado deprisa para leerla:
  ahí es donde se acaban los puntos, como en el Pong de siempre.

## [0.21.0] - 2026-09-04

### Cambiado

- **El ⛳ Minigolf pasa de cinco hoyos a diez, y deja de ser siempre el mismo.**
  Antes cambiaban los números pero no la forma: muros verticales en columnas,
  salida a la izquierda, hoyo a la derecha, hoyo tras hoyo. Ahora el recorrido
  entero se sortea en cada partida —hasta el lado al que se juega— y va creciendo:
  **el hoyo 1 está vacío y el 10 tiene nueve cosas por medio**.

  Y no sólo más cosas: cosas distintas, que van entrando poco a poco para que
  cada una se aprenda sola.

  | Desde el hoyo | Aparece | Qué hace |
  |---|---|---|
  | 1 | muro vertical | con hueco arriba o abajo |
  | 3 | muro horizontal | corto: se rodea por un lado |
  | 4 | bloque suelto | en cualquier sitio |
  | 5 | 🏖 arena | frena cuatro veces más que el césped |
  | 7 | 💧 agua | un golpe de más, y a repetir desde donde saliste |
  | 8 | 🟡 tope | te devuelve con más fuerza de la que llevabas |

  El par de la vuelta es 38.

- **Si tardas, el juego cierra la ronda él.** A los ocho minutos y medio da por
  perdidos los hoyos que falten y apunta la marca. Antes, una ronda muy larga se
  comía el límite del escenario y se perdía entera, sin resultado: perder por
  lento es una derrota, perderlo todo era un fallo.

### Corregido

- **Una marca de otras reglas ya no se queda ahí para siempre.** Los 24 golpes
  que se podían hacer en el recorrido de cinco hoyos son imposibles en el de
  diez, así que ese récord no lo iba a batir nadie nunca. Ahora, cuando un juego
  cambia cómo puntúa, **su récord se borra** —y sólo el récord: las partidas y
  las victorias siguen contadas, que ésas se jugaron de verdad—. Le pasará a
  cualquier juego que se retoque, así que el arreglo vale para todos.

## [0.20.0] - 2026-09-04

### Añadido

- **⛳ Minigolf.** Nivel 20, en la pantalla entera, y **el primero que hay que
  comprar**: 900 cuacks. Cinco hoyos vistos desde arriba, con muros de madera en
  medio y la bandera al fondo. Se apunta como en «Pato Hook» —hacia el cursor, y
  la fuerza sale de lo lejos que esté— pero lo que sale rodando es una bola por
  el césped. Tu mascota se queda abajo, fuera del campo, mirando.

  Es también **el primero que puntúa a menos**: el récord se bate bajando, no
  subiendo. Gana quien acabe los cinco hoyos con menos golpes.

  Tres cosas que conviene saber antes del primer tiro:

  - **Deprisa se pasa de largo.** Si la bola llega lanzada, se lleva el hoyo por
    delante. Medir la fuerza importa tanto como apuntar.
  - **Las bandas devuelven**, y bastante: los muros nunca cruzan el campo entero,
    así que siempre hay hueco por arriba o por abajo— pero el camino corto suele
    ser el de banda.
  - **Ocho golpes por hoyo y se pasa al siguiente**, con los ocho apuntados. Una
    bola atascada no puede dejarte la partida colgada.

## [0.19.0] - 2026-09-04

### Cambiado

- **Los juegos ahora cuestan cuacks —y lo que ya tenías sigue siendo tuyo.** En
  la 0.18.0 los diez juegos de siempre eran gratis para todo el mundo, y eso
  dejaba con el catálogo entero regalado a quien instalase mañana. Lo que había
  que proteger no era el juego: era lo conseguido.

  Ahora **todos llevan precio menos el de nivel 1** —que es la puerta: sin uno
  con el que empezar a ganar no habría forma de comprar el segundo—, y al
  estrenar el monedero **se te regalan de golpe todos los que tu nivel ya tenía
  abiertos**. Las dos cosas a la vez no se contradicen: la diferencia no es el
  juego, es cuándo se abrió.

  | Quién eres | Se te regalan | Pagas |
  |---|---|---|
  | Instalas hoy, nivel 1 | sólo el de nivel 1 | los otros nueve |
  | Venías jugando, nivel 10 | siete | Jumping, Flappy y The Hole |
  | Venías jugando, nivel 16 o más | los diez | nada |

  Y sí, los que **todavía no** habías abierto por nivel se pagan aunque lleves
  meses con tu mascota. Un juego que aún no tenías no era tuyo; ahí no se le
  quita nada a nadie. Los precios van de 100 («Pato dice») a 725 (The Hole), y
  cada uno sale por unas veinte partidas del anterior.

- **El saldo de arranque cambia de sentido.** Ya no compensa lo de atrás —de
  eso se encarga el regalo—: está para lo de delante, para que a quien le falten
  juegos por abrir no le cambien las reglas justo al llegar al siguiente. Siguen
  siendo cinco cuacks por partida jugada, con tope de 500.

- **El aviso de subir de nivel dice el precio.** Anunciar «Nuevo juego: Par o
  impar» y que al abrir el panel resulte que hay que comprarlo sería prometer de
  más. El nivel lo ABRE, y ahora el cartel lo dice tal cual: «Par o impar ·
  🪙 125».

## [0.18.0] - 2026-09-04

### Añadido

- **🪙 Los cuacks.** Una moneda que se gana jugando. El nivel te ABRE un juego
  y los cuacks te lo COMPRAN, así que subir de nivel deja de ser lo único que
  hay que hacer. El saldo sale arriba en 🎮 Juegos, lo que paga cada partida
  sale en el pie, y hay un desplegable que lo explica entero.

  Lo que paga una partida sube con el nivel del juego: comprar el siguiente
  cuesta unas cuarenta partidas del último que tengas, y entre 180 y 610 si te
  empeñas en machacar el más tonto contra la máquina. No hay nada que lo
  prohíba; simplemente no sale a cuenta. Jugar contra otra mascota paga el
  doble, y en los juegos de marca batir tu récord ya cuenta como ganar.

  **No hay tope diario**, al revés que con la experiencia: el freno ya lo pone
  el cansancio de tu mascota, que de ochenta de energía da para ocho partidas.

- **El «No tocar» paga.** Pasar las diez cuentas del peaje da **120 + tu nivel
  × 10** cuacks, una vez al día. La cifra se dice en Ajustes antes de que lo
  pulses, porque es la mitad del trato. La otra mitad sigue sin adornarse: son
  diez cuentas con reloj, fallar te devuelve a la primera y el consejo no ha
  cambiado.

### Cambiado

- **Los juegos que ya tienes son gratis para siempre.** Los diez que había
  valen 0 y van a seguir valiendo 0: quitarte algo que ya usabas para
  vendértelo después no se hace. La moneda empieza a contar con los juegos que
  vengan —el primero será el Minigolf—.
- **Y si ya venías jugando, empiezas con saldo.** Al estrenar el monedero se
  abonan cinco cuacks por cada partida que ya tuvieras guardada, hasta 500. Sale
  de tus partidas de verdad, no de un número inventado, y se paga una sola vez.

### Corregido

- **El marcador global ya se encuentra.** Estaba, y la única puerta era pulsar
  una fila de 🏅 Tus récords sin que nada lo dijera. Ahora las filas que
  llevan a un marcador terminan en 🌐 y el pie de la lista lo explica.

## [0.17.0] - 2026-09-04

### Añadido

- **🌐 Marcador global.** Las marcas de los juegos de puntuación ya no se
  quedan en tu ordenador: se comparan con las de todos los patos. Se entra
  desde **🏅 Tus récords**, pulsando la fila del juego —las que llevan
  marcador salen con un 🌐 al final—, y sale la tabla de los veinte
  mejores con el nombre de cada pato.

  Sube sola cuando bates tu propia marca, y sólo entonces: si la partida no
  mejora lo tuyo, no se manda nada. Los juegos que sólo se ganan o se pierden
  no tienen tabla, porque una lista de victorias no compara nada.

  Y se dice donde se lee: **lo declara cada pato y nadie lo comprueba**. Sin un
  servidor que juegue la partida, una marca es lo que su dueño dice que es;
  presentarlo como verificado sería mentir, y además explica por qué sale el
  nombre de quien la firma.

### Seguridad

- **Tus récords son tuyos y de nadie más.** Cada instalación estrena una firma
  privada que no sale de ella —ni al pato, ni a la extensión, ni por la red— y
  en la tabla el dueño de una fila es el hash de esa firma. Nadie puede
  escribir sobre la marca de otro ni reservarse un nombre. La contrapartida es
  honesta: **si pierdes la instalación, pierdes las filas**, porque no hay a
  quién reclamarlas.

## [0.16.0] - 2026-09-04

### Cambiado

- **El peaje del «No tocar» ahora aprieta.** Cada una de las diez cuentas tiene
  su reloj —de 7 s la primera a 25 s la última— y **quedarse sin tiempo o
  contestar mal devuelve a la primera**. Además el orden se baraja en cada tanda
  y se vuelve a barajar al empezar de nuevo, así que repetirlo no enseña la
  secuencia. Va a pagar cuacks cuando exista la moneda, y por eso deja de ser un
  trámite. Lo que no cambia: el botón de «Vale, sigo» sigue cerrándolo para
  volver a los patos, y las salidas que no se negocian —los diez minutos, el
  icono de la bandeja y el apagado— siguen intactas.

- **«Pato Hook» y «Pato Jumping» se intercambian**: Hook pasa al nivel 9 y
  Jumping al 12. Apuntar sin prisa es más fácil que seguir una pelota con el
  ratón, y estaban al revés. Si estás justo entre el 9 y el 11, Jumping se te
  vuelve a cerrar un rato; **tus marcas no se pierden**.
- **La escalera de niveles ya no tiene techo.** Estaba encajada a la fuerza en
  50; ahora lo fijo es la regla —cada juego se coloca un poco más arriba que el
  anterior, y el hueco crece— y los niveles se amplían con los juegos que
  vengan. Los rangos acompañan: siguen hasta «Cuack eterno» en el 70, y se
  alargan cuando haga falta.

## [0.15.0] - 2026-09-04

### Añadido

- **🪶 «Flappy Pato».** Nivel 14, en la pantalla entera. Tu mascota cae sola y
  cada golpe de **espacio** le da un aletazo; hay que colarse por los huecos
  entre columnas. Es el Runner con la gravedad cambiada de bando: allí decides
  cuándo saltar, aquí cuándo **no** dejarla caer. El hueco se estrecha y las
  columnas se juntan según vas pasando.

### Cambiado

- **Malabares pasa a llamarse «Pato Jumping»**, con el apellido de la familia.

## [0.14.1] - 2026-09-04

### Cambiado

- **Obstáculos pasa a llamarse «Pato Runner»** —o «Cuacky Runner», o como se
  llame la tuya—. Y los dos que aún no están se apuntan con el mismo apellido:
  Aleteo será **«Flappy {mascota}»** y Derribos, **«Angry {mascota}»**.

## [0.14.0] - 2026-09-04

### Añadido

- **Los juegos de pantalla completa se presentan antes de empezar.** Malabares,
  «Pato Hook», The Hole y Obstáculos enseñan durante cinco segundos su nombre, de
  qué van —la misma línea que sale al pasar por encima del botón— y una cuenta
  atrás. Ahí no hay panel donde leer nada, y un juego de reflejos que arranca de
  golpe no se entiende la primera vez. Mientras dura la cuenta el juego está
  quieto de verdad: no empieza a caer nada ni se gasta un disparo.

- **🌵 Obstáculos.** Nivel 8, en la pantalla entera. Tu mascota corre, el suelo
  pasa por detrás y con la **barra espaciadora** salta lo que venga: cactus
  bajos, altos y dobles. Y a partir de un rato, gaviotas a la altura de la
  cabeza, que son las que **no** hay que saltar. Un botón, dos respuestas. Se
  cuentan los metros y se acaba al primer golpe.
- Cuanto más mantienes pulsado, más alto salta —hasta un límite—, así que el
  salto no es siempre el mismo. Y el ritmo se aprieta con los metros: no es sólo
  que vaya más rápido, es que los huecos se juntan.

## [0.13.1] - 2026-09-04

### Añadido

- **🏅 Tus récords.** Un botón debajo de la rejilla del panel de juegos, con el
  número de partidas al lado. Dentro: tus totales —partidas, ganadas, y cuántas
  de hoy han puntuado de las ocho que caben— y una fila por juego con su mejor
  marca. Salen **todos**, también los que aún no tienes por nivel y los que no
  has tocado, porque un marcador vacío es una invitación; y también las marcas de
  un juego que se te haya vuelto a bloquear, que ésas no se pierden nunca.

## [0.13.0] - 2026-09-04

### Añadido

- **🕳️ The Hole.** Nivel 16, en la pantalla entera. Caen mascotas desde arriba y
  tú llevas un agujero por el suelo: las que caen dentro, dentro. Las que no,
  **se quedan en el suelo** —no desaparecen, no se limpian, y van tapando el
  sitio por donde te mueves, porque un montón que te llega por encima no lo
  atraviesas—. Se acaba cuando ya no cabe ninguna más.
- Es **incremental**: una barra se llena con cada mascota recogida y al llenarse
  sube el calibre —de una en una, de dos en dos, de tres en tres— mientras la
  barra pide cada vez más. Cada calibre nuevo es un regalo y una condena a la
  vez, y es lo que le pone freno a un incremental que si no, no acabaría. La
  marca es el calibre más alto al que llegaste.
- Las que caen son mascotas de verdad, con los diseños que tengas desbloqueados,
  y caen con la misma física con la que vuela la tuya. Pasar el agujero por
  debajo de un montón lo va limpiando, aunque eso no puntúa: para subir de
  calibre hay que cazarlas al vuelo.
- **⚠️ No tocar.** Al final de Ajustes, en rojo y con su separador. Se pulsa, y
  sale un cartel que dice que no debiste hacerlo mientras empiezan a caer patos.
  Si haces clic en uno, se parte en dos más pequeños. Y otra vez. No se gana ni
  se puntúa: no es un juego, es una broma —no da experiencia, no cuenta partidas
  y no cansa a tu mascota, que se pone triste y te dice que te lo había avisado—.
  Sobre una página web ajena el botón ni aparece.
- **Y salir tiene peaje.** Pulsar Esc o el botón de salir no te saca: te pone
  **diez cuentas**, cada una más gorda que la anterior y cada una con su
  reprimenda. Se empieza en `8 + 9` y se acaba en `16³ + √1600 − 808`, con
  raíces y potencias por el medio. Al resolver la décima, sales. Está hecho para
  poder pasarlo: salen todas enteras, fallar repite la misma cuenta —ni reinicia
  ni castiga—, no hay reloj, y hay un botón para cerrarlo y seguir. Y pase lo que
  pase, la broma se acaba sola a los diez minutos, o se cierra el pato desde el
  icono de la bandeja.
- **El puntero cambia según lo que haya debajo**: una mira en la pantalla y una
  explosión encima de un pato, para que se vea cuál se puede reventar.

### Cambiado

- **La barra de tareas ya no se queda debajo del pato.** La ventana cubre el
  monitor entero para que el pato pueda caminar por la barra, pero con un panel
  abierto o una partida en marcha el ratón está capturado, y eso dejaba el icono
  de la bandeja —que es por donde se cierra el pato— tapado por una ventana
  transparente. Ahora esa franja nunca captura, así que **siempre se puede cerrar
  el pato desde el icono de junto al reloj**. Arrastrando sí sigue capturando:
  soltar al pato sobre la barra tiene que poder hacerse.
- **Los juegos se reparten hasta el nivel 50.** Hay gente que lleva meses con el
  pato y ya no tenía nada que desbloquear, así que la cuesta se estira: tres en
  raya pasa al 6, Malabares al 9, «Pato Hook» al 12 y The Hole al 16, y los que
  faltan por hacer se colocan entre el 8 y el 50. Con un día activo normal, el
  nivel 16 son unos seis días y el 50, treinta y dos. **Lo que ya hayas jugado no
  se pierde** aunque un juego se te vuelva a bloquear: las marcas se guardan
  aparte del catálogo.
- **Los rangos llegan hasta el nivel 50**, para acompañarlos. Se acababan en
  «Leyenda» al 20, que era el techo de cuando lo único que se desbloqueaba eran
  diseños. Ahora siguen cada cinco niveles: Capo, Padrino, Intocable, Jefe de
  jefes, Mito y Cuack supremo.
- **Puntería pasa a llamarse «Pato Hook»** —o «Cuacky Hook», o como se llame la
  tuya—, que es Robin Hood pasado por el pato. **Toques con la paleta** pasa a
  ser **Malabares**, que es lo que se hace ahí y cabe en la tarjeta. Y **El
  agujero**, a **The Hole**. El nombre «Pong» se deja libre a propósito: va a
  haber uno de verdad.
- **El selector de juegos cabe otra vez.** Con ocho juegos la rejilla medía 305
  píxeles y el panel entero 405, así que acababa colocándose debajo del pato.
  Ahora enseña dos filas y se desplaza.

## [0.12.0] - 2026-09-03

### Añadido

- **Puntería.** Nivel 8, en la pantalla entera. Apuntas con el ratón, sueltas, y
  tu mascota sale volando contra cinco dianas. Seis disparos: diez puntos por
  diana, veinticinco si le das al centro, y cinco más por cada disparo que te
  sobre si las limpias todas.
- Se dispara con **el mismo lanzamiento con el que le tiras estando quieta**, así
  que quien ya sabe lanzar a su mascota por la pantalla ya sabe jugar. Al apuntar
  se ve la salida del tiro —sólo el principio: con la parábola entera dibujada
  dejaría de ser un juego de puntería—, y las paredes devuelven bastante a
  propósito, porque el tiro de banda es la jugada bonita que tiene.

## [0.11.0] - 2026-09-03

### Añadido

- **Memoria.** Nivel 4. Doce cartas boca abajo, seis parejas:
  destapas dos, si son iguales se quedan y repites, y si no se tapan y le toca
  al otro. Se juega contra tu mascota o contra otra por red.
- **Las cartas son tu mascota haciendo cosas** —durmiendo, comiendo, con un
  regalo— recortadas de las mismas hojas de sprites con las que se dibuja el
  pato. Cada pareja es una pose distinta y nunca se repite ninguna: si dos caras
  se parecieran, dejaría de ser un juego de memoria. Los diseños que tengas
  desbloqueados se reparten entre las seis poses, así que la baraja gana
  variedad a la vez que la colección.
- Contra la mascota, **se acuerda mejor según el nivel**: empieza despistada y
  acaba siendo implacable. En este juego acordarse *es* jugar bien, así que con
  memoria perfecta desde el principio no habría partida.

## [0.10.0] - 2026-09-03

### Añadido

- **«Pato dice», el Simón de toda la vida.** Nivel 2. Tu mascota canta una serie
  de colores y tú la repites; si aciertas, la serie crece en uno. No se gana: se
  aguanta, y lo que se guarda es hasta qué ronda llegaste. Cada botón lleva
  siempre la misma nota —sol, do, mi, sol, un acorde de do mayor— así que
  cualquier serie suena a algo y se acaba recordando la melodía antes que los
  colores. Hay cinco segundos por pulsación: sin reloj, un Simón se resuelve
  apuntando la serie en un papel.
- **Un juego puede llamarse por el nombre de tu mascota.** Si en el catálogo
  pone `{mascota}`, se cambia por el que tengas en Ajustes. De ahí que el juego
  nuevo se llame «Pato dice», «Cuacky dice» o lo que corresponda, en la tarjeta,
  en la cabecera del panel y en el aviso de subir de nivel.

## [0.9.2] - 2026-09-03

### Añadido

- **Las partidas por red sobreviven al cambio de pestaña.** En la extensión el
  pato se muda cada vez que el usuario cambia de pestaña, y hasta ahora eso se
  llevaba por delante la partida: el pato avisaba de que se había quedado atrás
  y la soltaba. Ahora el worker le devuelve los mensajes que guardó, la sala se
  rehace y la partida sigue donde estaba, sin que el rival tenga que repetir
  nada ni enterarse de nada. Se recupera el tablero del tres en raya entero y el
  marcador de piedra-papel-tijera y par o impar; la ronda que estuviera a medias
  de esos dos se vuelve a elegir, porque el compromiso se firmó con una sal que
  sólo vivía en la pestaña anterior.

### Corregido

- **Mudarse de pestaña ya no es rendirse.** Al cambiar de pestaña, el pato
  mandaba al rival el mismo aviso de abandono que al salir de la partida a
  propósito —dos veces, además: una al cerrar la sala y otra al cerrar el panel—.

## [0.9.1] - 2026-09-02

### Añadido

- **Buscar actualizaciones a mano, y aplicarlas sin esperar.** En Ajustes, bajo
  la versión. Lo automático sigue exactamente igual —comprueba al arrancar,
  descarga sola e instala al salir—, pero tenía dos huecos que se notaban: sólo
  mira UNA vez, al arrancar, así que un pato que lleve abierto desde antes de
  que saliera la versión no se entera por mucho que espere; e instala al SALIR,
  y el pato vive en la bandeja, donde cerrar la ventana no es salir. De ahí lo
  de abrir y cerrar varias veces hasta que se aplica. Ahora se puede mirar
  cuando uno quiera, se ve en qué anda (comprobando, descargando con su
  porcentaje, al día, o el error), y cuando hay una descargada el mismo botón
  pasa a **Reiniciar e instalar**. En la extensión no aparece: de ésa se encarga
  Chrome.

  *Con red de seguridad en todas las salidas:* si la comprobación no contesta en
  20 s, si resuelve sin decir nada, o si no hay actualizador que preguntar, se
  dice — en vez de dejar el "Mirando si hay algo nuevo…" puesto para siempre. Y
  "Reiniciar e instalar" no cierra el pato si no hay nada descargado que
  instalar.

## [0.9.0] - 2026-09-02

### Añadido

- **Toques con la paleta** (nivel 7). Mantener a la mascota en el aire sin que
  toque el suelo, dándole con una paleta que sigue al ratón. Se cuenta cada
  toque y se guarda el récord. Es el primer juego que **toma prestada la
  pantalla entera**: en vez de un tablero dentro de un panel, pilota a la propia
  mascota con la misma física con la que vuela cuando la lanzas — sólo cambian
  los números, y quién manda. Golpear con el borde la desvía, y el movimiento de
  la paleta se le pega, así que se puede colocar el toque siguiente. Sólo se
  ofrece donde la mascota tiene la pantalla para ella: escritorio y panel
  lateral, no sobre una página ajena.

## [0.8.1] - 2026-09-02

### Corregido

- **Las partidas por red ya no se quedan colgadas nada más empezar.** Los dos
  jugadores elegían y se quedaban esperando al otro para siempre. La sala se
  monta en cuanto arranca la partida, pero el juego tarda un poco más —su módulo
  se trae con `import()`, y en la extensión eso se nota—; si el rival era
  rápido, su primera jugada llegaba en ese hueco, la sala la confirmaba y
  avanzaba la secuencia, y luego no había nadie a quien dársela. Se perdía para
  siempre. Ahora se guarda hasta que el juego esté escuchando.
- **Un pato podía no verificar el compromiso del otro.** El de escritorio firma
  con `sha256` y el que vive sobre una página `http://` cae a un respaldo,
  porque `crypto.subtle` sólo existe en contexto seguro. Se recalculaba con el
  algoritmo de casa, así que entre esos dos NINGUNA jugada cuadraba y todas se
  daban por trampa. Ahora se verifica con el algoritmo que dice el propio
  compromiso.
- **El invitado ya no puede esperar indefinidamente.** El plazo para revelar lo
  armaba sólo el anfitrión; ahora lo arman los dos, y sólo cuando ambos están
  comprometidos (antes no sería justo: el otro puede estar pensándoselo).

### Añadido

- **Rastro de las partidas por red en desarrollo.** Una partida pasa por cuatro
  sitios —dos patos y dos transportes— y sin ver los mensajes no hay forma de
  saber en cuál se corta; encontrar lo de arriba fue exactamente eso. También
  `__pato.estadoDeJuego()` para un vistazo rápido. Y una jugada que no puede
  salir lo dice, en vez de callarse.

## [0.8.0] - 2026-09-01

### Añadido

- **Dos juegos más: piedra, papel o tijera y par o impar.** Los dos al mejor de
  tres, contra tu mascota o contra otra por red. En par o impar uno pide par, el
  otro se queda con impar, y cada uno saca un número del 0 al 5: la suma decide.
- **Jugadas a la vez, y en secreto.** Es lo que hacía falta para que esos dos
  juegos sean justos: si mando mi jugada antes que el otro, el otro la ve y gana
  siempre. Ahora primero viaja el *hash* de la jugada y sólo cuando los dos están
  comprometidos se revelan los valores, así que cambiar de idea al revelar se
  nota y se dice. Quien no revele a tiempo pierde la ronda.
- **Un pato de pruebas**, para poder ser dos sin liarla: `npm run pato:pruebas`
  levanta una instancia aparte, con su propio perfil y el nivel que se le pida,
  que convive con la de siempre sin tocarle el estado ni los ajustes. Hacía
  falta para probar el multijugador, que es cosa de dos.

### Cambiado

- **Los juegos se ordenan por lo que cuestan y se desbloquean escalonados:**
  piedra, papel o tijera en el nivel 1; par o impar en el 3; tres en raya en el
  5. *Tres en raya estaba en el 1, así que quien vaya por debajo del nivel 5 lo
  verá con candado hasta llegar.* A cambio, el catálogo tiene por fin una cuesta
  que subir en vez de un único juego suelto.

### Corregido

- **El recado de una visita ya no se borra mientras lo escribes.** La lista de
  Conectados se repinta cada vez que alguien entra o sale del canal, y el cajón
  del recado se reconstruía con ella: perdías lo escrito y el foco a media
  palabra. Con gente conectada pasaba tan a menudo que era imposible escribir
  nada. Ahora el cajón se guarda entero y se le devuelven el cursor y el foco.
- **El resultado de cada ronda se ve.** En piedra, papel o tijera y en par o
  impar era una línea pequeña que se borraba en algo más de un segundo: no daba
  tiempo a mirar qué había sacado el otro, que es media gracia del juego. Ahora
  sale en grande —los iconos enfrentados, o la cuenta de la suma— con el
  veredicto en color, y dura más del doble. El hueco está reservado siempre, así
  que el tablero ya no pega un salto entre rondas.

## [0.7.0] - 2026-09-01

### Añadido

- **Minijuegos.** Nueva entrada `🎮 Juegos` en el menú de la mascota, con un
  catálogo que se desbloquea por nivel igual que los diseños. Entra jugable
  **Tres en raya** contra tu mascota, con una IA que va dejando de fallar a
  propósito a medida que sube de nivel. Terminar una partida da experiencia (+4,
  +8 más si se gana) con un tope de ocho al día, para que jugar en bucle no sea
  la vía rápida para subir; y jugar gasta energía, así que una mascota agotada
  no juega. Las partidas, victorias y récords se guardan por juego.
- **El sistema que gobierna los juegos**, pensado para que añadir uno nuevo sean
  tres pasos y ningún cambio en `app.js`: un catálogo
  ([`src/core/game/minijuegos/index.js`](src/core/game/minijuegos/index.js)),
  un marco de partida que se encarga de cargar el módulo, apagar sus bucles,
  contar el resultado una sola vez y repartir la experiencia, y un contrato de
  una sola función. Está contado en
  [`docs/MINIJUEGOS.md`](docs/MINIJUEGOS.md).
- **Juegos de escenario**: un juego puede tomar prestadas la mascota y la pantalla
  entera en vez de vivir en un panel. La devolución va protegida por cuatro
  capas independientes, porque un préstamo que no se devuelve dejaría la ventana
  transparente capturando el ratón y al usuario sin poder pulsar nada en su
  escritorio. Sobre páginas web ajenas no se ofrecen: ahí la mascota está de
  prestado.
- **Partidas por turnos entre mascotas.** Desde el panel de juegos se puede retar a
  cualquier mascota conectada; al otro le sale un aviso con su cuenta atrás, y si
  está ocupado el reto espera en el menú en vez de saltarle encima de lo que
  estuviera haciendo. Las jugadas viajan por el mismo canal que el chat, en su
  propio evento y dirigidas a una mascota concreta —igual que las visitas—, con
  numeración, confirmación y reintentos, de modo que una jugada perdida no cuelga
  la partida. Probado con un rival simulado y pérdida de mensajes provocada.
- **Identidad estable de mascota** (`patoId`), que es lo que permite reconocer al
  rival a mitad de partida aunque su clave de presencia cambie al reconectar. Una
  mascota con una versión anterior sigue apareciendo en la lista y se le puede
  hablar y mandarle la tuya; sencillamente no se le puede retar.
- **Sonidos de partida** (empezar, victoria, derrota, cambio de turno) y una
  `nota` suelta como ladrillo para los juegos que la necesiten.

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
- **La física del vuelo de la mascota vive ahora en
  [`src/core/pet/fisica.js`](src/core/pet/fisica.js)**, fuera de `app.js`. Es
  el mismo comportamiento exacto —se comprobó comparando ambas versiones sobre
  9.680 trayectorias con paso fijo, exigiendo igualdad exacta de posición,
  velocidad, sonidos, inclinación y giro—, pero ahora un minijuego puede
  pilotarla con otros números en vez de tener que copiarla. La inercia del
  cursor sale al mismo sitio ([`pet/inercia.js`](src/core/pet/inercia.js)) y la
  comparten el arrastre y los juegos.
- **El aviso de subir de nivel anuncia cualquier cosa que se desbloquee**, no
  sólo diseños. Añadir un catálogo nuevo es meterlo en una lista.
## [0.6.1] - 2026-08-31

### Añadido

- **La fila 12 del sprite (`regalo`) ya existe en los cinco diseños.** A falta de
  arte definitivo, el empaquetador la **compone** inclinando el saludo hacia
  delante desde los pies. Es un apaño declarado —sale del saludo, así que no hay
  objeto que ofrecer— para que el gesto funcione de punta a punta mientras se
  dibuja. [`docs/DISENOS.md`](docs/DISENOS.md) describe qué tiene que enseñar el
  arte final; en cuanto la fila aparezca, el empaquetador la usa y deja de
  componerla sin tocar código.

### Cambiado

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

[No publicado]: https://github.com/Mapiedra/TuCuack/compare/v0.9.1...HEAD
[0.9.1]: https://github.com/Mapiedra/TuCuack/releases/tag/v0.9.1
[0.9.0]: https://github.com/Mapiedra/TuCuack/releases/tag/v0.9.0
[0.8.1]: https://github.com/Mapiedra/TuCuack/releases/tag/v0.8.1
[0.8.0]: https://github.com/Mapiedra/TuCuack/releases/tag/v0.8.0
[0.7.0]: https://github.com/Mapiedra/TuCuack/releases/tag/v0.7.0
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
