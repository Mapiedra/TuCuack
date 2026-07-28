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
