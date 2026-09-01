// Panel de conectados: qué patos hay ahora mismo en el canal común del chat, y
// a cuál mandarle el nuestro.
//
// La lista sale de la presencia del canal, que ya se mantenía para comprobar
// que un nombre no estuviera en uso; aquí simplemente se enseña. Como los patos
// entran y salen por su cuenta, el panel se repinta con `actualizar` mientras
// está abierto en vez de mostrar una foto fija.
//
// Mandarle tu mascota a alguien necesita su CLAVE de presencia, no su nombre: dos
// patos pueden llamarse igual. Por eso el botón sólo sale en las filas que
// vengan de `presentes`; si al otro lado del canal hay una versión que todavía
// no anuncia claves, la lista se ve igual pero sin poder mandar nada.

import { panelHeader } from './panelHeader.js';

/**
 * @typedef {{clave:string, nombre:string}} Presente
 * @typedef {{yo:string, otros:string[], presentes:Presente[],
 *            conectado:boolean}} EstadoPresencia
 */

const MAX_RECADO = 280;

// Cada cuánto se repinta la cuenta atrás de los botones en espera. Cuatro veces
// por segundo basta para que la rueda se vea avanzar sin parecer un reloj roto.
const REFRESCO_ESPERA = 250;

/**
 * @param {EstadoPresencia} inicial
 * `esperaDe` dice cuántos ms faltan para poder mandarle otra vez el pato a
 * alguien, y `esperaTotal` cuánto dura esa espera entera: con las dos cosas se
 * sabe qué parte de la rueda hay que llenar. El número lo pone quien llama, que
 * es quien sabe de dónde sale (ver `esperaParaVisitar` en app.js).
 *
 * @param {{onEnviar?:(destino:Presente, texto:string)=>boolean,
 *          esperaDe?:(clave:string)=>number, esperaTotal?:number,
 *          onBack?:Function, onClose:Function}} handlers
 * @returns {{el:HTMLElement, actualizar:(estado:EstadoPresencia)=>void}}
 */
