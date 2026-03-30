const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const { execFile } = require('child_process');
const fs = require('fs');
const http = require('http'); // use http module instead of fetch (compat)

// ── path config ────────────────────────────────────────────────
const IS_PROD = app.isPackaged;

// electron-builder: files->app.asar, extraResources->resources/
// keep both backend and python-embedded under resources/
const RESOURCES = IS_PROD ? process.resourcesPath : path.join(__dirname, '..');

const BACKEND_DIR  = path.join(RESOURCES, 'backend');
const PYTHON_EMBED = path.join(RESOURCES, 'python-embedded', 'python.exe');
const PYTHON_VENV  = path.join(RESOURCES, 'backend', '.venv', 'Scripts', 'python.exe');

function getPythonPath() {
  if (IS_PROD) {
    if (fs.existsSync(PYTHON_EMBED)) return PYTHON_EMBED;
    if (fs.existsSync(PYTHON_VENV))  return PYTHON_VENV;
    return 'python'; // fallback
  }
  // dev: venv first, fallback system python
  const devVenv = path.join(__dirname, '..', 'backend', '.venv', 'Scripts', 'python.exe');
  if (fs.existsSync(devVenv)) return devVenv;
  return process.env.ROADFLOW_PYTHON || 'python';
}

const FRONTEND_PROD = path.join(__dirname, '..', 'frontend', 'dist', 'index.html');
const FRONTEND_DEV  = 'http://localhost:5173';

// ── global vars ────────────────────────────────────────────────
let mainWindow    = null;
let backendProc   = null;
let splashWindow  = null;

// ── log file ────────────────────────────────────────────────────
const LOG_DIR  = path.join(app.getPath('userData'), 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
const LOG_FILE = path.join(LOG_DIR, 'roadflow-' + new Date().toISOString().slice(0,10) + '.log');

function log(msg) {
  const line = '[' + new Date().toISOString() + '] ' + msg;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch(e) {}
}

// ── http health check (no fetch, compat) ────────
function checkHealth(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => { req.destroy(); resolve(false); });
  });
}

