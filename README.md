# 🦆 TuCuack

Una mascota de escritorio para Windows: un pato con gafas, cadena de oro y bate que
**camina sobre la barra de tareas**, se puede **arrastrar y lanzar por la pantalla**,
se cuida como un **Tamagotchi** y **habla con los patos de otras personas** mediante
bocadillos de cómic.

Construido con **Electron**. Chat con **Supabase Realtime**. Auto-actualización con
**electron-updater + GitHub Releases**.

---

## Puesta en marcha

```bash
npm install
npm start
```

El pato aparece sobre la barra de tareas y empieza a pasear. **Clic derecho** sobre él
abre el menú (Alimentar, Jugar, Limpiar, Dormir, Hablar, Estadísticas, Ajustes, Salir).
También hay icono en la bandeja del sistema.

Modo desarrollo con DevTools: `npm run dev`

Requisitos: Node.js 18+ (probado con 20). Para regenerar sprites o iconos, Python 3
con Pillow y numpy.

---

## Qué sabe hacer

**Tamagotchi.** Cuatro necesidades (comida, energía, higiene, felicidad) que decaen con
el tiempo, incluso mientras la app está cerrada (hasta un tope, para no encontrártelo
"muerto"). El estado de ánimo que resulta decide qué hace el pato por su cuenta:
pasear, aburrirse, entristecerse o irse a dormir. Puedes darle de comer, jugar,
limpiarlo y mandarlo a dormir (o despertarlo) desde la botonera del menú o la bandeja.

**Agotamiento.** Si la energía llega a **0**, el pato se desploma y duerme hasta
recuperar el **20 %**. Mientras dure no hace ninguna otra cosa ni acepta cuidados: las
opciones de cuidado se ven apagadas y no hay forma de despertarlo. El umbral de vuelta
no es 0 a propósito, para que no se pase el rato entrando y saliendo del sueño; es el
mismo por debajo del cual está "cansado" (`AGOTAMIENTO` en
[`src/core/game/Tamagotchi.js`](src/core/game/Tamagotchi.js)).

**Su estado, a mano.** Las necesidades se ven en el globo que sale al dejar el ratón
sobre el pato, y **el mismo globo es la cabecera del menú** del clic derecho, ahí con
barras más grandes y una **botonera** para cuidarlo sin salir de él: se pulsa, las
barras se mueven al momento y el menú sigue abierto. No son dos vistas parecidas: es
el mismo componente ([`src/core/ui/statsView.js`](src/core/ui/statsView.js)), así que
sólo hay un sitio que tocar. El resto de opciones va debajo **a dos columnas**, para
que el menú no se haga largo.

**Arrastrar y lanzar.** El overlay ocupa toda la pantalla, así que puedes llevarlo a
cualquier punto. Al soltar se mide la **velocidad del cursor** y se aplica como impulso:

- **Lanzado**: sale despedido en **parábola**, se inclina hacia donde vuela y **rebota**
  en los lados y en el suelo, perdiendo energía en cada bote hasta posarse.
- **Soltado casi quieto**: en vez de desplomarse, **planea aleteando** hasta aterrizar.

La transición es automática: manda la inercia mientras va rápido, y cuando frena el
pato aletea. Constantes ajustables (`GRAVITY`, `WALL_BOUNCE`, `GLIDE_SPEED`…) juntas en
[`src/core/app.js`](src/core/app.js).

**Varios monitores.** El pato vive en uno cada vez y **se lleva a otro arrastrándolo**:
al cruzar el cursor a otra pantalla, la ventana se muda allí con el pato bajo el
puntero. Se descartó cubrir todo el escritorio con una única ventana gigante porque
penaliza el rendimiento y se comporta mal con monitores de distinta escala; así cada
monitor lo dibuja a su propia resolución.

**Niveles y diseños.** Cuidar bien al pato da experiencia: sobre todo tenerlo
contento con el tiempo, y atender las necesidades **cuando de verdad hacen falta**
(machacar los botones con las barras llenas no puntúa). Al subir de nivel se
desbloquean diseños de pato, que se ven todos desde el principio pero con un candado
hasta que se alcanza su nivel. El nivel viaja con los mensajes del chat, así que se
compara con el de los demás. Detalles en [`docs/DISENOS.md`](docs/DISENOS.md).

