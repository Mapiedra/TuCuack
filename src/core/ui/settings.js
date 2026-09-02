// Panel de ajustes: nombre del pato (para el chat), sonido, tamaño y
// auto-arranque.

import { panelHeader } from './panelHeader.js';
import { LIMITES, normalizarFactor } from '../scale.js';

/**
 * @param {{displayName:string, autoLaunch:boolean, visitas?:boolean}} settings
 * @param {string} version
 * @param {boolean} handlers.actualizaciones  si esta carcasa se actualiza sola
 * @param {{onSave:(s:object)=>void, onClose:Function,
 *          isNameTaken:(n:string)=>boolean, chatReady:boolean,
 *          onSonido:(s:object)=>void, onEscala:(pct:number)=>void,
 *          puedeAutoArrancar:boolean}} handlers
 * @returns {{el:HTMLElement}}
 */
export function buildSettingsPanel(settings, version, handlers) {
  const el = document.createElement('div');
  el.className = 'panel hot';

  el.appendChild(panelHeader('Ajustes', handlers));

  // Nombre del pato
  const row1 = document.createElement('div');
  row1.className = 'row';
  const lbl1 = document.createElement('label');
  lbl1.textContent = 'Nombre de tu mascota';
  const name = document.createElement('input');
  name.type = 'text';
  name.maxLength = 24;
  name.value = settings.displayName || '';
  name.placeholder = 'p. ej. Cuackers';
  const hint = document.createElement('div');
  hint.className = 'muted';
  hint.textContent = handlers.chatReady
    ? 'Se muestra en los bocadillos del chat.'
    : 'Chat sin configurar: no se puede comprobar si el nombre está libre.';
  row1.append(lbl1, name, hint);
  el.appendChild(row1);

  // Sonido
  const rowSnd = document.createElement('div');
  rowSnd.className = 'row';
  const lblSnd = document.createElement('label');
  lblSnd.textContent = 'Sonido';
  const linea = document.createElement('div');
  linea.className = 'fila-sonido';
  const mute = document.createElement('button');
  mute.type = 'button';
  mute.className = 'btn-icono';
  const vol = document.createElement('input');
  vol.type = 'range';
  vol.min = '0';
  vol.max = '100';
  vol.value = String(Math.round((settings.volumen != null ? settings.volumen : 0.5) * 100));
  const pintaMute = () => {
    mute.textContent = settings.silenciado ? '🔇' : '🔊';
    mute.title = settings.silenciado ? 'Activar sonido' : 'Silenciar';
    vol.disabled = !!settings.silenciado;
  };
  mute.addEventListener('click', () => {
    settings.silenciado = !settings.silenciado;
    pintaMute();
    handlers.onSonido({ silenciado: settings.silenciado, volumen: vol.value / 100 });
  });
  vol.addEventListener('input', () => {
    handlers.onSonido({ silenciado: settings.silenciado, volumen: vol.value / 100 });
  });
  pintaMute();
  linea.append(mute, vol);
  rowSnd.append(lblSnd, linea);
  el.appendChild(rowSnd);

  // Tamaño del pato. Se aplica al momento, como el volumen, porque es un ajuste
  // que sólo se acierta viéndolo.
  const rowEsc = document.createElement('div');
  rowEsc.className = 'row';
  const lblEsc = document.createElement('label');
  lblEsc.textContent = 'Tamaño de la mascota';
  const lineaEsc = document.createElement('div');
  lineaEsc.className = 'fila-sonido';
  const esc = document.createElement('input');
  esc.type = 'range';
  esc.min = String(LIMITES.MINIMO);
  esc.max = String(LIMITES.MAXIMO);
  esc.step = String(LIMITES.PASO);
  esc.value = String(normalizarFactor(
    settings.escala != null ? settings.escala : LIMITES.POR_DEFECTO
  ));
  const valorEsc = document.createElement('span');
  valorEsc.className = 'valor-escala';
  const pintaEscala = () => { valorEsc.textContent = `${esc.value} %`; };
  esc.addEventListener('input', () => {
    pintaEscala();
    handlers.onEscala(Number(esc.value));
  });
  pintaEscala();
  lineaEsc.append(esc, valorEsc);
  rowEsc.append(lblEsc, lineaEsc);
  el.appendChild(rowEsc);

  // Visitas de otros patos. El canal es común a todo el mundo, así que tiene que
  // poder cerrarse la puerta sin renunciar al chat.
  const rowVis = document.createElement('div');
  rowVis.className = 'row';
  const lblVis = document.createElement('label');
  const chkVis = document.createElement('input');
  chkVis.type = 'checkbox';
  // Por defecto se admiten: quien nunca haya tocado esto no tiene el ajuste
  // guardado, y `undefined` no puede significar "no".
  chkVis.checked = settings.visitas !== false;
  chkVis.style.marginRight = '6px';
  lblVis.append(chkVis, document.createTextNode('Dejar que otras mascotas vengan de visita'));
  const hintVis = document.createElement('div');
  hintVis.className = 'muted';
  hintVis.textContent = 'Cualquier mascota conectada puede mandarte la suya a la '
    + 'pantalla. Desactívalo y no entrará ninguno.';
  rowVis.append(lblVis, hintVis);
  el.appendChild(rowVis);

  // Auto-arranque. Sólo donde hay un sistema en el que arrancar: en una
  // extensión no existe tal cosa.
  const chk = document.createElement('input');
  chk.type = 'checkbox';
  chk.checked = !!settings.autoLaunch;
  if (handlers.puedeAutoArrancar) {
    const row2 = document.createElement('div');
    row2.className = 'row';
    const lbl2 = document.createElement('label');
    chk.style.marginRight = '6px';
    lbl2.append(chk, document.createTextNode('Iniciar con Windows'));
    row2.appendChild(lbl2);
    el.appendChild(row2);
  }

  // Guardar
  const btnRow = document.createElement('div');
  btnRow.className = 'btn-row';
  const save = document.createElement('button');
  save.className = 'btn';
  save.textContent = 'Guardar';
  btnRow.appendChild(save);
  el.appendChild(btnRow);

  const ver = document.createElement('div');
  ver.className = 'muted';
  ver.style.marginTop = '10px';
  ver.textContent = `TuCuack v${version}`;
  el.appendChild(ver);

  // ---- Actualizaciones ----------------------------------------------------
  //
  // Lo automático sigue funcionando igual. Esto es para las dos veces en que no
  // basta: cuando el pato lleva abierto desde antes de que saliera la versión
  // (sólo mira al arrancar), y cuando la descarga está lista pero no se aplica
  // porque cerrar la ventana no es salir de la app.
  let botonAct = null;
  let notaAct = null;
  if (handlers.actualizaciones) {
    botonAct = document.createElement('button');
    botonAct.className = 'btn';
    botonAct.type = 'button';
    botonAct.style.marginTop = '6px';

    notaAct = document.createElement('div');
    notaAct.className = 'muted';

    botonAct.addEventListener('click', () => {
      if (botonAct.dataset.accion === 'instalar') handlers.onInstalarActualizacion();
      else handlers.onBuscarActualizacion();
    });

    el.appendChild(botonAct);
    el.appendChild(notaAct);
  }

  /**
   * Pinta en qué anda la actualización.
   *
   * El botón cambia de trabajo según el estado: normalmente busca, y cuando hay
   * una descargada pasa a instalarla. Son dos cosas distintas y no merecen dos
   * botones: el segundo estaría apagado el 99 % del tiempo.
   */
  function pintarActualizacion(estado) {
    if (!botonAct) return;
    const e = estado || { tipo: 'desconocido' };
    const version = e.version ? `v${e.version}` : 'la nueva versión';

    if (e.tipo === 'lista') {
      botonAct.dataset.accion = 'instalar';
      botonAct.disabled = false;
      botonAct.textContent = `⬇️ Reiniciar e instalar ${version}`;
      notaAct.textContent = 'Se cierra el pato, se instala y vuelve.';
      notaAct.classList.remove('error');
      return;
    }

    botonAct.dataset.accion = 'buscar';
    botonAct.disabled = e.tipo === 'comprobando' || e.tipo === 'descargando';
    botonAct.textContent = '🔄 Buscar actualizaciones';
    notaAct.classList.toggle('error', e.tipo === 'error');
    notaAct.textContent = {
      comprobando: 'Mirando si hay algo nuevo…',
      descargando: e.porcentaje != null
        ? `Descargando ${version}… ${e.porcentaje} %`
        : `Descargando ${version}…`,
      ninguna: 'Ya tienes la última.',
      error: `No se pudo comprobar: ${e.mensaje || 'sin detalle'}`,
      'no-disponible': 'En desarrollo no hay actualizaciones que buscar.',
      desconocido: ''
    }[e.tipo] || '';
  }

  pintarActualizacion(handlers.estadoActualizacion && handlers.estadoActualizacion());

  // El panel se entera del avance mientras siga abierto —una descarga tarda— y
  // se da de baja al cerrarse. Se apunta él solo: quien lo abre no tiene por qué
  // acordarse de darlo de alta, y menos de darlo de baja.
  if (botonAct && handlers.alCambiarActualizacion) {
    const baja = handlers.alCambiarActualizacion(pintarActualizacion);
    el.addEventListener('panel:cerrado', baja, { once: true });
  }

  const setError = (msg) => {
    hint.textContent = msg || '';
    hint.classList.toggle('error', !!msg);
    name.classList.toggle('invalid', !!msg);
  };

  name.addEventListener('input', () => setError(''));

  save.addEventListener('click', () => {
    const value = name.value.trim();
    if (!value) {
      setError('Ponle un nombre a tu mascota.');
      return;
    }
    // El nombre identifica al pato en el chat, así que no puede repetirse
    // con el de otro pato conectado ahora mismo.
    if (value !== (settings.displayName || '') && handlers.isNameTaken(value)) {
      setError(`Ya hay una mascota llamada "${value}". Prueba con otro nombre.`);
      return;
    }
    handlers.onSave({
      displayName: value,
      autoLaunch: chk.checked,
      visitas: chkVis.checked,
      volumen: vol.value / 100,
      silenciado: !!settings.silenciado,
      escala: Number(esc.value)
    });
    handlers.onClose();
  });

  setTimeout(() => name.focus(), 0);
  return { el };
}
