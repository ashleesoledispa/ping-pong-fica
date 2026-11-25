/* Portada: cuenta regresiva y estado de inscripciones */
(async () => {
  const FALLBACK_DEADLINE = '2026-11-30T23:59:59-05:00';
  const cfg = await Torneo.config();
  const deadline = new Date(cfg?.fechaLimite || FALLBACK_DEADLINE).getTime();

  const el = {
    d: document.querySelector('[data-cd="d"]'),
    h: document.querySelector('[data-cd="h"]'),
    m: document.querySelector('[data-cd="m"]'),
    s: document.querySelector('[data-cd="s"]'),
  };
  const box = document.querySelector('[data-countdown]');
  const pad = n => String(n).padStart(2, '0');

  function cerrar() {
    box.querySelector('.countdown__label').textContent = 'Inscripciones cerradas';
    box.classList.add('is-closed');
    document.querySelectorAll('a[href="/inscripcion"]').forEach(a => {
      a.classList.add('is-disabled');
      a.setAttribute('aria-disabled', 'true');
      a.addEventListener('click', e => e.preventDefault());
    });
    const cta = document.querySelector('[data-cta]');
    const closed = document.querySelector('[data-closed]');
    if (cta) cta.hidden = true;
    if (closed) closed.hidden = false;
  }

  function tick() {
    const diff = deadline - Date.now();
    if (diff <= 0) {
      Object.values(el).forEach(x => (x.textContent = '00'));
      cerrar();
      return false;
    }
    el.d.textContent = pad(Math.floor(diff / 86400000));
    el.h.textContent = pad(Math.floor(diff / 3600000) % 24);
    el.m.textContent = pad(Math.floor(diff / 60000) % 60);
    el.s.textContent = pad(Math.floor(diff / 1000) % 60);
    return true;
  }

  if (cfg && cfg.abierto === false) {
    tick();
    cerrar();
  } else if (tick()) {
    const timer = setInterval(() => { if (!tick()) clearInterval(timer); }, 1000);
  }

  const teams = document.querySelector('[data-teams]');
  if (cfg && teams && cfg.inscritos > 0) {
    const n = cfg.inscritos;
    teams.textContent = cfg.cupoMaximo
      ? `${n} de ${cfg.cupoMaximo} cupos ocupados`
      : `${n} ${n === 1 ? 'jugador ya está inscrito' : 'jugadores ya están inscritos'}`;
    teams.hidden = false;
  }
})();
