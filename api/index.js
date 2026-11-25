// Función de Vercel: recibe todas las rutas /api/* (ver vercel.json).
const { handleApi } = require('../lib/app');

module.exports = (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const forwarded = url.searchParams.get('__path');
  const pathname = forwarded !== null ? '/api/' + forwarded : url.pathname;
  return handleApi(req, res, pathname);
};
