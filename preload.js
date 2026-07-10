const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petAPI', {
  showContextMenu: () => ipcRenderer.send('show-context-menu'),

  setIgnoreMouseEvents: (ignore, options) => {
    ipcRenderer.send('set-ignore-mouse-events', ignore, options);
  },

  moveWindow: (deltaX, deltaY) => {
    ipcRenderer.send('move-window', deltaX, deltaY);
  },

  setWindowPosition: (x, y) => {
    ipcRenderer.send('set-window-position', x, y);
  },

  getScreenBounds: () => ipcRenderer.invoke('get-screen-bounds'),

  getWindowPosition: () => ipcRenderer.invoke('get-window-position'),

  onPetAction: (callback) => {
    const handler = (_event, action) => callback(action);
    ipcRenderer.on('pet-action', handler);
    return () => ipcRenderer.removeListener('pet-action', handler);
  },
});
