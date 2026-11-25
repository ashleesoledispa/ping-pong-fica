/* Panel secreto de administración */
(() => {
  const $ = s => document.querySelector(s);
  const loginBox = $('[data-login]');
  const panel = $('[data-panel]');
  const list = $('[data-list]');
  const empty = $('[data-empty]');
  const modal = $('[data-modal]');
  const modalContent = $('[data-modal-content]');

  let data = [];
  let filtro = 'todas';
  let busqueda = '';
  let precio = 2.5;
  let estado = null;

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fecha = iso => new Date(iso).toLocaleString('es-EC', { timeZone: 'America/Guayaquil', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  const ESTADOS = { pendiente: 'Pendiente', confirmada: 'Confirmada', rechazada: 'Rechazada' };

  async function api(url, opts = {}) {
    const r = await fetch(url, { credentials: 'same-origin', ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
    const body = await r.json().catch(() => ({}));
    if (r.status === 401 && !url.endsWith('/login')) { mostrarLogin(); throw new Error(body.error || 'Sesión expirada'); }
    if (!r.ok) throw new Error(body.error || 'Error');
    return body;
  }

  // ---------- Login ----------
  function mostrarLogin() {
    panel.hidden = true;
    loginBox.hidden = false;
    $('#usuario').focus();
  }

  $('[data-login-form]').addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('[data-login-error]');
    err.hidden = true;
    try {
      await api('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ usuario: $('#usuario').value.trim(), clave: $('#clave').value }),
      });
      $('#clave').value = '';
      iniciarPanel();
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    }
  });

  $('[data-logout]').addEventListener('click', async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    mostrarLogin();
  });

  // ---------- Panel ----------
  async function iniciarPanel() {
    loginBox.hidden = true;
    panel.hidden = false;
    await cargar();
  }

  async function cargar() {
    try {
      const r = await api('/api/admin/inscripciones');
      data = r.inscripciones;
      precio = r.precio || 2.5;
      const cierre = new Date(r.fechaLimite).toLocaleString('es-EC', { timeZone: 'America/Guayaquil', dateStyle: 'medium', timeStyle: 'short' });
      estado = { abierto: r.abierto, cierre, cupoMaximo: r.cupoMaximo };
      render();
    } catch (ex) {
      Torneo.toast(ex.message);
    }
  }

  function stats() {
    const c = { pendiente: 0, confirmada: 0, rechazada: 0 };
    data.forEach(i => c[i.estado]++);
    $('[data-stat="total"]').textContent = data.length - c.rechazada;
    $('[data-stat="pendiente"]').textContent = c.pendiente;
    $('[data-stat="confirmada"]').textContent = c.confirmada;
    $('[data-stat="rechazada"]').textContent = c.rechazada;
    if (estado) {
      const cupos = estado.cupoMaximo ? ` · ${data.length - c.rechazada}/${estado.cupoMaximo} cupos` : '';
      $('[data-status]').textContent = `${estado.abierto ? 'Abiertas' : 'Cerradas'} · cierre ${estado.cierre}${cupos}`;
    }
    $('[data-stat="dinero"]').textContent = '$' + (c.confirmada * precio).toFixed(2).replace('.', ',');
  }

  function waLink(celular, nombre, codigo) {
    const num = '593' + String(celular).replace(/\D/g, '').replace(/^0/, '');
    const msg = `¡Hola ${nombre.split(' ')[0]}! Te saludamos de ASE UDLA FICA. Tu inscripción ${codigo} al Torneo de Ping Pong por Fiestas de Quito está CONFIRMADA. Nos vemos el 2 de diciembre en UDLAPark (10h00 a 16h00). Llega 10 minutos antes de tu encuentro con tu identificación universitaria. ¡Que viva Quito!`;
    return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
  }

  function jugador(p, codigo) {
    return `
      <div class="player">
        <div class="player__info">
          <span><b>Correo:</b> <a href="mailto:${esc(p.correo)}">${esc(p.correo)}</a></span>
          <span><b>ID Banner:</b> <span class="mono">${esc(p.idBanner)}</span></span>
          <span><b>Celular:</b> <span class="mono">${esc(p.celular)}</span></span>
          <span><b>Carrera:</b> ${esc(p.carrera)}</span>
        </div>
        <a class="wa" href="${waLink(p.celular, p.nombre, codigo)}" target="_blank" rel="noopener" title="Escribir por WhatsApp">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.4 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-3.3-.8a11.5 11.5 0 0 1-4.6-4.1c-.3-.5-1-1.4-1-2.6 0-1.2.6-1.8.9-2.1.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .5l-.3.5-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l2 .9c.3.2.5.2.5.4.1.1.1.7-.1 1.4Z"/></svg>
          Confirmar por WhatsApp
        </a>
      </div>`;
  }

  function tarjeta(i) {
    const comps = i.comprobantes.map(c => {
      const url = `/api/admin/archivos/${encodeURIComponent(c.archivo)}`;
      return c.tipo === 'pdf'
        ? `<button class="thumb thumb--pdf" data-view="${url}" data-pdf>PDF</button>`
        : `<button class="thumb" data-view="${url}"><img src="${url}" alt="Comprobante" loading="lazy"></button>`;
    }).join('');

    return `
      <article class="entry entry--${i.estado}" data-id="${i.id}">
        <header class="entry__head">
          <div>
            <span class="entry__code">${esc(i.codigo)}</span>
            <h3>${esc(i.participante.nombre)}</h3>
            <small>${fecha(i.fecha)}</small>
          </div>
          <span class="badge badge--${i.estado}">${ESTADOS[i.estado]}</span>
        </header>
        <div class="entry__players">
          ${jugador(i.participante, i.codigo)}
        </div>
        <div class="entry__bottom">
          <div class="entry__thumbs">${comps || '<em>Sin comprobante</em>'}</div>
          <div class="entry__note">
            <textarea rows="2" maxlength="500" placeholder="Nota interna (ej: pago verificado)" data-note>${esc(i.nota)}</textarea>
            <button class="btn btn--ghost-dark btn--xs" data-save-note>Guardar nota</button>
          </div>
        </div>
        <footer class="entry__actions">
          <button class="btn btn--ok btn--sm" data-estado="confirmada" ${i.estado === 'confirmada' ? 'disabled' : ''}>✓ Confirmar</button>
          <button class="btn btn--warn btn--sm" data-estado="pendiente" ${i.estado === 'pendiente' ? 'disabled' : ''}>Pendiente</button>
          <button class="btn btn--bad btn--sm" data-estado="rechazada" ${i.estado === 'rechazada' ? 'disabled' : ''}>✕ Rechazar</button>
          <button class="btn btn--link btn--sm" data-delete>Eliminar</button>
        </footer>
      </article>`;
  }

  function render() {
    stats();
    const q = busqueda.toLowerCase();
    const visibles = data.filter(i => {
      if (filtro !== 'todas' && i.estado !== filtro) return false;
      if (!q) return true;
      const p = i.participante;
      return [i.codigo, p.nombre, p.correo, p.celular, p.idBanner, p.carrera]
        .join(' ').toLowerCase().includes(q);
    });
    list.innerHTML = visibles.map(tarjeta).join('');
    empty.hidden = visibles.length > 0;
  }

  // ---------- Acciones ----------
  list.addEventListener('click', async e => {
    const card = e.target.closest('.entry');
    if (!card) return;
    const id = card.dataset.id;
    const item = data.find(x => x.id === id);

    const view = e.target.closest('[data-view]');
    if (view) return abrirVisor(view.dataset.view, view.hasAttribute('data-pdf'));

    const est = e.target.closest('[data-estado]');
    if (est) {
      try {
        const r = await api(`/api/admin/inscripciones/${id}`, { method: 'PATCH', body: JSON.stringify({ estado: est.dataset.estado }) });
        Object.assign(item, r.inscripcion);
        render();
        Torneo.toast(`${item.codigo} → ${ESTADOS[item.estado]}`);
      } catch (ex) { Torneo.toast(ex.message); }
      return;
    }

    if (e.target.closest('[data-save-note]')) {
      try {
        const nota = card.querySelector('[data-note]').value;
        const r = await api(`/api/admin/inscripciones/${id}`, { method: 'PATCH', body: JSON.stringify({ nota }) });
        Object.assign(item, r.inscripcion);
        Torneo.toast('Nota guardada');
      } catch (ex) { Torneo.toast(ex.message); }
      return;
    }

    if (e.target.closest('[data-delete]')) {
      if (!confirm(`¿Eliminar definitivamente la inscripción ${item.codigo}? También se borrarán sus comprobantes.`)) return;
      try {
        await api(`/api/admin/inscripciones/${id}`, { method: 'DELETE' });
        data = data.filter(x => x.id !== id);
        render();
        Torneo.toast('Inscripción eliminada');
      } catch (ex) { Torneo.toast(ex.message); }
    }
  });

  document.querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('[data-filter]').forEach(x => x.classList.toggle('is-active', x === b));
    filtro = b.dataset.filter;
    render();
  }));
  $('[data-search]').addEventListener('input', e => { busqueda = e.target.value.trim(); render(); });
  $('[data-refresh]').addEventListener('click', cargar);

  // ---------- Visor ----------
  function abrirVisor(url, pdf) {
    modalContent.innerHTML = pdf
      ? `<iframe src="${url}" title="Comprobante PDF"></iframe><a class="btn btn--red btn--sm" href="${url}" target="_blank" rel="noopener">Abrir en otra pestaña</a>`
      : `<img src="${url}" alt="Comprobante"><a class="btn btn--red btn--sm" href="${url}" target="_blank" rel="noopener">Abrir en tamaño completo</a>`;
    modal.hidden = false;
  }
  const cerrarVisor = () => { modal.hidden = true; modalContent.innerHTML = ''; };
  $('[data-modal-close]').addEventListener('click', cerrarVisor);
  modal.addEventListener('click', e => { if (e.target === modal) cerrarVisor(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) cerrarVisor(); });

  // ---------- Inicio ----------
  fetch('/api/admin/session').then(r => r.json()).then(s => (s.autenticado ? iniciarPanel() : mostrarLogin())).catch(mostrarLogin);
})();
