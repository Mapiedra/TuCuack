Iconos de TuCuack.

Se GENERAN a partir del sprite del pato, no se editan a mano:

    python tools/make_icons.py

  tucuack.ico : icono de la aplicación y del instalador (16-256 px)
  tucuack.png : versión grande (512 px), para tiendas o la web
  tray.png    : icono de la bandeja del sistema (32 px)

Si borras estos archivos, la app arranca igual (Electron usa su icono por
defecto), pero el instalador saldrá sin icono propio.
