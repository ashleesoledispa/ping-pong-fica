/* Formulario de inscripción (1 jugador) */
(async () => {
  const MAX_FILES = 2;
  const MAX_BYTES = 3 * 1024 * 1024;       // por archivo, ya comprimido
  const MAX_TOTAL = 3.1 * 1024 * 1024;     // total enviado (límite del servidor)
  const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

  const form = document.getElementById('form-inscripcion');
  const errorBox = document.querySelector('[data-error]');
  const submitBtn = document.querySelector('[data-submit]');
  const input = document.getElementById('archivos');
  const dropzone = document.querySelector('[data-dropzone]');
  const previews = document.querySelector('[data-previews]');
  let archivos = []; // { file, url }

  // --- Estado de inscripciones ---
  const cfg = await Torneo.config();
  const dominio = cfg?.dominioCorreo ?? 'udla.edu.ec';
  if (cfg && cfg.abierto === false) {
    document.querySelector('[data-closed]').hidden = false;
    form.querySelectorAll('input, button').forEach(x => (x.disabled = true));
    form.classList.add('is-disabled');
  }
  const cupos = document.querySelector('[data-cupos]');
  if (cfg?.cupoMaximo && cupos) {
    const libres = Math.max(0, cfg.cupoMaximo - cfg.inscritos);
    cupos.textContent = libres === 1 ? '¡Queda 1 cupo!' : `Quedan ${libres} de ${cfg.cupoMaximo} cupos`;
    cupos.hidden = false;
  }

  // --- Copiar datos bancarios ---
  document.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const txt = btn.dataset.copy;
      try {
        await navigator.clipboard.writeText(txt);
      } catch {
        const ta = Object.assign(document.createElement('textarea'), { value: txt });
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
      }
      btn.textContent = '¡Copiado!';
      btn.classList.add('is-done');
      setTimeout(() => { btn.textContent = 'Copiar'; btn.classList.remove('is-done'); }, 1500);
    });
  });

  // --- Limpieza mientras escribe ---
  const celInput = document.getElementById('celular');
  celInput.addEventListener('input', () => { celInput.value = celInput.value.replace(/[^\d+ ]/g, ''); });
  const bannerInput = document.getElementById('idBanner');
  bannerInput.addEventListener('input', () => { bannerInput.value = bannerInput.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });

  // --- Archivos ---
  function agregar(files) {
    for (const file of files) {
      if (archivos.length >= MAX_FILES) { Torneo.toast(`Máximo ${MAX_FILES} archivos`); break; }
      const tipoOk = OK_TYPES.includes(file.type) || /\.(jpe?g|png|webp|pdf)$/i.test(file.name);
      if (!tipoOk) { Torneo.toast(`"${file.name}" no es JPG, PNG, WEBP o PDF`); continue; }
      const esPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      if (esPdf && file.size > MAX_BYTES) { Torneo.toast('El PDF pesa más de 3 MB. Sube una captura en su lugar.'); continue; }
      if (file.size > 25 * 1024 * 1024) { Torneo.toast('Esa imagen es demasiado pesada'); continue; }
      archivos.push({ file, url: esPdf ? null : URL.createObjectURL(file) });
    }
    pintar();
  }

  function pintar() {
    previews.innerHTML = '';
    archivos.forEach((a, i) => {
      const li = document.createElement('li');
      li.className = 'preview';
      if (a.url) {
        const img = document.createElement('img');
        img.src = a.url; img.alt = '';
        li.appendChild(img);
      } else {
        const pdf = document.createElement('span');
        pdf.className = 'preview__pdf'; pdf.textContent = 'PDF';
        li.appendChild(pdf);
      }
      const name = document.createElement('span');
      name.className = 'preview__name'; name.textContent = a.file.name;
      const rm = document.createElement('button');
      rm.type = 'button'; rm.className = 'preview__rm'; rm.setAttribute('aria-label', 'Quitar archivo'); rm.textContent = '✕';
      rm.addEventListener('click', () => {
        if (a.url) URL.revokeObjectURL(a.url);
        archivos.splice(i, 1);
        pintar();
      });
      li.append(name, rm);
      previews.appendChild(li);
    });
    dropzone.classList.toggle('has-files', archivos.length > 0);
  }

  input.addEventListener('change', () => { agregar([...input.files]); input.value = ''; });
  ['dragenter', 'dragover'].forEach(ev => dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach(ev => dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.remove('is-over'); }));
  dropzone.addEventListener('drop', e => agregar([...e.dataTransfer.files]));

  const leerBase64 = blob => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });

  // Reduce las fotos del celular antes de enviarlas
  async function comprimir(file, maxLado, calidad) {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxLado / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return new Promise(res => canvas.toBlob(res, 'image/jpeg', calidad));
  }

  async function preparar({ file }) {
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      return { nombre: file.name, bytes: file.size, data: await leerBase64(file) };
    }
    let blob = file;
    try {
      blob = await comprimir(file, 1600, 0.82);
      if (blob.size > 900 * 1024) blob = await comprimir(file, 1200, 0.75);
      if (file.size < blob.size && file.size <= MAX_BYTES && OK_TYPES.includes(file.type)) blob = file;
    } catch { blob = file; }
    if (blob.size > MAX_BYTES) throw new Error(`"${file.name}" pesa demasiado. Sube una captura más liviana.`);
    const nombre = blob === file ? file.name : file.name.replace(/\.\w+$/, '') + '.jpg';
    return { nombre, bytes: blob.size, data: await leerBase64(blob) };
  }

  // --- Validación ---
  const val = id => document.getElementById(id).value.trim();

  function marcar(id, msg) {
    const field = document.getElementById(id).closest('.field');
    field.classList.toggle('has-error', Boolean(msg));
    let small = field.querySelector('.field__error');
    if (msg) {
      if (!small) { small = document.createElement('small'); small.className = 'field__error'; field.appendChild(small); }
      small.textContent = msg;
    } else if (small) small.remove();
    return !msg;
  }

  function validar() {
    const correo = val('correo').toLowerCase();
    const cel = val('celular').replace(/\D/g, '').replace(/^593(?=9\d{8}$)/, '0');
    const reglas = [
      ['nombre', /\p{L}+\s+\p{L}+/u.test(val('nombre')) ? '' : 'Escribe nombre y apellido'],
      ['correo', !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) ? 'Correo no válido'
        : (dominio && !correo.endsWith('@' + dominio)) ? `Usa tu correo @${dominio}` : ''],
      ['idBanner', /^[A-Z0-9]{5,15}$/.test(val('idBanner')) ? '' : 'Escribe tu ID Banner (solo letras y números)'],
      ['celular', /^09\d{8}$/.test(cel) ? '' : 'Debe tener 10 dígitos y empezar con 09'],
      ['carrera', val('carrera').length >= 3 ? '' : 'Indica tu carrera'],
    ];
    let primero = null;
    for (const [id, msg] of reglas) if (!marcar(id, msg) && !primero) primero = id;
    if (primero) document.getElementById(primero).focus();
    return !primero;
  }

  form.querySelectorAll('input').forEach(i => i.addEventListener('input', () => {
    if (i.closest('.field')?.classList.contains('has-error')) marcar(i.id, '');
  }));

  function error(msg) {
    errorBox.textContent = msg;
    errorBox.hidden = !msg;
  }

  // --- Envío ---
  form.addEventListener('submit', async e => {
    e.preventDefault();
    error('');
    if (!validar()) return error('Revisa los campos marcados en rojo.');
    if (archivos.length === 0) return error('Adjunta el comprobante de pago.');
    if (!document.getElementById('acepta').checked) return error('Debes aceptar el reglamento del torneo.');

    submitBtn.disabled = true;
    submitBtn.classList.add('is-loading');
    try {
      const adjuntos = [];
      for (const a of archivos) adjuntos.push(await preparar(a));
      const total = adjuntos.reduce((s, a) => s + a.bytes, 0);
      if (total > MAX_TOTAL) throw new Error('Los archivos pesan demasiado juntos. Sube solo una captura del comprobante.');

      const r = await fetch('/api/inscripciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participante: {
            nombre: val('nombre'),
            correo: val('correo'),
            idBanner: val('idBanner'),
            celular: val('celular'),
            carrera: val('carrera'),
          },
          aceptaReglamento: true,
          archivos: adjuntos.map(({ nombre, data }) => ({ nombre, data })),
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || (r.status === 413 ? 'Los archivos pesan demasiado.' : 'No se pudo enviar la inscripción. Inténtalo de nuevo.'));

      form.hidden = true;
      document.querySelector('[data-code]').textContent = data.codigo;
      const ok = document.querySelector('[data-success]');
      ok.hidden = false;
      window.scrollTo({ top: ok.offsetTop - 90, behavior: 'smooth' });
    } catch (err) {
      error(err.message === 'Failed to fetch' ? 'Sin conexión con el servidor. Revisa tu internet.' : err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.classList.remove('is-loading');
    }
  });
})();
