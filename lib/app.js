/**
 * Núcleo de la API (compartido por server.js y por la función de Vercel en api/index.js).
 * No usa dependencias externas.
 */
'use strict';

const path = require('node:path');
const crypto = require('node:crypto');

try { process.loadEnvFile(path.join(__dirname, '..', '.env')); } catch { /* .env es opcional */ }

const config = {
  adminUser: process.env.ADMIN_USER || 'Ashlee22',
  adminPass: process.env.ADMIN_PASS || 'ashlee22',
  deadline: new Date(process.env.REG_DEADLINE || '2026-11-30T23:59:59-05:00'),
  emailDomain: (process.env.EMAIL_DOMAIN ?? 'udla.edu.ec').trim().toLowerCase().replace(/^@/, ''),
  maxCupos: process.env.MAX_CUPOS === undefined ? 64 : Number(process.env.MAX_CUPOS) || 0, // 0 = sin límite
  precio: Number(process.env.PRECIO) || 2.5,
  sessionSecret: process.env.SESSION_SECRET
    || crypto.createHash('sha256').update('pp-fica:' + (process.env.ADMIN_USER || 'Ashlee22') + ':' + (process.env.ADMIN_PASS || 'ashlee22')).digest('hex'),
};

const MAX_BODY = 4.4 * 1024 * 1024; // Vercel acepta hasta 4.5 MB por petición
const MAX_FILE = 3 * 1024 * 1024;   // 3 MB por archivo
const MAX_FILES = 2;
const SESSION_MS = 8 * 60 * 60 * 1000;

// ---------- Almacenamiento: Supabase si está configurado, si no archivos locales ----------
let storePromise;
function getStore() {
  if (!storePromise) {
    storePromise = (async () => {
      if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return require('./store-supabase').create({
          url: process.env.SUPABASE_URL,
          key: process.env.SUPABASE_SERVICE_ROLE_KEY,
          bucket: process.env.SUPABASE_BUCKET || 'comprobantes',
        });
      }
      if (process.env.VERCEL) {
        throw Object.assign(new Error('Falta configurar Supabase (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY) en Vercel.'), { status: 500, expose: true });
      }
      const dataDir = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'storage'));
      return require('./store-local').create({ dataDir });
    })();
    storePromise.catch(() => { storePromise = undefined; });
  }
  return storePromise;
}

// ---------- Utilidades HTTP ----------
function sendJson(res, status, data, extra = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extra,
  });
  res.end(JSON.stringify(data));
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status, expose: true });
}

