// Panel de ajustes: nombre del pato (para el chat) y auto-arranque.

import { panelHeader } from './panelHeader.js';

/**
 * @param {{displayName:string, autoLaunch:boolean}} settings
 * @param {string} version
 * @param {{onSave:(s:object)=>void, onClose:Function,
 *          isNameTaken:(n:string)=>boolean, chatReady:boolean}} handlers
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
  lbl1.textContent = 'Nombre de tu pato';
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

  // Auto-arranque
  const row2 = document.createElement('div');
  row2.className = 'row';
  const lbl2 = document.createElement('label');
  const chk = document.createElement('input');
  chk.type = 'checkbox';
  chk.checked = !!settings.autoLaunch;
  chk.style.marginRight = '6px';
  lbl2.append(chk, document.createTextNode('Iniciar con Windows'));
  row2.appendChild(lbl2);
  el.appendChild(row2);

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

  const setError = (msg) => {
    hint.textContent = msg || '';
    hint.classList.toggle('error', !!msg);
    name.classList.toggle('invalid', !!msg);
  };

  name.addEventListener('input', () => setError(''));

  save.addEventListener('click', () => {
    const value = name.value.trim();
    if (!value) {
      setError('Ponle un nombre a tu pato.');
      return;
    }
    // El nombre identifica al pato en el chat, así que no puede repetirse
    // con el de otro pato conectado ahora mismo.
    if (value !== (settings.displayName || '') && handlers.isNameTaken(value)) {
      setError(`Ya hay un pato llamado "${value}". Prueba con otro.`);
      return;
    }
    handlers.onSave({ displayName: value, autoLaunch: chk.checked });
    handlers.onClose();
  });

  setTimeout(() => name.focus(), 0);
  return { el };
}