**Chat entre patos.** Todos los patos comparten **un único canal común**. Lo que
escribes aparece en tu bocadillo y en el de los demás, y viceversa. Cada pato tiene un
**nombre**, que se comprueba que no esté siendo usado por otro pato conectado.

**Histórico de la sesión.** El bocadillo dura unos segundos, así que **Hablar** guarda
los últimos **50 mensajes** —los de los demás y los tuyos— y los enseña encima de la
caja de escribir. Se anotan aunque el panel esté cerrado, que es justo cuando hacen
falta. Vive en memoria y se va al cerrar el pato: ni fichero, ni base de datos, ni nada
que sobreviva a la sesión ([`src/core/chat/historial.js`](src/core/chat/historial.js)).
En la extensión el pato se muda de pestaña y estrenaría memoria en cada salto, así que
ahí lo guarda el service worker en `storage.session` —se borra al cerrar Chrome— y se
lo pasa al pato al llegar.

**Quién anda por ahí.** La opción **Conectados** del menú (y de la bandeja) abre la
lista de los patos que están en el canal ahora mismo, con el tuyo el primero. El menú
lleva la cuenta al lado, y la lista se actualiza sola mientras está abierta según entra
y sale gente. Sale de la presencia del canal, la misma que ya se usaba para comprobar
los nombres, así que no hace falta nada más en Supabase.

**Se integra sin molestar.** Ventana transparente siempre encima, con **hit-test por
píxel**: el overlay sólo captura el ratón cuando el cursor está de verdad sobre el
pato, así que los clics alrededor siguen llegando al escritorio.

---

## Configurar el chat (Supabase)

Sin esto la app funciona igual, pero el chat queda deshabilitado.

**Guía completa: [docs/CONFIGURACION.md](docs/CONFIGURACION.md)** — cubre los cuatro
entornos (tu equipo, el CI, el instalador que reparten y una instalación ya hecha).

Resumen para desarrollo:

1. Crea un proyecto en [supabase.com](https://supabase.com) (plan gratuito; sólo se usa
   Realtime, no hace falta crear tablas).
2. En **Project Settings → API Keys** copia la **Project URL** y la **Publishable key**.
3. Edita el `supabase.json` de la raíz (ya viene creado):

   ```json
   {
     "url": "https://abcdefghijklmnop.supabase.co",
     "publishableKey": "sb_publishable_xxxxxxxxxxxxxxxx"
   }
   ```

4. Reinicia la app y ponle nombre a tu pato en **Ajustes**.

`supabase.json` está en `.gitignore`, así que **no se sube al repositorio**. Para que
los instaladores publicados lleven el chat, define los secrets `SUPABASE_URL` y
`SUPABASE_PUBLISHABLE_KEY` en el repositorio: el workflow genera el fichero al compilar
(no hace falta compilar en local).

**Para que varias personas chateen entre sí**, todas deben usar las mismas credenciales.


## Sprites y animaciones

Los sheets que usa la app (`assets/sprites/duck-<id>.png`) **se generan** desde el
arte fuente:

```bash
npm run sprites      # python tools/pack_sprites.py
```

Procesa **todos** los diseños que haya en `assets/sprites/fuentes/<id>.webp` y produce
un `assets/sprites/duck-<id>.png` por cada uno. Cómo debe ser ese arte y qué diseños
faltan por dibujar: [`docs/DISENOS.md`](docs/DISENOS.md).

El arte fuente trae cada frame a distinta escala y altura, y varios con el pato
recortado (no cabía en su celda). El script lo corrige: segmenta el **cuerpo** por color
(amarillo/naranja, frente al marrón del bate) y con ese bbox normaliza cada frame —
escala uniforme, alineación por los pies y por el centro, y lienzo con margen para que
el bate no se corte. Los frames recortados se **completan** tomando como plantilla un
frame sano de la misma animación. Al terminar imprime una **verificación** (`base var` =
salto vertical, `alto var` = cambio de tamaño, `cortados`).

