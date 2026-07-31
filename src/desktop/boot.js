// Arranque de la versión de escritorio: instala la plataforma de Electron y
// suelta al pato.

import { arrancarPato } from '../core/app.js';
import { crearPlataformaElectron } from './platform.js';

arrancarPato(crearPlataformaElectron())
  .catch((err) => console.error('[pato] error al arrancar', err));
