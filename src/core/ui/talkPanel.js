// Panel de Chat: dos pestañas, «Todos» y «Privados».
//
// Antes eran una barrita para soltar una frase, luego un panel con histórico, y
// durante un rato los privados vivieron en un panel aparte con su propia entrada
// en el menú. Eso último era un error de organización: el canal común y los
// privados son las dos formas de decirle algo a alguien, así que van juntos.
// Lo que es distinto es CONECTADOS, que es gente, no mensajes.
//
// La diferencia entre las dos pestañas no es de forma, es de fondo, y por eso
// cada una lo dice en su sitio: en «Todos» lo que escribes lo ve todo el mundo y
// no se guarda en ningún servidor; en «Privados» va a una sola persona y sí se
// guarda, porque si no, no le llegaría cuando no está conectada.
//
// El histórico de «Todos» no lo guarda este panel: vive en chat/historial.js,
// que sigue apuntando mensajes aunque el panel esté cerrado (que es cuando más
// falta hace). Aquí sólo se decide qué trozo se pinta: con miles de mensajes
// apuntados, montarlos todos sería tirar cientos de nodos al DOM para enseñar
// los cuatro últimos.

import { panelHeader } from './panelHeader.js';
import { objetivoReal } from '../stage.js';
import * as historial from '../chat/historial.js';
import { crearVistaPrivados } from './privadosPanel.js';

/** Cuántos mensajes se pintan de entrada, y cuántos se añaden al subir. */
const VENTANA = 40;
/** Contexto que se enseña por encima de la raya de "nuevos", para no empezar a
 *  leer en el vacío. */
const CONTEXTO = 10;
/** Tope de lo que se pinta al abrir, aunque haya más sin leer. Volver tras una
 *  semana fuera son cientos de mensajes pendientes, y montarlos todos de golpe
 *  es tirar cientos de nodos al DOM para enseñar los de arriba. Los demás
 *  siguen ahí, un botón por encima. */
const VENTANA_MAX = 150;

/**
 * @param {Object} handlers
 * @param {(text:string)=>boolean} handlers.onSend  del canal común; devuelve si
 *   el mensaje ha salido de verdad.
 * @param {boolean} [handlers.hayPrivados]  si esta carcasa los tiene. Sin ellos
 *   no hay pestañas: el panel es lo que era.
 * @param {'todos'|'privados'} [handlers.abrirEn]
 * @param {string} [handlers.abrirCon]  dirección con la que abrir directamente
 *   una conversación, que es como se entra desde Conectados.
 * @param {Function} [handlers.onBack]
 * @param {Function} handlers.onClose
 * @returns {{el:HTMLElement}}
 */