| Animación | Frames | Uso |
|-----------|--------|-----|
| `idle`  | 7  | quieto, bate al hombro |
| `walk`  | 8  | ciclo de caminar |
| `play`  | 10 | **Jugar** → swing del bate |
| `eat`   | 8  | **Alimentar** |
| `sleep` | 8  | **Dormir**: agachado, respirando |
| `happy` | 4  | **Limpiar** / contento / aterrizaje |
| `talk`  | 6  | hablar (al enviar/recibir chat) |
| `cool`  | 6  | se ajusta las gafas |
| `sad`   | 6  | triste (necesidad crítica) |
| `flap`  | 6  | aletea mientras planea al caer |
| `drag`  | 6  | colgando del cursor |

El swing del bate se compone midiendo el ángulo del bate en cada frame (eje principal de
su máscara) y recorriéndolos ordenados en vaivén, es decir con arte real. Se intentó
antes recortar el bate y rotarlo, pero se solapa un 70-78 % con el cuerpo en todos los
frames y al quitarlo dejaba un corte visible.

Si cambias frames o fps, actualiza la constante `SHEET` de
[`src/core/pet/Duck.js`](src/core/pet/Duck.js).

### Tamaño del pato

En **Ajustes** hay un control de tamaño, del 40 % al 160 % en saltos de 5, que
se aplica mientras se arrastra y se guarda al momento. Funciona igual en el
escritorio y en la extensión.

Ese porcentaje multiplica una escala base que decide cada carcasa
([`src/core/scale.js`](src/core/scale.js)), de modo que el 100 % significa "el
tamaño normal del pato aquí":

- **Escritorio**: la base es `--duck-scale` en `src/core/styles.css` (0.62).
- **Extensión**: se calcula según el ancho del panel
  ([`src/extension/escala.js`](src/extension/escala.js)), así que el pato se
  adapta si se cambia el ancho, y además hay un tope para que no acabe más
  grande que el panel por mucho que se suba el ajuste.

Los iconos también se generan, desde el propio sprite:

```bash
python tools/make_icons.py
```

---

## Empaquetar y publicar

```bash
npm run build     # instalador para tu sistema, en dist/
```

Se compila el instalador **NSIS** de Windows. El workflow de release lo sube al
Release junto con el **zip de la extensión de Chrome**, que se ensambla en el
mismo workflow con `npm run ext`.

### No hay versión de macOS

Se retiró. Sin una cuenta de Apple Developer no se puede firmar ni notarizar, y
una app sin firmar da más problemas de los que resuelve: macOS la bloquea y hay
que enseñarle a cada persona a saltarse el aviso. **Quien use Mac tiene la
extensión de Chrome**, que funciona igual en cualquier sistema.

Para publicar una versión y que las instalaciones se actualicen solas:

1. Sube la versión en `package.json`.
2. Añade la entrada correspondiente en [`CHANGELOG.md`](CHANGELOG.md).
3. Crea y sube el tag:

   ```bash
   git tag v0.1.0 && git push origin v0.1.0
   ```

El workflow [`.github/workflows/release.yml`](.github/workflows/release.yml) compila y
publica el instalador + `latest.yml` en un **GitHub Release**. Las instalaciones
existentes lo detectan al arrancar, lo descargan en segundo plano y lo aplican al
reiniciar.

> Sin firma de código, Windows SmartScreen mostrará un aviso al instalar. Se elimina
> firmando el instalador (certificado de code-signing, de pago) con secrets en el
> workflow.

---

## Estructura

```
src/core/       el pato: animación, física, Tamagotchi, paneles, chat, niveles
src/desktop/    carcasa de escritorio: documento del overlay y plataforma Electron
src/extension/  carcasa de Chrome: panel lateral, service worker y plataforma
src/main/       proceso principal: ventana overlay, bandeja, chat, updater, persistencia
tools/          generadores de sprites e iconos (Python), banco de pruebas y ensamblado
assets/         sprite sheet e iconos
.github/        workflow de release
```