function readBody(req, limit = MAX_BODY) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > limit) {
        reject(httpError(413, 'Los archivos son demasiado pesados. Sube una foto más liviana.'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJson(req, limit) {
  const buf = await readBody(req, limit);
  try { return JSON.parse(buf.toString('utf8') || '{}'); }
  catch { throw httpError(400, 'Datos inválidos.'); }
}

function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function clientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || '?';
}

const hits = new Map();
function rateLimited(key, max, windowMs) {
  const now = Date.now();
  const list = (hits.get(key) || []).filter(t => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) hits.clear();
  return list.length > max;
}

// ---------- Sesión del panel (token firmado, funciona también en Vercel) ----------
function sign(value) {
  return crypto.createHmac('sha256', config.sessionSecret).update(value).digest('hex');
}
function sameSecret(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}
function newToken() {
  const exp = String(Date.now() + SESSION_MS);
  return `${exp}.${sign(exp)}`;
}
function isAdmin(req) {
  const token = parseCookies(req).admin_sid || '';
  const [exp, mac] = token.split('.');
  if (!exp || !mac || !sameSecret(mac, sign(exp))) return false;
  return Number(exp) > Date.now();
}
function sessionCookie(req, token, maxAgeSec) {
  const secure = (req.headers['x-forwarded-proto'] === 'https' || process.env.VERCEL) ? '; Secure' : '';
  return `admin_sid=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAgeSec}${secure}`;
}

// ---------- Validación ----------
function clean(value, max = 120) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalizarCelular(raw) {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (d.startsWith('593') && d.length === 12) d = '0' + d.slice(3);
  return /^09\d{8}$/.test(d) ? d : null;
}

function validarParticipante(p, errores) {
  const nombre = clean(p?.nombre, 100);
  const correo = clean(p?.correo, 120).toLowerCase();
  const celular = normalizarCelular(p?.celular);
  const idBanner = clean(p?.idBanner, 20).toUpperCase().replace(/\s/g, '');
  const carrera = clean(p?.carrera, 100);

  if (nombre.length < 5 || !/\p{L}+\s+\p{L}+/u.test(nombre)) errores.push('Escribe tu nombre y apellido.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) errores.push('El correo no es válido.');
  else if (config.emailDomain && !correo.endsWith('@' + config.emailDomain)) errores.push(`Usa tu correo institucional (@${config.emailDomain}).`);
  if (!celular) errores.push('El celular debe tener 10 dígitos y empezar con 09.');
  if (!/^[A-Z0-9]{5,15}$/.test(idBanner)) errores.push('El ID Banner no es válido (solo letras y números).');
  if (carrera.length < 3) errores.push('Indica tu carrera.');

  return { nombre, correo, celular, idBanner, carrera };
}

function detectarTipo(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (buf.toString('ascii', 0, 5) === '%PDF-') return 'pdf';
  return null;
}

const CONTENT_TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf' };

async function estadoInscripciones(store) {
  const activos = await store.countActive();
  const abierto = Date.now() <= config.deadline.getTime() && (!config.maxCupos || activos < config.maxCupos);
  return { activos, abierto };
}

// ---------- Rutas ----------
async function crearInscripcion(req, res) {
  if (rateLimited('ins:' + clientIp(req), 8, 10 * 60 * 1000)) {
    return sendJson(res, 429, { error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' });
  }
  const store = await getStore();
  const { abierto } = await estadoInscripciones(store);
  if (!abierto) return sendJson(res, 403, { error: 'Las inscripciones están cerradas o ya no quedan cupos.' });

  const body = await readJson(req);
  const errores = [];
  const participante = validarParticipante(body.participante, errores);
  if (body.aceptaReglamento !== true) errores.push('Debes aceptar el reglamento del torneo.');

  if (participante.correo && await store.existsActive('correo', participante.correo)) {
    errores.push('Ese correo ya está inscrito en el torneo.');
  }
  if (participante.idBanner && await store.existsActive('idBanner', participante.idBanner)) {
    errores.push('Ese ID Banner ya está inscrito en el torneo.');
  }

  const archivos = Array.isArray(body.archivos) ? body.archivos : [];
  if (archivos.length === 0) errores.push('Adjunta el comprobante de pago.');
  if (archivos.length > MAX_FILES) errores.push(`Puedes adjuntar máximo ${MAX_FILES} archivos.`);

  const buffers = [];
  if (archivos.length && archivos.length <= MAX_FILES) {
    for (const [i, a] of archivos.entries()) {
      const buf = Buffer.from(String(a?.data || '').replace(/^data:[^;]+;base64,/, ''), 'base64');
      const ext = detectarTipo(buf);
      if (!ext) { errores.push(`Archivo ${i + 1}: solo se aceptan imágenes JPG, PNG, WEBP o PDF.`); continue; }
      if (buf.length > MAX_FILE) { errores.push(`Archivo ${i + 1}: pesa más de 3 MB.`); continue; }
      buffers.push({ buf, ext, original: clean(a?.nombre, 80) || `archivo-${i + 1}.${ext}` });
    }
  }

  if (errores.length) return sendJson(res, 400, { error: errores[0], errores });

  const id = crypto.randomUUID();
  const comprobantes = [];
  for (const [i, f] of buffers.entries()) {
    const archivo = `${id}-${i + 1}.${f.ext}`;
    await store.saveFile(archivo, f.buf, CONTENT_TYPES[f.ext]);
    comprobantes.push({ archivo, original: f.original, tipo: f.ext, bytes: f.buf.length });
  }

  let creada;
  try {
    creada = await store.insert({ id, participante, comprobantes });
  } catch (err) {
    for (const c of comprobantes) await store.deleteFile(c.archivo).catch(() => {});
    if (err.duplicate) return sendJson(res, 409, { error: 'Ese correo o ID Banner ya está inscrito en el torneo.' });
    throw err;
  }
  sendJson(res, 201, { ok: true, codigo: creada.codigo });
}

function csvCell(v) {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}

async function exportarCsv(res, store) {
  const lista = await store.list();
  const header = ['Código', 'Fecha', 'Estado', 'Nombre', 'Correo', 'Celular', 'ID Banner', 'Carrera', 'Comprobantes', 'Nota'];
  const rows = lista.map(i => [
    i.codigo, new Date(i.fecha).toLocaleString('es-EC', { timeZone: 'America/Guayaquil' }), i.estado,
    i.participante.nombre, i.participante.correo, i.participante.celular, i.participante.idBanner, i.participante.carrera,
    i.comprobantes.length, i.nota,
  ]);
  const csv = '﻿' + [header, ...rows].map(r => r.map(csvCell).join(';')).join('\r\n');
  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'attachment; filename="inscripciones-torneo-pingpong.csv"',
    'Cache-Control': 'no-store',
  });
  res.end(csv);
}

async function handleApi(req, res, pathname) {
  const method = req.method;
  try {
    if (pathname === '/api/config' && method === 'GET') {
      const store = await getStore();
      const { activos, abierto } = await estadoInscripciones(store);
      return sendJson(res, 200, {
        abierto,
        fechaLimite: config.deadline.toISOString(),
        inscritos: activos,
        cupoMaximo: config.maxCupos || null,
        dominioCorreo: config.emailDomain || null,
        precio: config.precio,
      });
    }
    if (pathname === '/api/inscripciones' && method === 'POST') return await crearInscripcion(req, res);

    if (pathname === '/api/admin/login' && method === 'POST') {
      if (rateLimited('login:' + clientIp(req), 8, 15 * 60 * 1000)) {
        return sendJson(res, 429, { error: 'Demasiados intentos. Espera 15 minutos.' });
      }
      const { usuario, clave } = await readJson(req, 10 * 1024);
      const ok = sameSecret(usuario ?? '', config.adminUser) & sameSecret(clave ?? '', config.adminPass);
      if (!ok) return sendJson(res, 401, { error: 'Usuario o contraseña incorrectos.' });
      return sendJson(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(req, newToken(), SESSION_MS / 1000) });
    }
    if (pathname === '/api/admin/logout' && method === 'POST') {
      return sendJson(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(req, '', 0) });
    }
    if (pathname === '/api/admin/session' && method === 'GET') {
      return sendJson(res, 200, { autenticado: isAdmin(req) });
    }

    if (pathname.startsWith('/api/admin/')) {
      if (!isAdmin(req)) return sendJson(res, 401, { error: 'Sesión expirada. Vuelve a ingresar.' });
      const store = await getStore();

      if (pathname === '/api/admin/inscripciones' && method === 'GET') {
        const { abierto } = await estadoInscripciones(store);
        return sendJson(res, 200, {
          inscripciones: await store.list(),
          fechaLimite: config.deadline.toISOString(),
          abierto,
          cupoMaximo: config.maxCupos || null,
          precio: config.precio,
        });
      }
      if (pathname === '/api/admin/export.csv' && method === 'GET') return await exportarCsv(res, store);

      const mArchivo = pathname.match(/^\/api\/admin\/archivos\/([a-f0-9-]{36}-\d\.(jpg|png|webp|pdf))$/);
      if (mArchivo && method === 'GET') {
        const data = await store.readFile(mArchivo[1]);
        if (!data) return sendJson(res, 404, { error: 'No encontrado' });
        res.writeHead(200, {
          'Content-Type': CONTENT_TYPES[mArchivo[2]],
          'Content-Disposition': `inline; filename="${mArchivo[1]}"`,
          'Cache-Control': 'private, max-age=3600',
          'X-Content-Type-Options': 'nosniff',
        });
        return res.end(data);
      }

      const mItem = pathname.match(/^\/api\/admin\/inscripciones\/([a-f0-9-]{36})$/);
      if (mItem && method === 'PATCH') {
        const body = await readJson(req, 20 * 1024);
        const patch = {};
        if (body.estado !== undefined) {
          if (!['pendiente', 'confirmada', 'rechazada'].includes(body.estado)) return sendJson(res, 400, { error: 'Estado inválido.' });
          patch.estado = body.estado;
        }
        if (body.nota !== undefined) patch.nota = String(body.nota).slice(0, 500);
        let item;
        try {
          item = await store.update(mItem[1], patch);
        } catch (err) {
          if (err.duplicate) return sendJson(res, 409, { error: 'No se puede reactivar: ese correo o ID Banner ya tiene otra inscripción activa.' });
          throw err;
        }
        if (!item) return sendJson(res, 404, { error: 'Inscripción no encontrada.' });
        return sendJson(res, 200, { ok: true, inscripcion: item });
      }
      if (mItem && method === 'DELETE') {
        const item = await store.remove(mItem[1]);
        if (!item) return sendJson(res, 404, { error: 'Inscripción no encontrada.' });
        for (const c of item.comprobantes) await store.deleteFile(c.archivo).catch(() => {});
        return sendJson(res, 200, { ok: true });
      }
    }

    return sendJson(res, 404, { error: 'Ruta no encontrada.' });
  } catch (err) {
    if (!err.expose) console.error(err);
    if (!res.headersSent) sendJson(res, err.status || 500, { error: err.expose ? err.message : 'Error interno del servidor.' });
  }
}

module.exports = { handleApi, config, getStore };
