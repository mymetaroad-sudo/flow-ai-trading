const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');

const IS_PROD = app.isPackaged;
const RESOURCES = IS_PROD ? process.resourcesPath : path.join(__dirname, '..');
const BACKEND_DIR = path.join(RESOURCES, 'backend');
const PYTHON_EMBED = path.join(RESOURCES, 'python-embedded', 'python.exe');
const PYTHON_VENV = path.join(BACKEND_DIR, '.venv', 'Scripts', 'python.exe');

function getPythonPath() {
  if (IS_PROD) {
    if (fs.existsSync(PYTHON_EMBED)) return PYTHON_EMBED;
    if (fs.existsSync(PYTHON_VENV)) return PYTHON_VENV;
    return 'python';
  }
  const python32 = 'C:\\Python39_32\\python.exe';
  if (fs.existsSync(python32)) return python32;
  const devVenv = path.join(__dirname, '..', 'backend', '.venv', 'Scripts', 'python.exe');
  if (fs.existsSync(devVenv)) return devVenv;
  return process.env.ROADFLOW_PYTHON || 'python';
}

const FRONTEND_URL = IS_PROD
  ? ('file://' + path.join(__dirname, '..', 'frontend', 'dist', 'index.html'))
  : 'http://localhost:5173';

const BACKEND_HEALTH = 'http://127.0.0.1:8000/api/health';

let mainWindow = null;
let backendProcess = null;
let backendReady = false;

const LOG_DIR = path.join(app.getPath('userData'), 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
const LOG_FILE = path.join(LOG_DIR, 'roadflow-' + new Date().toISOString().slice(0, 10) + '.log');

function log(msg) {
  const line = '[' + new Date().toISOString() + '] ' + msg;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch(e) {}
}

function checkHealth(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => { resolve(res.statusCode === 200); });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => { req.destroy(); resolve(false); });
  });
}

async function waitForBackend(retries, delayMs) {
  retries = retries || 60;
  delayMs = delayMs || 500;
  for (let i = 0; i < retries; i++) {
    const ok = await checkHealth(BACKEND_HEALTH);
    if (ok) { log('[backend] Ready!'); backendReady = true; return true; }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  log('[backend] Timeout');
  return false;
}

function startBackend() {
  const python = getPythonPath();
  log('[backend] Python: ' + python);
  const envFile = path.join(BACKEND_DIR, '.env');
  if (!fs.existsSync(envFile)) {
    fs.writeFileSync(envFile, 'BROKER_MODE=mock\nDAILY_LOSS_LIMIT_PCT=2.0\nCONSECUTIVE_STOP_LIMIT=2\nTOTAL_CAPITAL=300000000\n');
  }
  backendProcess = spawn(
    python,
    ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000', '--log-level', 'warning'],
    { cwd: BACKEND_DIR, shell: true, env: { ...process.env, PYTHONUNBUFFERED: '1' } }
  );
  backendProcess.stdout && backendProcess.stdout.on('data', (d) => log('[backend] ' + d.toString().trim()));
  backendProcess.stderr && backendProcess.stderr.on('data', (d) => log('[backend err] ' + d.toString().trim()));
  backendProcess.on('exit', (code) => {
    log('[backend] Exit code=' + code);
    backendReady = false;
    if (mainWindow && code !== 0 && code !== null) mainWindow.webContents.send('backend-crashed', { code });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1024, minHeight: 700,
    title: 'Flow AI Trading', show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadURL(FRONTEND_URL);
  if (!IS_PROD) mainWindow.webContents.openDevTools({ mode: 'detach' });
  mainWindow.once('ready-to-show', () => { mainWindow.show(); log('[electron] Window shown'); });
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

ipcMain.handle('get-app-info', () => ({ version: app.getVersion(), isProd: IS_PROD, backendReady, logFile: LOG_FILE }));
ipcMain.handle('open-log-dir', () => { shell.openPath(LOG_DIR); });
ipcMain.handle('restart-backend', async () => {
  if (backendProcess) { backendProcess.kill(); await new Promise(r => setTimeout(r, 1000)); }
  startBackend();
  return await waitForBackend(20, 500);
});

app.whenReady().then(async () => {
  log('[electron] Start IS_PROD=' + IS_PROD);
  if (!IS_PROD) {
    log('[electron] Dev mode - connecting to existing backend');
    createWindow();
    return;
  }
  startBackend();
  await waitForBackend();
  createWindow();
});

app.on('window-all-closed', () => { if (backendProcess) backendProcess.kill(); if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (mainWindow === null) createWindow(); });
app.on('before-quit', () => { if (backendProcess) backendProcess.kill(); });