export function buildOnlinePanel(inicial, handlers) {
  const el = document.createElement('div');
  el.className = 'panel hot';

  const cab = panelHeader('Conectados', handlers);
  el.appendChild(cab);
  const titulo = cab.querySelector('.panel-title');

  const lista = document.createElement('ul');
  lista.className = 'lista-conectados';
  el.appendChild(lista);

  const nota = document.createElement('div');
  nota.className = 'muted';
  el.appendChild(nota);

  // A quién se le está escribiendo un recado ahora mismo.
  let componiendo = null;
  // Y el cajón en sí, GUARDADO ENTERO. La lista se repinta cada vez que alguien
  // entra o sale del canal —que con gente conectada es a menudo—, y volver a
  // construir el campo borraba lo que llevases escrito y te quitaba el foco a
  // media palabra. Guardando el elemento, repintar sólo lo cambia de sitio.
  /** @type {{clave:string, el:HTMLElement, campo:HTMLInputElement}|null} */
  let cajon = null;

  /** Cierra el recado y tira el cajón: el siguiente se estrena limpio. */
  function cerrarRecado() {
    componiendo = null;
    cajon = null;
  }
  // El último estado pintado: el compositor se repinta con la lista y necesita
  // saber con qué.
  let ultimoEstado = inicial;
  /** Botón de mandar de cada pato, para repintarle la espera sin rehacer la
   *  lista entera (rehacerla cerraría el recado a medio escribir). */
  let botones = new Map();
  const esperaDe = handlers.esperaDe || (() => 0);
  const esperaTotal = handlers.esperaTotal > 0 ? handlers.esperaTotal : 1;

  // Se pinta también antes de estar en el documento (el panel se mide y se
  // coloca ya montado, pero con contenido). Quien lo abre deja de llamarlo en
  // cuanto se cierra, así que no hace falta comprobar si sigue vivo.
  const actualizar = (estado) => {
    const presentes = Array.isArray(estado.presentes) ? estado.presentes : [];
    const otros = Array.isArray(estado.otros) ? estado.otros : [];

    // Se apunta ANTES de vaciar: al sacar el campo del documento pierde el foco,
    // así que después ya no habría forma de saber si lo tenía.
    const recuperarFoco = elCampoTieneElCursor();
    const cursor = recuperarFoco
      ? [cajon.campo.selectionStart, cajon.campo.selectionEnd]
      : null;

    lista.textContent = '';
    botones = new Map();

    if (!estado.conectado) {
      // Sin canal no se sabe quién anda por ahí, y los demás tampoco nos ven.
      titulo.textContent = 'Conectados';
      nota.textContent = 'El chat no está conectado. En cuanto vuelva, la lista '
        + 'se rellena sola.';
      cerrarRecado();
      return;
    }

    const cuantos = presentes.length || otros.length;
    titulo.textContent = `Conectados · ${cuantos + 1}`;
    lista.appendChild(fila({ nombre: estado.yo }, true, null));

    if (presentes.length) {
      // Si el que estaba componiendo se ha ido del canal, se cierra el recado.
      if (componiendo && !presentes.some((p) => p.clave === componiendo)) cerrarRecado();
      for (const p of ordenar(presentes, (x) => x.nombre)) {
        const li = fila(p, false, handlers.onEnviar ? abrirRecado : null);
        const boton = li.querySelector('.btn-mandar');
        if (boton) {
          botones.set(p.clave, { boton, nombre: p.nombre });
          const restante = esperaDe(p.clave);
          pintarEspera(boton, p.nombre, restante);
          if (restante > 0) arrancarReloj();
        }
        lista.appendChild(li);
        if (componiendo === p.clave) lista.appendChild(compositor(p));
      }
    } else {
      // Sin claves sólo se puede mirar: ver la nota de arriba.
      for (const nombre of ordenar(otros, (x) => x)) {
        lista.appendChild(fila({ nombre }, false, null));
      }
    }

    nota.textContent = cuantos
      ? ''
      : 'Ahora mismo no hay ninguna otra mascota conectada.';

    // Y se devuelve el foco donde estaba, con el cursor donde estaba. Sin esto,
    // escribir un recado mientras alguien entra o sale del canal es imposible.
    if (recuperarFoco && cajon && cajon.el.isConnected) {
      cajon.campo.focus();
      try { cajon.campo.setSelectionRange(cursor[0], cursor[1]); } catch { /* da igual */ }
    }
  };

  /**
   * Deja el botón de un pato como toque: listo para mandar, o esperando.
   *
   * Mientras se espera, el botón se convierte en una rueda que se va llenando
   * con los segundos que faltan dentro. Sin esto la espera era invisible: el
   * pato se mandaba, se decía que iba de camino, y al otro lado se descartaba
   * sin que nadie se enterara.
   */
  function pintarEspera(boton, nombre, restante) {
    const esperando = restante > 0;
    boton.classList.toggle('esperando', esperando);
    boton.disabled = esperando;

    if (!esperando) {
      boton.textContent = '🛫';
      boton.style.removeProperty('--progreso');
      boton.title = `Mandarle tu mascota a ${nombre}`;
      return;
    }
    const segundos = Math.ceil(restante / 1000);
    boton.textContent = String(segundos);
    // De 0 a 1: lo que YA se ha esperado, para que la rueda se llene en vez de
    // vaciarse. Una rueda que se vacía se lee como algo que se acaba.
    boton.style.setProperty('--progreso',
      String(Math.max(0, Math.min(1, 1 - restante / esperaTotal))));
    boton.title = `${nombre} acaba de recibir tu mascota. `
      + `Podrás mandárselo otra vez dentro de ${segundos} s.`;
  }

  // Sólo late mientras haya alguien esperando: un panel abierto sin esperas no
  // tiene por qué estar repintándose.
  let reloj = null;
  const repasarEsperas = () => {
    let quedaAlguna = false;
    for (const [clave, { boton, nombre }] of botones) {
      const restante = esperaDe(clave);
      if (restante > 0) quedaAlguna = true;
      pintarEspera(boton, nombre, restante);
    }
    if (!quedaAlguna) pararReloj();
  };
  const arrancarReloj = () => {
    if (reloj) return;
    reloj = setInterval(repasarEsperas, REFRESCO_ESPERA);
  };
  const pararReloj = () => {
    if (reloj) clearInterval(reloj);
    reloj = null;
  };
  // El panel puede cerrarse en cualquier momento; el reloj no puede sobrevivirle.
  el.addEventListener('panel:cerrado', pararReloj, { once: true });

  /** Abre (o cierra, si ya estaba) el recado para ese pato. */
  function abrirRecado(destino) {
    if (componiendo === destino.clave) cerrarRecado();
    else { cerrarRecado(); componiendo = destino.clave; }
    actualizar(ultimoEstado);
    if (componiendo) {
      const campo = lista.querySelector('.recado-texto');
      if (campo) campo.focus();
    }
  }

  /** El cajón que se despliega bajo un pato para mandarle el nuestro. */
  function compositor(destino) {
    // Si ya hay uno abierto para este pato, se devuelve TAL CUAL: con su texto,
    // su cursor y el estado de su botón. Es lo que hace que repintar la lista no
    // se lleve por delante lo que estás escribiendo.
    if (cajon && cajon.clave === destino.clave) return cajon.el;

    const li = document.createElement('li');
    li.className = 'recado';

    const campo = document.createElement('input');
    campo.type = 'text';
    campo.className = 'recado-texto';
    campo.maxLength = MAX_RECADO;
    campo.placeholder = 'Un recado (opcional)';

    const enviar = document.createElement('button');
    enviar.className = 'btn';
    enviar.textContent = '🛫 Mandar la mascota';

    const aviso = document.createElement('div');
    aviso.className = 'muted recado-aviso';
    // Que nadie mande por aquí lo que no mandaría por un grupo: el canal es
    // compartido y el recado pasa por él aunque sólo lo enseñe el destinatario.
    aviso.textContent = 'El recado viaja por el canal común: lo enseña sólo '
      + `${destino.nombre}, pero no es una conversación privada.`;

    const mandar = () => {
      enviar.disabled = true;
      const salio = handlers.onEnviar(destino, campo.value);
      enviar.textContent = salio ? '✅ Va de camino' : '⚠️ No se pudo enviar';
      // El pato ya va de camino: el cajón se cierra solo para no dejar el botón
      // pulsado invitando a mandar otro.
      setTimeout(() => {
        cerrarRecado();
        actualizar(ultimoEstado);
      }, salio ? 1200 : 2500);
    };

    enviar.addEventListener('click', mandar);
    campo.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') mandar();
      else if (e.key === 'Escape') { cerrarRecado(); actualizar(ultimoEstado); }
    });

    li.append(campo, enviar, aviso);
    cajon = { clave: destino.clave, el: li, campo };
    return li;
  }

  /**
   * ¿Está el cursor en el campo del recado?
   *
   * Se pregunta por el elemento activo y no se sigue con eventos de foco: un
   * `focus()` fija el elemento activo pero NO dispara el evento si la ventana no
   * tiene el foco del sistema, y entonces el rastro se pierde.
   *
   * Y se pregunta a `getRootNode()`, no a `document`: sobre una página ajena el
   * pato vive en un Shadow DOM, y desde fuera `document.activeElement` sólo
   * enseña el anfitrión, nunca el campo de dentro.
   */
  function elCampoTieneElCursor() {
    if (!cajon) return false;
    const raiz = cajon.campo.getRootNode();
    return !!raiz && raiz.activeElement === cajon.campo;
  }

  const actualizarYRecordar = (estado) => {
    ultimoEstado = estado;
    actualizar(estado);
  };
  actualizarYRecordar(inicial);

  return { el, actualizar: actualizarYRecordar };
}

