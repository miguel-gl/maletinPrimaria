const { app, BrowserWindow, ipcMain, shell, dialog, Menu, net } = require('electron');
const path = require('path');
const fs = require('fs');

const { autoUpdater } = require('electron-updater');
const { semanticSearch } = require('./src/ai/search');

const ACTIVATION_API_URL = 'https://sistemasaudiovisualesinternacionales.com/saiadmin/api/activar.php';

ipcMain.handle('activate-license', async (_event, payload = {}) => {
  const body = JSON.stringify({
    licencia: String(payload.licencia || '').trim(),
    nombre_completo: String(payload.nombre_completo || '').trim(),
    telefono: String(payload.telefono || '').trim(),
    folio_compra: String(payload.folio_compra || '').trim(),
  });

  console.log('[activate-license] POST', ACTIVATION_API_URL);
  console.log('[activate-license] body:', body);

  try {
    const response = await net.fetch(ACTIVATION_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    const raw = await response.text();
    console.log('[activate-license] HTTP', response.status, raw);

    let json;
    try {
      json = JSON.parse(raw);
    } catch (_e) {
      console.error('[activate-license] respuesta no es JSON valido:', raw);
      return { ok: false, httpStatus: response.status, status: 'error', message: 'Respuesta inesperada del servidor.', data: null };
    }

    return {
      ok: response.ok,
      httpStatus: response.status,
      status: json.status,
      message: json.message || '',
      data: json.data || null,
    };
  } catch (error) {
    console.error('[activate-license] error de red:', error.message);
    return {
      ok: false,
      httpStatus: 0,
      status: 'error',
      message: 'No se pudo conectar al servidor. Verifica tu conexion a internet.',
      data: null,
    };
  }
});

ipcMain.handle('semantic-search', async (_event, payload = {}) => {
  const query = String(payload.query || '').trim();
  const discoveryContext = payload?.filters?.discoveryContext || {};
  const hasDiscoveryContextFilters = Object.values(discoveryContext).some((values) => Array.isArray(values) && values.length > 0);

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
    icon: path.join(__dirname, 'assets/img/lineicons/maletin.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'activacion.html'));

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  autoUpdater.checkForUpdatesAndNotify();

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
