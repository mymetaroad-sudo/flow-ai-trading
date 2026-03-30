const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('roadflowAPI', {
  getAppInfo:     () => ipcRenderer.invoke('get-app-info'),
  openLogDir:     () => ipcRenderer.invoke('open-log-dir'),
  restartBackend: () => ipcRenderer.invoke('restart-backend'),
  onBackendCrash: (cb) => ipcRenderer.on('backend-crashed', (_, data) => cb(data)),
});
