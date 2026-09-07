// La vista de privados: con quién hablas a solas, y la conversación con cada uno.
//
// No es un panel: es el contenido de una de las dos pestañas del Chat (ver
// talkPanel.js). Antes tenía panel propio y entrada en el menú, y era un error
// de organización — el chat común y los privados son las dos formas de decirle
// algo a alguien, así que van juntos; lo que es distinto es CONECTADOS, que es
// gente, no mensajes.
//
// La diferencia entre las dos pestañas sí importa, y se dice en la pantalla: en
// «Todos» lo que escribes lo ve todo el mundo y no se guarda en ningún servidor;
// aquí va a una sola persona y SÍ se guarda, porque si no, no le llegaría cuando
// no está conectada. Está razonado a fondo en supabase/mensajes.sql, pero el
// usuario no lee ficheros SQL.
//
// Una dirección es un hash: no dice quién es nadie. El nombre sale de dos
// sitios, en este orden: de quien esté ahora mismo en la presencia del canal, y
// si no, del que el otro llevaba al escribir. Si no hay ninguno, se enseña la
// dirección recortada, que es feo pero es la verdad.

/** Cuántos caracteres de la dirección se enseñan cuando no hay nombre. */
const TROZO_DIRECCION = 8;

/**
 * @param {Object} handlers
 * @param {() => Promise<object>} handlers.onConversaciones
 * @param {(con:string) => Promise<object>} handlers.onLeer
 * @param {(m:{para:string, texto:string}) => Promise<object>} handlers.onEnviar
 * @param {(a:string, si:boolean) => Promise<object>} handlers.onBloquear
 * @param {() => Array<{clave:string, nombre:string, dir:string}>} handlers.presentes
 * @param {(estado:{abierta:string|null, nombre:string}) => void} [handlers.alCambiarVista]
 *   Avisa al marco de que se ha entrado o salido de una conversación, para que
 *   rehaga su cabecera: el título pasa a ser el nombre del otro y el «volver»
 *   deja de ir al menú para volver a la lista.
 * @returns {{el:HTMLElement, abrirCon:(dir:string)=>void, enConversacion:()=>string|null,
 *            nombreAbierto:()=>string, volverALaLista:()=>void}}
 */
