/**
 * Torneo de Ping Pong por Fiestas de Quito — ASE UDLA FICA
 * Servidor local (sin dependencias externas).
 *
 *   Iniciar:  npm start   (o  node server.js)
 *   Página:   http://localhost:3000
 *   Panel:    http://localhost:3000/admin
 *
 * En Vercel no se usa este archivo: allí la API corre en api/index.js
 * y las páginas se sirven desde la carpeta public/.
 */
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { handleApi, config, getStore } = require('./lib/app');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const PAGES = { '/': 'index.html', '/inscripcion': 'inscripcion.html', '/admin': 'admin.html' };
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.gif': 'image/gif', '.ico': 'image/x-icon', '.pdf': 'application/pdf',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};

async function serveStatic(req, res, pathname) {
  const rel = PAGES[pathname.replace(/\/+$/, '') || '/'] || pathname;
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) { res.writeHead(403); return res.end(); }
  try {
    const stat = await fsp.stat(file);
    if (!stat.isFile()) throw new Error('no es archivo');
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  } catch {
    const page404 = path.join(PUBLIC_DIR, '404.html');
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(page404).on('error', () => res.end('404')).pipe(res);
  }
}

const server = http.createServer(async (req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400); return res.end('Dirección inválida');
  }
  if (pathname.startsWith('/api/')) return handleApi(req, res, pathname);
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  return serveStatic(req, res, pathname);
});

getStore().then(store => {
  server.listen(PORT, () => {
    console.log('\nTorneo de Ping Pong — ASE UDLA FICA');
    console.log(`  Página:  http://localhost:${PORT}`);
    console.log(`  Panel:   http://localhost:${PORT}/admin`);
    console.log(`  Datos:   ${store.tipo === 'supabase' ? 'Supabase' : 'archivos locales (carpeta storage/)'}`);
    console.log(`  Cierre:  ${config.deadline.toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })}\n`);
  });
}).catch(err => {
  console.error('No se pudo iniciar:', err.message);
  process.exit(1);
});
