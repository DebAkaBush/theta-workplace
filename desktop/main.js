const { app, BrowserWindow, dialog, shell } = require('electron');
const { ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

const APP_PORT = 3000;
let window;
let server;

ipcMain.on('toggle-fullscreen', () => { if (window) window.setFullScreen(!window.isFullScreen()); });

function startServer() {
  process.env.HOST = '127.0.0.1';
  process.env.PORT = String(APP_PORT);
  process.env.THETA_DATA_DIR = path.join(app.getPath('userData'), 'data');
  server = require('../server');
}

async function waitForServer() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${APP_PORT}`);
      if (response.ok) return;
    } catch { }
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error('theta-workplace sunucusu başlatılamadı.');
}

function createWindow() {
  window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 390,
    minHeight: 620,
    backgroundColor: '#f4f7f2',
    title: 'theta-workplace',
    icon: path.join(__dirname, 'icon.svg'),
    webPreferences: { contextIsolation: true, sandbox: true, preload: path.join(__dirname, 'preload.js') }
  });
  window.removeMenu();
  window.loadURL(`http://127.0.0.1:${APP_PORT}`);
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') { event.preventDefault(); window.setFullScreen(!window.isFullScreen()); }
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });
}

function configureUpdates() {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = false;
  autoUpdater.on('update-available', async () => {
    const result = await dialog.showMessageBox(window, { type: 'info', buttons: ['Güncellemeyi indir', 'Sonra'], title: 'theta-workplace güncellemesi', message: 'Yeni bir sürüm hazır.' });
    if (result.response === 0) autoUpdater.downloadUpdate();
  });
  autoUpdater.on('update-downloaded', async () => {
    const result = await dialog.showMessageBox(window, { type: 'info', buttons: ['Yeniden başlat', 'Sonra'], title: 'Güncelleme hazır', message: 'Yeni sürüm indirildi. Uygulama yeniden başlatılsın mı?' });
    if (result.response === 0) autoUpdater.quitAndInstall();
  });
  autoUpdater.on('error', error => console.error('Güncelleme kontrolü başarısız:', error.message));
  autoUpdater.checkForUpdates().catch(error => console.error('Güncelleme kontrolü başarısız:', error.message));
}

app.whenReady().then(async () => {
  try {
    startServer();
    await waitForServer();
    createWindow();
    configureUpdates();
  } catch (error) {
    await dialog.showMessageBox({ type: 'error', title: 'theta-workplace', message: error.message });
    app.quit();
  }
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { if (server?.close) server.close(); });
