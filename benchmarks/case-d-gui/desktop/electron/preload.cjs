// Preload: expose a tiny, safe bridge to the renderer via contextBridge.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fugue', {
  run: (cmd) => ipcRenderer.invoke('fugue:run', cmd),
  agents: () => ipcRenderer.invoke('fugue:agents'),
});
