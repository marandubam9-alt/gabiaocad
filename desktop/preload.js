const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  saveFile: (opts) => ipcRenderer.invoke('save-file', opts),
  openFile: () => ipcRenderer.invoke('open-file'),
  showInFolder: (p) => ipcRenderer.invoke('show-in-folder', p),
  setTitle: (t) => ipcRenderer.invoke('set-title', t),
  confirmClose: (dirty) => ipcRenderer.invoke('confirm-close', { dirty }),
  forceClose: () => ipcRenderer.invoke('force-close'),
  aiHasKey: () => ipcRenderer.invoke('ai-has-key'),
  aiSetKey: (k) => ipcRenderer.invoke('ai-set-key', k),
  aiAnalyze: (o) => ipcRenderer.invoke('ai-analyze', o),
  aiCancel: () => ipcRenderer.invoke('ai-cancel'),
  onMenu: (fn) => ipcRenderer.on('menu', (_e, a) => fn(a)),
  onProjectOpened: (fn) => ipcRenderer.on('project-opened', (_e, p) => fn(p)),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  takePendingAuth: () => ipcRenderer.invoke('take-pending-auth'),
  onAuthUrl: (fn) => ipcRenderer.on('auth-url', (_e, u) => fn(u)),
  onQueryClose: (fn) => ipcRenderer.on('query-close', () => fn()),
});
