/**
 * Almacenamiento en Supabase (base de datos Postgres + Storage), usando su API REST.
 * Se usa automáticamente cuando existen SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
 * Ejecuta primero supabase.sql en el SQL Editor de tu proyecto.
 */
'use strict';

const COLUMNAS = { correo: 'correo', idBanner: 'id_banner' };

function create({ url, key, bucket }) {
  const base = url.replace(/\/+$/, '');
  const headers = { apikey: key };
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`; // clave service_role (JWT)

  async function rest(pathAndQuery, { method = 'GET', body, prefer } = {}) {
    const r = await fetch(`${base}/rest/v1/${pathAndQuery}`, {
      method,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        ...(prefer ? { Prefer: prefer } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!r.ok) {
      const info = await r.json().catch(() => ({}));
      const err = new Error(`Supabase ${r.status}: ${info.message || r.statusText}`);
      if (info.code === '23505') err.duplicate = true;
      throw err;
    }
    return r;
  }

  const aItem = row => ({
    id: row.id,
    codigo: `PP-${String(row.numero).padStart(3, '0')}`,
    fecha: row.creado,
    estado: row.estado,
    participante: {
      nombre: row.nombre,
      correo: row.correo,
      celular: row.celular,
      idBanner: row.id_banner,
      carrera: row.carrera,
    },
    comprobantes: row.comprobantes || [],
    nota: row.nota || '',
    actualizado: row.actualizado,
  });

  const enc = encodeURIComponent;

  return {
    tipo: 'supabase',

    async countActive() {
      const r = await rest('inscripciones?select=id&estado=neq.rechazada&limit=1', { prefer: 'count=exact' });
      const total = (r.headers.get('content-range') || '*/0').split('/')[1];
      return Number(total) || 0;
    },

    async existsActive(campo, valor) {
      const r = await rest(`inscripciones?select=id&estado=neq.rechazada&${COLUMNAS[campo]}=eq.${enc(valor)}&limit=1`);
      return (await r.json()).length > 0;
    },

    async list() {
      const r = await rest('inscripciones?select=*&order=numero.desc');
      return (await r.json()).map(aItem);
    },

    async insert({ id, participante, comprobantes }) {
      const r = await rest('inscripciones', {
        method: 'POST',
        prefer: 'return=representation',
        body: {
          id,
          nombre: participante.nombre,
          correo: participante.correo,
          celular: participante.celular,
          id_banner: participante.idBanner,
          carrera: participante.carrera,
          comprobantes,
        },
      });
      return aItem((await r.json())[0]);
    },

    async update(id, patch) {
      const r = await rest(`inscripciones?id=eq.${enc(id)}`, {
        method: 'PATCH',
        prefer: 'return=representation',
        body: { ...patch, actualizado: new Date().toISOString() },
      });
      const rows = await r.json();
      return rows[0] ? aItem(rows[0]) : null;
    },

    async remove(id) {
      const r = await rest(`inscripciones?id=eq.${enc(id)}`, { method: 'DELETE', prefer: 'return=representation' });
      const rows = await r.json();
      return rows[0] ? aItem(rows[0]) : null;
    },

    async saveFile(name, buf, contentType) {
      const r = await fetch(`${base}/storage/v1/object/${bucket}/${name}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': contentType, 'x-upsert': 'false' },
        body: buf,
      });
      if (!r.ok) throw new Error(`Supabase Storage ${r.status}: ${await r.text()}`);
    },

    async readFile(name) {
      const r = await fetch(`${base}/storage/v1/object/${bucket}/${name}`, { headers });
      if (!r.ok) return null;
      return Buffer.from(await r.arrayBuffer());
    },

    async deleteFile(name) {
      await fetch(`${base}/storage/v1/object/${bucket}`, {
        method: 'DELETE',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefixes: [name] }),
      });
    },
  };
}

module.exports = { create };
