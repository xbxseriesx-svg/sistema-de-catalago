import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';

const HOST = '127.0.0.1';
const PORT = Number(process.env.E2E_PORT || 8787);
const SPA_ROOT = resolve(process.cwd(), 'frontend', 'dist');

const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
  ['.ico', 'image/x-icon'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.mp4', 'video/mp4'],
  ['.webm', 'video/webm'],
  ['.pdf', 'application/pdf'],
]);

function json(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

function safeSpaPath(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const relative = decoded.replace(/^\/+/, '');
  const candidate = resolve(SPA_ROOT, relative);
  if (candidate !== SPA_ROOT && !candidate.startsWith(`${SPA_ROOT}${sep}`)) return null;
  return candidate;
}

function serveFile(req, res, file) {
  if (!existsSync(file) || !statSync(file).isFile()) return false;
  const type = MIME.get(extname(file).toLowerCase()) || 'application/octet-stream';
  res.writeHead(200, {
    'content-type': type,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  if (req.method === 'HEAD') {
    res.end();
    return true;
  }
  createReadStream(file).pipe(res);
  return true;
}

const server = http.createServer((req, res) => {
  if (!req.url) return json(res, 400, { ok: false, error: 'missing_url' });
  if (!['GET', 'HEAD'].includes(req.method || 'GET')) {
    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);

  if (url.pathname === '/__e2e_health') {
    const ready = existsSync(resolve(SPA_ROOT, 'index.html'));
    return json(res, ready ? 200 : 503, { ok: ready, service: 'asteryon-enterprise-spa' });
  }

  if (url.pathname.startsWith('/api/')) {
    return json(res, 501, { ok: false, error: 'unmocked_api_in_ui_e2e', path: url.pathname });
  }

  const direct = safeSpaPath(url.pathname);
  if (!direct) return json(res, 400, { ok: false, error: 'invalid_path' });
  if (serveFile(req, res, direct)) return;

  const index = resolve(SPA_ROOT, 'index.html');
  if (serveFile(req, res, index)) return;
  json(res, 404, { ok: false, error: 'index_missing' });
});

server.on('clientError', (_error, socket) => {
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

server.listen(PORT, HOST, () => {
  console.log(`[E2E Enterprise SPA] http://${HOST}:${PORT} servindo ${SPA_ROOT}`);
});

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
