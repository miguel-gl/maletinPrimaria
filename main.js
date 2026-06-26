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

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
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
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  let updateWin = null;
  let updateReady = false;
  let pendingVersion = '';
  let pendingProgress = [];

  function getUpdateHTML(version) {
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',sans-serif;background:#f0f4ff;display:flex;align-items:center;justify-content:center;height:100vh}
.card{background:#fff;border-radius:18px;padding:1.8rem 2rem;box-shadow:0 20px 50px rgba(30,50,100,.18);border:1px solid #e0e8f8;width:100%;text-align:center}
.title{font-size:.88rem;font-weight:800;color:#1f2d54;margin-bottom:.2rem}
.version{font-size:.76rem;color:#5f6b8b;margin-bottom:1.1rem}
.track{height:10px;border-radius:999px;background:#e4edf8;overflow:hidden;margin-bottom:.65rem}
.bar{height:100%;border-radius:999px;background:linear-gradient(90deg,#4d91ff,#44c2ff);width:0%;transition:width .3s ease}
.pct{font-size:1.2rem;font-weight:800;color:#4d91ff}
.status{font-size:.74rem;color:#8a96b3;margin-top:.45rem}
.btn{display:none;margin-top:1rem;width:100%;height:42px;border:none;border-radius:10px;background:linear-gradient(145deg,#4d91ff,#44c2ff);color:#fff;font-size:.86rem;font-weight:800;cursor:pointer;box-shadow:0 8px 20px rgba(71,139,238,.3)}
.btn:hover{opacity:.9}
.btn.show{display:block}
</style></head><body>
<div class="card">
<p class="title" id="title">Descargando actualizacion</p>
<p class="version">Version ${version}</p>
<div class="track" id="track"><div class="bar" id="bar"></div></div>
<p class="pct" id="pct">0%</p>
<p class="status" id="status">Preparando descarga...</p>
<button class="btn" id="btn" onclick="window.__restart()">Reiniciar ahora</button>
</div>
</body></html>`;
  }

  function createUpdateWindow(version) {
    updateWin = new BrowserWindow({
      width: 440,
      height: 260,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      frame: false,
      alwaysOnTop: true,
      webPreferences: {
        contextIsolation: false,
        nodeIntegration: false,
      },
    });

    updateWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(getUpdateHTML(version)));

    updateWin.webContents.on('did-finish-load', () => {
      updateReady = true;
      updateWin.webContents.executeJavaScript(
        `window.__restart = function() { require('electron').ipcRenderer.send('do-restart'); };`
      ).catch(() => {});
      pendingProgress.forEach((p) => sendProgress(p.percent, p.speed));
      pendingProgress = [];
    });

    updateWin.center();
  }

  function sendProgress(percent, speed) {
    if (!updateWin || updateWin.isDestroyed()) return;
    const pct = Math.round(percent);
    const mbps = speed ? (speed / 1024 / 1024).toFixed(1) : '0.0';
    const status = pct < 100 ? (mbps + ' MB/s') : 'Finalizando...';
    updateWin.webContents.executeJavaScript(
      `document.getElementById('bar').style.width='${pct}%';` +
      `document.getElementById('pct').textContent='${pct}%';` +
      `document.getElementById('status').textContent='${status}';`
    ).catch(() => {});
  }

  function showCompleted(version) {
    if (!updateWin || updateWin.isDestroyed()) {
      dialog.showMessageBox({
        type: 'info',
        title: 'Actualizacion lista',
        message: 'La version ' + version + ' esta lista. Reinicia la app para aplicarla.',
        buttons: ['Reiniciar ahora'],
      }).then(() => { autoUpdater.quitAndInstall(); });
      return;
    }
    updateWin.webContents.executeJavaScript(
      `document.getElementById('bar').style.width='100%';` +
      `document.getElementById('pct').textContent='100%';` +
      `document.getElementById('title').textContent='Actualizacion lista';` +
      `document.getElementById('status').textContent='Listo para instalar';` +
      `document.getElementById('track').style.display='none';` +
      `document.getElementById('btn').classList.add('show');`
    ).catch(() => {});
  }

  ipcMain.on('do-restart', () => {
    autoUpdater.quitAndInstall();
  });

  autoUpdater.on('checking-for-update', () => {
    console.log('[updater] Buscando actualizaciones...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[updater] Actualizacion disponible:', info.version);
    pendingVersion = info.version;
    updateReady = false;
    pendingProgress = [];
    createUpdateWindow(info.version);
    autoUpdater.downloadUpdate();
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[updater] No hay actualizaciones disponibles.');
  });

  autoUpdater.on('download-progress', (progress) => {
    console.log('[updater] Descargando: ' + Math.round(progress.percent) + '%');
    if (updateReady) {
      sendProgress(progress.percent, progress.bytesPerSecond);
    } else {
      pendingProgress.push({ percent: progress.percent, speed: progress.bytesPerSecond });
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[updater] Descarga completa:', info.version);
    const waitForReady = () => {
      if (updateReady) {
        showCompleted(info.version);
      } else {
        setTimeout(waitForReady, 200);
      }
    };
    waitForReady();
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
