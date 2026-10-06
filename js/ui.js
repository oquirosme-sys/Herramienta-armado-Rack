/* Componentes de interfaz reutilizables. */
(function (g) {
  'use strict';
  const h = U.h;

  const UI = {
    /** Campo con etiqueta. */
    field(label, control, hint, cls) {
      return h('label', { class: 'field ' + (cls || '') }, h('span', { class: 'field-l' }, label), control, hint ? h('small', { class: 'hint' }, hint) : null);
    },

    /** Input de texto/número/fecha enlazado a obj[key]. */
    input(obj, key, opts) {
      opts = opts || {};
      const type = opts.type || 'text';
      const el = h('input', { type, class: opts.class || '', placeholder: opts.placeholder || '', value: obj[key] === null || obj[key] === undefined ? '' : obj[key], disabled: opts.disabled, list: opts.list, min: opts.min, step: opts.step, 'aria-label': opts.label });
      el.addEventListener('change', () => {
        let v = el.value;
        if (type === 'number') v = v === '' ? null : Number(v);
        else if (opts.trim !== false) v = v.trim();
        if (opts.validate && !opts.validate(v, el)) { el.value = obj[key] === null || obj[key] === undefined ? '' : obj[key]; return; }
        obj[key] = v;
        if (opts.save !== false) Store.save();
        if (opts.after) opts.after(v);
      });
      return el;
    },

    /** Select. options: [{value,label,group?}] */
    select(options, value, onchange, opts) {
      opts = opts || {};
      const el = h('select', { class: opts.class || '', disabled: opts.disabled, 'aria-label': opts.label });
      UI.fillSelect(el, options, value);
      el.addEventListener('change', () => onchange(el.value, el));
      return el;
    },
    fillSelect(el, options, value) {
      U.clear(el);
      const groups = {};
      options.forEach(o => {
        const opt = h('option', { value: o.value, title: o.title || null }, o.label);
        if (o.group) {
          let gr = groups[o.group];
          if (!gr) { gr = groups[o.group] = h('optgroup', { label: o.group }); el.appendChild(gr); }
          gr.appendChild(opt);
        } else el.appendChild(opt);
      });
      el.value = value === null || value === undefined ? '' : value;
      if (el.value !== (value === null || value === undefined ? '' : String(value))) el.value = '';
    },

    /** Opciones agrupadas por categoría para un conjunto de items. */
    itemOptions(items, vacio) {
      const o = vacio === false ? [] : [{ value: '', label: vacio || '— seleccione —' }];
      items.forEach(i => o.push({ value: i.id, label: i.descripcion, group: i.categoria, title: (i.marca ? i.marca + ' · ' : '') + (i.parte || '') }));
      return o;
    },

    btn(label, onclick, cls, title) { return h('button', { type: 'button', class: 'btn ' + (cls || ''), onclick, title: title || null }, label); },
    iconBtn(label, title, onclick, cls) { return h('button', { type: 'button', class: 'icon-btn ' + (cls || ''), onclick, title, 'aria-label': title }, label); },

    card(title, body, extra) {
      return h('section', { class: 'card' },
        h('header', { class: 'card-h' }, h('h3', null, title), extra || null),
        h('div', { class: 'card-b' }, body));
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
    /** Pide un texto (p. ej. código del nivel) */
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
