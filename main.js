const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const { semanticSearch } = require('./src/ai/search');

ipcMain.handle('semantic-search', async (_event, payload = {}) => {
  const query = String(payload.query || '').trim();
  const discoveryContext = payload?.filters?.discoveryContext || {};
  const hasDiscoveryContextFilters = Object.values(discoveryContext).some((values) => Array.isArray(values) && values.length > 0);

  if (!query && !hasDiscoveryContextFilters) {
    return {
      ok: true,
      results: [],
    };
  }

  try {
    const results = await semanticSearch(query, {
      topK: payload.topK,
      minScore: payload.minScore,
      filters: payload.filters,
    });

    return {
      ok: true,
      results,
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message,
      results: [],
    };
  }
});

ipcMain.handle('open-local-resource', async (_event, payload = {}) => {
  const relativePath = String(payload.relativePath || '').trim();

  if (!relativePath) {
    return { ok: false, error: 'Ruta de archivo no proporcionada.' };
  }

  const targetPath = path.resolve(__dirname, relativePath);
  if (!fs.existsSync(targetPath)) {
    return { ok: false, error: 'No se encontro el archivo solicitado.' };
  }

  const result = await shell.openPath(targetPath);
  if (result) {
    return { ok: false, error: result };
  }

  return { ok: true };
});

ipcMain.handle('save-local-resource', async (_event, payload = {}) => {
  const relativePath = String(payload.relativePath || '').trim();

  if (!relativePath) {
    return { ok: false, error: 'Ruta de archivo no proporcionada.' };
  }

  const sourcePath = path.resolve(__dirname, relativePath);
  if (!fs.existsSync(sourcePath)) {
    return { ok: false, error: 'No se encontro el archivo solicitado.' };
  }

  const defaultName = path.basename(sourcePath);
  const saveResult = await dialog.showSaveDialog({
    title: 'Guardar instrumento de evaluacion',
    defaultPath: defaultName,
    filters: [
      { name: 'Archivos de Excel', extensions: ['xlsx', 'xls'] },
      { name: 'Todos los archivos', extensions: ['*'] },
    ],
  });

  if (saveResult.canceled || !saveResult.filePath) {
    return { ok: false, cancelled: true, error: 'Guardado cancelado.' };
  }

  fs.copyFileSync(sourcePath, saveResult.filePath);

  const result = await shell.openPath(saveResult.filePath);
  if (result) {
    return { ok: false, error: result };
  }

  return { ok: true, savedPath: saveResult.filePath };
});

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1366,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'inicio.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