/** Alfabético, ignorando mayúsculas y acentos. */
function ordenar(items, nombreDe) {
  return [...items].sort((a, b) =>
    String(nombreDe(a)).localeCompare(String(nombreDe(b)), 'es', { sensitivity: 'base' }));
}

/**
 * @param {{clave?:string, nombre:string}} quien
 * @param {boolean} esYo
 * @param {((destino:object)=>void)|null} onMandar
 */
function fila(quien, esYo, onMandar) {
  const li = document.createElement('li');
  if (esYo) li.className = 'yo';

  const punto = document.createElement('span');
  punto.className = 'punto';

  const txt = document.createElement('span');
  txt.className = 'nombre';
  // Nombre puesto por otra persona: siempre como texto, nunca como HTML.
  txt.textContent = String(quien.nombre || 'Pato');
  txt.title = txt.textContent;      // por si no cabe y se recorta

  li.append(punto, txt);

  if (esYo) {
    const etiqueta = document.createElement('span');
    etiqueta.className = 'etiqueta-yo';
    etiqueta.textContent = 'tú';
    li.appendChild(etiqueta);
    return li;
  }

  if (onMandar) {
    const boton = document.createElement('button');
    boton.className = 'btn-mandar';
    boton.textContent = '🛫';
    boton.title = `Mandarle tu mascota a ${txt.textContent}`;
    boton.addEventListener('click', () => onMandar(quien));
    li.appendChild(boton);
  }
  return li;
}
