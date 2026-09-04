'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// API segura expuesta al renderer. Sin acceso directo a Node.
contextBridge.exposeInMainWorld('pato', {
  // Overlay: capturar o dejar pasar el ratón según el hover.
  setIgnoreMouse: (ignore) => ipcRenderer.send('set-ignore-mouse', ignore),

  // Estado del Tamagotchi.
  loadState: () => ipcRenderer.invoke('state:load'),
  saveState: (data) => ipcRenderer.send('state:save', data),

  // Ajustes (nombre a mostrar, auto-arranque).
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (data) => ipcRenderer.send('settings:save', data),

  // Config de la app (versión, dev).
  getConfig: () => ipcRenderer.invoke('config:get'),

  // Chat entre patos.
  sendChat: (msg) => ipcRenderer.send('chat:send', msg),
  // Mandar el pato a la pantalla de otro.
  sendVisit: (visita) => ipcRenderer.send('chat:visit', visita),
  // Partidas entre patos: lo que llega vuelve por onChatEvent.
  sendGame: (mensaje) => ipcRenderer.send('juego:send', mensaje),
  // Esconder el pato en la bandeja, sin cerrarlo.
  hide: () => ipcRenderer.send('app:hide'),
  // Actualizaciones a mano.
  estadoActualizacion: () => ipcRenderer.invoke('update:status'),
  buscarActualizacion: () => ipcRenderer.send('update:check'),
  instalarActualizacion: () => ipcRenderer.send('update:install'),
  // Marcador global. `invoke` y no `send`: aquí sí hace falta la respuesta, y
  // la firma con la que se escribe se queda al otro lado del puente.
  marcadorMejores: (juego, mejorEs) => ipcRenderer.invoke('marcador:mejores', juego, mejorEs),
  marcadorGuardar: (record) => ipcRenderer.invoke('marcador:guardar', record),
  onChatEvent: (cb) => ipcRenderer.on('chat:event', (_e, evt) => cb(evt)),
  setChatName: (name) => ipcRenderer.send('chat:set-name', name),
  chatNames: () => ipcRenderer.invoke('chat:names'),
  chatStatus: () => ipcRenderer.invoke('chat:status'),

  // Acciones de app.
  quit: () => ipcRenderer.send('app:quit'),
  openExternal: (url) => ipcRenderer.send('open-external', url),

  // Eventos hacia el renderer.
  // Arrastre del pato: el proceso principal sigue el cursor mientras dura, para
  // poder mudar la ventana si se cruza a otro monitor.
  dragStart: () => ipcRenderer.send('drag:start'),
  dragEnd: () => ipcRenderer.send('drag:end'),
  onDisplayChanged: (cb) => ipcRenderer.on('display:changed', (_e, d) => cb(d)),

  onBeforeQuit: (cb) => ipcRenderer.on('app:before-quit', () => cb()),
  onLayoutChanged: (cb) => ipcRenderer.on('layout:changed', (_e, d) => cb(d)),
  onTrayCommand: (cb) => ipcRenderer.on('tray:command', (_e, cmd) => cb(cmd)),
  onUpdateEvent: (cb) => ipcRenderer.on('update:event', (_e, evt) => cb(evt))
});
