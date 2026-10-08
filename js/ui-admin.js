/* Administración (solo rol admin): catálogo de equipos, canastas, tuberías, cableado, marcas,
   categorías, tipos de salida, referencias, seguridad/respaldo y revisiones.
   Paso 2: estas escrituras irán a Supabase protegidas por RLS (solo perfiles con rol admin). */
(function (g) {
  'use strict';
  const h = U.h;
  let sub = 'catalogo';
  const filtro = { cat: '', q: '' };

  const ROLES = [
    ['equipo', 'Equipo de rack (lista de equipos; con RU)'],
    ['panel', 'Patch panel de cobre (genera etiquetado de puertos)'],
    ['rack', 'Rack / gabinete / soporte de pared'],
    ['orgvert', 'Organizador vertical'],
    ['jack', 'Jack (una unidad por salida)'],
    ['ups', 'UPS (entra al balance de capacidad)'],
    ['libre', 'Espacio libre (no se compra ni cuenta como ocupado)'],
    ['reservado', 'Espacio reservado (ocupa RU, no se compra)'],
    ['canalizacion', 'Canalización (canasta, tubería, escalerilla…)'],
    ['cableado', 'Cableado (cobre, fibra…)'],
  ];

  function render(root) {
    U.clear(root);
    if (!Auth.isAdmin()) { root.appendChild(h('p', { class: 'empty' }, 'Esta sección es solo para administradores.')); return; }
    const tabs = [['catalogo', 'Catálogo'], ['categorias', 'Categorías'], ['marcas', 'Marcas'], ['tipos', 'Tipos de salida'], ['refs', 'Marcas de referencia'], ['seguridad', 'Seguridad y respaldo'], ['revisiones', 'Revisiones']];
    const body = h('div', { class: 'stack' });
    const bar = h('div', { class: 'subtabs', role: 'tablist' }, tabs.map(([k, t]) => h('button', { type: 'button', role: 'tab', 'aria-selected': k === sub ? 'true' : 'false', onclick: () => { sub = k; render(root); } }, t)));
    root.appendChild(h('div', { class: 'stack' }, h('div', { class: 'room-head' }, h('div', null, h('h2', null, 'Administración'), h('p', { class: 'muted' }, 'Aquí se agregan marcas, tipos de canasta, tubería, cableado y equipos. Los cambios afectan a todos los niveles del proyecto.'))), bar, body));
    ({ catalogo, categorias, marcas, tipos, refs, seguridad, revisiones })[sub](body, () => render(root));
  }

  /* ---------------- Catálogo ---------------- */
  function catalogo(host, redraw) {
    const cat = Store.catalog;
    const sel = UI.select([{ value: '', label: 'Todas las categorías' }].concat(cat.categorias.map(c => ({ value: c.nombre, label: c.nombre }))), filtro.cat, v => { filtro.cat = v; redraw(); });
    const q = h('input', { type: 'search', placeholder: 'Buscar descripción, marca o parte…', value: filtro.q, 'aria-label': 'Buscar' });
    q.addEventListener('input', () => { filtro.q = q.value; fill(); });
    const tb = h('tbody');
    const fill = () => {
      U.clear(tb);
      const t = filtro.q.toLowerCase();
      const items = cat.items.filter(i => (!filtro.cat || i.categoria === filtro.cat) && (!t || [i.descripcion, i.marca, i.parte, i.categoria].join(' ').toLowerCase().includes(t)));
      count.textContent = items.length + ' de ' + cat.items.length;
      items.forEach(i => tb.appendChild(h('tr', null,
        h('td', null, i.categoria), h('td', null, i.descripcion), h('td', null, i.marca), h('td', { class: 'muted' }, i.parte),
        h('td', { class: 'num' }, i.ru ?? ''), h('td', { class: 'num' }, i.puertos ?? ''), h('td', { class: 'num' }, i.consumo ?? ''),
        h('td', { class: 'row-actions' }, UI.iconBtn('✎', 'Editar', () => itemForm(i, redraw)), UI.iconBtn('⧉', 'Duplicar', () => itemForm(Object.assign(U.clone(i), { id: null, descripcion: i.descripcion + ' (copia)' }), redraw)),
          UI.iconBtn('✕', 'Eliminar', async () => {
            const u = Store.usageOfItem(i.id);
            if (u) { UI.alert('No se puede eliminar: se usa ' + u + ' vez/veces en el proyecto actual. Quítelo primero de los niveles.'); return; }
            if (await UI.confirm('¿Eliminar "' + i.descripcion + '" del catálogo?', 'Eliminar')) { cat.items = cat.items.filter(x => x !== i); Store.saveCatalog(); redraw(); }
          }, 'danger')))));
    };
    const count = h('span', { class: 'muted' });
    host.appendChild(UI.card('Catálogo de equipos y materiales', [
      h('div', { class: 'toolbar' }, sel, q, count, h('span', { class: 'grow' }), UI.btn('+ Nuevo', () => itemForm({ id: null, categoria: filtro.cat || (cat.categorias[0] || {}).nombre, descripcion: '', marca: '', parte: '', ru: null, puertos: null, notas: '', consumo: null, peso: null, capacidad: null }, redraw), 'primary')),
      h('div', { class: 'table-wrap tall' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ['Categoría', 'Descripción', 'Marca', 'N.º de parte', 'RU', 'Puertos', 'W', ''].map(t => h('th', null, t)))), tb))]));
    fill();
  }

  function itemForm(src, redraw) {
    const cat = Store.catalog, it = Object.assign({}, src), isNew = !src.id;
    const d = {};
    const roleOf = () => Store.roleOfCat(d.categoria.value);
    const inp = (k, type, extra) => { d[k] = h('input', Object.assign({ type: type || 'text', value: it[k] === null || it[k] === undefined ? '' : it[k] }, extra || {})); return d[k]; };
    d.categoria = UI.select(cat.categorias.map(c => ({ value: c.nombre, label: c.nombre })), it.categoria, () => toggle());
    const marcaList = h('datalist', { id: 'dl-marcas' }, cat.marcas.map(m => h('option', { value: m })));
    const extraRu = h('div', { class: 'grid cols-4' },
      UI.field('RU', inp('ru', 'number', { min: 0, step: 1 }), 'Vacío = no va en el rack'), UI.field('Puertos', inp('puertos', 'number', { min: 0, step: 1 })),
      UI.field('Consumo típico (W)', inp('consumo', 'number', { min: 0 }), 'Vacío = sin dato'), UI.field('Peso (kg)', inp('peso', 'number', { min: 0 })),
      UI.field('Capacidad de suministro (W)', inp('capacidad', 'number', { min: 0 }), 'Solo UPS'));
    const extraLin = h('div', { class: 'grid cols-4' },
      UI.field('Unidad', inp('unidad', 'text', { placeholder: 'm' })), UI.field('Largo de pieza / rollo (m)', inp('largoPieza', 'number', { min: 0, step: 0.01 }), 'Para calcular piezas o rollos'));
    if (!it.unidad) d.unidad.value = 'm';
    const toggle = () => { const r = roleOf(), lin = r === 'canalizacion' || r === 'cableado'; extraRu.style.display = lin ? 'none' : ''; extraLin.style.display = lin ? '' : 'none'; };
    const notas = h('textarea', { rows: 2 }, it.notas || '');
    const err = h('small', { class: 'err' });
    const body = h('div', { class: 'stack' }, marcaList,
      h('div', { class: 'grid cols-4' }, UI.field('Categoría', d.categoria), UI.field('Descripción', inp('descripcion'), null, 'span-3'),
        UI.field('Marca', inp('marca', 'text', { list: 'dl-marcas' }), 'Si escribe una marca nueva se agrega a la lista de marcas.', 'span-2'), UI.field('N.º de parte', inp('parte'), null, 'span-2')),
      extraRu, extraLin, UI.field('Especificación / notas', notas),
      UI.field('Imagen del catálogo', UI.imagePicker(() => it.imagen || '', v => { it.imagen = v; }, 'Imagen del equipo'), 'Se muestra en la lista de equipos del rack, en la memoria y en el glosario. Se guarda reducida.'), err);
    toggle();
    UI.modal(isNew ? 'Nuevo elemento del catálogo' : 'Editar elemento', body, [{ label: 'Cancelar' }, {
      label: 'Guardar', cls: 'primary', onclick: () => {
        const desc = d.descripcion.value.trim(); if (!desc) { err.textContent = 'La descripción es obligatoria.'; return false; }
        const dup = cat.items.find(x => x.descripcion.toLowerCase() === desc.toLowerCase() && x.id !== src.id);
        if (dup) { err.textContent = 'Ya existe un elemento con esa descripción (los niveles se enlazan por elemento, evite duplicados).'; return false; }
        const out = isNew || !src.id ? { id: Store.nextItemId() } : cat.items.find(x => x.id === src.id);
        out.categoria = d.categoria.value; out.descripcion = desc; out.marca = d.marca.value.trim(); out.parte = d.parte.value.trim(); out.notas = notas.value.trim();
        ['ru', 'puertos', 'consumo', 'peso', 'capacidad', 'largoPieza'].forEach(k => { out[k] = d[k] ? U.toNum(d[k].value) : null; });
        out.unidad = d.unidad.value.trim() || 'm'; out.imagen = it.imagen || '';
        if (out.marca && !cat.marcas.includes(out.marca)) { cat.marcas.push(out.marca); cat.marcas.sort((a, b) => a.localeCompare(b)); }
        if (!cat.items.includes(out)) cat.items.push(out);
        Store.saveCatalog(); redraw(); UI.toast('Catálogo actualizado.');
      },
    }], { wide: true });
  }

  /* ---------------- Categorías ---------------- */
  function categorias(host, redraw) {
    const cat = Store.catalog;
    const tb = h('tbody');
    cat.categorias.forEach(c => {
      const n = cat.items.filter(i => i.categoria === c.nombre).length;
      const oldName = c.nombre;
      const nameI = h('input', { type: 'text', value: c.nombre, 'aria-label': 'Nombre' });
      nameI.addEventListener('change', () => {
        const v = nameI.value.trim();
        if (!v || cat.categorias.some(x => x !== c && x.nombre === v)) { UI.toast('Nombre vacío o repetido.', 'warn'); nameI.value = c.nombre; return; }
        cat.items.forEach(i => { if (i.categoria === c.nombre) i.categoria = v; }); c.nombre = v; Store.saveCatalog(); UI.toast('Categoría renombrada.');
      });
      const rol = UI.select(ROLES.map(([v, t]) => ({ value: v, label: t })), c.rol, v => { c.rol = v; Store.saveCatalog(); }, { label: 'Rol' });
      const col = h('input', { type: 'color', value: c.color, 'aria-label': 'Color' }); col.addEventListener('change', () => { c.color = col.value; Store.saveCatalog(); });
      tb.appendChild(h('tr', null, h('td', null, nameI), h('td', null, rol), h('td', null, col), h('td', { class: 'num' }, n),
        h('td', { class: 'row-actions' }, UI.btn('Glosario…', () => catDetail(c, redraw), 'small'), UI.iconBtn('✕', 'Eliminar', async () => { if (n) { UI.alert('La categoría tiene ' + n + ' elementos; muévalos o elimínelos primero.'); return; } cat.categorias = cat.categorias.filter(x => x !== c); Store.saveCatalog(); redraw(); }, 'danger'))));
    });
    const nm = h('input', { type: 'text', placeholder: 'Nueva categoría (ej. Escalerilla)' });
    const rl = UI.select(ROLES.map(([v, t]) => ({ value: v, label: t })), 'canalizacion', () => { });
    host.appendChild(UI.card('Categorías', [
      h('p', { class: 'hint' }, 'El rol define cómo se usa la categoría. Cree aquí nuevas categorías de canalización (ej. "Escalerilla", "Ducto") o de cableado (ej. "Coaxial") y luego agregue sus elementos en el Catálogo.'),
      h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ['Nombre', 'Rol', 'Color', 'Elementos', ''].map(t => h('th', null, t)))), tb)),
      h('div', { class: 'toolbar' }, nm, rl, UI.btn('+ Agregar categoría', () => {
        const v = nm.value.trim(); if (!v || cat.categorias.some(x => x.nombre === v)) { UI.toast('Nombre vacío o repetido.', 'warn'); return; }
        cat.categorias.push({ nombre: v, rol: rl.value, color: '#d0d7de' }); Store.saveCatalog(); redraw();
      }, 'primary'))]));
  }

  /** Descripción e imágenes de una categoría (módulo Glosario). */
  function catDetail(c, redraw) {
    const imgs = (c.imagenes || []).slice(0, 4); while (imgs.length < 3) imgs.push('');
    const desc = h('textarea', { rows: 6 }, c.descripcion || '');
    const pickers = imgs.map((v, i) => UI.field('Imagen ' + (i + 1), UI.imagePicker(() => imgs[i], x => { imgs[i] = x; }, 'Imagen de ' + c.nombre)));
    UI.modal('Glosario — ' + c.nombre, h('div', { class: 'stack' }, UI.field('Descripción', desc, 'Qué es, para qué sirve y cuándo se usa. Se muestra en el Glosario de equipos.'), ...pickers), [
      { label: 'Cancelar' }, { label: 'Guardar', cls: 'primary', onclick: () => { c.descripcion = desc.value.trim(); c.imagenes = imgs.filter(Boolean); Store.saveCatalog(); UI.toast('Glosario actualizado.'); redraw(); } }], { wide: true });
  }

  /* ---------------- Marcas ---------------- */
  function marcas(host, redraw) {
    const cat = Store.catalog;
    const tb = h('tbody');
    cat.marcas.slice().sort((a, b) => a.localeCompare(b)).forEach(m => {
      const n = cat.items.filter(i => i.marca === m).length;
      const inp = h('input', { type: 'text', value: m, 'aria-label': 'Marca' });
      inp.addEventListener('change', () => {
        const v = inp.value.trim(); if (!v || (v !== m && cat.marcas.includes(v))) { UI.toast('Nombre vacío o repetido.', 'warn'); inp.value = m; return; }
        cat.items.forEach(i => { if (i.marca === m) i.marca = v; }); cat.marcas[cat.marcas.indexOf(m)] = v; Store.saveCatalog(); redraw();
      });
      tb.appendChild(h('tr', null, h('td', null, inp), h('td', { class: 'num' }, n), h('td', { class: 'row-actions' }, UI.iconBtn('✕', 'Eliminar', () => { if (n) { UI.alert('La marca se usa en ' + n + ' elementos del catálogo.'); return; } cat.marcas = cat.marcas.filter(x => x !== m); Store.saveCatalog(); redraw(); }, 'danger'))));
    });
    const nm = h('input', { type: 'text', placeholder: 'Nueva marca' });
    host.appendChild(UI.card('Marcas', [h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ['Marca', 'Elementos', ''].map(t => h('th', null, t)))), tb)),
      h('div', { class: 'toolbar' }, nm, UI.btn('+ Agregar marca', () => { const v = nm.value.trim(); if (!v || cat.marcas.includes(v)) { UI.toast('Nombre vacío o repetido.', 'warn'); return; } cat.marcas.push(v); Store.saveCatalog(); redraw(); }, 'primary'))]));
  }

  /* ---------------- Tipos de salida ---------------- */
  function tipos(host, redraw) {
    const cat = Store.catalog; const tb = h('tbody');
    cat.tiposSalida.forEach(t => tb.appendChild(h('tr', null,
      h('td', null, UI.input(t, 'codigo', { class: 'w-code', save: false, after: () => Store.saveCatalog(), validate: v => !!v && !cat.tiposSalida.some(x => x !== t && x.codigo === v) })),
      h('td', null, UI.input(t, 'nombre', { save: false, after: () => Store.saveCatalog() })),
      h('td', { class: 'row-actions' }, UI.iconBtn('✕', 'Eliminar', () => { cat.tiposSalida = cat.tiposSalida.filter(x => x !== t); Store.saveCatalog(); redraw(); }, 'danger')))));
    const c = h('input', { type: 'text', placeholder: 'Código (ej. R)', class: 'w-code' }), n = h('input', { type: 'text', placeholder: 'Nombre (ej. Radio)' });
    host.appendChild(UI.card('Nomenclatura de tipos de salida', [h('p', { class: 'hint' }, 'El código "-" es especial: marca un puerto sin salida. Cambiar un código no actualiza los paneles ya asignados en los niveles.'),
      h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ['Código', 'Tipo de salida', ''].map(t => h('th', null, t)))), tb)),
      h('div', { class: 'toolbar' }, c, n, UI.btn('+ Agregar tipo', () => { const cv = c.value.trim(), nv = n.value.trim(); if (!cv || !nv || cat.tiposSalida.some(x => x.codigo === cv)) { UI.toast('Código y nombre son obligatorios y el código no puede repetirse.', 'warn'); return; } cat.tiposSalida.push({ codigo: cv, nombre: nv }); Store.saveCatalog(); redraw(); }, 'primary'))]));
  }

  /* ---------------- Referencias ---------------- */
  function refs(host, redraw) {
    const cat = Store.catalog; const tb = h('tbody');
    cat.referencias.forEach(r => tb.appendChild(h('tr', null, h('td', null, UI.input(r, 'sistema', { save: false, after: () => Store.saveCatalog() })), h('td', null, UI.input(r, 'marca', { save: false, after: () => Store.saveCatalog() })),
      h('td', { class: 'row-actions' }, UI.iconBtn('✕', 'Eliminar', () => { cat.referencias = cat.referencias.filter(x => x !== r); Store.saveCatalog(); redraw(); }, 'danger')))));
    host.appendChild(UI.card('Marcas de referencia por sistema', [h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ['Sistema', 'Marca', ''].map(t => h('th', null, t)))), tb)),
      h('div', { class: 'toolbar' }, UI.btn('+ Agregar', () => { cat.referencias.push({ sistema: '', marca: '' }); Store.saveCatalog(); redraw(); }, 'primary'))]));
  }

  /* ---------------- Seguridad y respaldo ---------------- */
  function seguridad(host, redraw) {
    const pw1 = h('input', { type: 'password', autocomplete: 'new-password' }), pw2 = h('input', { type: 'password', autocomplete: 'new-password' });
    const file = h('input', { type: 'file', accept: '.json', style: { display: 'none' } });
    file.addEventListener('change', async () => {
      try { Store.importCatalog(await file.files[0].text()); UI.toast('Catálogo importado.'); redraw(); } catch (e) { UI.alert(e.message); }
    });
    host.appendChild(h('div', { class: 'grid cols-2' },
      UI.card('Contraseña de administrador (modo local)', [
        h('p', { class: 'hint' }, 'En esta versión el acceso de administrador es local a este navegador. Cuando se cree la base de datos en Supabase (paso 2), el rol de administrador vendrá de la cuenta del usuario y se hará cumplir en el servidor.'),
        UI.field('Nueva contraseña', pw1), UI.field('Repetir contraseña', pw2),
        h('div', { class: 'toolbar' }, UI.btn('Cambiar contraseña', () => { if (pw1.value.length < 6) { UI.toast('Mínimo 6 caracteres.', 'warn'); return; } if (pw1.value !== pw2.value) { UI.toast('Las contraseñas no coinciden.', 'warn'); return; } Store.setAdminPassword(pw1.value); pw1.value = pw2.value = ''; UI.toast('Contraseña actualizada en este navegador.'); }, 'primary'))]),
      UI.card('Respaldo del catálogo', [
        h('p', { class: 'hint' }, 'El catálogo editado vive en este navegador. Expórtelo para respaldarlo o para compartirlo con otros equipos hasta que exista la base de datos.'),
        h('div', { class: 'toolbar' }, UI.btn('Exportar catálogo (JSON)', () => U.download('catalogo-rackcode.json', Store.exportCatalog(), 'application/json')), UI.btn('Importar catálogo…', () => file.click()), file,
          UI.btn('Restablecer al catálogo original', async () => { if (await UI.confirm('Se perderán todos los cambios hechos al catálogo en este navegador y se restaurará el catálogo del Excel. ¿Continuar?', 'Restablecer')) { Store.resetCatalog(); UI.toast('Catálogo restablecido.'); redraw(); } }, 'ghost danger'))])));
  }

  /* ---------------- Revisiones ---------------- */
  function revisiones(host, redraw) {
    const cat = Store.catalog;
    const rows = cat.revisiones.slice().reverse().map(r => h('tr', null, h('td', { class: 'num' }, r.n), h('td', null, r.fecha), h('td', null, r.desc)));
    const f = h('input', { type: 'date', value: U.today() }), t = h('textarea', { rows: 2, placeholder: 'Descripción del cambio' });
    host.appendChild(UI.card('Revisiones', [h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ['#', 'Fecha', 'Descripción'].map(x => h('th', null, x)))), h('tbody', null, rows))),
      h('div', { class: 'grid cols-4' }, UI.field('Fecha', f), UI.field('Descripción', t, null, 'span-3')),
      h('div', { class: 'toolbar' }, UI.btn('+ Registrar revisión', () => { if (!t.value.trim()) { UI.toast('Escriba una descripción.', 'warn'); return; } cat.revisiones.push({ n: cat.revisiones.length + 1, fecha: f.value, desc: t.value.trim() }); Store.saveCatalog(); redraw(); }, 'primary'))]));
  }

  g.AdminView = { render };
})(window);