export function buildTalkPanel(handlers) {
  const el = document.createElement('div');
  el.className = 'panel panel-hablar hot';

  const conPrivados = !!(handlers.hayPrivados && handlers.onConversaciones);
  let pestaña = (conPrivados && handlers.abrirEn === 'privados') ? 'privados' : 'todos';

  let cabecera = null;
  const tiras = document.createElement('div');
  tiras.className = 'chat-pestanas';
  const cuerpo = document.createElement('div');
  cuerpo.className = 'chat-cuerpo';
  el.append(tiras, cuerpo);

  // ---- «Todos»: el canal común -------------------------------------------
  //
  // Se construye una vez y se esconde al cambiar de pestaña, en vez de
  // rehacerse: lleva estado que no se puede perder —dónde estaba el scroll,
  // hasta dónde estaba leído, cuántos mensajes viejos se han traído— y volver
  // a montarlo lo tiraría todo.

  const todos = document.createElement('div');
  cuerpo.appendChild(todos);

  const lista = document.createElement('div');
  lista.className = 'chat-historial';
  todos.appendChild(lista);

  const fila = document.createElement('div');
  fila.className = 'chat-escribir';
  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 280;
  input.placeholder = 'Escribe algo…';
  const enviar = document.createElement('button');
  enviar.className = 'btn';
  enviar.type = 'button';
  enviar.textContent = 'Enviar';
  fila.append(input, enviar);
  todos.appendChild(fila);

  const aviso = document.createElement('div');
  aviso.className = 'muted';
  todos.appendChild(aviso);

  // Hasta dónde estaba leído CUANDO se abrió el panel. Se pregunta una sola vez
  // a propósito: abrir el panel marca todo como leído, y si la raya mirara el
  // valor de verdad desaparecería en el mismo momento de enseñarla.
  const corte = historial.corteDeLectura();
  // Cuántos mensajes se pintan. Empieza cubriendo todo lo que quedaba sin leer:
  // de nada sirve avisar de doce mensajes nuevos y enseñar sólo los últimos.
  let mostrados = Math.min(VENTANA_MAX, Math.max(VENTANA, historial.noLeidos() + CONTEXTO));
  let primeraVez = true;
  let separador = null;

  // Un chat se lee por abajo: lo último dicho es lo que interesa ver. Pero sólo
  // se arrastra al fondo a quien YA estaba en el fondo — si has subido a releer
  // algo, un mensaje nuevo no debe devolverte de un tirón.
  const HOLGURA = 24;   // píxeles que se dan por buenos como «está al final»

  const estaAlFondo = () => {
    if (!lista.clientHeight) return true;
    return lista.scrollHeight - lista.scrollTop - lista.clientHeight <= HOLGURA;
  };
  const irAlFondo = () => { lista.scrollTop = lista.scrollHeight; };

  /** Enseña un trozo más de lo antiguo, dejando la vista donde estaba. */
  const verAnteriores = () => {
    if (mostrados >= historial.todos().length) return;
    mostrados += VENTANA;
    // Al meter mensajes POR ARRIBA todo lo demás baja: sin compensar, la vista
    // se quedaría clavada en el mismo punto y el texto se iría hacia abajo.
    const altoAntes = lista.scrollHeight;
    const dondeAntes = lista.scrollTop;
    pintarTodos();
    lista.scrollTop = dondeAntes + (lista.scrollHeight - altoAntes);
  };

  function botonAnteriores(cuantos) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chat-anteriores';
    btn.textContent = `Ver mensajes anteriores (${cuantos})`;
    btn.addEventListener('click', verAnteriores);
    return btn;
  }

  function pintarTodos() {
    // Se mira ANTES de vaciar: la lista se reconstruye entera, y al vaciarla el
    // navegador pierde el scroll y ya no hay forma de saber dónde estabas.
    const seguirAbajo = estaAlFondo();
    const donde = lista.scrollTop;

    const mensajes = historial.todos();
    lista.textContent = '';
    separador = null;
    if (!mensajes.length) {
      const vacio = document.createElement('div');
      vacio.className = 'muted chat-vacio';
      vacio.textContent = 'Aquí aparecerán los mensajes del chat.';
      lista.appendChild(vacio);
      return;
    }

    const desde = Math.max(0, mensajes.length - mostrados);
    if (desde > 0) lista.appendChild(botonAnteriores(desde));

    for (const m of mensajes.slice(desde)) {
      // La raya va delante del primer mensaje ajeno que no estaba leído. Lo
      // propio no cuenta: nadie tiene pendiente de leer lo que acaba de decir.
      if (!separador && !m.propio && m.ts > corte) {
        separador = rayaDeNuevos();
        lista.appendChild(separador);
      }
      lista.appendChild(linea(m));
    }

    if (seguirAbajo) irAlFondo();
    else lista.scrollTop = donde;
  }

  pintarTodos();

  // Con la pestaña de «Todos» delante, lo que llega se da por leído. Con la de
  // privados NO: no lo estás mirando, y darlo por leído sería mentir.
  const alCambiarHistorial = () => {
    pintarTodos();
    if (pestaña === 'todos') historial.marcarTodoLeido();
  };
  const dejarDeEscuchar = historial.alCambiar(alCambiarHistorial);
  if (pestaña === 'todos') historial.marcarTodoLeido();

  lista.addEventListener('scroll', () => {
    if (lista.scrollTop <= 0) verAnteriores();
  });

  const enviarTexto = () => {
    const texto = input.value.trim();
    if (!texto) return;
    const salio = handlers.onSend(texto);
    input.value = '';
    // A diferencia de la caja de antes, el panel NO se cierra al enviar: con el
    // histórico delante lo natural es seguir la conversación.
    input.focus();
    aviso.textContent = salio === false
      ? 'El chat no está conectado: ese mensaje no ha salido de aquí.'
      : '';
    aviso.classList.toggle('error', salio === false);
  };

  enviar.addEventListener('click', enviarTexto);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') enviarTexto();
  });

  // ---- «Privados» ---------------------------------------------------------
  //
  // Se monta sólo si la carcasa los tiene, y se monta ya (no al entrar en la
  // pestaña) para que su lista esté pedida cuando llegues.

  const privados = conPrivados ? crearVistaPrivados({
    onConversaciones: handlers.onConversaciones,
    onLeer: handlers.onLeer,
    onEnviar: handlers.onEnviarPrivado,
    onBloquear: handlers.onBloquear,
    presentes: handlers.presentes,
    // Entrar y salir de una conversación cambia el título y a dónde va el
    // «volver», así que la cabecera se rehace.
    alCambiarVista: () => { rehacerCabecera(); pintarPestanas(); }
  }) : null;
  if (privados) cuerpo.appendChild(privados.el);

  // ---- El marco ------------------------------------------------------------

  function enConversacion() {
    return !!(privados && privados.enConversacion());
  }

  function rehacerCabecera() {
    if (cabecera) cabecera.remove();
    cabecera = panelHeader(
      enConversacion() ? (privados.nombreAbierto() || 'Privado') : 'Chat',
      {
        // Dentro de una conversación, el «volver» vuelve a la lista y no al
        // menú: perder la pantalla entera por querer salir de un hilo es de las
        // cosas que más molestan.
        onBack: enConversacion() ? () => privados.volverALaLista() : handlers.onBack,
        onClose: handlers.onClose
      }
    );
    el.prepend(cabecera);
  }

  function pintarPestanas() {
    tiras.textContent = '';
    // Dentro de una conversación no hay pestañas: estás en un sitio concreto y
    // el camino de vuelta es el «volver» de arriba.
    if (!conPrivados || enConversacion()) {
      tiras.hidden = true;
      return;
    }
    tiras.hidden = false;
    for (const [id, texto] of [['todos', 'Todos'], ['privados', 'Privados']]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chat-pestana' + (pestaña === id ? ' activa' : '');
      b.textContent = texto;
      b.addEventListener('click', () => irA(id));
      tiras.appendChild(b);
    }
  }

  function irA(id) {
    if (pestaña === id) return;
    pestaña = id;
    aplicarPestaña();
    pintarPestanas();
    // Volver a «Todos» es volver a mirarlo: lo que llegara mientras estabas en
    // privados deja de estar pendiente.
    if (pestaña === 'todos') {
      historial.marcarTodoLeido();
      setTimeout(() => input.focus(), 0);
    }
  }

  function aplicarPestaña() {
    todos.hidden = pestaña !== 'todos';
    if (privados) privados.el.hidden = pestaña !== 'privados';
  }

  rehacerCabecera();
  pintarPestanas();
  aplicarPestaña();

  // Se abre directamente en una conversación cuando se entra desde Conectados.
  if (privados && handlers.abrirCon) {
    pestaña = 'privados';
    aplicarPestaña();
    privados.abrirCon(handlers.abrirCon);
  }

  // ---- Cierre --------------------------------------------------------------

  // Escape en todo el documento, no sólo dentro de la caja: el foco puede
  // haberse ido a cualquier parte. Y un clic fuera cierra, como en el menú.
  // Quedarse encerrado en un cuadro de texto es de las cosas más molestas que
  // puede hacer un pato.
  const alPulsarTecla = (e) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    // Igual que el «volver»: dentro de un hilo, Escape sale del hilo.
    if (enConversacion()) { privados.volverALaLista(); return; }
    handlers.onClose();
  };
  const alPulsarFuera = (e) => {
    if (!el.contains(objetivoReal(e))) handlers.onClose();
  };
  document.addEventListener('keydown', alPulsarTecla, true);
  // En diferido: el mismo clic que lo abre no debe cerrarlo.
  const pendiente = setTimeout(() => {
    document.addEventListener('mousedown', alPulsarFuera, true);
  }, 0);

  // Se limpia solo, se cierre como se cierre: por la ×, por el volver, por
  // Escape o por un clic fuera.
  el.addEventListener('panel:cerrado', () => {
    clearTimeout(pendiente);
    document.removeEventListener('keydown', alPulsarTecla, true);
    document.removeEventListener('mousedown', alPulsarFuera, true);
    dejarDeEscuchar();
  }, { once: true });

  // El panel se construye ANTES de meterlo en el DOM (lo monta `mountPanel`),
  // y hasta entonces la lista no tiene alturas: `scrollTop` no se puede mover y
  // se quedaba callado. Por eso el chat se abría siempre por el primer mensaje
  // aunque `pintarTodos` mandara ir al fondo. En cuanto está montado, a su sitio.
  setTimeout(() => {
    if (primeraVez && pestaña === 'todos') {
      primeraVez = false;
      if (separador) {
        // Un pelín por encima de la raya, para que se vea que empieza ahí.
        lista.scrollTop = Math.max(0, separador.offsetTop - lista.offsetTop - 12);
      } else {
        irAlFondo();
      }
      input.focus();
    }
  }, 0);
  return { el };
}

