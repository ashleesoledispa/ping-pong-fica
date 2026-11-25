/** Almacenamiento en archivos locales (para correr en tu computadora o en un servidor con disco). */
'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

function create({ dataDir }) {
  const uploadDir = path.join(dataDir, 'comprobantes');
  const dbFile = path.join(dataDir, 'inscripciones.json');
  fs.mkdirSync(uploadDir, { recursive: true });

  let db = { seq: 0, inscripciones: [] };
  if (fs.existsSync(dbFile)) {
    db = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    db.inscripciones ||= [];
    db.seq ||= db.inscripciones.length;
  } else {
    fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
  }

  let chain = Promise.resolve();
  function save() {
    const job = chain.then(async () => {
      const tmp = dbFile + '.tmp';
      await fsp.writeFile(tmp, JSON.stringify(db, null, 2));
      await fsp.rename(tmp, dbFile);
    });
    chain = job.catch(err => console.error('Error guardando datos:', err));
    return job;
  }

  const activos = () => db.inscripciones.filter(i => i.estado !== 'rechazada');
  const choca = (p, exceptId) => activos().some(i => i.id !== exceptId
    && (i.participante.correo === p.correo || i.participante.idBanner === p.idBanner));

  return {
    tipo: 'local',
    async countActive() { return activos().length; },
    async existsActive(campo, valor) { return activos().some(i => i.participante[campo] === valor); },
    async list() { return [...db.inscripciones].reverse(); },

    async insert({ id, participante, comprobantes }) {
      if (choca(participante)) throw Object.assign(new Error('duplicado'), { duplicate: true });
      db.seq += 1;
      const item = {
        id,
        codigo: `PP-${String(db.seq).padStart(3, '0')}`,
        fecha: new Date().toISOString(),
        estado: 'pendiente',
        participante,
        comprobantes,
        nota: '',
      };
      db.inscripciones.push(item);
      await save();
      return item;
    },

    async update(id, patch) {
      const item = db.inscripciones.find(i => i.id === id);
      if (!item) return null;
      if (patch.estado && patch.estado !== 'rechazada' && item.estado === 'rechazada' && choca(item.participante, id)) {
        throw Object.assign(new Error('duplicado'), { duplicate: true });
      }
      Object.assign(item, patch, { actualizado: new Date().toISOString() });
      await save();
      return item;
    },

    async remove(id) {
      const idx = db.inscripciones.findIndex(i => i.id === id);
      if (idx === -1) return null;
      const [item] = db.inscripciones.splice(idx, 1);
      await save();
      return item;
    },

    async saveFile(name, buf) { await fsp.writeFile(path.join(uploadDir, name), buf); },
    async readFile(name) { try { return await fsp.readFile(path.join(uploadDir, name)); } catch { return null; } },
    async deleteFile(name) { await fsp.rm(path.join(uploadDir, name), { force: true }); },
  };
}

module.exports = { create };
