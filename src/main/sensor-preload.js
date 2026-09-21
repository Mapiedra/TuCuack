'use strict';

// El puente del timbre (ver `sensor.js`). Es lo más pequeño que puede ser un
// preload: una sola función, en una sola dirección.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sensor', {
  dice: (evento) => ipcRenderer.send('sensor:puntero', evento)
});