/** La raya que separa lo ya leído de lo que llegó después. */
function rayaDeNuevos() {
  const raya = document.createElement('div');
  raya.className = 'chat-nuevos';
  raya.textContent = 'nuevos';
  return raya;
}

/** @param {import('../chat/historial.js').Mensaje} m */
function linea(m) {
  const fila = document.createElement('div');
  fila.className = 'chat-msg' + (m.propio ? ' propio' : '');

  const cab = document.createElement('div');
  cab.className = 'chat-msg-cab';
  const quien = document.createElement('span');
  quien.className = 'chat-quien';
  // Nombre y texto los pone otra persona: siempre como texto, nunca como HTML.
  quien.textContent = m.propio ? 'Tú' : m.from;
  const hora = document.createElement('span');
  hora.className = 'chat-hora';
  hora.textContent = cuando(m.ts);
  cab.append(quien, hora);

  const texto = document.createElement('div');
  texto.className = 'chat-texto';
  texto.textContent = m.text;

  fila.append(cab, texto);

  if (m.fallo) {
    const nota = document.createElement('div');
    nota.className = 'chat-fallo';
    nota.textContent = 'no enviado';
    fila.appendChild(nota);
  }
  return fila;
}

/**
 * La hora de un mensaje.
 *
 * Con el histórico guardado en disco ya no todo es de hoy: la hora a secas
 * haría creer que un mensaje de la semana pasada acaba de llegar, así que a
 * partir de ayer se pone también el día.
 */
function cuando(ts) {
  const fecha = new Date(ts);
  const hora = fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const hoy = new Date();
  const mismoDia = fecha.getDate() === hoy.getDate()
    && fecha.getMonth() === hoy.getMonth()
    && fecha.getFullYear() === hoy.getFullYear();
  if (mismoDia) return hora;
  return `${fecha.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })} ${hora}`;
}
