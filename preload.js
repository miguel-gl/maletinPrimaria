const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('maletinLicense', {
  activate(payload) {
    return ipcRenderer.invoke('activate-license', payload);
  },
});

contextBridge.exposeInMainWorld('maletinAI', {
  semanticSearch(query, options = {}) {
    return ipcRenderer.invoke('semantic-search', {
      query,
      topK: options.topK,
      minScore: options.minScore,
      filters: options.filters,
    });
  },
  openLocalResource(relativePath) {
    return ipcRenderer.invoke('open-local-resource', {
      relativePath,
    });
  },
  saveLocalResource(relativePath) {
    return ipcRenderer.invoke('save-local-resource', {
      relativePath,
    });
  },
});
