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

  autoUpdater.logger = console;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  let updateWin = null;

  function createUpdateWindow(version) {
    updateWin = new BrowserWindow({
      width: 420,
      height: 220,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      frame: false,
      alwaysOnTop: true,
      transparent: true,
      webPreferences: { contextIsolation: true, nodeIntegration: false },
    });

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',sans-serif;background:transparent;display:flex;align-items:center;justify-content:center;height:100vh}
.card{background:#fff;border-radius:18px;padding:1.6rem 1.8rem;box-shadow:0 20px 50px rgba(30,50,100,.18);border:1px solid #e8edf8;width:100%;text-align:center}
.title{font-size:.82rem;font-weight:800;color:#1f2d54;margin-bottom:.15rem}
.version{font-size:.74rem;color:#5f6b8b;margin-bottom:1rem}
.track{height:10px;border-radius:999px;background:#e8edf8;overflow:hidden;margin-bottom:.6rem}
.bar{height:100%;border-radius:999px;background:linear-gradient(90deg,#4d91ff,#44c2ff);width:0%;transition:width .3s ease}
.pct{font-size:1.1rem;font-weight:800;color:#4d91ff}
.status{font-size:.72rem;color:#8a96b3;margin-top:.4rem}
</style></head><body>
<div class="card">
<p class="title">Descargando actualizacion</p>
<p class="version" id="ver">Version ${version}</p>
<div class="track"><div class="bar" id="bar"></div></div>
<p class="pct" id="pct">0%</p>
<p class="status" id="status">Iniciando descarga...</p>
</div>
</body></html>`;

    updateWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    updateWin.center();
  }

  function updateProgress(percent, speed) {
    if (!updateWin || updateWin.isDestroyed()) return;
    const pct = Math.round(percent);
    const mbps = speed ? (speed / 1024 / 1024).toFixed(1) : '0.0';
    const status = pct < 100 ? mbps + ' MB/s' : 'Finalizando...';
    updateWin.webContents.executeJavaScript(
      `document.getElementById('bar').style.width='${pct}%';` +
      `document.getElementById('pct').textContent='${pct}%';` +
      `document.getElementById('status').textContent='${status}';`
    ).catch(() => {});
  }

  function closeUpdateWindow() {
    if (updateWin && !updateWin.isDestroyed()) {
      updateWin.close();
    }
    updateWin = null;
  }

  autoUpdater.on('checking-for-update', () => {
    console.log('[updater] Buscando actualizaciones...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[updater] Actualizacion disponible:', info.version);
    createUpdateWindow(info.version);
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[updater] No hay actualizaciones disponibles.');
  });

  autoUpdater.on('download-progress', (progress) => {
    console.log('[updater] Descargando: ' + Math.round(progress.percent) + '%');
    updateProgress(progress.percent, progress.bytesPerSecond);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[updater] Descarga completa:', info.version);
    closeUpdateWindow();
    dialog.showMessageBox({
      type: 'info',
      title: 'Actualizacion lista',
      message: 'La version ' + info.version + ' esta lista. La app se reiniciara para aplicar la actualizacion.',
      buttons: ['Reiniciar ahora'],
    }).then(() => {
      autoUpdater.quitAndInstall();
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('[updater] Error:', err.message);
    closeUpdateWindow();
  });

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
