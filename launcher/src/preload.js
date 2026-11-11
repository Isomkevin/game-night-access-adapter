const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gameNight', {
  openUrl: (url) => ipcRenderer.invoke('open-url', url),
  openHub: () => ipcRenderer.invoke('open-hub'),
  openLanding: () => ipcRenderer.invoke('open-landing'),
  rerunExtensionSetup: () => ipcRenderer.invoke('rerun-extension-setup'),
  markFirstRunDone: () => ipcRenderer.invoke('mark-first-run-done'),
  checkExtension: () => ipcRenderer.invoke('check-extension'),
  onExtensionInfo: (cb) => {
    ipcRenderer.on('extension-info', (_e, data) => cb(data));
  },
  onCoachInfo: (cb) => {
    ipcRenderer.on('coach-info', (_e, data) => cb(data));
  },
});
