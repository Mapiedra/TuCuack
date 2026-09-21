# Probar TuCuack en Ubuntu

Esta guía es para quien tenga una Ubuntu delante. El soporte de Linux se escribió
**sin poder ejecutarlo ni una vez**: lo que decide el guardia del ratón está comprobado
con sondas (`npm run raton:check`), pero hay cosas que ningún sustituto puede contestar
—si la ventana se pinta transparente, si se queda encima, si el sistema entrega el
ratón—. Eso es lo que se pide aquí.

**Dónde estamos.** En la **0.38.0** el pato salía y caminaba, pero no había forma de
tocarlo: se preguntaba al sistema dónde estaba el cursor y bajo XWayland esa respuesta
viene congelada (ver el CHANGELOG). La **0.38.1** lo arregla con el timbre, y está
confirmado en una Ubuntu de verdad: arranca, conecta el chat y **responde al ratón**.
Lo que sigue abierto es el resto de la lista de aquí abajo, que nadie ha recorrido
entera.

No hace falta saber del proyecto. Hace falta media hora y decir qué pasó.

---

## Instalar

Del [último Release](https://github.com/Mapiedra/TuCuack/releases), el `.deb`:

```bash
sudo apt install ./tucuack_*_amd64.deb
tucuack
```

Arráncalo **desde una terminal** la primera vez: las dos líneas que escribe al
empezar son media respuesta si algo va mal.

Si prefieres el `.AppImage`, en Ubuntu 24.04 en adelante puede negarse a arrancar con
un error de *sandbox*; se sortea con `./TuCuack-*.AppImage --no-sandbox`. Es un
problema conocido del formato, no del pato.

---

## Lo primero: dos líneas

Nada más arrancar, la terminal tiene que escribir algo así:

```
[app] linux · ratón sondeado (ver raton.js)
[raton] el pato ya dice dónde está: sondeo del cursor en marcha (y timbre puesto)
```

**Si falta la segunda**, para aquí y dilo: el pato no está publicando dónde está y no
se va a poder tocar. Todo lo demás de esta lista dará igual.

---

## Y si no se le puede tocar

Eso fue lo que pasó en la 0.38.0, y por eso el pato trae ahora herramientas para
contestar *por qué* sin adivinar nada. Si vuelve a pasar —otra máquina, otro
escritorio— haz estas dos pruebas y pega lo que salga:

```bash
tucuack --timbre-de-prueba
```

Al cabo de un segundo y medio el pato debería **pararse solo** unos cuatro segundos
(se para siempre que le señalas) y luego seguir andando. Si se para, el camino entero
—la ventanita que oye el ratón, el puente, el pato— funciona, y lo que falla es que el
sistema no le está entregando el ratón a esa ventanita.

```bash
tucuack --diagnostico
```

Escribe una línea por segundo con todo lo que el pato sabe. Mueve el ratón por la
pantalla y **mira el campo `cursor`**: si no cambia, el sistema no nos está diciendo
dónde está el ratón (es lo normal bajo XWayland) y lo que tiene que salvar la situación
es el timbre. Pasa el ratón por encima del pato y mira si aparecen líneas
`[diag] el timbre oye ...`: si aparecen, el timbre suena; si no, no le llega nada.

Pega unas quince líneas: unas cuantas con el ratón lejos y unas cuantas pasando por
encima del pato.

Y una tercera, sólo si las otras dos no aclaran nada:

```bash
tucuack --raton=siempre
```

Con esto el pato se queda el ratón de toda la pantalla (el escritorio deja de
responder: es para un minuto, no para trabajar). Si **así** se le puede señalar y
arrastrar, lo que falla es quién avisa de que el cursor ha llegado. Si ni así, es que
la ventana no recibe el ratón en absoluto, que es otra historia.

---

## Las diez cosas

Sobre cada una: **sí / no / raro**, y si es raro, en qué se nota.

1. **Aparece.** Un pato caminando por la parte de abajo de la pantalla, sin ventana,
   sin marco y **sin recuadro gris ni negro alrededor**. Un fondo oscuro en vez de
   transparente es el fallo más probable de todos.
2. **Se queda encima.** Abre una ventana cualquiera a pantalla completa. El pato tiene
   que seguir viéndose por delante.
3. **Se le puede tocar.** Acerca el ratón al pato: se para y sale su globo. Ésta es la
   pieza que se escribió a ciegas; si falla, falla todo lo demás.
4. **El escritorio sigue siendo tuyo.** Pulsa en un icono del escritorio **a un palmo
   del pato**. Tiene que responder como siempre. Si hay una zona muerta alrededor del
   pato, di **de qué tamaño** más o menos.
5. **Clic derecho.** Sobre el pato abre el menú, y se puede alimentar, jugar, limpiar
   y abrir Ajustes desde ahí.
6. **Arrastrarlo y lanzarlo.** Cógelo y suéltalo en movimiento: tiene que salir
   despedido en parábola y rebotar. Con dos monitores, arrástralo de uno a otro.
7. **La bandeja.** Tiene que haber un icono de pato arriba, con su menú. Escóndelo
   desde ahí (*Ocultar mascota*) y vuelve a sacarlo. Si no aparece el icono, di qué
   escritorio usas (Ubuntu normal, GNOME pelado, KDE…).
8. **El dock.** Con el dock abajo, el pato camina **sobre** él; con el dock a la
   izquierda (lo de fábrica en Ubuntu) camina por el borde inferior. Las dos están
   bien. Lo que no puede pasar es que el dock deje de responder.
9. **Arrancar con la sesión.** En Ajustes, marca *Arrancar con el sistema*, reinicia y
   mira si vuelve solo. Se puede comprobar a mano:
   `ls ~/.config/autostart/tucuack.desktop`.
10. **El chat.** Ajustes → ponle nombre. Tiene que decir que está conectado, y verse
    en *Conectados* junto a los patos de Windows. Si hay otro pato a mano, habladle.

---

## Y además

- **Cuánto consume.** `top -p $(pgrep -f tucuack | head -1)` un rato con el pato
  quieto. El sondeo del cursor corre 20 veces por segundo; si eso se nota en el
  ventilador, hay que saberlo.
- **El timbre, que no se note.** Es una ventana transparente de un palmo pegada al
  pato, y hay dos formas de que se note aunque no se vea: que el escritorio le pinte
  sombra o borde (un recuadro que sigue al pato), o que al pasar por encima del pato la
  ventana en la que estabas escribiendo pierda el foco. Ninguna de las dos debería
  pasar; si pasa, es del timbre.
- **Ajustes → Actualizaciones.** Con el `.deb` tiene que decir que se actualiza con el
  gestor de paquetes, no dar error. Con el AppImage, tiene que buscar de verdad.
- **Todo lo que escriba la terminal** mientras juegas. Pégalo tal cual, aunque parezca
  ruido.

---

## Si algo va mal

Lo útil es siempre lo mismo: **versión de Ubuntu** (`lsb_release -d`), **sesión**
(`echo $XDG_SESSION_TYPE` — debería decir `x11` aunque estés en Wayland, porque el
pato pide X11 a propósito), **escritorio** (`echo $XDG_CURRENT_DESKTOP`) y lo que
haya escrito la terminal.

Con eso se arregla desde Windows. Sin eso, no.