async function waitForBackend(retries, delayMs) {
  retries  = retries  || 60;   // max 30s wait
  delayMs  = delayMs  || 500;
  for (let i = 0; i < retries; i++) {
    const ok = await checkHealth('http://127.0.0.1:8000/api/health');
    if (ok) { log('[backend] ready (' + i + ' retries)'); return true; }
    if (i % 5 === 0) {
      log('[backend] waiting... (' + i + '/' + retries + ')');
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.webContents.executeJavaScript(
          'document.getElementById("status").textContent = "Starting... (' + i + '/' + retries + ')"'
        ).catch(() => {});
      }
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  log('[backend] timeout after ' + retries + ' retries');
  return false;
}

// ── start backend ──────────────────────────────────────────────
function startBackend() {
  const python = getPythonPath();
  log('[backend] python: ' + python);
  log('[backend] dir:    ' + BACKEND_DIR);
  log('[backend] exists: ' + fs.existsSync(BACKEND_DIR));
  log('[backend] py_exists: ' + fs.existsSync(python));

  if (!fs.existsSync(BACKEND_DIR)) {
    log('[ERROR] backend dir not found: ' + BACKEND_DIR);
    return;
  }

  // create .env with defaults if missing
  const envFile = path.join(BACKEND_DIR, '.env');
  if (!fs.existsSync(envFile)) {
    const defaults = [
      'BROKER_MODE=mock',
      'DAILY_LOSS_LIMIT_PCT=2.0',
      'CONSECUTIVE_STOP_LIMIT=2',
      'TOTAL_CAPITAL=300000000',
    ].join('\n');
    fs.writeFileSync(envFile, defaults);
    log('[backend] .env created');
  }

  // execFile: shell 없이 직접 실행 → 공백 포함 경로 정상 처리
  backendProc = execFile(
    python,
    ['-m', 'uvicorn', 'app.main:app',
     '--host', '127.0.0.1', '--port', '8000',
     '--log-level', 'warning'],
    {
      cwd:   BACKEND_DIR,
      env:   { ...process.env, PYTHONUNBUFFERED: '1' },
      maxBuffer: 1024 * 1024 * 10,
    }
  );

  backendProc.stdout && backendProc.stdout.on('data', (d) => log('[backend] ' + d.toString().trim()));
  backendProc.stderr && backendProc.stderr.on('data', (d) => log('[backend err] ' + d.toString().trim()));
  backendProc.on('exit', (code, sig) => {
    log('[backend] exit code=' + code + ' sig=' + sig);
    if (mainWindow && !mainWindow.isDestroyed() && code !== 0 && code !== null) {
      mainWindow.webContents.send('backend-crashed', { code });
    }
  });
}

// ── splash window ──────────────────────────────────────────────
function createSplash() {
  splashWindow = new BrowserWindow({
    width: 480, height: 300,
    frame: false, alwaysOnTop: true, transparent: true,
    webPreferences: { contextIsolation: false, nodeIntegration: true },
  });
  const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;background:#0f1722;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:Arial;color:#e5eef9;">' +
    '<div style="font-size:28px;font-weight:bold;color:#2f7cff;">Roadflow AI Lite</div>' +
    '<div style="font-size:14px;margin-top:8px;color:#64748b;">V1</div>' +
    '<div id="status" style="font-size:12px;margin-top:6px;color:#475569;">Starting...</div>' +
    '<div style="margin-top:24px;width:240px;height:4px;background:#1e293b;border-radius:2px;">' +
    '<div style="width:60%;height:100%;background:#2f7cff;border-radius:2px;animation:p 1.2s ease-in-out infinite alternate;"></div></div>' +
    '<style>@keyframes p{from{width:20%}to{width:90%}}</style>' +
    '</body></html>';
  splashWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  return splashWindow;
}

// ── main window ────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440, height: 900,
    minWidth: 1024, minHeight: 700,
    title: 'Roadflow AI Lite V1',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.setMenuBarVisibility(false);

  if (IS_PROD && fs.existsSync(FRONTEND_PROD)) {
    mainWindow.loadFile(FRONTEND_PROD);
  } else {
    mainWindow.loadURL(FRONTEND_DEV);
    if (!IS_PROD) mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    log('[electron] main window shown');
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// ── IPC handlers ───────────────────────────────────────────────
ipcMain.handle('get-app-info', () => ({
  version:    app.getVersion(),
  isProd:     IS_PROD,
  logFile:    LOG_FILE,
  backendDir: BACKEND_DIR,
  pythonPath: getPythonPath(),
}));

ipcMain.handle('open-log-dir', () => shell.openPath(LOG_DIR));

ipcMain.handle('restart-backend', async () => {
  if (backendProc) { backendProc.kill(); await new Promise(r => setTimeout(r, 1500)); }
  startBackend();
  return await waitForBackend(20, 500);
});

// ── app start ──────────────────────────────────────────────────
app.whenReady().then(async () => {
  log('[electron] start IS_PROD=' + IS_PROD);
  log('[electron] resourcesPath=' + process.resourcesPath);
  log('[electron] __dirname=' + __dirname);
  log('[electron] BACKEND_DIR=' + BACKEND_DIR);
  log('[electron] python=' + getPythonPath());

  if (IS_PROD) createSplash();

  startBackend();
  const ready = await waitForBackend();

  if (!ready) {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.destroy();
    dialog.showErrorBox(
      'Roadflow - Start Error',
      'Backend server failed to start.\n\nLog file:\n' + LOG_FILE + '\n\nPlease check Python installation.'
    );
    app.quit();
    return;
  }

  createWindow();
  if (splashWindow && !splashWindow.isDestroyed()) {
    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) splashWindow.destroy();
    }, 800);
  }
});

app.on('window-all-closed', () => {
  log('[electron] all windows closed');
  if (backendProc) { backendProc.kill(); log('[backend] killed'); }
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

process.on('uncaughtException', (err) => {
  log('[ERROR] uncaughtException: ' + err.message + '\n' + err.stack);
});
