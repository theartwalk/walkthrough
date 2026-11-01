/* Artwork images for Walkthrough.
   Real works use their photo (image, plus a smaller thumb when there is one).
   Sample works have no photo, so a placeholder painting is drawn in the browser. */
(() => {
  'use strict';
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
    if (w.image) return (longEdge <= 800 && w.thumb) ? w.thumb : w.image;
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

  window.WalkArt = { url: artURL };
})();
