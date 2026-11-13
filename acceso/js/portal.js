/* Binocular3D · portal de acceso y administración.
   - Cada versión del visor está cifrada con AES-256-GCM (clave de contenido por versión).
   - v/usuarios.json guarda, por usuario (identificado por una huella SHA-256), las claves de contenido
     de las versiones que su tipo permite, cifradas con una llave derivada de su clave (PBKDF2-SHA256).
   - Los administradores reciben además un paquete con todas las claves de contenido y la llave del
     directorio cifrado de usuarios, que les permite crear, cambiar y eliminar accesos.
   Las claves nunca salen del navegador. */
(function () {
  'use strict';
  const ITER = 600000;
  const VERS = {
    anon: { t: 'Binocular3D Estándar', tag: ['tagG', 'Demostración'], d: 'Camión diésel-eléctrico genérico con catálogo de demostración. Recorrido 3D, despieces, interiores de gabinetes, cabina en primera persona y galería 3D.' },
    plus: { t: 'Binocular3D Plus', tag: ['tagY', 'Plus'], d: 'Catálogo a escala real (524 subconjuntos, 6.799 ítems) con consumo de repuestos y confiabilidad de una flota de demostración: mapa de calor 3D del gasto y de las detenciones, disponibilidad, MTBF y MTTR, Pareto de detenciones, vida de componentes (Weibull) y alertas.' },
  };
  const ROLES = {
    demo: { n: 'Estándar', v: ['anon'] },
    plus: { n: 'Plus', v: ['anon', 'plus'] },
    admin: { n: 'Administrador', v: ['anon', 'plus'], adm: true },
  };
  const $ = s => document.querySelector(s);
  const te = new TextEncoder(), td = new TextDecoder();
  const b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const b64e = u => { u = new Uint8Array(u); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
  const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rnd = n => crypto.getRandomValues(new Uint8Array(n));
  const hoy = () => new Date().toISOString().slice(0, 10);
  const show = id => document.querySelectorAll('.page').forEach(p => p.classList.toggle('on', p.id === id));

  // ---------- criptografía
  async function kek(pass, salt) {
    const base = await crypto.subtle.importKey('raw', te.encode(pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  const aes = raw => crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  async function enc(key, bytes) { const iv = rnd(12); return { iv: b64e(iv), ct: b64e(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes)) }; }
  async function decB(key, o) { return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(o.iv) }, key, b64d(o.ct))); }
  const encJ = (key, obj) => enc(key, te.encode(JSON.stringify(obj)));
  const decJ = async (key, o) => JSON.parse(td.decode(await decB(key, o)));
  const huella = async u => hex(await crypto.subtle.digest('SHA-256', te.encode('b3d:' + u.trim().toLowerCase())));

  async function cargarUsuarios() {
    const r = await fetch('v/usuarios.json', { cache: 'no-store' });
    if (!r.ok) throw new Error('No se encontró v/usuarios.json en el sitio.');
    return r.json();
  }

  // ---------- sesión (dura lo que la pestaña)
  let SES = null;
  const guardarSes = () => { try { sessionStorage.setItem('b3d.ses', JSON.stringify(SES)); } catch (_) {} };
  const leerSes = () => { try { return JSON.parse(sessionStorage.getItem('b3d.ses') || 'null'); } catch (_) { return null; } };
  function salir() { try { sessionStorage.clear(); } catch (_) {} SES = null; location.href = location.pathname; }
  window.__B3D_SALIR = salir;
  window.__B3D_MENU = () => { try { sessionStorage.removeItem('b3d.v'); } catch (_) {} location.href = location.pathname; };

  async function ingresar(usuario, clave) {
    const U = await cargarUsuarios();
    const rec = U.u[await huella(usuario)];
    if (!rec) throw new Error('CRED');
    let K, who;
    try { K = await kek(clave, b64d(rec.salt)); who = await decJ(K, rec.who); } catch (_) { throw new Error('CRED'); }
    if (rec.exp && hoy() > rec.exp) throw new Error('VENC');
    const keys = {};
    for (const [v, o] of Object.entries(rec.k || {})) keys[v] = b64e(await decB(K, o));
    let adm = null; if (rec.adm) adm = await decJ(K, rec.adm);
    SES = { usuario: who.usuario, nombre: who.nombre, rol: who.rol, keys, adm };
    guardarSes();
  }

  // ---------- menú de versiones
  function menu() {
    const R = ROLES[SES.rol] || ROLES.demo;
    $('#whoN').textContent = SES.nombre ? `${SES.nombre} (${SES.usuario})` : SES.usuario;
    $('#whoR').textContent = R.n;
    $('#hola').textContent = 'Hola' + (SES.nombre ? ', ' + SES.nombre.split('·')[0].trim() : '');
    $('#bAdmin').hidden = !SES.adm;
    $('#cards').innerHTML = Object.keys(SES.keys).filter(v => VERS[v]).map(v => `<article class="card"><span class="tag ${VERS[v].tag[0]}">${VERS[v].tag[1]}</span><h3>${VERS[v].t}</h3><p>${VERS[v].d}</p><button class="btn" data-open="${v}">Abrir</button></article>`).join('')
      || '<p class="mut">Tu clave no tiene versiones habilitadas. Contacta a Binocular3D.</p>';
    $('#openErr').hidden = true; $('#openProg').hidden = true;
    show('pMenu');
  }

  async function abrir(v) {
    const K = await aes(b64d(SES.keys[v]));
    const leer = async rel => { const r = await fetch(`v/${v}/${rel}.enc`); if (!r.ok) throw new Error(r.status === 404 ? 'NOPUB' : 'no se pudo cargar ' + rel); const u = new Uint8Array(await r.arrayBuffer()); return td.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.slice(0, 12) }, K, u.slice(12))); };
    window.__B3D_LOAD = async src => {
      if (/^(https?:)?\/\//.test(src) || /^vendor\//.test(src)) return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('no se pudo cargar ' + src)); document.head.appendChild(s); });
      const s = document.createElement('script'); s.textContent = await leer(src); document.head.appendChild(s);
    };
    const html = await leer('index.html');
    try { sessionStorage.setItem('b3d.v', v); } catch (_) {}
    document.open(); document.write(html); document.close();
  }

  // ---------- administración
  let ADM = null; // { U (usuarios.json), dir:[...], cambios:bool, edit:usuario|null }
  async function admAbrir() {
    const U = await cargarUsuarios();
    const kd = await aes(b64d(SES.adm.dir));
    ADM = { U, dir: await decJ(kd, U.dir), cambios: false, edit: null };
    const cfg = JSON.parse(localStorage.getItem('b3d.gh') || 'null') || {};
    const host = location.hostname, seg = location.pathname.split('/').filter(Boolean)[0];
    $('#gO').value = cfg.o || 'victorbarrientosboccardo';
    $('#gR').value = cfg.r || 'Binocular3D';
    $('#gB').value = cfg.b || 'main'; $('#gT').value = cfg.t || ''; $('#gRem').checked = !!cfg.t;
    nuevoForm(); tabla(); show('pAdmin');
  }
  function marcar() { ADM.cambios = true; $('#pend').hidden = false; }
  function tabla() {
    const f = ($('#filt').value || '').toLowerCase();
    const L = ADM.dir.filter(x => !f || (x.usuario + ' ' + (x.nombre || '') + ' ' + x.rol).toLowerCase().includes(f)).sort((a, b) => a.usuario.localeCompare(b.usuario));
    $('#nUs').textContent = `· ${ADM.dir.length}`;
    $('#tb').innerHTML = L.map(x => `<tr><td>${esc(x.usuario)}</td><td>${esc(x.nombre || '')}</td><td><span class="role">${esc((ROLES[x.rol] || {}).n || x.rol)}</span></td><td class="${x.exp && hoy() > x.exp ? 'exp' : ''}">${x.exp ? esc(x.exp) + (hoy() > x.exp ? ' · vencido' : '') : '—'}</td><td>${esc(x.creado || '')}</td>
      <td><button class="btn ghost sm" data-ed="${esc(x.usuario)}">Cambiar tipo o clave</button> <button class="btn ghost sm danger" data-del="${esc(x.usuario)}">Eliminar</button></td></tr>`).join('') || '<tr><td colspan="6" class="mut">Sin usuarios.</td></tr>';
  }
  function genClave(n = 4) { const a = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const r = rnd(n * 5); return Array.from({ length: n }, (_, i) => Array.from(r.slice(i * 5, i * 5 + 5), b => a[b % a.length]).join('')).join('-'); }
  function nuevoForm(x) {
    ADM.edit = x ? x.usuario : null;
    $('#fTit').textContent = x ? 'Cambiar tipo o clave · ' + x.usuario : 'Nuevo usuario';
    $('#nU').value = x ? x.usuario : ''; $('#nU').disabled = !!x;
    $('#nN').value = x ? x.nombre || '' : ''; $('#nR').value = x ? x.rol : 'demo'; $('#nV').value = x ? x.exp || '' : '';
    $('#nP').value = genClave($('#nR').value === 'admin' ? 5 : 4);
    $('#nOk').textContent = x ? 'Guardar usuario con clave nueva' : 'Agregar usuario'; $('#nCancel').hidden = !x; $('#nErr').hidden = true;
  }
  async function registro(usuario, nombre, rol, exp, clave) {
    const salt = rnd(16), K = await kek(clave, salt), R = ROLES[rol];
    const rec = { salt: b64e(salt), exp: exp || null, who: await encJ(K, { usuario, nombre, rol }), k: {} };
    for (const v of R.v) { const iv = rnd(12); rec.k[v] = { iv: b64e(iv), ct: b64e(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, K, b64d(SES.adm[v]))) }; }
    if (R.adm) rec.adm = await encJ(K, SES.adm);
    return rec;
  }
  async function guardarUsuario(e) {
    e.preventDefault(); const err = $('#nErr'); err.hidden = true; $('#cred').hidden = true;
    const usuario = $('#nU').value.trim().toLowerCase(), nombre = $('#nN').value.trim(), rol = $('#nR').value, exp = $('#nV').value || null, clave = $('#nP').value;
    if (!/^[a-z0-9._@\-]{3,60}$/.test(usuario)) { err.textContent = 'Usuario inválido: 3 a 60 caracteres (letras, números, punto, guion, guion bajo o @).'; err.hidden = false; return; }
    if (clave.length < (rol === 'admin' ? 16 : 12)) { err.textContent = `La clave debe tener al menos ${rol === 'admin' ? 16 : 12} caracteres.`; err.hidden = false; return; }
    if (!ADM.edit && ADM.dir.some(x => x.usuario === usuario)) { err.textContent = 'Ese usuario ya existe. Usa «Cambiar tipo o clave».'; err.hidden = false; return; }
    if (ADM.edit && rol !== 'admin' && ADM.dir.find(x => x.usuario === usuario)?.rol === 'admin' && ADM.dir.filter(x => x.rol === 'admin').length === 1) { err.textContent = 'Debe quedar al menos un administrador.'; err.hidden = false; return; }
    $('#nOk').disabled = true;
    try {
      const h = await huella(usuario);
      ADM.U.u[h] = await registro(usuario, nombre, rol, exp, clave);
      const prev = ADM.dir.find(x => x.usuario === usuario);
      const fila = { usuario, nombre, rol, exp, creado: prev ? prev.creado : hoy() };
      if (prev) Object.assign(prev, fila); else ADM.dir.push(fila);
      marcar(); tabla();
      const R = ROLES[rol], url = location.origin + location.pathname;
      $('#cred').innerHTML = `<b>${prev ? 'Clave nueva asignada' : 'Usuario creado'}. Copia esta credencial ahora: la clave no se puede volver a ver.</b><pre id="credTxt">Sitio:   ${esc(url)}\nUsuario: ${esc(usuario)}\nClave:   ${esc(clave)}\nTipo:    ${esc(R.n)} (${R.v.map(v => VERS[v].t).join(', ')})${exp ? '\nVence:   ' + esc(exp) : ''}</pre><div class="row"><button type="button" class="btn sm" id="credCp">Copiar credencial</button><span class="fine">Recuerda guardar los cambios.</span></div>`;
      $('#cred').hidden = false;
      $('#credCp').onclick = () => navigator.clipboard.writeText($('#credTxt').textContent).then(() => { $('#credCp').textContent = 'Copiada'; });
      nuevoForm();
    } catch (x) { err.textContent = 'No se pudo crear el usuario: ' + x.message; err.hidden = false; }
    $('#nOk').disabled = false;
  }
  async function contenido() {
    const kd = await aes(b64d(SES.adm.dir));
    // limpiar registros huérfanos (sin fila en el directorio)
    const vivos = new Set(await Promise.all(ADM.dir.map(x => huella(x.usuario))));
    for (const h of Object.keys(ADM.U.u)) if (!vivos.has(h)) delete ADM.U.u[h];
    ADM.U.dir = await encJ(kd, ADM.dir); ADM.U.actualizado = new Date().toISOString();
    return JSON.stringify(ADM.U, null, 1);
  }
  function msg(t, bad) { const m = $('#gMsg'); m.textContent = t; m.className = 'msg' + (bad ? ' bad' : ''); m.hidden = false; }
  async function guardarGh() {
    const o = $('#gO').value.trim(), r = $('#gR').value.trim(), b = $('#gB').value.trim() || 'main', t = $('#gT').value.trim();
    if (!o || !r || !t) { $('#ghCfg').open = true; return msg('Completa dueño, repositorio y token en «Conexión con GitHub».', true); }
    if ($('#gRem').checked) localStorage.setItem('b3d.gh', JSON.stringify({ o, r, b, t })); else localStorage.setItem('b3d.gh', JSON.stringify({ o, r, b }));
    $('#bGh').disabled = true; msg('Guardando en GitHub…');
    try {
      const api = `https://api.github.com/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/contents/acceso/v/usuarios.json`;
      const H = { Authorization: 'Bearer ' + t, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
      const g = await fetch(api + '?ref=' + encodeURIComponent(b), { headers: H, cache: 'no-store' });
      if (!g.ok && g.status !== 404) throw new Error(g.status === 401 ? 'token inválido o vencido' : g.status === 403 ? 'el token no tiene permiso de escritura' : 'GitHub respondió ' + g.status);
      const sha = g.ok ? (await g.json()).sha : undefined;
      const body = { message: 'Actualiza usuarios de Binocular3D (' + SES.usuario + ')', content: b64e(te.encode(await contenido())), branch: b, sha };
      const p = await fetch(api, { method: 'PUT', headers: H, body: JSON.stringify(body) });
      if (!p.ok) { const j = await p.json().catch(() => ({})); throw new Error(j.message || 'GitHub respondió ' + p.status); }
      ADM.cambios = false; $('#pend').hidden = true;
      msg('Guardado en GitHub. El sitio aplicará los cambios en 1–2 minutos, cuando termine la publicación.');
    } catch (x) { msg('No se pudo guardar: ' + x.message + '. Puedes usar «Descargar usuarios.json» y subirlo a mano.', true); }
    $('#bGh').disabled = false;
  }
  async function descargar() {
    const blob = new Blob([await contenido()], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'usuarios.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    ADM.cambios = false; $('#pend').hidden = true;
    msg('Descargado. Súbelo al repositorio en la carpeta acceso/v/ reemplazando usuarios.json.');
  }

  // ---------- eventos
  $('#loginForm').onsubmit = async e => {
    e.preventDefault(); const err = $('#loginErr'); err.hidden = true;
    if (!window.crypto || !crypto.subtle) { err.textContent = 'Este navegador no permite descifrar el contenido. Usa una versión reciente de Chrome, Edge, Firefox o Safari, con https.'; err.hidden = false; return; }
    $('#loginB').disabled = true; $('#loginProg').hidden = false;
    try { await ingresar($('#u').value, $('#p').value); $('#p').value = ''; menu(); }
    catch (x) { err.textContent = x.message === 'CRED' ? 'Usuario o clave incorrectos.' : x.message === 'VENC' ? 'Tu acceso venció. Contacta a Binocular3D para renovarlo.' : 'No se pudo ingresar: ' + x.message; err.hidden = false; }
    $('#loginB').disabled = false; $('#loginProg').hidden = true;
  };
  $('#cards').addEventListener('click', async e => {
    const b = e.target.closest('[data-open]'); if (!b) return;
    $('#openErr').hidden = true; $('#openProg').hidden = false; document.querySelectorAll('[data-open]').forEach(x => x.disabled = true);
    try { await abrir(b.dataset.open); }
    catch (x) {
      $('#openErr').textContent = x.message === 'NOPUB' ? 'Esta versión no está publicada en este sitio.' : 'No se pudo abrir la versión: ' + x.message;
      $('#openErr').hidden = false; $('#openProg').hidden = true; document.querySelectorAll('[data-open]').forEach(x => x.disabled = false);
    }
  });
  $('#bSalir').onclick = $('#bSalir2').onclick = () => { if (ADM && ADM.cambios && !confirm('Hay cambios sin guardar. ¿Salir igual?')) return; salir(); };
  $('#bAdmin').onclick = () => admAbrir().catch(x => alert('No se pudo abrir la administración: ' + x.message));
  $('#bVolver').onclick = () => { if (ADM && ADM.cambios && !confirm('Hay cambios sin guardar. ¿Volver igual?')) return; ADM = null; $('#pend').hidden = true; $('#gMsg').hidden = true; $('#cred').hidden = true; menu(); };
  $('#fNuevo').onsubmit = guardarUsuario;
  $('#nGen').onclick = () => { $('#nP').value = genClave($('#nR').value === 'admin' ? 5 : 4); };
  $('#nR').onchange = () => { if ($('#nR').value === 'admin' && $('#nP').value.length < 16) $('#nP').value = genClave(5); };
  $('#nCancel').onclick = () => nuevoForm();
  $('#filt').oninput = tabla;
  $('#tb').addEventListener('click', e => {
    const ed = e.target.closest('[data-ed]'), del = e.target.closest('[data-del]');
    if (ed) { nuevoForm(ADM.dir.find(x => x.usuario === ed.dataset.ed)); $('#fNuevo').scrollIntoView({ behavior: 'smooth' }); }
    if (del) {
      const u = del.dataset.del, x = ADM.dir.find(y => y.usuario === u);
      if (x.rol === 'admin' && ADM.dir.filter(y => y.rol === 'admin').length === 1) return alert('No puedes eliminar el único administrador.');
      if (u === SES.usuario && !confirm('Vas a eliminar tu propio usuario. ¿Continuar?')) return;
      if (!confirm(`¿Eliminar el usuario «${u}»?`)) return;
      ADM.dir = ADM.dir.filter(y => y.usuario !== u); marcar(); tabla();
    }
  });
  $('#bGh').onclick = guardarGh; $('#bDl').onclick = descargar;
  window.addEventListener('beforeunload', e => { if (ADM && ADM.cambios) { e.preventDefault(); e.returnValue = ''; } });

  // ---------- reanudar sesión de la pestaña
  SES = leerSes();
  if (SES) { let v = null; try { v = sessionStorage.getItem('b3d.v'); } catch (_) {} if (v && SES.keys[v]) abrir(v).catch(() => menu()); else menu(); }
})();
