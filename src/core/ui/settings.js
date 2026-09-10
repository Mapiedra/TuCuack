// Panel de ajustes: nombre del pato (para el chat), sonido, tamaño,
// concentración y auto-arranque.

import { panelHeader } from './panelHeader.js';
import { LIMITES, normalizarFactor } from '../scale.js';

/**
 * @param {{displayName:string, autoLaunch:boolean, visitas?:boolean}} settings
 * @param {string} version
 * @param {boolean} handlers.actualizaciones  si esta carcasa se actualiza sola
 * @param {{onSave:(s:object)=>void, onClose:Function,
 *          isNameTaken:(n:string)=>boolean, chatReady:boolean,
 *          onSonido:(s:object)=>void, onEscala:(pct:number)=>void,
 *          puedeAutoArrancar:boolean, puedeFoco:boolean}} handlers
 * @returns {{el:HTMLElement}}
 */
export function buildSettingsPanel(settings, version, handlers) {
  const el = document.createElement('div');
  el.className = 'panel hot';

  el.appendChild(panelHeader('Ajustes', handlers));

  // El panel ha ido creciendo (visitas, concentración…) hasta ser una columna
  // interminable. Se reparte en bloques plegables, y en acordeón: al abrir uno
  // se cierran los demás, así que como mucho crece lo que ocupe UN bloque y no
  // la suma de todos los que se han ido abriendo por curiosidad.
  const grupos = [];
  const grupo = (titulo, abierto) => {
    const det = document.createElement('details');
    det.className = 'ajustes-grupo';
    det.open = !!abierto;
    const sum = document.createElement('summary');
    sum.textContent = titulo;
    det.appendChild(sum);
    det.addEventListener('toggle', () => {
      if (det.open) grupos.forEach((g) => { if (g !== det) g.open = false; });
    });
    grupos.push(det);
    el.appendChild(det);
    return det;
  };

  // ---- Mascota --------------------------------------------------------
  const gMascota = grupo('Mascota', true);

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
  gMascota.appendChild(row1);

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
  gMascota.appendChild(rowSnd);

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
  gMascota.appendChild(rowEsc);

  // ---- Social -----------------------------------------------------------
  const gSocial = grupo('Social');

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
  gSocial.appendChild(rowVis);

  // ---- Modo concentración -------------------------------------------------
  // Sólo donde el pato pueda esconderse y volver a sacarse él solo (ver
  // `capacidades.focus`): en la extensión no hay bandeja donde enseñar la
  // cuenta atrás mientras está fuera.
  const foco = {};
  if (handlers.puedeFoco) {
    const gFoco = grupo('Modo concentración (Pomodoro)');

    const campo = (etiqueta, valor, min, max) => {
      const row = document.createElement('div');
      row.className = 'row';
      const lbl = document.createElement('label');
      lbl.textContent = etiqueta;
      const input = document.createElement('input');
      input.type = 'number';
      input.min = String(min);
      input.max = String(max);
      input.step = '1';
      input.value = String(valor);
      row.append(lbl, input);
      gFoco.appendChild(row);
      return input;
    };

    foco.work = campo('Minutos de concentración', settings.focusWorkMin || 25, 1, 180);
    foco.shortBreak = campo('Minutos de descanso corto', settings.focusShortBreakMin || 5, 1, 60);
    foco.longBreak = campo('Minutos de descanso largo', settings.focusLongBreakMin || 20, 1, 120);
    foco.cyclesToLong = campo('Ciclos antes del descanso largo', settings.focusCyclesToLong || 4, 1, 12);
  }

  // ---- Sistema ------------------------------------------------------------
  const gSistema = grupo('Sistema');

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
    gSistema.appendChild(row2);
  }

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

    gSistema.append(botonAct, notaAct);
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
    // Apagado mientras se está mirando, y también donde no hay nada que mirar:
    // un botón que se puede pulsar y no hace nada es peor que uno apagado.
    botonAct.disabled = e.tipo === 'comprobando'
      || e.tipo === 'descargando'
      || e.tipo === 'no-disponible';
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

  // ---- Zona de riesgo -------------------------------------------------
  //
  // Al final del todo y plegada: es donde va un botón que pide que no lo
  // pulses, así que lo último que conviene es que se abra solo. Sólo donde el
  // pato tiene la pantalla para él: quien decide eso es app.js mirando las
  // capacidades de la carcasa.
  if (handlers.puedeLaBroma) {
    const gRiesgo = grupo('Zona de riesgo');

    const broma = document.createElement('button');
    broma.className = 'btn peligro';
    broma.type = 'button';
    broma.textContent = '⚠️ No tocar';
    broma.title = 'No.';
    broma.addEventListener('click', () => handlers.onLaBroma());
    gRiesgo.appendChild(broma);

    const avisoBroma = document.createElement('div');
    avisoBroma.className = 'muted';
    avisoBroma.textContent = 'En serio.';
    gRiesgo.appendChild(avisoBroma);

    // El cebo, y con la cifra por delante: la broma paga si se pasa el peaje, y
    // callarlo sería esconder la mitad del trato. Lo que NO se hace es adornar
    // la otra mitad —que son diez cuentas con reloj y que fallar te devuelve a
    // la primera—, así que el consejo se mantiene tal cual: no lo pulses.
    const premio = handlers.premioDeLaBroma ? handlers.premioDeLaBroma() : null;
    if (premio) {
      const cebo = document.createElement('div');
      cebo.className = 'muted broma-cebo';
      cebo.textContent = premio.yaCobrado
        ? 'El peaje ya lo cobraste hoy. Sigue sin ser buena idea.'
        : `Pasar el peaje da ${premio.cuacks} cuacks. Sigue sin ser buena idea.`;
      gRiesgo.appendChild(cebo);
    }
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
      escala: Number(esc.value),
      ...(handlers.puedeFoco ? {
        focusWorkMin: Math.max(1, Number(foco.work.value) || 25),
        focusShortBreakMin: Math.max(1, Number(foco.shortBreak.value) || 5),
        focusLongBreakMin: Math.max(1, Number(foco.longBreak.value) || 20),
        focusCyclesToLong: Math.max(1, Number(foco.cyclesToLong.value) || 4)
      } : {})
    });
    handlers.onClose();
  });

  setTimeout(() => name.focus(), 0);
  return { el };
}
