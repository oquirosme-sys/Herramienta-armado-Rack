/* Componentes de interfaz reutilizables. */
(function (g) {
  'use strict';
  const h = U.h;

  /** Número escrito con coma o punto decimal. */
  const parseNum = s => { const t = String(s).trim().replace(/\s/g, '').replace(',', '.'); return t === '' ? '' : (isFinite(Number(t)) ? Number(t) : NaN); };

  const UI = {
    parseNum,
    field(label, control, hint, cls) {
      return h('label', { class: 'field ' + (cls || '') }, h('span', { class: 'field-l' }, label), control, hint ? h('small', { class: 'hint' }, hint) : null);
    },

    /** Input enlazado a obj[key]. opts: type ('text'|'num'|'date'), fk (clave para recuperar el foco), after, placeholder, class. */
    input(obj, key, opts) {
      opts = opts || {};
      const num = opts.type === 'num';
      const val = obj[key] === null || obj[key] === undefined ? '' : obj[key];
      const el = h('input', { type: num ? 'text' : (opts.type || 'text'), inputmode: num ? 'decimal' : null, class: (opts.class || '') + (num ? ' num' : ''), placeholder: opts.placeholder || '',
        value: num && val !== '' ? String(val).replace('.', ',') : val, disabled: opts.disabled, list: opts.list, title: opts.title || null, 'aria-label': opts.label || null, 'data-fk': opts.fk || null });
      el.addEventListener('change', () => {
        let v = el.value;
        if (num) { v = parseNum(v); if (Number.isNaN(v)) { el.classList.add('invalid'); UI.toast('Número no válido', 'bad'); return; } }
        else if (opts.trim !== false) v = v.trim();
        el.classList.remove('invalid');
        if (opts.validate) { const m = opts.validate(v); if (m) { UI.toast(m, 'bad'); el.value = val; return; } }
        obj[key] = v;
        if (opts.save !== false) Store.save();
        if (opts.after) opts.after(v); else if (g.App) App.refresh();
      });
      return el;
    },

    /** Select. options: [{value,label,group?,title?}] */
    select(options, value, onchange, opts) {
      opts = opts || {};
      const el = h('select', { class: opts.class || '', disabled: opts.disabled, 'aria-label': opts.label || null, 'data-fk': opts.fk || null, title: opts.title || null });
      UI.fillSelect(el, options, value);
      el.addEventListener('change', () => onchange(el.value, el));
      return el;
    },
    /** Select enlazado a obj[key]; numérico si los valores del catálogo lo son. */
    bind(obj, key, options, opts) {
      opts = opts || {};
      return UI.select(options, obj[key], v => { obj[key] = opts.num && v !== '' ? Number(v) : v; Store.save(); if (opts.after) opts.after(v); else App.refresh(); }, opts);
    },
    fillSelect(el, options, value) {
      U.clear(el);
      const groups = {};
      options.forEach(o => {
        if (typeof o !== 'object') o = { value: o, label: o };
        const opt = h('option', { value: o.value, title: o.title || null }, o.label);
        if (o.group) {
          let gr = groups[o.group];
          if (!gr) { gr = groups[o.group] = h('optgroup', { label: o.group }); el.appendChild(gr); }
          gr.appendChild(opt);
        } else el.appendChild(opt);
      });
      const v = value === null || value === undefined ? '' : String(value);
      el.value = v;
      if (el.value !== v) el.value = '';
    },
    opts(list, vacio) { return (vacio !== undefined ? [{ value: '', label: vacio }] : []).concat(list.map(x => (typeof x === 'object' ? x : { value: x, label: x }))); },

    btn(label, onclick, cls, title) { return h('button', { type: 'button', class: 'btn ' + (cls || ''), onclick, title: title || null }, label); },
    iconBtn(label, title, onclick, cls) { return h('button', { type: 'button', class: 'icon-btn ' + (cls || ''), onclick, title, 'aria-label': title }, label); },

    card(title, body, extra, cls) {
      return h('section', { class: 'card ' + (cls || '') },
        h('header', { class: 'card-h' }, h('h3', null, title), extra || null),
        h('div', { class: 'card-b' }, body));
    },
    kpi(label, value, sub, kind) { return h('div', { class: 'kpi ' + (kind || '') }, h('span', { class: 'kpi-l' }, label), h('strong', null, value), sub ? h('small', null, sub) : null); },
    avisos(list) { return list && list.length ? h('ul', { class: 'avisos' }, list.map(a => h('li', null, a))) : null; },

    /* ---------- archivos ---------- */
    pickFile(accept) {
      return new Promise(res => {
        const f = h('input', { type: 'file', accept, style: { display: 'none' } });
        f.addEventListener('change', () => { res(f.files[0] || null); f.remove(); });
        document.body.appendChild(f); f.click();
      });
    },
    readText(file) {
      return new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => {
          const buf = new Uint8Array(fr.result);
          let txt = new TextDecoder('utf-8').decode(buf);
          if (txt.includes('�')) txt = new TextDecoder('windows-1252').decode(buf); // exportaciones de Revit en ANSI
          if (buf[0] === 0xFF && buf[1] === 0xFE) txt = new TextDecoder('utf-16le').decode(buf);
          res(txt.replace(/^﻿/, ''));
        };
        fr.onerror = () => rej(new Error('No se pudo leer el archivo.'));
        fr.readAsArrayBuffer(file);
      });
    },
    readBuffer(file) {
      return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(new Error('No se pudo leer el archivo.')); fr.readAsArrayBuffer(file); });
    },

    /* ---------- modal / confirmación / toast ---------- */
    modal(title, body, buttons, opts) {
      opts = opts || {};
      const root = document.getElementById('modal-root');
      const close = () => { back.remove(); document.removeEventListener('keydown', onKey); };
      const onKey = e => { if (e.key === 'Escape') close(); };
      const foot = h('footer', { class: 'modal-f' }, (buttons || []).map(b => h('button', {
        type: 'button', class: 'btn ' + (b.cls || ''),
        onclick: () => { if (b.onclick) { const r = b.onclick(close); if (r === false) return; } if (b.close !== false) close(); },
      }, b.label)));
      const back = h('div', { class: 'modal-back', onmousedown: e => { if (e.target === back) close(); } },
        h('div', { class: 'modal ' + (opts.wide ? 'wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
          h('header', { class: 'modal-h' }, h('h3', null, title), h('button', { class: 'icon-btn', type: 'button', onclick: close, 'aria-label': 'Cerrar' }, '✕')),
          h('div', { class: 'modal-b' }, body), foot));
      root.appendChild(back);
      document.addEventListener('keydown', onKey);
      const first = back.querySelector('input,select,textarea'); if (first && !opts.noFocus) first.focus();
      return close;
    },
    confirm(msg, okLabel, danger) {
      return new Promise(res => {
        UI.modal('Confirmar', h('p', null, msg), [
          { label: 'Cancelar', onclick: () => res(false) },
          { label: okLabel || 'Aceptar', cls: danger === false ? 'primary' : 'danger', onclick: () => res(true) },
        ]);
      });
    },
    alert(msg, title) { UI.modal(title || 'Aviso', h('p', null, msg), [{ label: 'Entendido', cls: 'primary' }]); },
    toast(msg, kind) {
      const t = h('div', { class: 'toast ' + (kind || '') }, msg);
      document.getElementById('toast-root').appendChild(t);
      setTimeout(() => t.classList.add('out'), 2600); setTimeout(() => t.remove(), 3000);
    },
    prompt(title, label, valor, validar) {
      return new Promise(res => {
        const inp = h('input', { type: 'text', value: valor || '' });
        const err = h('small', { class: 'err' });
        UI.modal(title, h('div', null, UI.field(label, inp), err), [
          { label: 'Cancelar', onclick: () => res(null) },
          { label: 'Aceptar', cls: 'primary', onclick: () => { const v = inp.value.trim(); const m = validar ? validar(v) : ''; if (m) { err.textContent = m; return false; } res(v); } },
        ]);
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') { const b = document.querySelector('.modal-f .btn.primary'); if (b) b.click(); } });
      });
    },
  };
  g.UI = UI;
})(window);
