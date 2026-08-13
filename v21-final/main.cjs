const { app, BrowserWindow, shell } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');
let server;
function contentType(file) {
  const ext = path.extname(file).toLowerCase();
  return ({
    '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
    '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8',
    '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
    '.webp':'image/webp', '.ico':'image/x-icon', '.woff':'font/woff', '.woff2':'font/woff2'
  })[ext] || 'application/octet-stream';
}
function startServer() {
  const root = path.resolve(__dirname, '..', 'dist');
  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      try {
        const raw = decodeURIComponent((req.url || '/').split('?')[0]);
        const safe = raw.replace(/^\/+/, '');
        let file = path.resolve(root, safe || 'index.html');
        if (!file.startsWith(root)) { res.writeHead(403); res.end('Forbidden'); return; }
        if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
        res.writeHead(200, {
          'Content-Type': contentType(file),
          'Cache-Control': 'no-cache',
          'X-Content-Type-Options': 'nosniff'
        });
        fs.createReadStream(file).pipe(res);
      } catch {
        res.writeHead(500); res.end('Internal error');
      }
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}/`));
  });
}
async function createWindow() {
  const localUrl = await startServer();
  const win = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0b1220',
    autoHideMenuBar: true,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, target) => {
    if (!target.startsWith(localUrl)) {
      event.preventDefault();
      if (/^https?:/i.test(target)) shell.openExternal(target);
    }
  });
  await win.loadURL(localUrl);
}
app.whenReady().then(createWindow);
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { try { server?.close(); } catch {} });
