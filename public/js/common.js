/* Utilidades compartidas por todas las páginas */
(() => {
  // --- Espacios para logos: si la imagen no existe se muestra el recuadro punteado ---
  document.querySelectorAll('.logo-slot img').forEach(img => {
    const slot = img.closest('.logo-slot');
    const ok = () => slot.classList.remove('missing');
    const fail = () => slot.classList.add('missing');
    if (img.complete) (img.naturalWidth ? ok() : fail());
    img.addEventListener('load', ok);
    img.addEventListener('error', fail);
  });

  // --- Menú móvil ---
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      toggle.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    });
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      nav.classList.remove('is-open');
      toggle.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    }));
  }

  // --- Animación al hacer scroll ---
  const items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && items.length) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    items.forEach(el => io.observe(el));
  } else {
    items.forEach(el => el.classList.add('is-visible'));
  }

  // --- Acceso secreto al panel: 3 clics sobre la pelotita del pie de página ---
  const secret = document.querySelector('.secret-ball');
  if (secret) {
    let clicks = 0, timer;
    secret.addEventListener('click', () => {
      clicks++;
      clearTimeout(timer);
      timer = setTimeout(() => (clicks = 0), 900);
      if (clicks >= 3) window.location.href = '/admin';
    });
  }

  // --- API pública ---
  window.Torneo = {
    async config() {
      try {
        const r = await fetch('/api/config', { cache: 'no-store' });
        if (!r.ok) throw new Error();
        return await r.json();
      } catch {
        return null;
      }
    },
    toast(msg) {
      let t = document.querySelector('.toast');
      if (!t) {
        t = document.createElement('div');
        t.className = 'toast';
        t.setAttribute('role', 'status');
        document.body.appendChild(t);
      }
      t.textContent = msg;
      t.classList.add('is-show');
      clearTimeout(t._timer);
      t._timer = setTimeout(() => t.classList.remove('is-show'), 2200);
    },
  };
})();
