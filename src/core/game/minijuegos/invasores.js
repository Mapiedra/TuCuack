// Invasores: gaviotas que bajan, y tu mascota poniendo huevos hacia arriba.
//
// Space Invaders. La mascota se mueve por abajo y dispara; enfrente, filas de
// gaviotas que van de lado, bajan un escalón cada vez que tocan un borde, y
// aceleran según quedan menos. Que lleguen a tu altura es el final.
//
// ---- Lo que estrena ---------------------------------------------------------
//
// Es el primero con **proyectiles propios, y en las dos direcciones**. Hasta
// ahora lo que volaba era la mascota (Hook, Flappy) o una pelota compartida
// (Pong, Ladrillos); aquí hay dos listas de cosas que van a su aire y se cruzan.
//
// Y trae la restricción que define el género: **sólo dos huevos en el aire a la
// vez**. Sin eso, en una pantalla de escritorio se barre la oleada aporreando el
// espacio y no hay que apuntar a nada. Con eso, cada disparo es una decisión.
//
// No hace falta arte: las gaviotas son un emoji pintado en el lienzo, como el
// resto del catálogo, y el huevo es una elipse.

import { sembrar } from './azar.js';

/** Vidas. Que te alcance un excremento cuesta una; que lleguen abajo, todas. */
const VIDAS = 3;

/** Cuántos huevos puede haber volando a la vez. Ver la cabecera. */
const HUEVOS_A_LA_VEZ = 2;
const HUEVO_VELOCIDAD = 900;

/** Lo que caen sus proyectiles, y cada cuánto sueltan uno. */
const CAIDA = 420;
const CAIDA_POR_OLEADA = 26;
const BOMBA_CADA = 1.6;
const BOMBA_MINIMO = 0.42;

/** Lo que se mueve la formación, y cuánto acelera. */
const VELOCIDAD = 62;
const VELOCIDAD_POR_OLEADA = 16;
/** Y cuánto multiplica ir quedando pocas: es la prisa del final de oleada. */
const VELOCIDAD_POR_BAJA = 2.6;

/** Lo que bajan al tocar un borde. */
const ESCALON = 26;

/** Lo deprisa que se mueve la mascota. */
const LATERAL = 620;

/** Lo que se espera entre oleadas, para verlo. */
const RESPIRO_S = 1.1;

/**
 * Lo que el juego se da antes de cerrar.
 *
 * El préstamo del escenario corta a los diez minutos y lo hace SIN resultado
 * (ver `TOPE_PARTIDA_MS` en escenario.js). Con tres vidas es difícil llegar,
 * pero quien aguante no puede perder la marca por buena.
 */
const PRESUPUESTO_MS = 8.5 * 60 * 1000;

/**
 * @param {import('./index.js').ContextoPartida} ctx
 * @returns {import('./index.js').Partida}
 */
