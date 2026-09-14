const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('thetaDesktop', {
  toggleFullscreen: () => ipcRenderer.send('toggle-fullscreen')
});