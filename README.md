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
limpiarlo y mandarlo a dormir (o despertarlo) desde el menú, el panel o la bandeja.

**Arrastrar y lanzar.** El overlay ocupa toda la pantalla, así que puedes llevarlo a
cualquier punto. Al soltar se mide la **velocidad del cursor** y se aplica como impulso:

- **Lanzado**: sale despedido en **parábola**, se inclina hacia donde vuela y **rebota**
  en los lados y en el suelo, perdiendo energía en cada bote hasta posarse.
- **Soltado casi quieto**: en vez de desplomarse, **planea aleteando** hasta aterrizar.

La transición es automática: manda la inercia mientras va rápido, y cuando frena el
pato aletea. Constantes ajustables (`GRAVITY`, `WALL_BOUNCE`, `GLIDE_SPEED`…) juntas en
[`src/renderer/app.js`](src/renderer/app.js).

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
[`src/renderer/pet/Duck.js`](src/renderer/pet/Duck.js). Para cambiar el tamaño en
pantalla basta tocar `--duck-scale` en `src/renderer/styles.css`.

Los iconos también se generan, desde el propio sprite:

```bash
python tools/make_icons.py
```

---

## Empaquetar y publicar

```bash
npm run build     # instalador para tu sistema, en dist/
```

Cada sistema se compila en el suyo: Windows produce el instalador **NSIS**, y macOS
un **DMG** y un **ZIP** (universales, Intel y Apple Silicon). El workflow de release
los genera en paralelo y los sube al mismo Release.

### Sobre la versión de macOS

Funciona, pero con dos avisos:

- **No está firmada ni notarizada** (haría falta una cuenta de Apple Developer). La
  primera vez, macOS la bloqueará: hay que abrirla con **clic derecho → Abrir**, o
  ejecutar `xattr -cr /Applications/TuCuack.app`.
- El pato camina por el borde inferior de la pantalla, donde en macOS suele estar el
  **Dock**. La app vive en la barra de menús (no aparece en el Dock).

No se ha probado en un Mac real; si algo se comporta raro, abre una incidencia.

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
src/main/       proceso principal: ventana overlay, bandeja, chat, updater, persistencia
src/renderer/   interfaz: pato, animación, física, Tamagotchi, paneles, chat
tools/          generadores de sprites e iconos (Python)
assets/         sprite sheet e iconos
.github/        workflow de release
```

## Herramientas de desarrollo

`--capture` guarda fotogramas de la ventana en `scratch_caps/`, y `--probe` ejecuta una
expresión en el renderer y muestra el resultado (útil para medir la física):

```bash
npx electron . --dev --probe "JSON.stringify(__pato.state())"
```

En modo `--dev`, el renderer expone `window.__pato` (`duck`, `behavior`, `tam`, `chat`,
`throwFrom(x,y,vx,vy)`, `act('feed'|'play'|'clean'|'sleep')`, `state()`, `name()`).

## Licencia

MIT — ver [LICENSE](LICENSE).
