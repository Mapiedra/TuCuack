(() => {
  'use strict';

  // El pato sobre una página web.
  //
  // Se inyecta sólo en la pestaña donde toca (lo decide el árbitro del service
  // worker, ver sw.js) y monta el pato dentro de un Shadow DOM, para que el CSS del
  // sitio no le deforme los paneles ni el suyo altere la página.
  //
  // Este fichero es un content script clásico, no un módulo: el núcleo se trae con
  // un `import()` dinámico, que sí carga módulos y mantiene el mundo aislado.
  //
  // Se inyecta muchas veces en el mismo documento (el pato va y viene), así que
  // tiene que ser idempotente. El estado vive en `window` del mundo aislado, que
  // persiste entre inyecciones y no lo ve la página.
  //
  // Lo delicado es que montar TARDA —hay un fetch y tres import()— y el árbitro
  // puede querer llevarse el pato en mitad de la faena. Por eso el desmontador está
  // disponible desde el primer instante: si llega durante el montaje, se apunta la
  // petición y se atiende al acabar. Cuando esto no estaba resuelto, una pestaña
  // pillada en mal momento se quedaba marcada como ocupada por un pato que el
  // árbitro ya no controlaba, y no volvía a aceptarlo nunca más.

  // Nombre improbable: es el único rastro del pato en el árbol de la página.
  const ID_ANFITRION = 'tucuack-pato-anfitrion';

  /**
   * ¿Seguimos formando parte de la extensión?
   *
   * Al recargarla o actualizarla, este script se queda en la página ejecutándose
   * pero desconectado: su `chrome.*` ya no sirve. Perder `chrome.runtime.id` es
   * cómo se nota.
   */
  function contextoVivo() {
    try {
      return !!(chrome.runtime && chrome.runtime.id);
    } catch {
      return false;
    }
  }

  if (!window.__tucuack) {
    window.__tucuack = { fase: 'montando', cancelado: false, quitar: null };

    // Lo llama el árbitro con executeScript. Siempre existe, en cualquier fase.
    window.__tucuackDesmontar = () => {
      const estado = window.__tucuack;
      if (!estado) return;

      if (estado.fase === 'montando') {
        // Aún no hay nada que quitar: se atenderá en cuanto termine de montarse.
        estado.cancelado = true;
        return;
      }
      if (estado.quitar) {
        try {
          estado.quitar();
        } catch (err) {
          console.warn('[pato] fallo al apagar', err);
        }
      }
      window.__tucuack = null;
    };

    arrancar().catch((err) => {
      console.error('[pato] no se pudo montar en la página', err);
      // Que un fallo no deje la puerta cerrada para el siguiente intento.
      const previo = document.getElementById(ID_ANFITRION);
      if (previo) previo.remove();
      window.__tucuack = null;
    });
  }

  async function arrancar() {
    const previo = document.getElementById(ID_ANFITRION);
    if (previo) previo.remove();

    const anfitrion = document.createElement('div');
    anfitrion.id = ID_ANFITRION;
    // Cubre la ventana entera para que el pato pueda ser lanzado a cualquier
    // punto, pero deja pasar todos los clics: sólo los captura cuando el cursor
    // está sobre él (lo conmuta `capturarRaton`).
    anfitrion.style.cssText = [
      'position: fixed',
      'inset: 0',
      'margin: 0',
      'padding: 0',
      'border: 0',
      'background: none',
      'pointer-events: none',
      // Por encima de casi todo, sin llegar al máximo absoluto para no pelearse
      // con los avisos del propio navegador.
      'z-index: 2147483000',
      'color-scheme: normal'
    ].join(';');

    // Al documentElement y no al body: hay páginas que reescriben el body entero.
    document.documentElement.appendChild(anfitrion);

    const sombra = anfitrion.attachShadow({ mode: 'open' });

    // El CSS se trae por fetch y se pega dentro de la sombra. No vale un <link>:
    // el `style-src` de la página podría bloquearlo.
    const css = await (await fetch(chrome.runtime.getURL('core/styles.css'))).text();
    const estilo = document.createElement('style');
    estilo.textContent = css;
    sombra.appendChild(estilo);

    const escenario = document.createElement('div');
    escenario.id = 'stage';
    escenario.innerHTML = `
      <div id="duck" class="duck" data-state="idle" data-facing="left">
        <div class="status-bubbles" id="statusBubbles"></div>
        <div class="speech-layer" id="speechLayer"></div>
        <canvas id="duckCanvas" class="duck-canvas" width="248" height="268"></canvas>
        <div class="duck-shadow"></div>
      </div>`;
    sombra.appendChild(escenario);

    const { arrancarPato } = await import(chrome.runtime.getURL('core/app.js'));
    const { fijarEscenario } = await import(chrome.runtime.getURL('core/stage.js'));
    const { crearPlataformaPagina } = await import(chrome.runtime.getURL('platform-pagina.js'));

    // El pato busca sus elementos y monta sus paneles dentro de la sombra; las
    // variables CSS van en el anfitrión, que es quien hace de `:host`.
    fijarEscenario({ raiz: sombra, contenedor: sombra, estilo: anfitrion });

    const pato = await arrancarPato(crearPlataformaPagina(anfitrion));

    // Vigilancia de orfandad.
    //
    // Al recargar o actualizar la extensión, este script se queda en la página
    // ejecutándose pero desconectado: su `chrome.*` deja de funcionar. Si no se
    // retirara, seguiría dando vueltas, y —lo peor— la marca que deja en `window`
    // haría creer al pato nuevo que la pestaña ya está ocupada, así que no volvería
    // a entrar en ella nunca. Un pato huérfano se recoge solo.
    const vigilante = setInterval(() => {
      if (contextoVivo()) return;
      clearInterval(vigilante);
      console.log('[pato] la extensión se ha recargado; este pato se retira');
      try {
        pato.apagar();
      } catch { /* con el contexto muerto, poco más se puede hacer */ }
      anfitrion.remove();
      window.__tucuack = null;
      window.__tucuackDesmontar = null;
    }, 2000);

    const estado = window.__tucuack;
    // Si nos han desmontado por el camino, el sitio ya no es nuestro: se recoge
    // todo y se deja la pestaña libre para el próximo.
    if (!estado) {
      clearInterval(vigilante);
      pato.apagar('mudanza');
      anfitrion.remove();
      return;
    }

    // Apagarlo de verdad, no sólo quitarlo de la vista: si sus bucles siguieran
    // corriendo, este pato y el de la pestaña nueva estarían guardando el mismo
    // estado a la vez.
    estado.quitar = () => {
      clearInterval(vigilante);
      // Al árbitro sólo le quita el pato de una pestaña para ponerlo en otra:
      // es una mudanza, no una despedida.
      pato.apagar('mudanza');
      anfitrion.remove();
    };
    estado.fase = 'montado';

    if (estado.cancelado) window.__tucuackDesmontar();
  }
})();
