import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { compare, defaults, preview } from './simulation.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const files = { '/': ['index.html', 'text/html; charset=utf-8'], '/app.js': ['app.js', 'text/javascript; charset=utf-8'], '/style.css': ['style.css', 'text/css; charset=utf-8'] };
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  const send = (status, value, type = 'application/json; charset=utf-8') => { res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(typeof value === 'string' ? value : JSON.stringify(value)); };
  try {
    if (req.method === 'GET' && path === '/api/health') return send(200, { status: 'ok', mode: 'local-prototype' });
    if (req.method === 'GET' && path === '/api/config') return send(200, { defaults, limits: { populationSize: 400, days: 90, repetitions: 30 }, mode: 'local-prototype' });
    if (req.method === 'GET' && files[path]) { const [name, type] = files[path]; return send(200, await readFile(join(root, name), 'utf8'), type); }
    if (req.method === 'POST' && ['/api/preview', '/api/compare'].includes(path)) {
      let raw = '';
      for await (const chunk of req) { raw += chunk; if (raw.length > 65536) return send(413, { error: 'La solicitud supera 64 KiB.' }); }
      let body;
      try { body = JSON.parse(raw); } catch { return send(400, { error: 'JSON inválido.' }); }
      return send(200, path === '/api/preview' ? preview(body) : compare(body));
    }
    send(404, { error: 'Ruta inexistente.' });
  } catch (error) { send(error.status || 500, { error: error.status ? error.message : 'Fallo al procesar la simulación.' }); }
});
server.listen(port, '127.0.0.1', () => console.log(`Prototipo en http://127.0.0.1:${port}`));
