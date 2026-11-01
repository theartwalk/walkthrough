/* Walkthrough gallery viewer. Plain JavaScript, no build step. */
(() => {
  'use strict';

  const cfg = window.GALLERY || {};
  let works = (window.SAMPLE_WORKS || []).slice();
  const $ = (s, r = document) => r.querySelector(s);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const wide = matchMedia('(min-width: 900px)');
  const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
  const PEEK = 176;       // visible height of the details sheet on phones
  const SIDE = 412;       // width taken by the details panel on wide screens
  const GAP = 24;         // space between slides in the viewer

  /* ---------- Storage (per viewer, best effort) ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
  };
  const savedKey = 'walkthrough-saved-' + (cfg.slug || 'demo');
  const saved = new Set(store.get(savedKey, []));

  /* ---------- Physics helpers ---------- */
  // A spring described the way Apple does: response (seconds) and damping ratio.
  class Spring {
    constructor(value = 0, { response = 0.4, damping = 1, precision = 0.5 } = {}) {
      this.value = value; this.target = value; this.velocity = 0;
      this.response = response; this.damping = damping; this.precision = precision;
      this.raf = 0; this.onUpdate = null; this.onRest = null;
      this.tick = this.tick.bind(this);
    }
    to(target, opts = {}) {
      this.target = target;
      if (opts.velocity !== undefined) this.velocity = opts.velocity;
      if (opts.response !== undefined) this.response = opts.response;
      if (opts.damping !== undefined) this.damping = opts.damping;
      this.onRest = opts.onRest || null;
      if (reduceMotion.matches) { this.finish(); return; }
      if (!this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame(this.tick); }
    }
    tick(now) {
      const dt = Math.min((now - this.last) / 1000, 1 / 30); this.last = now;
      const k = Math.pow((2 * Math.PI) / this.response, 2);
      const c = (4 * Math.PI * this.damping) / this.response;
      const steps = 4, h = dt / steps;
      for (let i = 0; i < steps; i++) {
        const a = -k * (this.value - this.target) - c * this.velocity;
        this.velocity += a * h; this.value += this.velocity * h;
      }
      if (Math.abs(this.value - this.target) < this.precision && Math.abs(this.velocity) < this.precision * 10) { this.finish(); return; }
      if (this.onUpdate) this.onUpdate(this.value);
      this.raf = requestAnimationFrame(this.tick);
    }
    finish() {
      this.stop(); this.value = this.target; this.velocity = 0;
      if (this.onUpdate) this.onUpdate(this.value);
      const cb = this.onRest; this.onRest = null; if (cb) cb();
    }
    stop() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; }
    jump(v) { this.stop(); this.value = v; this.target = v; this.velocity = 0; this.onRest = null; if (this.onUpdate) this.onUpdate(v); }
    get moving() { return !!this.raf; }
  }

  function velocityTracker() {
    const pts = [];
    return {
      add(x, y, t) { pts.push({ x, y, t }); while (pts.length > 2 && t - pts[0].t > 100) pts.shift(); },
      velocity() {
        if (pts.length < 2) return { x: 0, y: 0 };
        const a = pts[0], b = pts[pts.length - 1], dt = Math.max((b.t - a.t) / 1000, 1 / 120);
        return { x: (b.x - a.x) / dt, y: (b.y - a.y) / dt };
      },
      reset() { pts.length = 0; }
    };
  }
  // Where a flick would come to rest (Apple's projection, scroll-like deceleration).
  const project = (v, d = 0.998) => (v / 1000) * d / (1 - d);
  // Soft resistance past an edge.
  const rubber = (over, dim, c = 0.55) => Math.sign(over) * (Math.abs(over) * dim * c) / (dim + c * Math.abs(over));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ---------- Generated artwork images (demo only) ---------- */
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function archPath(ctx, x, y, w, h) {
    const r = w / 2; ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, y + r);
    ctx.arc(x + r, y + r, r, Math.PI, 0); ctx.lineTo(x + w, y + h); ctx.closePath();
  }
  function softRect(ctx, x, y, w, h, color, f) {
    ctx.fillStyle = color;
    for (let i = 0; i < 9; i++) { const e = f * (1 - i / 8); ctx.globalAlpha = 0.13; ctx.fillRect(x - e, y - e, w + 2 * e, h + 2 * e); }
    ctx.globalAlpha = 0.6; ctx.fillRect(x + f * 0.5, y + f * 0.5, w - f, h - f); ctx.globalAlpha = 1;
  }
  function paint(ctx, W, H, art) {
    const r = rng(art.seed || 1), P = art.palette, u = Math.min(W, H) / 100;
    const ink = () => P[1 + Math.floor(r() * (P.length - 1))];
    ctx.fillStyle = P[0]; ctx.fillRect(0, 0, W, H);
    if (art.kind === 'field') {
      const n = 2 + Math.floor(r() * 2), m = W * 0.08, total = H * 0.86, gap = H * 0.035, hs = [];
      let sum = 0; for (let i = 0; i < n; i++) { const v = 0.6 + r(); hs.push(v); sum += v; }
      let y = H * 0.07;
      hs.forEach((v, i) => { const h = (total - gap * (n - 1)) * v / sum; softRect(ctx, m, y, W - 2 * m, h, P[1 + (i % (P.length - 1))], u * 2.4); y += h + gap; });
    } else if (art.kind === 'grid') {
      const cols = 3 + Math.floor(r() * 3), rows = Math.max(2, Math.round(cols * H / W)), g = u * 1.4;
      const cw = (W - g * (cols + 1)) / cols, ch = (H - g * (rows + 1)) / rows;
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        if (r() < 0.16) continue;
        ctx.fillStyle = ink(); ctx.globalAlpha = 0.82 + r() * 0.18;
        const x = g + i * (cw + g), y = g + j * (ch + g);
        if (r() < 0.22) { ctx.beginPath(); ctx.arc(x + cw / 2, y + ch / 2, Math.min(cw, ch) / 2, 0, Math.PI * 2); ctx.fill(); }
        else ctx.fillRect(x, y, cw, ch);
      }
      ctx.globalAlpha = 1;
    } else if (art.kind === 'lines') {
      ctx.lineCap = 'round';
      const n = 70 + Math.floor(r() * 50), step = H / n;
      for (let i = 0; i < n; i++) {
        ctx.strokeStyle = ink(); ctx.globalAlpha = 0.45 + r() * 0.5; ctx.lineWidth = u * (0.12 + r() * 0.35);
        const y0 = step * (i + 0.5), amp = u * (1 + r() * 4), f = (1 + r() * 2.5) * Math.PI * 2 / W, ph = r() * 6;
        ctx.beginPath();
        for (let x = W * 0.06, first = true; x <= W * 0.94; x += W / 90, first = false) {
          const y = y0 + Math.sin(x * f + ph) * amp + Math.sin(x * f * 2.3 + ph * 1.7) * amp * 0.35;
          if (first) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (art.kind === 'bindu') {
      const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.44, rings = 7 + Math.floor(r() * 4);
      for (let i = rings; i > 0; i--) { ctx.fillStyle = P[1 + (i % (P.length - 2))]; ctx.beginPath(); ctx.arc(cx, cy, R * i / rings, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = P[P.length - 1]; ctx.beginPath(); ctx.arc(cx, cy, R * 0.05, 0, Math.PI * 2); ctx.fill();
    } else if (art.kind === 'arch') {
      const n = 2 + Math.floor(r() * 2), g = W * 0.07, aw = (W - g * (n + 1)) / n, base = H * 0.9;
      for (let i = 0; i < n; i++) {
        const x = g + i * (aw + g), top = H * (0.14 + r() * 0.12);
        for (let k = 0; k < 3; k++) { const ins = k * aw * 0.13; ctx.fillStyle = P[1 + ((i + k) % (P.length - 1))]; archPath(ctx, x + ins, top + ins, aw - 2 * ins, base - top - ins); ctx.fill(); }
      }
    }
    // Paper and canvas tooth.
    const grains = Math.round(W * H / 90);
    for (let i = 0; i < grains; i++) { ctx.fillStyle = r() < 0.5 ? '#000' : '#fff'; ctx.globalAlpha = 0.035; ctx.fillRect(r() * W, r() * H, 1.2, 1.2); }
    ctx.globalAlpha = 1;
  }
  const imgCache = new Map();
  function artURL(w, longEdge) {
    if (w.image) return w.image;
    const key = w.id + '@' + longEdge;
    if (imgCache.has(key)) return imgCache.get(key);
    const ratio = w.w / w.h, c = document.createElement('canvas');
    c.width = ratio >= 1 ? longEdge : Math.round(longEdge * ratio);
    c.height = ratio >= 1 ? Math.round(longEdge / ratio) : longEdge;
    paint(c.getContext('2d'), c.width, c.height, w.art || { kind: 'field', seed: 1, palette: ['#E6E0D2', '#888', '#555'] });
    const url = c.toDataURL('image/jpeg', 0.88);
    imgCache.set(key, url);
    return url;
  }

  /* ---------- Formatting ---------- */
  const sizeText = w => `${w.h} × ${w.w} cm`;
  const priceText = w => w.status === 'sold' ? 'Sold' : (w.price == null ? 'Price on request' : inr.format(w.price));
  const statusText = w => ({ available: 'Available', sold: 'Sold', reserved: 'Reserved' })[w.status] || 'Available';
  const dotFor = w => w.status === 'sold' ? '<span class="dot" title="Sold"></span>' : (w.status === 'reserved' ? '<span class="dot half" title="Reserved"></span>' : '');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  const workURL = w => location.origin + location.pathname + '#work=' + encodeURIComponent(w.id);
  function waLink(text) { return `https://wa.me/${(cfg.whatsapp || '').replace(/\D/g, '')}?text=${encodeURIComponent(text)}`; }
  function enquiryText(w) {
    return `Hello ${cfg.name || ''}, I'm interested in "${w.title}" by ${w.artist} (${sizeText(w)}, ${w.year}). Is it available? ${workURL(w)}`;
  }

  /* ---------- Toast ---------- */
  let toastTimer = 0;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  /* ---------- Page chrome ---------- */
  function fillPage() {
    const ex = cfg.exhibition || {};
    document.title = `${ex.title ? ex.title + ', ' : ''}${cfg.name || 'Gallery'}`;
    $('#brand').textContent = cfg.name || 'Gallery';
    $('#introWhere').textContent = [cfg.name, cfg.city].filter(Boolean).join(', ');
    $('#showTitle').textContent = ex.title || 'Current works';
    $('#showDates').textContent = ex.dates || '';
    $('#showLede').textContent = ex.lede || '';
    $('#footName').textContent = cfg.name || '';
    $('#footAddress').textContent = cfg.address || '';
    const links = [];
    links.push(`<a href="${waLink(`Hello ${cfg.name || ''}, I'd like to know more about your current exhibition.`)}" target="_blank" rel="noopener">WhatsApp</a>`);
    if (cfg.email) links.push(`<a href="mailto:${esc(cfg.email)}">${esc(cfg.email)}</a>`);
    if (cfg.instagram) links.push(`<a href="https://www.instagram.com/${esc(cfg.instagram)}/" target="_blank" rel="noopener">Instagram</a>`);
    $('#footLinks').innerHTML = links.join('');
    $('#barEnquire').href = waLink(`Hello ${cfg.name || ''}, I'd like to know more about your current exhibition.`);
    const bar = $('#bar');
    addEventListener('scroll', () => bar.classList.toggle('scrolled', scrollY > 8), { passive: true });
  }

  /* ---------- Saved ---------- */
  function toggleSaved(id) {
    if (saved.has(id)) saved.delete(id); else saved.add(id);
    store.set(savedKey, [...saved]);
    syncSaved();
    toast(saved.has(id) ? 'Saved' : 'Removed from saved');
  }
  function syncSaved() {
    $('#savedCount').textContent = saved.size;
    document.querySelectorAll('.save[data-id]').forEach(b => b.setAttribute('aria-pressed', saved.has(b.dataset.id)));
    if (isOpen || prog.moving) $('#vSave').setAttribute('aria-pressed', saved.has(list[cur] && list[cur].id));
    if (filter === 'saved') renderGrid();
  }

  /* ---------- Grid ---------- */
  let filter = 'all';
  let gridList = [];
  const heart = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';
  function renderGrid() {
    gridList = works.filter(w =>
      filter === 'all' ? true :
      filter === 'available' ? w.status === 'available' :
      filter === 'under2' ? (w.status !== 'sold' && w.price != null && w.price < 200000) :
      saved.has(w.id));
    $('#grid').innerHTML = gridList.map(w => {
      const ratio = w.w / w.h, tw = 600, th = Math.round(tw / ratio);
      return `<li class="card">
        <button class="card-open" type="button" data-id="${esc(w.id)}" aria-label="Open ${esc(w.title)} by ${esc(w.artist)}">
          <img src="${artURL(w, 640)}" width="${tw}" height="${th}" alt="${esc(w.title)} by ${esc(w.artist)}" loading="lazy" decoding="async">
        </button>
        <div class="card-meta">
          <div>
            <p class="card-title"><cite>${esc(w.title)}</cite>, ${esc(w.year)}</p>
            <p class="card-artist">${esc(w.artist)}</p>
            <p class="card-price">${dotFor(w)}${esc(priceText(w))}<span aria-hidden="true">&nbsp;</span>${esc(sizeText(w))}</p>
          </div>
          <button class="save" type="button" data-id="${esc(w.id)}" aria-pressed="${saved.has(w.id)}" aria-label="Save ${esc(w.title)}">${heart}</button>
        </div>
      </li>`;
    }).join('');
    $('#empty').hidden = !(filter === 'saved' && gridList.length === 0);
  }
  function setFilter(f) {
    filter = f;
    document.querySelectorAll('#filters .chip').forEach(c => c.setAttribute('aria-pressed', c.dataset.filter === f));
    $('#savedBtn').setAttribute('aria-pressed', f === 'saved');
    renderGrid();
  }

  /* ---------- The wall, to scale ---------- */
  const personSVG = '<path d="M25 24c-10 0-15 6-16 16l-4 52h8l3-34 2 110h7l3-70 3 70h7l2-110 3 34h8l-4-52c-1-10-6-16-16-16z"/><circle cx="25" cy="12" r="10"/>';
  function renderWall() {
    const inner = $('#wallInner'), H = inner.clientHeight, floor = 10;
    const ppc = (H - floor) / 290;               // the wall shows 290 cm of height
    const Y = cm => H - floor - cm * ppc;        // height above floor -> px from top
    let x = Math.max(48 * ppc, 150), html = '';
    html += `<div class="eye-line" style="top:${Y(150)}px"><span class="eye-label">Eye level, 150 cm</span></div>`;
    html += `<svg class="wall-person" viewBox="0 0 50 172" preserveAspectRatio="none" style="left:${x}px;width:${50 * ppc}px;height:${172 * ppc}px" aria-hidden="true">${personSVG}</svg>`;
    x += 50 * ppc + 70 * ppc;
    works.forEach(w => {
      const ww = w.w * ppc, hh = w.h * ppc, top = Y(150) - hh / 2;
      html += `<button class="wall-work" type="button" data-id="${esc(w.id)}" style="left:${x}px;top:${top}px;width:${ww}px;height:${hh}px" aria-label="Open ${esc(w.title)} by ${esc(w.artist)}, ${esc(sizeText(w))}">
        <img src="${artURL(w, 640)}" alt="" draggable="false"></button>
        <div class="wall-label" style="left:${x}px;top:${top + hh + 10}px"><cite>${esc(w.title)}</cite><br>${esc(w.artist)}</div>`;
      x += ww + Math.max(70 * ppc, 120);
    });
    inner.style.width = (x + 40) + 'px';
    inner.innerHTML = html;
  }
  // Drag the wall with a mouse, with momentum. Touch uses native scrolling.
  function bindWallDrag() {
    const wall = $('#wall'), vt = velocityTracker(), sx = new Spring(0, { response: 0.6, damping: 1, precision: 0.5 });
    sx.onUpdate = v => { wall.scrollLeft = v; };
    let d = null; let suppressClick = false;
    wall.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      sx.stop(); d = { x0: e.clientX, s0: wall.scrollLeft, moved: false }; vt.reset(); vt.add(e.clientX, 0, e.timeStamp);
    });
    addEventListener('pointermove', e => {
      if (!d) return; const dx = e.clientX - d.x0;
      if (!d.moved && Math.abs(dx) < 6) return;
      if (!d.moved) { d.moved = true; wall.classList.add('dragging'); }
      vt.add(e.clientX, 0, e.timeStamp);
      const max = wall.scrollWidth - wall.clientWidth; let s = d.s0 - dx;
      wall.scrollLeft = clamp(s, 0, max);
    });
    addEventListener('pointerup', () => {
      if (!d) return; const moved = d.moved; d = null; wall.classList.remove('dragging');
      if (!moved) return;
      suppressClick = true; setTimeout(() => { suppressClick = false; }, 0);
      const v = -vt.velocity().x, max = wall.scrollWidth - wall.clientWidth;
      sx.jump(wall.scrollLeft); sx.to(clamp(wall.scrollLeft + project(v, 0.996), 0, max), { velocity: v });
    });
    wall.addEventListener('click', e => { if (suppressClick) { e.stopPropagation(); e.preventDefault(); } }, true);
    wall.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault(); const max = wall.scrollWidth - wall.clientWidth;
        sx.jump(wall.scrollLeft); sx.to(clamp(wall.scrollLeft + (e.key === 'ArrowRight' ? 1 : -1) * wall.clientWidth * 0.6, 0, max));
      }
    });
  }

  /* ---------- Viewer ---------- */
  const V = { el: $('#viewer'), backdrop: $('#vBackdrop'), stage: $('#vStage'), track: $('#vTrack'), top: $('#vTop'), sheet: $('#sheet') };
  let list = [], cur = 0, isOpen = false, sourceKind = 'grid', fromRect = null, hiddenThumb = null, chrome = true;
  const drag = { x: 0, y: 0 };
  let zoom = { s: 1, x: 0, y: 0 };
  let sheetM = { h: 0, peek: 0, hidden: 0 };

  const prog = new Spring(0, { response: 0.42, damping: 1, precision: 0.001 });
  const pageX = new Spring(0, { response: 0.38, damping: 1, precision: 0.3 });
  const chromeS = new Spring(1, { response: 0.3, damping: 1, precision: 0.002 });
  const sheetY = new Spring(0, { response: 0.36, damping: 1, precision: 0.3 });
  const dragY = new Spring(0, { response: 0.36, damping: 1, precision: 0.3 });
  const dragX = new Spring(0, { response: 0.36, damping: 1, precision: 0.3 });
  const zt = new Spring(0, { response: 0.36, damping: 1, precision: 0.001 });
  let zFrom = null, zTo = null;
  [prog, pageX, chromeS, sheetY].forEach(s => { s.onUpdate = apply; });
  dragY.onUpdate = v => { drag.y = v; apply(); };
  dragX.onUpdate = v => { drag.x = v; apply(); };
  zt.onUpdate = t => {
    if (!zFrom) return;
    zoom = { s: zFrom.s + (zTo.s - zFrom.s) * t, x: zFrom.x + (zTo.x - zFrom.x) * t, y: zFrom.y + (zTo.y - zFrom.y) * t };
    apply();
  };

  const slides = [0, 1, 2].map(() => {
    const el = document.createElement('div'); el.className = 'v-slide';
    const img = document.createElement('img'); img.draggable = false; img.alt = '';
    el.appendChild(img); V.track.appendChild(el);
    return { el, img, work: null, rect: null };
  });

  function fitRect(w) {
    const vw = innerWidth, vh = innerHeight;
    const a = wide.matches
      ? { x: 40, y: 72, w: vw - SIDE - 80, h: vh - 72 - 40 }
      : { x: 14, y: 64, w: vw - 28, h: vh - 64 - PEEK - 16 };
    const r = w.w / w.h; let W = a.w, H = W / r;
    if (H > a.h) { H = a.h; W = H * r; }
    return { x: a.x + (a.w - W) / 2, y: a.y + (a.h - H) / 2, w: W, h: H };
  }
  const shrinkRect = r => ({ x: r.x + r.w * 0.06, y: r.y + r.h * 0.06 + 40, w: r.w * 0.88, h: r.h * 0.88 });

  function setSrc(img, w) {
    const small = artURL(w, 640);
    if (img.dataset.id !== w.id) { img.dataset.id = w.id; img.src = small; img.alt = `${w.title} by ${w.artist}`; }
    // Load the large version after the opening motion so the first frames stay smooth.
    setTimeout(() => {
      if (img.dataset.id !== w.id) return;
      const big = artURL(w, 1800);
      if (big === img.src) return;
      const pre = new Image(); pre.onload = () => { if (img.dataset.id === w.id) img.src = big; }; pre.src = big;
    }, 450);
  }

  function layoutSlides() {
    const W = innerWidth + GAP;
    [-1, 0, 1].forEach((d, k) => {
      const s = slides[k], w = list[cur + d];
      s.work = w || null;
      s.el.style.transform = `translate3d(${d * W}px,0,0)`;
      if (!w) { s.img.style.visibility = 'hidden'; s.img.removeAttribute('data-id'); return; }
      s.img.style.visibility = '';
      const r = fitRect(w); s.rect = r;
      Object.assign(s.img.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
      if (d !== 0) s.img.style.transform = '';
      setSrc(s.img, w);
    });
    apply();
  }

  function apply() {
    const s = slides[1]; if (!s.work || !s.rect) return;
    const r = s.rect, p = prog.value;
    let tx = 0, ty = 0, sc = 1;
    if (fromRect) {
      tx = (fromRect.x + fromRect.w / 2) - (r.x + r.w / 2);
      ty = (fromRect.y + fromRect.h / 2) - (r.y + r.h / 2);
      sc = fromRect.w / r.w;
    }
    const down = Math.max(0, drag.y);
    const dragScale = 1 - Math.min(0.3, down / 1400);
    const X = tx * (1 - p) + drag.x * p, Y = ty * (1 - p) + drag.y * p, S = sc * (1 - p) + dragScale * p;
    s.img.style.transform = `translate3d(${X + zoom.x * p}px,${Y + zoom.y * p}px,0) scale(${S * (1 + (zoom.s - 1) * p)})`;
    const fade = p * (1 - Math.min(1, down / 520));
    V.backdrop.style.opacity = fade;
    const showNeighbours = p > 0.99 && down < 1 && zoom.s < 1.01;
    slides[0].el.style.visibility = slides[2].el.style.visibility = showNeighbours ? '' : 'hidden';
    V.track.style.transform = `translate3d(${pageX.value}px,0,0)`;
    const vis = Math.min(p, chromeS.value) * (1 - Math.min(1, down / 260));
    V.top.style.opacity = vis;
    V.top.style.pointerEvents = vis > 0.5 ? 'auto' : 'none';
    V.sheet.style.pointerEvents = vis > 0.5 ? 'auto' : 'none';
    if (wide.matches) V.sheet.style.transform = `translate3d(${(1 - vis) * (SIDE + 24)}px,0,0)`;
    else V.sheet.style.transform = `translate3d(0,${sheetM.hidden + (sheetY.value - sheetM.hidden) * vis}px,0)`;
  }

  function measureSheet() {
    V.sheet.style.transform = 'none';
    const h = V.sheet.offsetHeight;
    sheetM = { h, peek: Math.max(0, h - PEEK), hidden: h + 24 };
  }

  function fillSheet() {
    const w = list[cur]; if (!w) return;
    $('#sTitle').textContent = w.title;
    $('#sArtist').textContent = w.artist;
    $('#sPrice').innerHTML = dotFor(w) + esc(priceText(w));
    $('#sYear').textContent = w.year;
    $('#sMedium').textContent = w.medium;
    $('#sSize').textContent = sizeText(w);
    $('#sStatus').textContent = statusText(w);
    $('#sNote').textContent = w.note || '';
    $('#sNote').hidden = !w.note;
    const e = $('#sEnquire');
    if (w.status === 'sold') { e.textContent = 'Ask about similar works'; e.href = waLink(`Hello ${cfg.name || ''}, "${w.title}" by ${w.artist} is sold. Do you have similar works by the artist? ${workURL(w)}`); }
    else { e.textContent = 'Ask on WhatsApp'; e.href = waLink(enquiryText(w)); }
    $('#vCount').textContent = `${cur + 1} of ${list.length}`;
    $('#vSave').setAttribute('aria-pressed', saved.has(w.id));
    $('#vSave').setAttribute('aria-label', saved.has(w.id) ? `Remove ${w.title} from saved` : `Save ${w.title}`);
    try { history.replaceState(null, '', '#work=' + encodeURIComponent(w.id)); } catch (err) { /* sandboxed */ }
  }

  function thumbFor(id) {
    const root = sourceKind === 'wall' ? $('#wallInner') : $('#grid');
    const btn = root.querySelector(`[data-id="${CSS.escape(id)}"]`);
    return btn ? (btn.querySelector('img') || btn) : null;
  }
  function setHidden(el) {
    if (hiddenThumb) hiddenThumb.style.visibility = '';
    hiddenThumb = el; if (el) el.style.visibility = 'hidden';
  }
  const rectOf = el => { const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; };

  function openViewer(l, i, kind) {
    list = l; cur = i; sourceKind = kind; isOpen = true;
    V.el.hidden = false;
    document.documentElement.classList.add('locked');
    drag.x = drag.y = 0; dragX.jump(0); dragY.jump(0);
    zoom = { s: 1, x: 0, y: 0 }; zt.stop();
    chrome = true; chromeS.jump(1); pageX.jump(0);
    fillSheet(); measureSheet(); sheetY.jump(sheetM.peek);
    const th = thumbFor(list[cur].id);
    layoutSlides();
    fromRect = th ? rectOf(th) : shrinkRect(slides[1].rect);
    setHidden(th);
    prog.jump(0);
    prog.to(1, { response: 0.42, damping: 1 });
    $('#vClose').focus({ preventScroll: true });
  }

  function closeViewer(velocity = 0) {
    if (!isOpen) return;
    isOpen = false;
    if (roomOpen) closeRoom(true);
    const th = thumbFor(list[cur].id);
    let r = null;
    if (th) { const b = rectOf(th); if (b.y + b.h > 0 && b.y < innerHeight && b.x + b.w > 0 && b.x < innerWidth) r = b; }
    fromRect = r || shrinkRect(slides[1].rect);
    setHidden(r ? th : null);
    if (zoom.s > 1.01) { zFrom = { ...zoom }; zTo = { s: 1, x: 0, y: 0 }; zt.jump(0); zt.to(1); }
    prog.to(0, { velocity, response: 0.4, damping: 1, onRest: finishClose });
  }
  function finishClose() {
    V.el.hidden = true;
    document.documentElement.classList.remove('locked');
    const th = hiddenThumb; setHidden(null);
    drag.x = drag.y = 0; dragX.jump(0); dragY.jump(0); zoom = { s: 1, x: 0, y: 0 };
    try { history.replaceState(null, '', location.pathname + location.search); } catch (err) { /* sandboxed */ }
    const btn = th && th.closest('button'); if (btn) btn.focus({ preventScroll: true });
  }
  // Grab a closing work mid-way and it comes back.
  function reopen() {
    isOpen = true; setHidden(thumbFor(list[cur].id));
    prog.to(1, { response: 0.42, damping: 1 });
  }

  function go(dir) {
    const n = cur + dir; if (n < 0 || n >= list.length || zoom.s > 1.01) return;
    const W = innerWidth + GAP;
    const off = pageX.value;
    cur = n; zoom = { s: 1, x: 0, y: 0 };
    layoutSlides(); fillSheet();
    pageX.jump(off + dir * W);
    pageX.to(0);
  }

  /* Zoom */
  function imgCenter() { const r = slides[1].rect; return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; }
  function clampZoom(z) {
    const r = slides[1].rect, mx = (r.w * z.s - r.w) / 2, my = (r.h * z.s - r.h) / 2;
    return { s: z.s, x: clamp(z.x, -mx, mx), y: clamp(z.y, -my, my) };
  }
  function animateZoom(to, response = 0.36) { zFrom = { ...zoom }; zTo = to; zt.jump(0); zt.to(1, { response }); }
  function toggleZoomAt(px, py) {
    if (zoom.s > 1.01) { animateZoom({ s: 1, x: 0, y: 0 }); return; }
    const c = imgCenter(), s = 2.6;
    animateZoom(clampZoom({ s, x: -(s - 1) * (px - c.x), y: -(s - 1) * (py - c.y) }));
  }

  /* Gestures on the stage */
  const pointers = new Map();
  const vt = velocityTracker();
  let g = null, pinch = null, lastTap = 0, lastTapPos = null, tapTimer = 0;

  V.stage.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    V.stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!isOpen && prog.moving) reopen();
    if (pointers.size === 2) { startPinch(); return; }
    if (pointers.size > 2) return;
    pageX.stop(); dragX.stop(); dragY.stop(); zt.stop();
    vt.reset(); vt.add(e.clientX, e.clientY, e.timeStamp);
    g = { id: e.pointerId, x0: e.clientX, y0: e.clientY, axis: null, moved: false, off0: pageX.value, dy0: drag.y, dx0: drag.x, z0: { ...zoom }, target: e.target };
  });

  V.stage.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch) { movePinch(); return; }
    if (!g || e.pointerId !== g.id) return;
    vt.add(e.clientX, e.clientY, e.timeStamp);
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (!g.axis) {
      if (Math.hypot(dx, dy) < 10) return;
      g.moved = true;
      g.axis = zoom.s > 1.01 ? 'pan' : (Math.abs(dx) > Math.abs(dy) ? 'x' : 'y');
    }
    if (g.axis === 'x') {
      let off = g.off0 + dx;
      if ((cur === 0 && off > 0) || (cur === list.length - 1 && off < 0)) off = rubber(off, innerWidth);
      pageX.jump(off);
    } else if (g.axis === 'y') {
      let y = g.dy0 + dy; if (y < 0) y = rubber(y, innerHeight, 0.25);
      drag.y = y; drag.x = g.dx0 + dx * (y > 0 ? 0.7 : 0); apply();
    } else if (g.axis === 'pan') {
      const r = slides[1].rect, mx = (r.w * zoom.s - r.w) / 2, my = (r.h * zoom.s - r.h) / 2;
      let x = g.z0.x + dx, y = g.z0.y + dy;
      if (Math.abs(x) > mx) x = Math.sign(x) * (mx + rubber(Math.abs(x) - mx, innerWidth));
      if (Math.abs(y) > my) y = Math.sign(y) * (my + rubber(Math.abs(y) - my, innerHeight));
      zoom = { s: zoom.s, x, y }; apply();
    }
  });

  function pointerEnd(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pinch) { if (pointers.size < 2) endPinch(); return; }
    if (!g || e.pointerId !== g.id) return;
    const v = vt.velocity(), gg = g; g = null;
    if (e.type === 'pointercancel') { settleAll(v); return; }
    if (!gg.moved) { handleTap(e, gg.target); return; }
    if (gg.axis === 'x') {
      const W = innerWidth + GAP, proj = pageX.value + project(v.x, 0.995);
      if (proj < -W * 0.35 && cur < list.length - 1) go(1);
      else if (proj > W * 0.35 && cur > 0) go(-1);
      pageX.to(0, { velocity: v.x });
    } else if (gg.axis === 'y') {
      const proj = drag.y + project(v.y, 0.99);
      if (drag.y > 0 && (proj > 200 || v.y > 900)) {
        const dist = Math.max(240, Math.abs((fromRect ? fromRect.y : innerHeight) - drag.y));
        closeViewer(-Math.min(6, Math.max(0, v.y) / dist));
      } else {
        if (!wide.matches && (drag.y < -24 || v.y < -500)) sheetY.to(0, { velocity: v.y, damping: 0.85 });
        dragY.jump(drag.y); dragX.jump(drag.x);
        dragY.to(0, { velocity: v.y }); dragX.to(0, { velocity: v.x });
      }
    } else if (gg.axis === 'pan') {
      zFrom = null;
      animateZoom(clampZoom({ s: zoom.s, x: zoom.x + project(v.x, 0.994), y: zoom.y + project(v.y, 0.994) }), 0.5);
    }
  }
  function settleAll(v = { x: 0, y: 0 }) {
    pageX.to(0); dragY.jump(drag.y); dragX.jump(drag.x); dragY.to(0, { velocity: v.y }); dragX.to(0);
    if (zoom.s < 1.05) animateZoom({ s: 1, x: 0, y: 0 }); else animateZoom(clampZoom(zoom));
  }
  V.stage.addEventListener('pointerup', pointerEnd);
  V.stage.addEventListener('pointercancel', pointerEnd);

  function handleTap(e, target) {
    const onImage = target === slides[1].img;
    // With a mouse, a click outside the work closes, like most desktop viewers.
    if (e.pointerType === 'mouse' && !onImage && zoom.s < 1.01) { closeViewer(0); return; }
    const now = e.timeStamp;
    if (now - lastTap < 300 && lastTapPos && Math.hypot(e.clientX - lastTapPos.x, e.clientY - lastTapPos.y) < 30) {
      clearTimeout(tapTimer); lastTap = 0; toggleZoomAt(e.clientX, e.clientY); return;
    }
    lastTap = now; lastTapPos = { x: e.clientX, y: e.clientY };
    tapTimer = setTimeout(() => { chrome = !chrome; chromeS.to(chrome ? 1 : 0); }, 300);
  }

  function startPinch() {
    g = null; zt.stop();
    const [a, b] = [...pointers.values()];
    pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, m0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, z0: { ...zoom } };
  }
  function movePinch() {
    const [a, b] = [...pointers.values()]; if (!b) return;
    const d = Math.hypot(a.x - b.x, a.y - b.y), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    let s = pinch.z0.s * d / pinch.d0;
    if (s > 5) s = 5 + rubber(s - 5, 5, 0.3); if (s < 1) s = 1 - rubber(1 - s, 1, 0.5);
    const c = imgCenter();
    const ox = (pinch.m0.x - c.x - pinch.z0.x) / pinch.z0.s, oy = (pinch.m0.y - c.y - pinch.z0.y) / pinch.z0.s;
    zoom = { s, x: m.x - c.x - ox * s, y: m.y - c.y - oy * s };
    apply();
  }
  function endPinch() {
    pinch = null; g = null;
    animateZoom(zoom.s < 1.08 ? { s: 1, x: 0, y: 0 } : clampZoom({ s: Math.min(zoom.s, 4), x: zoom.x, y: zoom.y }));
  }

  // Trackpad pinch and ctrl + wheel zoom on desktop.
  V.stage.addEventListener('wheel', e => {
    if (!isOpen) return;
    e.preventDefault();
    if (e.ctrlKey) {
      const c = imgCenter(), s = clamp(zoom.s * Math.exp(-e.deltaY / 120), 1, 5);
      const ox = (e.clientX - c.x - zoom.x) / zoom.s, oy = (e.clientY - c.y - zoom.y) / zoom.s;
      zt.stop(); zoom = clampZoom({ s, x: e.clientX - c.x - ox * s, y: e.clientY - c.y - oy * s }); apply();
    } else if (zoom.s > 1.01) {
      zt.stop(); zoom = clampZoom({ s: zoom.s, x: zoom.x - e.deltaX, y: zoom.y - e.deltaY }); apply();
    }
  }, { passive: false });

  /* Sheet dragging (phones) */
  (() => {
    const handle = $('#sheetDrag'), svt = velocityTracker(); let sg = null;
    handle.addEventListener('pointerdown', e => {
      if (wide.matches) return;
      handle.setPointerCapture(e.pointerId); sheetY.stop();
      sg = { id: e.pointerId, y0: e.clientY, s0: sheetY.value, moved: false };
      svt.reset(); svt.add(0, e.clientY, e.timeStamp);
    });
    handle.addEventListener('pointermove', e => {
      if (!sg || sg.id !== e.pointerId) return;
      const dy = e.clientY - sg.y0;
      if (!sg.moved && Math.abs(dy) < 6) return;
      sg.moved = true; svt.add(0, e.clientY, e.timeStamp);
      let y = sg.s0 + dy;
      if (y < 0) y = rubber(y, innerHeight, 0.3);
      if (y > sheetM.peek) y = sheetM.peek + rubber(y - sheetM.peek, 400, 0.5);
      sheetY.jump(y);
    });
    const end = e => {
      if (!sg || sg.id !== e.pointerId) return;
      const s = sg; sg = null;
      if (!s.moved) { sheetY.to(sheetY.value > sheetM.peek / 2 ? 0 : sheetM.peek); return; }
      const v = svt.velocity().y, proj = sheetY.value + project(v, 0.99);
      const target = Math.abs(proj) < Math.abs(proj - sheetM.peek) ? 0 : sheetM.peek;
      sheetY.to(target, { velocity: v, damping: Math.abs(v) > 400 ? 0.82 : 1 });
    };
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  })();

  /* ---------- See it on a wall ---------- */
  const R = { el: $('#room'), scene: $('#roomScene'), wall: $('#roomWall'), floor: $('#roomFloor'), art: $('#roomArt'), sofa: $('#roomSofa'), person: $('#roomPerson'), ui: $('#roomUi') };
  const roomP = new Spring(0, { response: 0.42, damping: 1, precision: 0.001 });
  let roomOpen = false;
  roomP.onUpdate = v => {
    R.el.style.opacity = Math.min(1, v * 1.4);
    R.scene.style.transform = `scale(${0.9 + 0.1 * v})`;
    R.ui.style.transform = `translate3d(0,${(1 - v) * 48}px,0)`;
  };
  function layoutRoom() {
    const w = list[cur]; if (!w) return;
    $('#roomCaption').innerHTML = `<cite>${esc(w.title)}</cite>, ${esc(sizeText(w))}. The sofa is 210 cm wide and the figure is 172 cm tall.`;
    const uiH = R.ui.offsetHeight, vw = innerWidth, vh = innerHeight - uiH;
    const narrow = vw < 600;
    const roomW = narrow ? 320 : 400, roomH = 290;
    const ppc = Math.min(vw / roomW, vh / roomH);
    const floorY = vh - 14 * ppc;
    R.wall.style.height = floorY + 'px';
    R.floor.style.top = floorY + 'px';
    const sofaW = 210, sofaH = 85;
    const sofaCx = vw / 2 - (narrow ? 45 : 30) * ppc;
    Object.assign(R.sofa.style, { left: (sofaCx - sofaW * ppc / 2) + 'px', top: (floorY - sofaH * ppc) + 'px', width: sofaW * ppc + 'px', height: sofaH * ppc + 'px' });
    let bottom = Math.max(100, 150 - w.h / 2);
    if (bottom + w.h > 272) bottom = Math.max(sofaH + 6, 272 - w.h);
    Object.assign(R.art.style, { left: (sofaCx - w.w * ppc / 2) + 'px', top: (floorY - (bottom + w.h) * ppc) + 'px', width: w.w * ppc + 'px', height: w.h * ppc + 'px' });
    const px = sofaCx + (sofaW / 2 + 40) * ppc;
    Object.assign(R.person.style, { left: px + 'px', top: (floorY - 172 * ppc) + 'px', width: 50 * ppc + 'px', height: 172 * ppc + 'px' });
    R.art.src = artURL(w, 1800);
    R.art.alt = `${w.title} on a wall above a sofa, to scale`;
  }
  function openRoom() {
    const b = $('#sWall').getBoundingClientRect();
    R.scene.style.transformOrigin = `${b.left + b.width / 2}px ${b.top + b.height / 2}px`;
    R.el.hidden = false; roomOpen = true;
    layoutRoom();
    roomP.to(1);
    $('#roomClose').focus({ preventScroll: true });
  }
  function closeRoom(instant) {
    roomOpen = false;
    if (instant) { roomP.jump(0); R.el.hidden = true; return; }
    roomP.to(0, { onRest: () => { R.el.hidden = true; } });
    $('#sWall').focus({ preventScroll: true });
  }
  document.querySelectorAll('#swatches button').forEach(b => {
    b.style.setProperty('--sw', b.dataset.wall);
    b.addEventListener('click', () => {
      document.querySelectorAll('#swatches button').forEach(x => x.setAttribute('aria-pressed', x === b));
      R.wall.style.background = b.dataset.wall; R.floor.style.background = b.dataset.floor;
      R.person.style.fill = ['#2E3B6E', '#3A3936'].includes(b.dataset.wall) ? 'rgba(238,236,231,.3)' : '';
    });
  });

  /* ---------- Data from a Google Sheet ---------- */
  function parseCSV(text) {
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }
  const PALETTES = [['#E6E0D2', '#2C3A7E', '#1F2858', '#3F4E9A'], ['#F1E6CF', '#C5562F', '#E3B04B', '#7A3B26'], ['#ECE7DD', '#2F6F64', '#D9A441', '#A8432F']];
  async function loadSheet() {
    if (!cfg.sheetCsvUrl) return;
    try {
      const res = await fetch(cfg.sheetCsvUrl); if (!res.ok) throw new Error(res.status);
      const [head, ...body] = parseCSV(await res.text());
      const col = n => head.findIndex(h => h.trim().toLowerCase() === n);
      const get = (r, n) => { const i = col(n); return i < 0 ? '' : (r[i] || '').trim(); };
      const rows = body.filter(r => get(r, 'title'));
      if (!rows.length) throw new Error('empty');
      works = rows.map((r, i) => {
        const price = get(r, 'price_inr').replace(/[^\d.]/g, '');
        return {
          id: get(r, 'id') || 'w' + (i + 1), title: get(r, 'title'), artist: get(r, 'artist'), year: get(r, 'year'),
          medium: get(r, 'medium'), w: Number(get(r, 'width_cm')) || 60, h: Number(get(r, 'height_cm')) || 80,
          price: price ? Number(price) : null, status: (get(r, 'status') || 'available').toLowerCase(),
          image: get(r, 'image_url') || null, note: get(r, 'description'),
          art: { kind: ['field', 'arch', 'grid', 'lines', 'bindu'][i % 5], seed: i + 3, palette: PALETTES[i % PALETTES.length] }
        };
      });
    } catch (err) {
      toast('Could not load the artwork sheet. Showing sample works.');
    }
  }

  /* ---------- Events ---------- */
  function bind() {
    $('#grid').addEventListener('click', e => {
      const save = e.target.closest('.save');
      if (save) { toggleSaved(save.dataset.id); return; }
      const open = e.target.closest('.card-open');
      if (open) openViewer(gridList, gridList.findIndex(w => w.id === open.dataset.id), 'grid');
    });
    $('#wallInner').addEventListener('click', e => {
      const b = e.target.closest('.wall-work');
      if (b) openViewer(works, works.findIndex(w => w.id === b.dataset.id), 'wall');
    });
    $('#filters').addEventListener('click', e => { const c = e.target.closest('.chip'); if (c) setFilter(c.dataset.filter); });
    $('#savedBtn').addEventListener('click', () => {
      setFilter(filter === 'saved' ? 'all' : 'saved');
      $('#worksHead').scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
    });
    $('#vClose').addEventListener('click', () => closeViewer(0));
    $('#vSave').addEventListener('click', () => toggleSaved(list[cur].id));
    $('#sWall').addEventListener('click', openRoom);
    $('#roomClose').addEventListener('click', () => closeRoom());
    $('#sShare').addEventListener('click', async () => {
      const w = list[cur], url = workURL(w);
      try {
        if (navigator.share) { await navigator.share({ title: `${w.title} by ${w.artist}`, url }); return; }
        await navigator.clipboard.writeText(url); toast('Link copied');
      } catch (err) { if (err && err.name !== 'AbortError') toast('Copy this link: ' + url); }
    });
    addEventListener('keydown', e => {
      if (!isOpen) return;
      if (e.key === 'Escape') { if (roomOpen) closeRoom(); else closeViewer(0); }
      else if (!roomOpen && e.key === 'ArrowRight') go(1);
      else if (!roomOpen && e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'Tab') trapFocus(e, roomOpen ? R.el : V.el);
    });
    let rt = 0;
    addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        renderWall();
        if (isOpen) { measureSheet(); sheetY.jump(Math.min(sheetY.value, sheetM.peek)); layoutSlides(); }
        if (roomOpen) layoutRoom();
      }, 120);
    });
  }
  function trapFocus(e, root) {
    const f = [...root.querySelectorAll('button, a[href]')].filter(el => el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ---------- Start ---------- */
  async function start() {
    fillPage();
    await loadSheet();
    renderGrid(); renderWall(); bindWallDrag(); bind(); syncSaved();
    openFromHash();
    addEventListener('hashchange', openFromHash);
  }
  function openFromHash() {
    const m = location.hash.match(/^#work=(.+)$/);
    if (!m || isOpen) return;
    const i = works.findIndex(w => w.id === decodeURIComponent(m[1]));
    if (i >= 0) { setFilter('all'); openViewer(works, i, 'grid'); }
  }
  start();
})();
