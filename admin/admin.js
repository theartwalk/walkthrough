/* Walkthrough admin dashboard.
   Live mode: Supabase (login, database, photo storage) when gallery.config.js has its keys.
   Demo mode: everything stays in this browser, seeded with the sample works. */
(() => {
  'use strict';
  const cfg = window.GALLERY || {};
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
  const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/dist/umd/supabase.js';
  const siteURL = (cfg.siteUrl || location.origin).replace(/\/$/, '');
  const WORK_FIELDS = ['title', 'artist', 'year', 'medium', 'width_cm', 'height_cm', 'price_inr', 'status', 'image_url', 'thumb_url', 'description', 'is_public', 'sort_order'];
  const GALLERY_FIELDS = ['name', 'city', 'address', 'whatsapp', 'email', 'instagram', 'exhibition_title', 'exhibition_dates', 'exhibition_lede'];

  const loadScript = src => new Promise((ok, fail) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => fail(new Error('Could not reach the database. Check your internet connection and reload.')); document.head.appendChild(s); });
  const blobToDataURL = b => new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(b); });
  const pick = (o, keys) => keys.reduce((a, k) => { if (k in o) a[k] = o[k]; return a; }, {});

  /* ---------- Demo store (this browser only) ---------- */
  const Demo = (() => {
    const KEY = 'walkthrough-demo-db';
    let db = null;
    function seed() {
      const ex = cfg.exhibition || {};
      const works = (window.SAMPLE_WORKS || []).map((w, i) => ({
        id: w.id, title: w.title, artist: w.artist, year: String(w.year || ''), medium: w.medium,
        width_cm: w.w, height_cm: w.h, price_inr: w.price, status: w.status, image_url: null, thumb_url: null,
        description: w.note || '', is_public: w.public !== false, sort_order: i, art: w.art
      }));
      const rooms = (window.SAMPLE_ROOMS || []).map((r, i) => ({
        id: 'r' + (i + 1), slug: r.room, title: r.title, for_name: r.for, message: r.message, expires: r.expires,
        work_ids: (window.SAMPLE_WORKS || []).filter(w => (w.rooms || []).includes(r.room)).map(w => w.id)
      }));
      return {
        gallery: { slug: cfg.slug || 'demo', name: cfg.name, city: cfg.city, address: cfg.address, whatsapp: cfg.whatsapp, email: cfg.email, instagram: cfg.instagram,
          exhibition_title: ex.title, exhibition_dates: ex.dates, exhibition_lede: ex.lede },
        works, rooms
      };
    }
    function load() { if (db) return; try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) { db = null; } if (!db) db = seed(); }
    function save() {
      try { localStorage.setItem(KEY, JSON.stringify(db)); }
      catch (e) { throw new Error('This browser has no space left for demo photos. Remove a photo, or connect the database to store them properly.'); }
    }
    const ss = { get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* ok */ } }, del(k) { try { sessionStorage.removeItem(k); } catch (e) { /* ok */ } } };
    const hash = s => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
    return {
      mode: 'demo',
      async session() { const e = ss.get('wt-demo-session'); return e ? { email: e } : null; },
      async signIn(email) { ss.set('wt-demo-session', email || 'demo'); return { email }; },
      async isMember() { return true; },
      async signOut() { ss.del('wt-demo-session'); },
      async gallery() { load(); return { ...db.gallery }; },
      async saveGallery(g) { load(); db.gallery = { ...db.gallery, ...g }; save(); return { ...db.gallery }; },
      async works() { load(); return db.works.map(w => ({ ...w })); },
      async saveWork(w) {
        load();
        if (!w.id) { const row = { ...w, id: 'd' + Date.now().toString(36), sort_order: db.works.length }; db.works.push(row); save(); return { ...row }; }
        const i = db.works.findIndex(x => x.id === w.id); db.works[i] = { ...db.works[i], ...w }; save(); return { ...db.works[i] };
      },
      async deleteWork(id) { load(); db.works = db.works.filter(w => w.id !== id); db.rooms.forEach(r => { r.work_ids = r.work_ids.filter(x => x !== id); }); save(); },
      async uploadImage(large, thumb) { return { image_url: await blobToDataURL(large), thumb_url: await blobToDataURL(thumb) }; },
      photoSize: { large: 1100, thumb: 360, quality: 0.78 },
      async rooms() { load(); return db.rooms.map(r => ({ ...r, work_ids: [...r.work_ids] })); },
      async saveRoom(r, ids) {
        load();
        if (db.rooms.some(x => x.slug === r.slug && x.id !== r.id)) throw new Error('That link name is already used. Choose another.');
        if (!r.id) { const row = { ...r, id: 'r' + Date.now().toString(36), work_ids: ids }; db.rooms.unshift(row); save(); return row; }
        const i = db.rooms.findIndex(x => x.id === r.id); db.rooms[i] = { ...db.rooms[i], ...r, work_ids: ids }; save(); return db.rooms[i];
      },
      async deleteRoom(id) { load(); db.rooms = db.rooms.filter(r => r.id !== id); save(); },
      async stats() {
        load(); const works = {}, rooms = {};
        db.works.forEach(w => { const h = hash(w.id); works[w.id] = { views: 4 + h % 46, enquiries: h % 4 }; });
        db.rooms.forEach(r => { const h = hash(r.id); rooms[r.id] = { opens: 1 + h % 9, enquiries: h % 3, last_open: new Date(Date.now() - (h % 72) * 36e5).toISOString() }; });
        return { works, rooms, sample: true };
      }
    };
  })();

  /* ---------- Live store (Supabase) ---------- */
  const Live = (() => {
    let sb = null; const gal = cfg.gallery;
    async function client() {
      if (!sb) { await loadScript(SUPABASE_JS); sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey); }
      return sb;
    }
    function friendly(error) {
      if (!error) return 'Something went wrong.';
      if (error.code === '23505') return 'That link name is already used. Choose another.';
      if (error.code === '42501' || /row-level security/i.test(error.message || '')) return 'This login is not allowed to change this gallery. Check the members step in the setup guide.';
      if (/fetch/i.test(error.message || '')) return 'Could not reach the database. Check your internet connection.';
      return error.message || 'Something went wrong.';
    }
    const ok = ({ data, error }) => { if (error) throw new Error(friendly(error)); return data; };
    return {
      mode: 'live',
      async session() { const c = await client(); const { data } = await c.auth.getSession(); return data.session ? { email: data.session.user.email } : null; },
      async signIn(email, password) {
        const c = await client(); const { data, error } = await c.auth.signInWithPassword({ email, password });
        if (error) throw new Error(/invalid/i.test(error.message) ? 'That email and password don’t match a login. Check them and try again.' : friendly(error));
        return { email: data.user.email };
      },
      async isMember() { const c = await client(); return ok(await c.from('members').select('gallery').eq('gallery', gal)).length > 0; },
      async signOut() { const c = await client(); await c.auth.signOut(); },
      async gallery() { const c = await client(); return ok(await c.from('galleries').select('*').eq('slug', gal).maybeSingle()) || { slug: gal, name: gal }; },
      async saveGallery(g) { const c = await client(); return ok(await c.from('galleries').update({ ...pick(g, GALLERY_FIELDS), updated_at: new Date().toISOString() }).eq('slug', gal).select().single()); },
      async works() { const c = await client(); return ok(await c.from('works').select('*').eq('gallery', gal).order('sort_order').order('created_at')); },
      async saveWork(w) {
        const c = await client(); const row = { ...pick(w, WORK_FIELDS), gallery: gal, updated_at: new Date().toISOString() };
        if (w.id) return ok(await c.from('works').update(row).eq('id', w.id).select().single());
        return ok(await c.from('works').insert(row).select().single());
      },
      async deleteWork(id) { const c = await client(); ok(await c.from('works').delete().eq('id', id)); },
      async uploadImage(large, thumb) {
        const c = await client();
        const base = `${gal}/${(crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2))}`;
        const up = async (blob, path) => {
          ok(await c.storage.from('artworks').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false }));
          return c.storage.from('artworks').getPublicUrl(path).data.publicUrl;
        };
        const [image_url, thumb_url] = await Promise.all([up(large, base + '.jpg'), up(thumb, base + '-s.jpg')]);
        return { image_url, thumb_url };
      },
      photoSize: { large: 2000, thumb: 700, quality: 0.86 },
      async rooms() {
        const c = await client();
        const rs = ok(await c.from('rooms').select('*, room_works(work_id)').eq('gallery', gal).order('created_at', { ascending: false }));
        return rs.map(r => ({ ...r, work_ids: (r.room_works || []).map(x => x.work_id) }));
      },
      async saveRoom(r, ids) {
        const c = await client();
        const row = { gallery: gal, slug: r.slug, title: r.title, for_name: r.for_name || null, message: r.message || null, expires: r.expires || null };
        const saved = r.id ? ok(await c.from('rooms').update(row).eq('id', r.id).select().single()) : ok(await c.from('rooms').insert(row).select().single());
        ok(await c.from('room_works').delete().eq('room_id', saved.id));
        if (ids.length) ok(await c.from('room_works').insert(ids.map(id => ({ room_id: saved.id, work_id: id }))));
        return { ...saved, work_ids: ids };
      },
      async deleteRoom(id) { const c = await client(); ok(await c.from('rooms').delete().eq('id', id)); },
      async stats() {
        const c = await client();
        const [w, r] = await Promise.all([c.rpc('work_stats', { gallery_slug: gal, days: 30 }), c.rpc('room_stats', { gallery_slug: gal })]);
        const works = {}, rooms = {};
        ok(w).forEach(x => { works[x.work_id] = { views: Number(x.views), enquiries: Number(x.enquiries) }; });
        ok(r).forEach(x => { rooms[x.room_id] = { opens: Number(x.opens), enquiries: Number(x.enquiries), last_open: x.last_open }; });
        return { works, rooms, sample: false };
      }
    };
  })();

  const DB = (cfg.supabaseUrl && cfg.supabaseKey && cfg.gallery) ? Live : Demo;

  /* ---------- State ---------- */
  const S = { tab: 'works', gallery: {}, works: [], rooms: [], stats: null, filter: 'all', q: '', editor: null };

  /* ---------- Helpers ---------- */
  let toastT = 0;
  function toast(msg, bad) {
    const t = $('#toast'); t.textContent = msg; t.classList.toggle('bad', !!bad); t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), bad ? 5000 : 2400);
  }
  const imgOf = (w, size = 200) => window.WalkArt.url({ id: w.id, w: Number(w.width_cm) || 60, h: Number(w.height_cm) || 80, art: w.art, image: w.image_url, thumb: w.thumb_url }, size);
  const sizeText = w => `${w.height_cm} × ${w.width_cm} cm`;
  const priceText = w => w.price_inr == null || w.price_inr === '' ? 'Price on request' : inr.format(w.price_inr);
  const today = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
  const roomOpen = r => !r.expires || r.expires >= today();
  const dateText = d => { const t = new Date(d + 'T12:00:00'); return isNaN(t) ? d : t.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); };
  const roomLink = r => `${siteURL}/?room=${encodeURIComponent(r.slug)}`;
  const slugify = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 32);
  const rand4 = () => Math.random().toString(36).slice(2, 6);
  const waShare = r => `https://wa.me/?text=${encodeURIComponent(`${S.gallery.name || ''}: a private viewing for you, ${r.title}. ${roomLink(r)}`)}`;
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast('Link copied'); }
    catch (e) { toast('Select the link and copy it'); }
  }
  async function run(btn, fn, okMsg) {
    const label = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    try { const r = await fn(); if (okMsg) toast(okMsg); return r; }
    catch (e) { toast(e.message || String(e), true); return undefined; }
    finally { if (btn) { btn.disabled = false; btn.textContent = label; } }
  }

  /* ---------- Photos ---------- */
  async function openImage(file) {
    if ('createImageBitmap' in window) { try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { /* fall back */ } }
    return new Promise((res, rej) => {
      const img = new Image(); const url = URL.createObjectURL(file);
      img.onload = () => res(img); img.onerror = () => rej(new Error('This file is not an image the browser can open. Use a JPG or PNG photo.'));
      img.src = url;
    });
  }
  async function makeJPEG(src, max, quality) {
    const W = src.width, H = src.height, s = Math.min(1, max / Math.max(W, H));
    const c = document.createElement('canvas'); c.width = Math.round(W * s); c.height = Math.round(H * s);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    return new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('Could not prepare the photo.')), 'image/jpeg', quality));
  }

  /* ---------- Views ---------- */
  const app = $('#app');

  function renderLogin(error = '') {
    const demo = DB.mode === 'demo';
    app.innerHTML = `<main class="login"><div class="login-card">
      <p class="muted">Walkthrough</p>
      <h1>Sign in to manage ${esc(cfg.name || 'your gallery')}</h1>
      ${demo ? `<p class="note">Demo mode. The database isn’t connected yet, so any email and password will do, and your changes are kept in this browser only.</p>` : ''}
      <form id="loginForm" novalidate>
        <label class="field"><span>Email</span><input id="email" type="email" autocomplete="username" required></label>
        <label class="field"><span>Password</span><input id="password" type="password" autocomplete="current-password" ${demo ? '' : 'required'}></label>
        ${error ? `<p class="error" role="alert">${esc(error)}</p>` : ''}
        <button class="btn primary" type="submit">Sign in</button>
      </form>
      <a class="link-btn" href="/">Back to the site</a>
    </div></main>`;
    $('#email').focus();
    $('#loginForm').addEventListener('submit', async e => {
      e.preventDefault();
      const email = $('#email').value.trim(), pw = $('#password').value;
      if (!email) { renderLogin('Enter your email.'); return; }
      const btn = e.submitter || $('#loginForm button');
      btn.disabled = true; btn.textContent = 'Signing in…';
      try { await DB.signIn(email, pw); await boot(); }
      catch (err) { renderLogin(err.message); $('#email').value = email; }
    });
  }

  function renderNoAccess(email) {
    app.innerHTML = `<main class="login"><div class="login-card">
      <h1>This login isn’t linked to a gallery yet</h1>
      <p class="muted">${esc(email)} signed in, but it has no access to “${esc(cfg.gallery)}”. Run add-gallery.sql in Supabase with this email, then sign in again.</p>
      <button class="btn" data-act="signout">Sign out</button>
    </div></main>`;
  }

  function shell() {
    const tabs = [['works', 'Works'], ['rooms', 'Private viewings'], ['activity', 'Activity'], ['gallery', 'Gallery details']];
    app.innerHTML = `<header class="top"><div class="wrap">
        <div class="top-row">
          <div class="who"><span class="g-name">${esc(S.gallery.name || cfg.name || 'Gallery')}</span><span class="muted">Admin</span></div>
          <div class="top-actions"><a class="link-btn" href="/" target="_blank" rel="noopener">View site</a><button class="link-btn" data-act="signout">Sign out</button></div>
        </div>
        <nav class="tabs" role="tablist" aria-label="Sections">${tabs.map(([k, l]) => `<button role="tab" data-tab="${k}" aria-selected="${S.tab === k}">${l}</button>`).join('')}</nav>
      </div></header>
      <div class="wrap">${DB.mode === 'demo' ? `<p class="banner">Demo mode: changes are saved in this browser only, and show on the site only in this browser. Connect the database (see README) to go live.</p>` : ''}</div>
      <main class="panel wrap" id="panel"></main>
      <div class="drawer-wrap" id="drawerWrap" hidden><div class="scrim" data-act="close-drawer"></div><aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="drawerTitle" id="drawer"></aside></div>`;
    renderPanel();
  }

  function renderPanel() {
    document.querySelectorAll('.tabs [data-tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === S.tab));
    const p = $('#panel');
    if (S.tab === 'works') p.innerHTML = worksView();
    else if (S.tab === 'rooms') p.innerHTML = roomsView();
    else if (S.tab === 'activity') { p.innerHTML = activityView(); if (!S.stats) loadStats(); }
    else p.innerHTML = galleryView();
  }

  /* Works */
  function worksView() {
    const q = S.q.toLowerCase();
    const list = S.works.filter(w =>
      (S.filter === 'all' || (S.filter === 'public' && w.is_public) || (S.filter === 'hidden' && !w.is_public) || (S.filter === 'sold' && w.status === 'sold')) &&
      (!q || (w.title + ' ' + w.artist).toLowerCase().includes(q)));
    const chips = [['all', 'All'], ['public', 'On the site'], ['hidden', 'Hidden'], ['sold', 'Sold']];
    const head = `<div class="toolbar">
        <input class="search" type="search" id="q" placeholder="Search by title or artist" value="${esc(S.q)}" aria-label="Search works">
        <div class="chips" role="group" aria-label="Show">${chips.map(([k, l]) => `<button class="chip" data-filter="${k}" aria-pressed="${S.filter === k}">${l}</button>`).join('')}</div>
        <button class="btn primary" data-act="new-work">Add work</button>
      </div>`;
    if (!S.works.length) return head + `<div class="empty-state"><h3>No works yet</h3><p>Add your first work with a photo, its size and price. It appears on the site straight away.</p><button class="btn primary" data-act="new-work">Add work</button></div>`;
    return head + `<p class="count">${list.length} of ${S.works.length} works</p>
      <ul class="rows">${list.map(w => `<li class="row" data-id="${esc(w.id)}">
        <img class="thumb" src="${imgOf(w)}" alt="" loading="lazy">
        <div class="row-main"><p class="row-title">${esc(w.title)}</p><p class="row-sub">${esc(w.artist)}, ${esc(sizeText(w))}, ${esc(priceText(w))}</p></div>
        <div class="row-controls">
          <select class="status" data-act="status" data-v="${esc(w.status)}" aria-label="Status of ${esc(w.title)}">
            ${['available', 'reserved', 'sold'].map(s => `<option value="${s}" ${w.status === s ? 'selected' : ''}>${s[0].toUpperCase() + s.slice(1)}</option>`).join('')}
          </select>
          <label class="switch"><input type="checkbox" data-act="public" ${w.is_public ? 'checked' : ''} aria-label="Show ${esc(w.title)} on the site">On site</label>
          <button class="btn" data-act="edit-work">Edit</button>
        </div></li>`).join('')}</ul>`;
  }

  function workEditor(w) {
    const isNew = !w.id;
    const rooms = S.rooms.map(r => `<label class="switch"><input type="checkbox" name="room" value="${esc(r.id)}" ${r.work_ids.includes(w.id) ? 'checked' : ''}>${esc(r.title)}${roomOpen(r) ? '' : ' (closed)'}</label>`).join('');
    const status = w.status || 'available';
    return `<div class="drawer-head"><h2 id="drawerTitle">${isNew ? 'Add a work' : 'Edit work'}</h2><button class="link-btn" data-act="close-drawer">Cancel</button></div>
      <form class="drawer-body" id="workForm" novalidate>
        <div class="drop" id="drop">
          ${w.image_url || w.art ? `<img id="dropImg" src="${imgOf(w, 800)}" alt="">` : `<p><strong>Add a photo</strong><br>Drop it here or tap to choose. JPG or PNG, straight-on and cropped to the edges of the work.</p>`}
          <input type="file" id="photo" accept="image/*" aria-label="Choose a photo">
        </div>
        <p class="hint" id="ratioHint" hidden></p>
        <label class="field"><span>Title</span><input id="f-title" value="${esc(w.title)}" required></label>
        <label class="field"><span>Artist</span><input id="f-artist" value="${esc(w.artist)}" required></label>
        <div class="grid2">
          <label class="field"><span>Year</span><input id="f-year" inputmode="numeric" value="${esc(w.year)}"></label>
          <label class="field"><span>Medium</span><input id="f-medium" value="${esc(w.medium)}" placeholder="Oil on canvas"></label>
        </div>
        <div class="grid2">
          <label class="field"><span>Height (cm)</span><input id="f-h" type="number" min="1" step="0.5" inputmode="decimal" value="${esc(w.height_cm)}" required></label>
          <label class="field"><span>Width (cm)</span><input id="f-w" type="number" min="1" step="0.5" inputmode="decimal" value="${esc(w.width_cm)}" required></label>
        </div>
        <label class="field"><span>Price (₹)</span><input id="f-price" type="number" min="0" step="1000" inputmode="numeric" value="${w.price_inr == null ? '' : esc(w.price_inr)}" placeholder="Leave empty for price on request"><small>Collectors trust listed prices. Leave empty only if you must.</small></label>
        <div class="field"><span>Status</span><div class="seg" role="group" aria-label="Status">${['available', 'reserved', 'sold'].map(s => `<button type="button" data-seg="${s}" aria-pressed="${status === s}">${s[0].toUpperCase() + s.slice(1)}</button>`).join('')}</div></div>
        <label class="field"><span>About the work</span><textarea id="f-desc" placeholder="Two or three sentences a collector would want to know">${esc(w.description)}</textarea></label>
        <label class="switch"><input type="checkbox" id="f-public" ${w.is_public !== false ? 'checked' : ''}>Show on the public site</label>
        ${S.rooms.length ? `<div class="field"><span>Private viewings</span><div style="display:grid;gap:10px">${rooms}</div></div>` : ''}
        <p class="error" id="formError" role="alert" hidden></p>
      </form>
      <div class="drawer-foot">
        ${isNew ? '' : '<button class="btn danger" data-act="delete-work">Delete</button>'}
        <div class="right"><button class="btn primary" data-act="save-work">${isNew ? 'Add work' : 'Save changes'}</button></div>
      </div>`;
  }

  /* Rooms */
  function roomsView() {
    const head = `<div class="toolbar"><p class="lede">Send a collector a link that shows only the works you choose, until a date you set. Hidden works can be included.</p><button class="btn primary" data-act="new-room">New private viewing</button></div>`;
    if (!S.rooms.length) return head + `<div class="empty-state"><h3>No private viewings yet</h3><p>Make one for a collector, pick the works, and send the link on WhatsApp.</p><button class="btn primary" data-act="new-room">New private viewing</button></div>`;
    const st = (S.stats && S.stats.rooms) || {};
    return head + `<ul class="cards">${S.rooms.map(r => {
      const open = roomOpen(r), ws = S.works.filter(w => r.work_ids.includes(w.id)), s = st[r.id];
      return `<li class="card" data-id="${esc(r.id)}">
        <div class="card-head"><h3>${esc(r.title)}</h3><span class="pill ${open ? 'open' : 'closed'}">${open ? (r.expires ? 'Open until ' + dateText(r.expires) : 'Open') : 'Closed ' + dateText(r.expires)}</span></div>
        <p class="muted">${r.for_name ? 'For ' + esc(r.for_name) + '. ' : ''}${ws.length} ${ws.length === 1 ? 'work' : 'works'}.${s ? ` Opened ${s.opens} ${s.opens === 1 ? 'time' : 'times'}, ${s.enquiries} ${s.enquiries === 1 ? 'enquiry' : 'enquiries'}.` : ''}</p>
        <div class="minis">${ws.slice(0, 8).map(w => `<img src="${imgOf(w, 120)}" alt="${esc(w.title)}" title="${esc(w.title)}">`).join('')}</div>
        <div class="linkbox"><input readonly value="${esc(roomLink(r))}" aria-label="Link for ${esc(r.title)}"><button class="btn" data-act="copy-link">Copy</button></div>
        <div class="card-actions">
          <a class="btn" href="${waShare(r)}" target="_blank" rel="noopener">Send on WhatsApp</a>
          <a class="btn" href="${esc(roomLink(r))}" target="_blank" rel="noopener">Preview</a>
          <button class="btn" data-act="edit-room">Edit</button>
        </div></li>`;
    }).join('')}</ul>`;
  }

  function roomEditor(r) {
    const isNew = !r.id;
    const defaultExp = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
    return `<div class="drawer-head"><h2 id="drawerTitle">${isNew ? 'New private viewing' : 'Edit private viewing'}</h2><button class="link-btn" data-act="close-drawer">Cancel</button></div>
      <form class="drawer-body" id="roomForm" novalidate>
        <label class="field"><span>Title</span><input id="r-title" value="${esc(r.title)}" placeholder="Autumn selection" required></label>
        <label class="field"><span>For</span><input id="r-for" value="${esc(r.for_name)}" placeholder="the Mehra family"><small>Shown as “for the Mehra family”.</small></label>
        <label class="field"><span>Message</span><textarea id="r-msg" placeholder="A short note to the collector">${esc(r.message)}</textarea></label>
        <label class="field"><span>Open until</span><input id="r-exp" type="date" value="${esc(isNew ? defaultExp : (r.expires || ''))}"><small>After this date the link shows “This viewing has closed”. Leave empty to keep it open.</small></label>
        <label class="field"><span>Link name</span><div class="prefix"><span>?room=</span><input id="r-slug" value="${esc(r.slug)}" ${isNew ? 'data-auto="1"' : ''} autocapitalize="off" spellcheck="false"></div><small>Letters, numbers and dashes. The random ending makes it hard to guess.</small></label>
        <div class="field"><span>Works <em class="muted" id="pickCount"></em></span>
          <div class="picker">${S.works.map(w => `<label class="pick"><input type="checkbox" name="pick" value="${esc(w.id)}" ${r.work_ids && r.work_ids.includes(w.id) ? 'checked' : ''}><img src="${imgOf(w, 240)}" alt=""><span>${esc(w.title)}</span><em>${w.is_public ? esc(priceText(w)) : 'Hidden from site'}</em></label>`).join('')}</div>
        </div>
        <p class="error" id="formError" role="alert" hidden></p>
      </form>
      <div class="drawer-foot">
        ${isNew ? '' : '<button class="btn danger" data-act="delete-room">Delete</button>'}
        <div class="right"><button class="btn primary" data-act="save-room">${isNew ? 'Create link' : 'Save changes'}</button></div>
      </div>`;
  }

  /* Activity */
  async function loadStats() {
    try { S.stats = await DB.stats(); } catch (e) { toast(e.message, true); S.stats = { works: {}, rooms: {}, sample: false }; }
    if (S.tab === 'activity' || S.tab === 'rooms') renderPanel();
  }
  function activityView() {
    if (!S.stats) return '<p class="muted">Loading activity…</p>';
    const W = S.stats.works, R = S.stats.rooms;
    const views = Object.values(W).reduce((a, x) => a + x.views, 0), enq = Object.values(W).reduce((a, x) => a + x.enquiries, 0), opens = Object.values(R).reduce((a, x) => a + x.opens, 0);
    const rows = S.works.map(w => ({ w, s: W[w.id] || { views: 0, enquiries: 0 } })).sort((a, b) => b.s.enquiries - a.s.enquiries || b.s.views - a.s.views);
    const max = Math.max(1, ...rows.map(r => r.s.views));
    return `${S.stats.sample ? '<p class="note" style="margin-bottom:16px">Sample numbers for the demo. Real activity appears once the database is connected.</p>' : ''}
      <div class="figures">
        <div class="figure"><b>${views}</b><span>Work views, last 30 days</span></div>
        <div class="figure"><b>${enq}</b><span>WhatsApp enquiries started</span></div>
        <div class="figure"><b>${opens}</b><span>Private viewings opened</span></div>
      </div>
      <h2 class="section">Works by interest</h2>
      <div class="table-wrap"><table><thead><tr><th>Work</th><th class="num">Views</th><th style="width:30%"></th><th class="num">Enquiries</th></tr></thead><tbody>
      ${rows.map(({ w, s }) => `<tr><td><div class="cell-work"><img src="${imgOf(w, 120)}" alt=""><span><i>${esc(w.title)}</i><br><span class="muted">${esc(w.artist)}</span></span></div></td>
        <td class="num">${s.views}</td><td><div class="bar" style="width:${(s.views / max * 100).toFixed(1)}%"></div></td><td class="num">${s.enquiries}</td></tr>`).join('')}
      </tbody></table></div>
      ${S.rooms.length ? `<h2 class="section">Private viewings</h2><div class="table-wrap"><table><thead><tr><th>Viewing</th><th class="num">Opened</th><th class="num">Enquiries</th><th class="num">Last opened</th></tr></thead><tbody>
        ${S.rooms.map(r => { const s = R[r.id] || { opens: 0, enquiries: 0 }; return `<tr><td>${esc(r.title)}${r.for_name ? `<br><span class="muted">${esc(r.for_name)}</span>` : ''}</td><td class="num">${s.opens}</td><td class="num">${s.enquiries}</td><td class="num">${s.last_open ? new Date(s.last_open).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : 'Not yet'}</td></tr>`; }).join('')}
      </tbody></table></div>` : ''}`;
  }

  /* Gallery details */
  function galleryView() {
    const g = S.gallery;
    const f = (id, label, val, extra = '', hint = '') => `<label class="field"><span>${label}</span><input id="${id}" value="${esc(val)}" ${extra}>${hint ? `<small>${hint}</small>` : ''}</label>`;
    return `<form class="form-narrow" id="galleryForm" novalidate>
      ${f('g-name', 'Gallery name', g.name, 'required')}
      <div class="grid2">${f('g-city', 'City', g.city)}${f('g-instagram', 'Instagram handle', g.instagram, 'autocapitalize="off"')}</div>
      ${f('g-address', 'Address', g.address)}
      <div class="grid2">${f('g-whatsapp', 'WhatsApp number', g.whatsapp, 'inputmode="tel"', 'With country code, e.g. 919876543210')}${f('g-email', 'Email', g.email, 'type="email"')}</div>
      <h2 class="section" style="margin:12px 0 0">Current exhibition</h2>
      ${f('g-ex-title', 'Title', g.exhibition_title)}
      ${f('g-ex-dates', 'Dates', g.exhibition_dates, '', 'Written as you want it shown, e.g. On view 14 November to 20 December 2026')}
      <label class="field"><span>Introduction</span><textarea id="g-ex-lede">${esc(g.exhibition_lede)}</textarea></label>
      <div><button class="btn primary" data-act="save-gallery" type="button">Save details</button></div>
    </form>`;
  }

  /* ---------- Drawer ---------- */
  let lastFocus = null;
  function openDrawer(html) {
    lastFocus = document.activeElement;
    const wrap = $('#drawerWrap'), d = $('#drawer');
    d.innerHTML = html; wrap.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('shown')));
    const first = d.querySelector('input:not([type=file]), textarea'); if (first) setTimeout(() => first.focus({ preventScroll: true }), 60);
  }
  function closeDrawer() {
    const wrap = $('#drawerWrap'); if (!wrap || wrap.hidden) return;
    wrap.classList.remove('shown'); S.editor = null;
    document.documentElement.style.overflow = '';
    setTimeout(() => { wrap.hidden = true; $('#drawer').innerHTML = ''; }, 340);
    if (lastFocus && lastFocus.isConnected) lastFocus.focus({ preventScroll: true });
  }
  function formError(msg) { const e = $('#formError'); if (!e) return; e.textContent = msg; e.hidden = !msg; if (msg) e.scrollIntoView({ block: 'nearest' }); }

  function editWork(w) {
    S.editor = { kind: 'work', work: { ...w }, file: null, status: w.status || 'available' };
    openDrawer(workEditor(w));
  }
  async function choosePhoto(file) {
    if (!file) return;
    if (!/^image\//.test(file.type) && !/\.(jpe?g|png|webp|heic)$/i.test(file.name)) { formError('Choose a photo file (JPG or PNG).'); return; }
    try {
      const img = await openImage(file);
      S.editor.file = file; S.editor.ratio = img.width / img.height;
      const url = URL.createObjectURL(file);
      const drop = $('#drop'); drop.querySelector('p, img') && drop.querySelector('p, img').remove();
      drop.insertAdjacentHTML('afterbegin', `<img id="dropImg" src="${url}" alt="Chosen photo">`);
      formError(''); checkRatio();
    } catch (e) { formError(e.message); }
  }
  function checkRatio() {
    const hint = $('#ratioHint'); if (!hint || !S.editor || !S.editor.ratio) return;
    const w = Number($('#f-w').value), h = Number($('#f-h').value);
    if (!(w > 0 && h > 0)) { hint.hidden = true; return; }
    const diff = Math.abs(Math.log((w / h) / S.editor.ratio));
    hint.hidden = diff < 0.12;
    hint.textContent = S.editor.ratio > w / h ? 'The photo is wider than the size typed. Check width and height, or crop the photo to the edges of the work.' : 'The photo is taller than the size typed. Check width and height, or crop the photo to the edges of the work.';
  }
  async function saveWork(btn) {
    const E = S.editor, v = id => $(id).value.trim();
    const row = {
      ...E.work, title: v('#f-title'), artist: v('#f-artist'), year: v('#f-year'), medium: v('#f-medium'),
      width_cm: Number(v('#f-w')), height_cm: Number(v('#f-h')),
      price_inr: v('#f-price') === '' ? null : Number(v('#f-price')), status: E.status,
      description: v('#f-desc'), is_public: $('#f-public').checked
    };
    document.querySelectorAll('#workForm .field').forEach(f => f.classList.remove('invalid'));
    const missing = [['#f-title', row.title], ['#f-artist', row.artist], ['#f-w', row.width_cm > 0], ['#f-h', row.height_cm > 0]].filter(([, ok]) => !ok);
    if (missing.length) { missing.forEach(([id]) => $(id).closest('.field').classList.add('invalid')); formError('Fill in the title, artist, and height and width in centimetres.'); return; }
    const roomIds = [...document.querySelectorAll('#workForm input[name=room]:checked')].map(i => i.value);
    await run(btn, async () => {
      if (E.file) {
        btn.textContent = 'Uploading photo…';
        const img = await openImage(E.file), sz = DB.photoSize;
        const [large, thumb] = await Promise.all([makeJPEG(img, sz.large, sz.quality), makeJPEG(img, sz.thumb, sz.quality)]);
        Object.assign(row, await DB.uploadImage(large, thumb));
        delete row.art;
      }
      const saved = await DB.saveWork(row);
      const i = S.works.findIndex(w => w.id === saved.id);
      if (i < 0) S.works.push(saved); else S.works[i] = saved;
      // keep private viewings in step with the checkboxes
      for (const r of S.rooms) {
        const has = r.work_ids.includes(saved.id), want = roomIds.includes(r.id);
        if (has !== want) {
          const ids = want ? [...r.work_ids, saved.id] : r.work_ids.filter(x => x !== saved.id);
          Object.assign(r, await DB.saveRoom(r, ids));
        }
      }
      closeDrawer(); renderPanel();
      toast(E.work.id ? 'Saved' : 'Work added');
    });
  }

  function editRoom(r) {
    S.editor = { kind: 'room', room: { ...r, work_ids: [...(r.work_ids || [])] } };
    openDrawer(roomEditor(S.editor.room));
    updatePickCount();
    if (!r.id) autoSlug();
  }
  function autoSlug() {
    const s = $('#r-slug'); if (!s || !s.dataset.auto) return;
    const base = slugify($('#r-for').value.replace(/^the\s+/i, '') || $('#r-title').value) || 'viewing';
    s.value = `${base}-${S.editor.rand || (S.editor.rand = rand4())}`;
  }
  function updatePickCount() { const n = document.querySelectorAll('#roomForm input[name=pick]:checked').length; const el = $('#pickCount'); if (el) el.textContent = `(${n} chosen)`; }
  async function saveRoom(btn) {
    const v = id => $(id).value.trim();
    const r = { ...S.editor.room, title: v('#r-title'), for_name: v('#r-for'), message: v('#r-msg'), expires: v('#r-exp') || null, slug: slugify(v('#r-slug')) };
    const ids = [...document.querySelectorAll('#roomForm input[name=pick]:checked')].map(i => i.value);
    if (!r.title) { $('#r-title').closest('.field').classList.add('invalid'); formError('Give the viewing a title.'); return; }
    if (!r.slug) { formError('Give the link a name, for example mehra-7k2p.'); return; }
    if (!ids.length) { formError('Choose at least one work.'); return; }
    await run(btn, async () => {
      const saved = await DB.saveRoom(r, ids);
      const i = S.rooms.findIndex(x => x.id === saved.id);
      if (i < 0) S.rooms.unshift(saved); else S.rooms[i] = saved;
      closeDrawer(); renderPanel();
      toast(r.id ? 'Saved' : 'Private viewing created. Copy the link or send it on WhatsApp.');
    });
  }

  function armDelete(btn, fn) {
    if (btn.classList.contains('armed')) { fn(); return; }
    btn.classList.add('armed'); btn.textContent = 'Click again to delete';
    setTimeout(() => { if (btn.isConnected) { btn.classList.remove('armed'); btn.textContent = 'Delete'; } }, 4000);
  }

  /* ---------- Events ---------- */
  document.addEventListener('click', async e => {
    const t = e.target.closest('[data-act], [data-tab], [data-filter], [data-seg]');
    if (!t) return;
    if (t.dataset.tab) { S.tab = t.dataset.tab; renderPanel(); return; }
    if (t.dataset.filter) { S.filter = t.dataset.filter; renderPanel(); return; }
    if (t.dataset.seg) { S.editor.status = t.dataset.seg; t.parentElement.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b === t)); return; }
    const act = t.dataset.act, row = t.closest('[data-id]'), id = row && row.dataset.id;
    switch (act) {
      case 'signout': await DB.signOut(); renderLogin(); break;
      case 'new-work': editWork({ title: '', artist: '', year: String(new Date().getFullYear()), medium: '', width_cm: '', height_cm: '', price_inr: null, status: 'available', description: '', is_public: true }); break;
      case 'edit-work': editWork(S.works.find(w => w.id === id)); break;
      case 'save-work': e.preventDefault(); await saveWork(t); break;
      case 'delete-work': armDelete(t, () => run(t, async () => {
        const wid = S.editor.work.id; await DB.deleteWork(wid);
        S.works = S.works.filter(w => w.id !== wid); S.rooms.forEach(r => { r.work_ids = r.work_ids.filter(x => x !== wid); });
        closeDrawer(); renderPanel();
      }, 'Work deleted')); break;
      case 'new-room': editRoom({ title: '', for_name: '', message: '', expires: '', slug: '', work_ids: [] }); break;
      case 'edit-room': editRoom(S.rooms.find(r => r.id === id)); break;
      case 'save-room': e.preventDefault(); await saveRoom(t); break;
      case 'delete-room': armDelete(t, () => run(t, async () => {
        const rid = S.editor.room.id; await DB.deleteRoom(rid); S.rooms = S.rooms.filter(r => r.id !== rid); closeDrawer(); renderPanel();
      }, 'Private viewing deleted')); break;
      case 'copy-link': copy(row.querySelector('.linkbox input').value); break;
      case 'close-drawer': closeDrawer(); break;
      case 'save-gallery': {
        const v = i => $(i).value.trim();
        const g = { name: v('#g-name'), city: v('#g-city'), address: v('#g-address'), whatsapp: v('#g-whatsapp').replace(/\D/g, ''), email: v('#g-email'), instagram: v('#g-instagram').replace(/^@/, ''),
          exhibition_title: v('#g-ex-title'), exhibition_dates: v('#g-ex-dates'), exhibition_lede: v('#g-ex-lede') };
        if (!g.name) { toast('The gallery needs a name.', true); return; }
        const saved = await run(t, () => DB.saveGallery(g), 'Details saved');
        if (saved) { S.gallery = saved; $('.g-name').textContent = saved.name; }
        break;
      }
    }
  });
  document.addEventListener('change', async e => {
    const t = e.target;
    if (t.id === 'photo') { choosePhoto(t.files[0]); return; }
    if (t.name === 'pick') { updatePickCount(); return; }
    const row = t.closest('.row[data-id]'); if (!row) return;
    const w = S.works.find(x => x.id === row.dataset.id); if (!w) return;
    if (t.dataset.act === 'status') {
      t.dataset.v = t.value;
      const saved = await run(null, () => DB.saveWork({ ...w, status: t.value }), t.value === 'sold' ? 'Marked sold. The red dot is on the site.' : 'Status updated');
      if (saved) Object.assign(w, saved); else { t.value = w.status; t.dataset.v = w.status; }
    }
    if (t.dataset.act === 'public') {
      const saved = await run(null, () => DB.saveWork({ ...w, is_public: t.checked }), t.checked ? 'Shown on the site' : 'Hidden from the site');
      if (saved) Object.assign(w, saved); else t.checked = w.is_public;
    }
  });
  document.addEventListener('input', e => {
    if (e.target.id === 'q') { S.q = e.target.value; const pos = e.target.selectionStart; renderPanel(); const q = $('#q'); q.focus(); q.setSelectionRange(pos, pos); }
    if (e.target.id === 'f-w' || e.target.id === 'f-h') checkRatio();
    if (e.target.id === 'r-title' || e.target.id === 'r-for') autoSlug();
    if (e.target.id === 'r-slug') delete e.target.dataset.auto;
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });
  // Drag a photo onto the drop zone.
  document.addEventListener('dragover', e => { const d = e.target.closest && e.target.closest('#drop'); if (d) { e.preventDefault(); d.classList.add('over'); } });
  document.addEventListener('dragleave', e => { const d = e.target.closest && e.target.closest('#drop'); if (d) d.classList.remove('over'); });
  document.addEventListener('drop', e => { const d = e.target.closest && e.target.closest('#drop'); if (d) { e.preventDefault(); d.classList.remove('over'); choosePhoto(e.dataTransfer.files[0]); } });

  /* ---------- Start ---------- */
  async function boot() {
    try {
      const s = await DB.session();
      if (!s) { renderLogin(); return; }
      if (!(await DB.isMember())) { renderNoAccess(s.email); return; }
      app.innerHTML = '<p class="loading">Loading your gallery…</p>';
      [S.gallery, S.works, S.rooms] = await Promise.all([DB.gallery(), DB.works(), DB.rooms()]);
      shell();
      loadStats();
    } catch (e) {
      app.innerHTML = `<main class="login"><div class="login-card"><h1>Couldn’t open the dashboard</h1><p class="muted">${esc(e.message)}</p><button class="btn" onclick="location.reload()">Try again</button></div></main>`;
    }
  }
  boot();
})();
