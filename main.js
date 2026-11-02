'use strict';
const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { StorageService } = require('./src/services/storage');
const { LibraryStore } = require('./src/store/libraryStore');
const { registerHandlers, createBackendServices } = require('./src/services/ipc');
const entry = path.join(__dirname, 'index.html');
const entryUrl = pathToFileURL(entry).href;
const placeholder = 'data:text/html;charset=utf-8,' + encodeURIComponent('<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src \'none\'"><title>Vocab Buddy</title><h1>Vocab Buddy</h1><p>Backend ready. Frontend integration is pending Stage 3.</p>');
let window;
function createWindow() {
  window = new BrowserWindow({ width: 1200, height: 800, webPreferences: {
    preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true
  } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.on('closed', () => { window = null; });
  const loading = fs.existsSync(entry) ? window.loadFile(entry) : window.loadURL(placeholder);
  loading.catch(error => console.error('Unable to load Vocab Buddy:', error.message));
}
app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  const store = new LibraryStore(new StorageService(app.getPath('userData')));
  const { dictionary, audio } = createBackendServices(app.getPath('userData'));
  registerHandlers(ipcMain, store, dictionary, frame => Boolean(window && frame === window.webContents.mainFrame && [entryUrl, placeholder].includes(frame.url)), audio);
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
}).catch(error => { console.error(error); app.quit(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