export function crearPartida(ctx) {
  const pista = ctx.escenario;
  const { pato, entrada } = pista;
  const azar = sembrar(ctx.semilla);
  const mejorPrevio = typeof ctx.marcas.mejor === 'number' ? ctx.marcas.mejor : null;

  // ---- TODO el estado va aquí arriba, antes del `return` -------------------
  //
  // Es la cuarta regla dura del contrato: abajo sólo declaraciones de función,
  // que son las únicas que se izan. Ver `tools/comprobar-juegos.js`.

  /** 'jugando' | 'entreOleadas' | 'fin' */
  let fase = 'entreOleadas';
  let oleada = 0;
  let vidas = VIDAS;
  let derribadas = 0;
  let espera = RESPIRO_S;
  let hastaLaBomba = BOMBA_CADA;
  let terminada = false;
  let pulsadoAntes = false;
  let transcurrido = 0;
  let ultimaMarcada = -1;

  let medidas = pista.medidas;
  let campo = medirCampo();

  /** @type {{x:number, y:number, viva:boolean, col:number}[]} */
  let gaviotas = [];
  /** @type {{x:number, y:number}[]} */
  const huevos = [];
  /** @type {{x:number, y:number}[]} */
  const bombas = [];

  /** Hacia dónde va la formación: 1 derecha, -1 izquierda. */
  let sentido = 1;
  /** El cuerpo de la mascota, en coordenadas de pantalla. Se refresca cada vez. */
  let nave = { x: 0, y: 0, w: 60, h: 40 };

  pista.cursor('none');
  colocarMascota();
  marcar();

  return { actualizar, destroy };

  function destroy() { terminada = true; }

  // ---- Un fotograma ------------------------------------------------------

  function actualizar(dt, p) {
    if (terminada) return;
    medidas = p.medidas;
    campo = medirCampo();

    transcurrido += dt * 1000;
    if (transcurrido >= PRESUPUESTO_MS) return acabar('tiempo');

    moverMascota(dt);

    if (fase === 'entreOleadas') {
      espera -= dt;
      if (espera <= 0) siguienteOleada();
    } else {
      moverFormacion(dt);
      soltarBombas(dt);
      moverProyectiles(dt);
      if (comprobarChoques()) return;
    }

    pintar(p.pintor);
    marcarSiCambia();
  }

  // ---- La mascota --------------------------------------------------------

  function colocarMascota() {
    pato.setTilt(0);
    pato.setState('idle');
    pato.setFacing(1);
    pato.setY(medidas.suelo);
    pato.setX(medidas.ancho * 0.5 - medidas.patoAncho / 2);
    refrescarNave();
  }

  function refrescarNave() {
    const c = pato.cuerpo();
    nave = {
      x: c.cx - medidas.patoAncho * 0.32,
      y: c.cy - medidas.patoAlto * 0.34,
      w: medidas.patoAncho * 0.64,
      h: medidas.patoAlto * 0.68
    };
  }

  function moverMascota(dt) {
    const izq = entrada.pulsada('ArrowLeft') || entrada.pulsada('a');
    const der = entrada.pulsada('ArrowRight') || entrada.pulsada('d');
    const dir = (der ? 1 : 0) - (izq ? 1 : 0);
    if (dir) {
      const x = Math.max(0, Math.min(medidas.ancho - medidas.patoAncho,
        pato.x + dir * LATERAL * dt));
      pato.setX(x);
      pato.setFacing(dir);
    }
    pato.setY(medidas.suelo);
    refrescarNave();

    const ahora = disparan();
    if (ahora && !pulsadoAntes && fase === 'jugando') disparar();
    pulsadoAntes = ahora;
  }

  function disparan() {
    return entrada.pulsada(' ') || entrada.pulsada('Spacebar')
      || entrada.pulsada('ArrowUp') || entrada.pulsada('w') || entrada.pulsado;
  }

  function disparar() {
    if (huevos.length >= HUEVOS_A_LA_VEZ) return;
    huevos.push({ x: nave.x + nave.w / 2, y: nave.y });
    // Se le quita la cara de haber recibido: volver a disparar es la señal de
    // que ya se ha recompuesto, y así no hace falta un temporizador para algo
    // que el propio jugador decide.
    pato.setState('idle');
    ctx.sonido.nota(680, 0.05);
  }

  // ---- La formación ------------------------------------------------------

  function siguienteOleada() {
    oleada++;
    huevos.length = 0;
    bombas.length = 0;
    sentido = 1;
    hastaLaBomba = ritmoDeBombas();

    // Más filas según se avanza, y empezando más abajo: las dos cosas quitan
    // tiempo, que es lo único que hay.
    const filas = Math.min(5, 1 + Math.ceil(oleada / 2));
    const columnas = Math.max(5, Math.min(11,
      Math.round(campo.ancho / (medidas.patoAncho * 1.5))));
    const paso = campo.ancho / (columnas + 1);
    const altoFila = Math.max(34, medidas.patoAlto * 0.5);
    const arriba = campo.y0 + Math.min(campo.alto * 0.30, (oleada - 1) * ESCALON);

    gaviotas = [];
    for (let f = 0; f < filas; f++) {
      for (let c = 0; c < columnas; c++) {
        gaviotas.push({
          x: campo.x0 + paso * (c + 1),
          y: arriba + f * altoFila,
          viva: true,
          col: c
        });
      }
    }

    fase = 'jugando';
    ctx.sonido.nota(520, 0.08);
    if (oleada > 1) ctx.decir(`Oleada ${oleada}.`);
    marcar();
  }

  function vivas() {
    let n = 0;
    for (const g of gaviotas) if (g.viva) n++;
    return n;
  }

  function moverFormacion(dt) {
    const quedan = vivas();
    if (!quedan) { fase = 'entreOleadas'; espera = RESPIRO_S; return; }

    // La prisa sale de cuántas quedan: la última corre como alma que lleva el
    // diablo, que es lo que hace memorable el final de una oleada.
    const parte = 1 - quedan / gaviotas.length;
    const v = (VELOCIDAD + (oleada - 1) * VELOCIDAD_POR_OLEADA)
      * (1 + parte * VELOCIDAD_POR_BAJA);

    let izq = Infinity;
    let der = -Infinity;
    for (const g of gaviotas) {
      if (!g.viva) continue;
      g.x += sentido * v * dt;
      if (g.x < izq) izq = g.x;
      if (g.x > der) der = g.x;
    }

    const radio = medidas.patoAncho * 0.3;
    if (der + radio >= campo.x1 || izq - radio <= campo.x0) {
      sentido = -sentido;
      // Se corrige el desbordamiento antes de bajar, o al fotograma siguiente
      // volvería a tocar el borde y bajaría dos escalones de una.
      const exceso = der + radio >= campo.x1
        ? der + radio - campo.x1
        : izq - radio - campo.x0;
      for (const g of gaviotas) {
        if (!g.viva) continue;
        g.x -= exceso;
        g.y += ESCALON;
      }
      ctx.sonido.nota(220, 0.05);
    }
  }

  function ritmoDeBombas() {
    return Math.max(BOMBA_MINIMO, BOMBA_CADA - (oleada - 1) * 0.14);
  }

  /**
   * Sólo tira la de más abajo de su columna.
   *
   * Si tirara cualquiera, los proyectiles saldrían del centro de la formación y
   * se verían aparecer de la nada. Y de paso es lo que hace que abrir un hueco
   * en una columna tenga consecuencias.
   */
  function soltarBombas(dt) {
    hastaLaBomba -= dt;
    if (hastaLaBomba > 0) return;
    hastaLaBomba = ritmoDeBombas();

    const ultimas = new Map();
    for (const g of gaviotas) {
      if (!g.viva) continue;
      const actual = ultimas.get(g.col);
      if (!actual || g.y > actual.y) ultimas.set(g.col, g);
    }
    if (!ultimas.size) return;

    const lista = [...ultimas.values()];
    const g = lista[Math.floor(azar() * lista.length)];
    bombas.push({ x: g.x, y: g.y + 10 });
  }

  function moverProyectiles(dt) {
    for (let i = huevos.length - 1; i >= 0; i--) {
      huevos[i].y -= HUEVO_VELOCIDAD * dt;
      if (huevos[i].y < campo.y0 - 20) huevos.splice(i, 1);
    }
    const caida = CAIDA + (oleada - 1) * CAIDA_POR_OLEADA;
    for (let i = bombas.length - 1; i >= 0; i--) {
      bombas[i].y += caida * dt;
      if (bombas[i].y > campo.y1 + 20) bombas.splice(i, 1);
    }
  }

  // ---- Choques -----------------------------------------------------------

  /** @returns {boolean} si la partida se ha acabado en este fotograma */
  function comprobarChoques() {
    const radio = medidas.patoAncho * 0.3;

    // Huevos contra gaviotas.
    for (let i = huevos.length - 1; i >= 0; i--) {
      const h = huevos[i];
      for (const g of gaviotas) {
        if (!g.viva) continue;
        if (Math.abs(g.x - h.x) > radio || Math.abs(g.y - h.y) > radio) continue;
        g.viva = false;
        huevos.splice(i, 1);
        derribadas++;
        ctx.sonido.nota(880 + azar() * 200, 0.05);
        marcar();
        break;
      }
    }

    // Bombas contra la mascota.
    for (let i = bombas.length - 1; i >= 0; i--) {
      const b = bombas[i];
      if (b.x < nave.x || b.x > nave.x + nave.w) continue;
      if (b.y < nave.y || b.y > nave.y + nave.h) continue;
      bombas.splice(i, 1);
      if (perderVida()) return true;
    }

    // Y lo que no se negocia: que lleguen a tu altura.
    for (const g of gaviotas) {
      if (!g.viva) continue;
      if (g.y + radio >= nave.y) { acabar('alcanzada'); return true; }
    }
    return false;
  }

  /** @returns {boolean} si con ésta se acabó */
  function perderVida() {
    vidas--;
    ctx.sonido.nota(180, 0.2);
    pato.setState('sad');
    marcar();
    if (vidas > 0) return false;
    acabar('sinVidas');
    return true;
  }

  // ---- Final -------------------------------------------------------------

  function acabar(motivo) {
    if (terminada) return;
    terminada = true;
    fase = 'fin';

    // La marca es la oleada a la que llegaste. Si te matan en la primera, es 1:
    // haber jugado cuenta, aunque sea poco.
    const marca = Math.max(1, oleada);
    const esRecord = mejorPrevio === null || marca > mejorPrevio;
    if (motivo === 'alcanzada') ctx.decir('Te han pasado por encima.');
    if (motivo === 'tiempo') ctx.decir('Se acabó el tiempo.');

    ctx.sonido[esRecord ? 'victoria' : 'derrota']();
    ctx.alTerminar({
      resultado: esRecord ? 'victoria' : 'derrota',
      puntos: marca,
      detalle: detalleFinal(marca, esRecord)
    });
  }

  function detalleFinal(marca, esRecord) {
    const cola = esRecord
      ? (mejorPrevio === null ? ' A ver quién llega más lejos.' : ` Récord nuevo: antes eran ${mejorPrevio}.`)
      : (mejorPrevio === null ? '' : ` Tu récord sigue en ${mejorPrevio}.`);
    return `Oleada ${marca}, con ${derribadas} ${derribadas === 1 ? 'gaviota' : 'gaviotas'} derribadas.${cola}`;
  }

  function marcarSiCambia() {
    const v = vivas();
    if (v === ultimaMarcada) return;
    ultimaMarcada = v;
    marcar();
  }

  function marcar() {
    const vidasTxt = '●'.repeat(Math.max(0, vidas)) + '○'.repeat(Math.max(0, VIDAS - vidas));
    const base = `Oleada ${Math.max(1, oleada)}  ·  ${vidasTxt}  ·  ${vivas()} enfrente`
      + `  ·  ${derribadas} derribadas`;
    pista.marcador(mejorPrevio === null ? base : `${base}  ·  récord ${mejorPrevio}`);
  }

  // ---- Medidas -----------------------------------------------------------

  function medirCampo() {
    const margen = Math.max(14, Math.min(40, medidas.ancho * 0.02));
    const y1 = Math.min(medidas.alto - 4, pista.aPantalla(medidas.suelo));
    return {
      x0: margen,
      x1: Math.max(margen + 240, medidas.ancho - margen),
      y0: margen,
      y1,
      ancho: Math.max(240, medidas.ancho - margen * 2),
      alto: Math.max(200, y1 - margen)
    };
  }

  // ---- Pintado -----------------------------------------------------------

  function pintar(g) {
    g.save();
    g.fillStyle = 'rgba(14, 14, 26, 0.86)';
    g.fillRect(campo.x0, campo.y0, campo.ancho, campo.y1 - campo.y0);
    g.lineWidth = 4;
    g.strokeStyle = '#8ecae6';
    g.strokeRect(campo.x0, campo.y0, campo.ancho, campo.y1 - campo.y0);
    g.restore();

    const talla = Math.max(20, medidas.patoAncho * 0.52);
    g.save();
    g.font = `${Math.round(talla)}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const gv of gaviotas) {
      if (!gv.viva) continue;
      g.fillText('🐦', gv.x, gv.y);
    }
    g.restore();

    g.save();
    g.fillStyle = '#fffdf7';
    for (const h of huevos) {
      g.beginPath();
      g.ellipse(h.x, h.y, 5, 8, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#c1121f';
    for (const b of bombas) {
      g.beginPath();
      g.ellipse(b.x, b.y, 4, 9, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }
}
