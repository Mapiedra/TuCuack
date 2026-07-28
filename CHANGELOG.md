# Changelog

Todos los cambios reseñables de TuCuack se documentan en este fichero.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
y el proyecto usa [Versionado Semántico](https://semver.org/lang/es/).

## [No publicado]

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

[No publicado]: https://github.com/Mapiedra/TuCuack/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/Mapiedra/TuCuack/releases/tag/v0.1.1
[0.1.0]: https://github.com/Mapiedra/TuCuack/releases/tag/v0.1.0
