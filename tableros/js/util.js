/* Utilidades generales: creación de DOM, formato, CSV, SHA-256. */
(function (g) {
  'use strict';

  /** Crea un elemento. h('div', {class:'x', onclick:fn}, hijo1, [hijos...]) */
  function h(tag, props) {
    const el = document.createElement(tag);
    for (const k in (props || {})) {
      const v = props[k];
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected' || k === 'readOnly') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (let i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) c.forEach(x => append(el, x));
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

  const uid = () => 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const pad = (n, w) => String(n).padStart(w, '0');
  const isNum = v => v !== null && v !== undefined && v !== '' && isFinite(Number(v));
  const toNum = v => (isNum(v) ? Number(v) : null);
  function fmt(n, d) {
    if (n === null || n === undefined || n === '' || isNaN(n)) return '';
    return Number(n).toLocaleString('es-CR', { minimumFractionDigits: d || 0, maximumFractionDigits: d === undefined ? 2 : d });
  }
  const pct = n => (n === null || n === undefined || isNaN(n) ? '–' : Math.round(n * 100) + ' %');
  const today = () => new Date().toISOString().slice(0, 10);
  const clone = o => JSON.parse(JSON.stringify(o));

  function csv(rows) {
    return '﻿' + rows.map(r => r.map(c => {
      const s = c === null || c === undefined ? '' : String(c);
      return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(';')).join('\r\n');
  }
  function download(name, text, mime) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: mime || 'text/plain' }));
    a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /** SHA-256 en JS puro (síncrono, funciona también con file://). */
  function sha256(str) {
    const bytes = new TextEncoder().encode(str);
    const primes = []; for (let n = 2; primes.length < 64; n++) if (primes.every(p => n % p)) primes.push(n);
    const frac = x => ((x - Math.floor(x)) * 4294967296) >>> 0;
    const K = primes.map(p => frac(Math.cbrt(p)));
    const H = primes.slice(0, 8).map(p => frac(Math.sqrt(p)));
    const l = bytes.length, total = ((l + 9 + 63) >> 6) << 6, buf = new Uint8Array(total);
    buf.set(bytes); buf[l] = 0x80;
    const dv = new DataView(buf.buffer);
    dv.setUint32(total - 8, Math.floor(l * 8 / 4294967296)); dv.setUint32(total - 4, (l * 8) >>> 0);
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));
    const w = new Uint32Array(64);
    for (let o = 0; o < total; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      let [a, b, c, d, e, f, gg, hh] = H;
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25), ch = (e & f) ^ (~e & gg);
        const t1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22), mj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + mj) >>> 0;
        hh = gg; gg = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      [a, b, c, d, e, f, gg, hh].forEach((v, i) => { H[i] = (H[i] + v) >>> 0; });
    }
    return H.map(v => v.toString(16).padStart(8, '0')).join('');
  }

  g.U = { h, clear, uid, pad, isNum, toNum, fmt, pct, today, clone, csv, download, sha256 };
})(typeof window !== 'undefined' ? window : globalThis);