`src/core/` es JavaScript de navegador puro: no sabe si vive en una ventana de
Electron o en una pestaña. Todo lo que necesita del entorno —persistencia,
chat, rutas de recursos, ratón, ciclo de vida— entra por el contrato que
describe [`src/core/platform.js`](src/core/platform.js), y cada carcasa aporta
su implementación. Eso es lo que permite que el mismo pato corra en el
escritorio y en el navegador sin duplicar código.

## Extensión de Chrome

El mismo pato, paseando por las páginas que visitas. Va en modo desarrollador: no
está en la Chrome Web Store ni hace falta que lo esté.

**Dónde vive.** Hay un solo pato, y está en la ventana de Chrome que estés
usando: sobre la página que tengas abierta, o en el panel lateral si lo abres. El
árbitro que lo decide está en el service worker, y por eso nunca hay dos patos
guardando el mismo estado. Para esconderlo o llamarlo: **botón derecho en el
icono de la extensión**. El botón izquierdo abre el panel.

Hay sitios donde Chrome no deja entrar a ninguna extensión y el pato no puede
aparecer: `chrome://`, el visor de PDF, la Chrome Web Store y las páginas de otras
extensiones. Con el panel abierto, se va al panel.

**Para quien la instala** hay instrucciones en
[`src/extension/INSTALAR.txt`](src/extension/INSTALAR.txt), que viaja dentro del
zip. Se actualiza descomprimiendo la versión nueva encima de la misma carpeta y
pulsando recargar en `chrome://extensions`.

```bash
npm run ext
```

Eso ensambla la extensión en `dist/extension/`. Después, en Chrome:
`chrome://extensions` → activar **Modo de desarrollador** → **Cargar
descomprimida** → elegir la carpeta `dist/extension`. El pato se abre pulsando
el icono de la extensión.

Mientras se trabaja en el pato conviene dejar el ensamblado vigilando; así basta
con pulsar recargar en `chrome://extensions` para ver los cambios, sin compilar
nada:

```bash
npm run ext:watch
```

**Por qué hay un paso de ensamblado.** Una extensión no puede leer nada fuera de
su carpeta raíz, y desde `src/extension/` no se alcanzan ni `src/core/` ni
`assets/`. El repo entero tampoco sirve como raíz: Chrome rechaza la carga si
encuentra ficheros que empiecen por `_`, y `node_modules` está lleno de ellos.

**El `key` del manifest no se toca.** En modo desarrollador el ID de una
extensión se deriva de la ruta de la carpeta, así que saldría distinto en cada
máquina — y de ese ID cuelgan el almacenamiento y la identidad del pato. La
clave pública fijada en `src/extension/manifest.json` hace que el ID sea el
mismo en todas partes.

**Chat.** Necesita `supabase.json` en la raíz del proyecto *antes* de ensamblar
(ver [docs/CONFIGURACION.md](docs/CONFIGURACION.md)); el ensamblado lo copia
dentro de la extensión y avisa si no lo encuentra. Sin él, el pato funciona
igual pero mudo. Los patos de extensión y los de escritorio comparten el mismo
canal, así que se ven entre ellos.

## Herramientas de desarrollo

`--capture` guarda fotogramas de la ventana en `scratch_caps/`, y `--probe` ejecuta una
expresión en el renderer y muestra el resultado (útil para medir la física):

```bash
npx electron . --dev --probe "JSON.stringify(__pato.state())"
```

En modo `--dev`, el renderer expone `window.__pato` (`duck`, `behavior`, `tam`, `chat`,
`throwFrom(x,y,vx,vy)`, `act('feed'|'play'|'clean'|'sleep')`, `state()`, `name()`).

**Banco de pruebas.** El núcleo también arranca en un navegador normal, sin
Electron, con una plataforma de mentira que guarda en `localStorage` y no se
conecta al chat. Sirve para trabajar en el pato sin levantar la app entera:

```bash
npm run banco
```

Y abrir <http://127.0.0.1:8777/tools/banco/index.html>. Ojo: si la pestaña
queda en segundo plano el navegador congela `requestAnimationFrame` y el pato
se queda quieto — no está roto, está durmiendo.

## Licencia

MIT — ver [LICENSE](LICENSE).