export function crearVistaPrivados(handlers) {
  const el = document.createElement('div');
  el.className = 'privados';

  /** Con quién se está hablando ahora mismo, o null si se ve la lista. */
  let abierta = null;
  /** El nombre que se sabía al abrir, para no perderlo si se desconecta. */
  let nombreAbierta = '';

  function avisarAlMarco() {
    if (handlers.alCambiarVista) {
      handlers.alCambiarVista({ abierta, nombre: nombreAbierta });
    }
  }

  function pintar() {
    el.textContent = '';
    if (abierta) pintarConversacion(abierta);
    else pintarLista();
  }

  /** El nombre de una dirección, si se puede saber. */
  function nombreDe(dir) {
    const presentes = (handlers.presentes && handlers.presentes()) || [];
    const aquí = presentes.find((p) => p && p.dir === dir);
    return aquí ? aquí.nombre : '';
  }

  /** La dirección recortada, para cuando no hay nombre. Es un hash: enseñarlo
   *  entero no ayuda a nadie y ocupa dos líneas. */
  function cortita(dir) {
    return `Pato ${String(dir).slice(0, TROZO_DIRECCION)}`;
  }

  // ---- La lista de conversaciones ----------------------------------------

  function pintarLista() {
    const aviso = document.createElement('p');
    aviso.className = 'muted privados-aviso';
    // Esto no es letra pequeña: en la otra pestaña nada toca un servidor y aquí
    // sí. Quien lo use tiene que saberlo antes, no después.
    aviso.textContent = 'A diferencia del chat, los privados se guardan en el '
      + 'servidor para que lleguen aunque el otro no esté conectado. No van '
      + 'cifrados: quien administra el servidor puede leerlos. Se guardan los '
      + '200 últimos de cada conversación y nada de más de 90 días.';
    el.appendChild(aviso);

    const lista = document.createElement('ul');
    lista.className = 'records-lista';
    const cargando = document.createElement('li');
    cargando.className = 'muted';
    cargando.textContent = 'Preguntando…';
    lista.appendChild(cargando);
    el.appendChild(lista);

    handlers.onConversaciones().then((res) => {
      if (abierta || !lista.isConnected) return;
      lista.textContent = '';
      if (!res || !res.ok) {
        lista.appendChild(suelto('No se ha podido consultar. ¿Hay conexión?'));
        return;
      }
      const filas = Array.isArray(res.datos) ? res.datos : [];
      if (!filas.length) {
        lista.appendChild(suelto('Todavía no has hablado en privado con nadie. '
          + 'Se empieza desde 🟢 Conectados, con el sobre de cada pato.'));
        return;
      }
      for (const f of filas) lista.appendChild(filaDeHilo(f));
    });
  }

  function suelto(texto) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = texto;
    return li;
  }

  function filaDeHilo(f) {
    const dir = String(f.con || '');
    // El de la presencia manda: es el nombre de AHORA. El de la fila es con el
    // que firmó la última vez, que puede ser de hace semanas.
    const nombre = nombreDe(dir) || String(f.nombre || '') || cortita(dir);

    const li = document.createElement('li');
    li.className = 'records-fila conMarcador';
    li.tabIndex = 0;
    const entrar = () => abrirCon(dir, nombre);
    li.addEventListener('click', entrar);
    li.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      entrar();
    });

    const icono = document.createElement('span');
    icono.className = 'records-icono';
    icono.textContent = '✉️';

    const medio = document.createElement('div');
    const nom = document.createElement('b');
    // Los nombres los escribe otra persona: `textContent`, siempre.
    nom.textContent = nombre;
    const bajo = document.createElement('span');
    bajo.className = 'records-detalle';
    bajo.textContent = (f.mio ? 'Tú: ' : '') + String(f.ultimo || '');
    medio.append(nom, bajo);

    const cuando = document.createElement('span');
    cuando.className = 'records-marca';
    cuando.textContent = haceCuanto(f.enviado_el);

    const flecha = document.createElement('span');
    flecha.className = 'records-flecha';
    flecha.textContent = '›';

    li.append(icono, medio, cuando, flecha);
    return li;
  }

  // ---- Una conversación --------------------------------------------------

  function pintarConversacion(dir) {
    const lista = document.createElement('div');
    lista.className = 'chat-historial';
    const cargando = document.createElement('div');
    cargando.className = 'muted';
    cargando.textContent = 'Preguntando…';
    lista.appendChild(cargando);
    el.appendChild(lista);

    const fila = document.createElement('div');
    fila.className = 'chat-escribir';
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 280;
    input.placeholder = 'Escribe en privado…';
    const enviar = document.createElement('button');
    enviar.className = 'btn';
    enviar.type = 'button';
    enviar.textContent = 'Enviar';
    fila.append(input, enviar);
    el.appendChild(fila);

    const aviso = document.createElement('div');
    aviso.className = 'muted';
    el.appendChild(aviso);

    const pie = document.createElement('div');
    pie.className = 'privados-pie';
    const bloquear = document.createElement('button');
    bloquear.type = 'button';
    bloquear.className = 'privados-bloquear';
    bloquear.textContent = 'Bloquear a este pato';
    bloquear.title = 'Dejará de llegarte lo que te escriba. Él no se entera.';
    bloquear.addEventListener('click', () => {
      bloquear.disabled = true;
      handlers.onBloquear(dir, true).then((res) => {
        aviso.textContent = (res && res.ok)
          ? 'Bloqueado. Lo que te escriba ya no se guarda, y él no lo sabe.'
          : 'No se ha podido bloquear.';
        aviso.classList.toggle('error', !(res && res.ok));
        bloquear.disabled = false;
      });
    });
    pie.appendChild(bloquear);
    el.appendChild(pie);

    const recargar = () => handlers.onLeer(dir).then((res) => {
      if (abierta !== dir || !lista.isConnected) return;
      lista.textContent = '';
      if (!res || !res.ok) {
        const mal = document.createElement('div');
        mal.className = 'muted';
        mal.textContent = 'No se ha podido consultar. ¿Hay conexión?';
        lista.appendChild(mal);
        return;
      }
      const filas = Array.isArray(res.datos) ? res.datos : [];
      if (!filas.length) {
        const vacio = document.createElement('div');
        vacio.className = 'muted chat-vacio';
        vacio.textContent = 'Todavía no os habéis dicho nada.';
        lista.appendChild(vacio);
        return;
      }
      // Vienen de la más reciente a la más antigua; una conversación se lee al
      // revés.
      for (const m of filas.slice().reverse()) lista.appendChild(linea(m));
      lista.scrollTop = lista.scrollHeight;
    });
    recargar();

    const mandar = () => {
      const texto = input.value.trim();
      if (!texto) return;
      input.value = '';
      input.focus();
      aviso.textContent = '';
      handlers.onEnviar({ para: dir, texto }).then((res) => {
        if (res && res.ok) {
          // El servidor contesta lo mismo si te tienen bloqueado, a propósito
          // (ver supabase/mensajes.sql). Así que aquí no se puede prometer que
          // lo vaya a leer, sólo que salió.
          if (res.datos === 'demasiados') {
            aviso.textContent = 'Estás escribiendo demasiado deprisa. Espera un minuto.';
            aviso.classList.add('error');
            return;
          }
          aviso.classList.remove('error');
          recargar();
          return;
        }
        aviso.textContent = 'No ha salido. ¿Hay conexión?';
        aviso.classList.add('error');
      });
    };
    enviar.addEventListener('click', mandar);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') mandar(); });
    setTimeout(() => input.focus(), 0);
  }

  function linea(m) {
    const fila = document.createElement('div');
    fila.className = 'chat-msg' + (m.mio ? ' propio' : '');

    const cab = document.createElement('div');
    cab.className = 'chat-msg-cab';
    const quien = document.createElement('span');
    quien.className = 'chat-quien';
    quien.textContent = m.mio ? 'Tú' : (nombreAbierta || 'Él');
    const hora = document.createElement('span');
    hora.className = 'chat-hora';
    hora.textContent = haceCuanto(m.enviado_el);
    cab.append(quien, hora);

    const texto = document.createElement('div');
    texto.className = 'chat-texto';
    // Lo escribe otra persona: `textContent`, siempre.
    texto.textContent = String(m.texto || '');

    fila.append(cab, texto);
    return fila;
  }

  // ---- La cara que ve el marco -------------------------------------------

  function abrirCon(dir, nombre) {
    abierta = String(dir || '') || null;
    nombreAbierta = abierta ? (nombre || nombreDe(abierta) || cortita(abierta)) : '';
    pintar();
    avisarAlMarco();
  }

  function volverALaLista() {
    abierta = null;
    nombreAbierta = '';
    pintar();
    avisarAlMarco();
  }

  pintar();

  return {
    el,
    abrirCon,
    volverALaLista,
    enConversacion: () => abierta,
    nombreAbierto: () => nombreAbierta
  };
}

/** Hace cuánto, en cristiano. */
function haceCuanto(iso) {
  const t = Date.parse(iso || '');
  if (!Number.isFinite(t)) return '';
  const seg = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (seg < 60) return 'ahora';
  if (seg < 3600) return `hace ${Math.floor(seg / 60)} min`;
  const fecha = new Date(t);
  const hoy = new Date();
  const mismoDia = fecha.getDate() === hoy.getDate()
    && fecha.getMonth() === hoy.getMonth()
    && fecha.getFullYear() === hoy.getFullYear();
  if (mismoDia) return fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return fecha.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
}
