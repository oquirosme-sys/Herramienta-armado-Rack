/* Pestaña de un nivel / cuarto: rack y equipos y etiquetado de puertos.
   Las celdas calculadas se actualizan con "bindings" (sin reconstruir la tabla) para no perder el foco al teclear. */
(function (g) {
  'use strict';
  const h = U.h;
  const lastSub = {};
  const EXCL_RACK_LIST = ['rack', 'orgvert', 'jack', 'canalizacion', 'cableado'];

  function render(root, roomId) {
    U.clear(root);
    const room = Store.findRoom(roomId);
    if (!room) { root.appendChild(h('p', { class: 'empty' }, 'El nivel ya no existe.')); return; }
    const B = { hdr: [], pane: [] };
    let C = null;
    const refresh = () => { C = Calc.calcRoom(room, Store.catalog, Store.project); B.hdr.forEach(f => f(C)); B.pane.forEach(f => f(C)); };

    /* ---------- encabezado con indicadores ---------- */
    const kpi = (label, cls) => { const v = h('b'); const el = h('div', { class: 'kpi ' + (cls || '') }, h('span', null, label), v); return { el, v }; };
    const kRU = kpi('RU ocupados'), kPct = kpi('Llenado del rack'), kPP = kpi('Patch panels'), kOut = kpi('Salidas etiquetadas'), kPPpct = kpi('Llenado de paneles'), kW = kpi('Consumo típico');
    B.hdr.push(c => {
      kRU.v.textContent = c.ocupados + ' / ' + c.totalRU + (c.rackQty > 1 ? ' (×' + c.rackQty + ')' : '');
      kPct.v.textContent = U.pct(c.pctRack); kPct.el.classList.toggle('bad', c.excede);
      kPP.v.textContent = c.panels.length + ' · ' + c.ports + ' puertos';
      kOut.v.textContent = c.outlets; kPPpct.v.textContent = c.ports ? U.pct(c.pctPanel) : '–';
      kW.v.textContent = U.fmt(c.power.consumo) + ' W';
    });
    const head = h('div', { class: 'room-head' },
      h('div', null, h('h2', null, 'Nivel ', h('span', { class: 'code' }, room.codigo)), h('p', { class: 'muted' }, room.descripcion || 'Sin descripción')),
      h('div', { class: 'kpis' }, kRU.el, kPct.el, kPP.el, kOut.el, kPPpct.el, kW.el),
      h('p', { class: 'print-meta' }, [Store.project.nombre, Store.project.numero && 'Proyecto N.º ' + Store.project.numero, Store.project.ubicacion, Store.project.revision && 'Rev. ' + Store.project.revision, Store.project.fecha, Store.project.elaboro && 'Elaboró: ' + Store.project.elaboro].filter(Boolean).join('  ·  ')),
      h('div', { class: 'no-print toolbar-inline' }, UI.btn('Imprimir hoja', () => window.print(), 'small'), UI.btn('Exportar nivel a Word', () => ExportDoc.download(room.id), 'small primary')));

    /* ---------- sub-pestañas ---------- */
    const subs = [['rack', 'Rack y equipos'], ['etiquetado', 'Etiquetado de puertos']];
    const paneHost = h('div', { class: 'pane' });
    const tabs = h('div', { class: 'subtabs no-print', role: 'tablist' });
    function showSub(k) {
      lastSub[roomId] = k; B.pane = [];
      [...tabs.children].forEach(b => b.setAttribute('aria-selected', b.dataset.k === k ? 'true' : 'false'));
      U.clear(paneHost);
      paneHost.appendChild(k === 'rack' ? rackPane(room, B, refresh, root, roomId) : portsPane(room, B, refresh));
      refresh();
    }
    subs.forEach(([k, t]) => tabs.appendChild(h('button', { type: 'button', role: 'tab', 'data-k': k, onclick: () => showSub(k) }, t)));
    root.appendChild(h('div', { class: 'stack' }, head, tabs, paneHost));
    showSub(lastSub[roomId] === 'etiquetado' ? 'etiquetado' : 'rack');
  }

  /* =====================================================================
     RACK Y EQUIPOS
     ===================================================================== */
  function rackPane(room, B, refresh, root, roomId) {
    const cat = Store.catalog, p = Store.project, ix = Calc.index(cat);
    const tipos = [{ value: '', label: '—' }].concat(cat.tiposSalida.map(t => ({ value: t.codigo, label: t.codigo + ' — ' + t.nombre })));
    const rackItems = Store.itemsByRole('rack');
    const orgItems = Store.itemsByRole('orgvert');
    const ubic = cat.listas.orgVertUbic.map(v => ({ value: v, label: v }));

    /* --- datos del cuarto --- */
    const rackInfo = h('small', { class: 'hint' });
    B.pane.push(c => { rackInfo.textContent = c.rack ? c.rack.marca + ' ' + c.rack.parte + ' · ' + c.totalRU + ' RU' + (c.rack.notas ? ' · ' + c.rack.notas : '') : 'Seleccione un rack o gabinete.'; });
    const datos = h('div', { class: 'grid cols-4' },
      UI.field('Código del cuarto', UI.input(room, 'codigo', {
        validate: v => { if (!v) { UI.toast('El código no puede quedar vacío.', 'warn'); return false; } if (p.niveles.some(o => o !== room && o.codigo === v)) { UI.toast('Ya existe un nivel con ese código.', 'warn'); return false; } return true; },
        after: () => { App.refreshTabs(); refresh(); },
      }), 'Prefijo de las etiquetas.'),
      UI.field('Descripción', UI.input(room, 'descripcion', { after: () => App.refreshTabs() }), null, 'span-3'),
      UI.field('Rack / gabinete', UI.select(UI.itemOptions(rackItems, '— seleccione —'), room.rackId, v => { room.rackId = v; Store.save(); refresh(); }), null, 'span-2'),
      UI.field('Cantidad', UI.input(room, 'rackQty', { type: 'number', min: 1, step: 1, after: refresh })),
      h('div', { class: 'field' }, h('span', { class: 'field-l' }, 'Capacidad'), rackInfo),
      UI.field('Organizador vertical', UI.select(UI.itemOptions(orgItems, '— ninguno —'), room.orgVertId, v => { room.orgVertId = v; Store.save(); refresh(); }), 'En gabinete use "Sin organizador" si ya trae gestión vertical.', 'span-2'),
      UI.field('Ubicación', UI.select(ubic, room.orgVertUbic, v => { room.orgVertUbic = v; Store.save(); refresh(); })),
    );

    /* --- equipos en el rack --- */
    const eqItems = Store.itemsByRole(['equipo', 'panel', 'libre', 'reservado', 'ups'], i => i.ru > 0);
    const eqOpts = UI.itemOptions(eqItems, '— seleccione equipo —');
    const tbody = h('tbody');
    const table = h('table', { class: 'tbl eq' },
      h('thead', null, h('tr', null, ['#', 'Equipo', 'N.º de parte', 'RU', 'Puertos', 'RU sup.', 'RU inf.', 'Panel', 'Tipo salida', 'Salidas', '% llenado', 'Utilización / notas', ''].map(t => h('th', null, t)))), tbody);

    function buildRows() {
      U.clear(tbody);
      room.equipos.forEach((eq, i) => tbody.appendChild(eqRow(eq, i)));
    }
    function eqRow(eq, i) {
      const cPart = h('td', { class: 'muted' }), cRU = h('td', { class: 'num' }), cPt = h('td', { class: 'num' }), cSup = h('td', { class: 'num' }), cInf = h('td', { class: 'num' }), cPanel = h('td', null), cPct = h('td', { class: 'num' });
      const sel = UI.select(eqOpts, eq.itemId, v => { eq.itemId = v; const it = Store.item(v); if (!it || Store.roleOfCat(it.categoria) !== 'panel') { eq.tipo = ''; eq.salidas = null; eq.mas = []; tipoSel.value = ''; salInp.value = ''; } Store.save(); refresh(); }, { label: 'Equipo' });
      const tipoSel = UI.select(tipos, eq.tipo || '', v => { eq.tipo = v; Store.save(); refresh(); }, { label: 'Tipo de salida', class: 'w-tipo' });
      const salInp = UI.input(eq, 'salidas', { type: 'number', min: 0, step: 1, class: 'w-num', label: 'Salidas', after: refresh });
      const ptxt = h('span', { class: 'print-txt' });
      const notas = UI.input(eq, 'notas', { label: 'Notas' });
      const masBtn = h('button', { type: 'button', class: 'btn small more', title: 'Agregar otros tipos de salida en este mismo panel', onclick: () => masDialog(eq, refresh, masBtn) });
      const masTxt = () => { masBtn.textContent = (eq.mas && eq.mas.length) ? '+' + eq.mas.length : '+ tipo'; };
      masTxt();
      const tr = h('tr', null,
        h('td', { class: 'num' }, i + 1), h('td', { class: 'c-eq' }, sel, ptxt), cPart, cRU, cPt, cSup, cInf, cPanel,
        h('td', null, tipoSel), h('td', { class: 'nowrap' }, salInp, masBtn), cPct, h('td', null, notas),
        h('td', { class: 'row-actions' },
          UI.iconBtn('▲', 'Subir', () => move(i, -1)), UI.iconBtn('▼', 'Bajar', () => move(i, 1)),
          UI.iconBtn('⧉', 'Duplicar fila', () => dup(i)), UI.iconBtn('✕', 'Quitar fila', () => del(i), 'danger')));
      B.pane.push(c => {
        const r = c.rows.find(x => x.eq === eq);
        const it = r && r.item, isP = !!(r && r.panel);
        ptxt.textContent = it ? it.descripcion : '';
        cPart.textContent = it ? it.parte : ''; cRU.textContent = it ? r.ru : ''; cPt.textContent = isP ? r.panel.np : '';
        const fuera = it && r.ru > 0 && r.inf < 1;
        cSup.textContent = r && r.sup !== null ? r.sup : ''; cInf.textContent = r && r.inf !== null ? r.inf : '';
        tr.classList.toggle('over', !!fuera); cInf.title = fuera ? 'Excede la capacidad del rack' : '';
        cPanel.textContent = isP ? r.panel.code : ''; cPanel.className = isP ? 'strong' : '';
        cPct.textContent = isP ? U.pct(r.panel.np ? r.panel.labeled / r.panel.np : 0) : '';
        tipoSel.disabled = !isP; salInp.disabled = !isP; masBtn.disabled = !isP; masTxt();
        tr.firstChild.style.borderLeft = '6px solid ' + (it ? ix.colorOf(it) : 'transparent');
      });
      return tr;
    }
    const move = (i, d) => { const a = room.equipos, j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; Store.save(); buildRows(); refresh(); };
    const dup = i => { const c = U.clone(room.equipos[i]); c.id = U.uid(); room.equipos.splice(i + 1, 0, c); Store.save(); buildRows(); refresh(); };
    const del = i => { room.equipos.splice(i, 1); Store.save(); buildRows(); refresh(); };
    const addEq = (itemId, n) => { for (let k = 0; k < n; k++) room.equipos.push({ id: U.uid(), itemId: itemId || '', tipo: '', salidas: null, notas: '' }); Store.save(); buildRows(); refresh(); };

    const addSel = UI.select(UI.itemOptions(eqItems, 'Agregar equipo al final del rack…'), '', () => { }, {});
    const addQty = h('input', { type: 'number', min: 1, max: 48, value: 1, class: 'w-num', 'aria-label': 'Cantidad a agregar' });
    const eqCard = UI.card('Equipos en el rack', [
      h('p', { class: 'hint' }, 'De arriba hacia abajo. En los patch panels elija el tipo de salida y cuántas salidas usa (vacío = todas); ese tipo se asigna a los puertos del etiquetado.'),
      h('div', { class: 'table-wrap' }, table),
      h('div', { class: 'toolbar no-print' }, addSel, addQty,
        UI.btn('+ Agregar', () => { if (!addSel.value) { UI.toast('Elija un equipo de la lista.', 'warn'); return; } addEq(addSel.value, Math.max(1, Number(addQty.value) || 1)); addSel.value = ''; addQty.value = 1; }, 'primary'),
        UI.btn('+ Fila vacía', () => addEq('', 1))),
      (() => { const m = h('p', { class: 'status' }); B.pane.push(c => { m.className = 'status ' + (c.excede ? 'bad' : 'ok'); m.textContent = c.excede ? '❌ EXCEDE: ' + c.usoRU + ' de ' + c.totalRU + ' RU (sobran ' + (c.usoRU - c.totalRU) + ')' : '✓ OK: cabe en el rack — ' + c.ocupados + ' RU ocupados, ' + c.libres + ' libres (' + U.pct(c.pctRack) + ')'; }); return m; })(),
    ]);
    buildRows();

    /* --- fuera del rack --- */
    const fuItems = Store.itemsByRole(['equipo', 'ups', 'panel'], i => !(i.ru > 0));
    const fuOpts = UI.itemOptions(fuItems, '— seleccione equipo —');
    const fbody = h('tbody');
    function buildOut() {
      U.clear(fbody);
      room.fuera.forEach((f, i) => {
        const part = h('td', { class: 'muted' });
        const sel = UI.select(fuOpts, f.itemId, v => { f.itemId = v; part.textContent = (Store.item(v) || {}).parte || ''; Store.save(); refresh(); }, { label: 'Equipo fuera del rack' });
        part.textContent = (Store.item(f.itemId) || {}).parte || '';
        fbody.appendChild(h('tr', null, h('td', { class: 'num' }, i + 1), h('td', { class: 'c-eq' }, sel, h('span', { class: 'print-txt' }, (Store.item(f.itemId) || {}).descripcion || '')), part,
          h('td', null, UI.input(f, 'cant', { type: 'number', min: 0, step: 1, class: 'w-num', after: refresh })), h('td', null, UI.input(f, 'notas')),
          h('td', { class: 'row-actions' }, UI.iconBtn('✕', 'Quitar', () => { room.fuera.splice(i, 1); Store.save(); buildOut(); refresh(); }, 'danger'))));
      });
    }
    buildOut();
    const outCard = UI.card('Equipos fuera del rack', [
      h('p', { class: 'hint' }, 'Pared del cuarto o campo: control de acceso, audio, parlantes… (entran en la lista de materiales).'),
      h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ['#', 'Equipo', 'N.º de parte', 'Cant.', 'Notas', ''].map(t => h('th', null, t)))), fbody)),
      h('div', { class: 'toolbar no-print' }, UI.btn('+ Agregar equipo de campo', () => { room.fuera.push({ id: U.uid(), itemId: '', cant: 1, notas: '' }); Store.save(); buildOut(); })),
    ]);

    /* --- potencia y calor --- */
    const pv = {};
    const prow = (k, label, unit, noteFn) => { const v = h('td', { class: 'num strong' }), n = h('td', { class: 'muted' }); pv[k] = [v, n, noteFn]; return h('tr', null, h('td', null, label), v, h('td', null, unit), n); };
    const poeInp = UI.input(room, 'poeW', { type: 'number', min: 0, step: 10, class: 'w-num', label: 'Carga PoE', after: refresh });
    const ptable = h('table', { class: 'tbl compact' }, h('tbody', null,
      prow('consumo', 'Consumo de equipos en el rack (sin PoE)', 'W', c => c.power.sinDato > 0 ? '⚠ ' + c.power.sinDato + ' equipo(s) sin dato de consumo en el Catálogo' : '✓ Todos los equipos tienen dato de consumo'),
      h('tr', null, h('td', null, 'Carga PoE entregada a dispositivos (dato)'), h('td', { class: 'num' }, poeInp), h('td', null, 'W'), h('td', { class: 'muted' }, 'Dato de entrada: PoE total de los switches. Carga el UPS pero no calienta el cuarto.')),
      prow('carga', 'Carga total sobre UPS', 'W', () => 'Consumo de equipos + carga PoE.'),
      prow('calor', 'Calor disipado en el cuarto', 'BTU/h', c => '≈ ' + U.fmt(c.power.tr, 2) + ' t.r. · dato para la hoja de cargas térmicas'),
      prow('peso', 'Peso estimado de los equipos', 'kg', () => 'Solo equipos de la lista; sin rack ni cableado.'),
      prow('cap', 'Capacidad UPS instalada (suma)', 'W', c => c.power.capSum === 0 ? 'Sin UPS en la lista de equipos' : c.power.upsN + ' UPS en el rack'),
      prow('pct', 'Carga sobre UPS (todos en servicio)', '% UPS', c => c.power.pctUps === null ? '' : c.power.pctUps > 0.8 ? '⚠ Más del 80 % de la capacidad' : '✓ Dentro del 80 % de la capacidad'),
      prow('pct1', 'Carga sobre 1 UPS (si el otro falla)', '% UPS', c => c.power.pctUno === null ? '' : c.power.upsN < 2 ? 'Un solo UPS: sin redundancia' : c.power.pctUno > 0.8 ? '⚠ Un UPS no soporta la carga' : '✓ Un UPS soporta la carga')));
    B.pane.push(c => {
      const P = c.power, set = (k, t) => { pv[k][0].textContent = t; pv[k][1].textContent = pv[k][2](c); };
      set('consumo', U.fmt(P.consumo)); set('carga', U.fmt(P.cargaUps)); set('calor', U.fmt(P.calorBTU)); set('peso', U.fmt(P.peso));
      set('cap', U.fmt(P.capSum)); set('pct', P.pctUps === null ? '' : U.pct(P.pctUps)); set('pct1', P.pctUno === null ? '' : U.pct(P.pctUno));
    });
    const pwCard = UI.card('Potencia, calor y peso', [h('p', { class: 'hint' }, 'Valores típicos de planificación del Catálogo (no de fabricante): confirmar con la hoja técnica.'), h('div', { class: 'table-wrap' }, ptable)]);

    /* --- vista del rack --- */
    const elev = h('div', { class: 'elev-host' });
    B.pane.push(c => drawElevation(elev, c, room));
    const elevCard = UI.card('Vista del rack', elev);
    elevCard.classList.add('sticky');

    return h('div', { class: 'rack-layout' },
      h('div', { class: 'stack' }, UI.card('Datos del cuarto', datos), eqCard, outCard, pwCard), elevCard);
  }

  /** Tipos de salida adicionales de un mismo patch panel (p. ej. 12 D + 12 W). Se asignan en orden tras las salidas del tipo principal. */
  function masDialog(eq, refresh, btn) {
    const item = Store.item(eq.itemId), np = item ? item.puertos || 0 : 0;
    eq.mas = eq.mas || [];
    const tipos = [{ value: '', label: '— tipo —' }].concat(Store.catalog.tiposSalida.filter(t => t.codigo !== '-').map(t => ({ value: t.codigo, label: t.codigo + ' — ' + t.nombre })));
    const info = h('p', { class: 'status' }), host = h('div', { class: 'stack' });
    const calcInfo = () => {
      const masSum = eq.mas.reduce((a, m) => a + (Number(m.cant) || 0), 0);
      const blank = eq.salidas === null || eq.salidas === undefined || eq.salidas === '';
      const first = blank ? Math.max(0, np - masSum) : Number(eq.salidas) || 0;
      const total = first + masSum;
      info.className = 'status ' + (total > np ? 'bad' : 'ok');
      info.textContent = 'Panel de ' + np + ' puertos: ' + (eq.tipo || 'sin tipo') + ' ×' + first + (eq.mas.length ? ' + ' + eq.mas.map(m => (m.tipo || '?') + ' ×' + (m.cant || 0)).join(' + ') : '') + ' = ' + total + ' de ' + np + (total > np ? ' (sobran ' + (total - np) + ': se recortan)' : ' (' + (np - total) + ' sin salida)');
    };
    const build = () => {
      U.clear(host);
      host.appendChild(h('p', { class: 'hint' }, 'El tipo y las salidas del panel (columnas de la tabla) son el primer tramo, desde el puerto 1. Cada tipo adicional continúa a partir del puerto siguiente. Si deja "Salidas" vacío, el primer tramo ocupa los puertos que sobren.'));
      eq.mas.forEach((m, i) => host.appendChild(h('div', { class: 'toolbar' },
        UI.select(tipos, m.tipo, v => { m.tipo = v; calcInfo(); }), UI.input(m, 'cant', { type: 'number', min: 1, step: 1, save: false, after: calcInfo, class: 'w-num' }), h('span', { class: 'muted' }, 'salidas'),
        UI.iconBtn('✕', 'Quitar', () => { eq.mas.splice(i, 1); build(); }, 'danger'))));
      host.appendChild(h('div', { class: 'toolbar' }, UI.btn('+ Agregar otro tipo', () => { eq.mas.push({ tipo: '', cant: 12 }); build(); }, 'primary')));
      host.appendChild(info); calcInfo();
    };
    build();
    UI.modal('Tipos de salida del panel', host, [{ label: 'Cancelar', onclick: () => { eq.mas = JSON.parse(snap); } }, { label: 'Aceptar', cls: 'primary', onclick: () => { eq.mas = eq.mas.filter(m => m.tipo && Number(m.cant) > 0); Store.save(); refresh(); if (btn) btn.textContent = eq.mas.length ? '+' + eq.mas.length : '+ tipo'; } }]);
    var snap = JSON.stringify(eq.mas);
  }

  function drawElevation(host, C, room) {
    U.clear(host);
        const ix = Calc.index(Store.catalog);
    const orgOn = C.room.orgVertId ? (C.room.orgVertUbic) : 'Sin organizador';
    const orgItem = ix.byId[room.orgVertId];
    const orgText = orgItem ? 'ORGANIZADOR VERTICAL ' + orgItem.parte : '';
    const left = orgOn === 'Ambos lados' || orgOn === 'Lado izquierdo', right = orgOn === 'Ambos lados' || orgOn === 'Lado derecho';
    const nums = h('div', { class: 'elev-nums' }), mid = h('div', { class: 'elev-rack' });
    C.elevation.forEach(b => {
      const hgt = (b.from - b.to + 1);
      nums.appendChild(h('div', { class: 'elev-n', style: { height: 'calc(var(--ru) * ' + hgt + ')' } }, b.from === b.to ? b.from : b.from + '–' + b.to));
      if (!b.row) { mid.appendChild(h('div', { class: 'elev-b empty', style: { height: 'calc(var(--ru) * ' + hgt + ')' } })); return; }
      const it = b.row.item, role = b.row.role;
      const label = b.row.panel ? 'Patch panel ' + b.row.panel.code + ' · ' + b.row.panel.np + ' p' + (b.row.panel.tipo ? ' · ' + b.row.panel.tipo : '') : it.descripcion;
      mid.appendChild(h('div', { class: 'elev-b ' + role, style: { height: 'calc(var(--ru) * ' + hgt + ')', background: ix.colorOf(it) }, title: it.descripcion + (it.marca ? ' · ' + it.marca : '') + ' · ' + b.row.ru + ' RU' }, h('span', null, label)));
    });
    const side = (on) => h('div', { class: 'elev-org' + (on ? ' on' : ''), title: on ? orgText : '' }, on ? h('span', null, orgText) : null);
    host.appendChild(h('div', { class: 'elev' }, nums, side(left), mid, side(right), nums.cloneNode(true)));
    if (!left && !right) host.appendChild(h('p', { class: 'hint' }, 'Sin organizador vertical: elíjalo y su ubicación en "Datos del cuarto" para verlo en el alzado.'));
    if (C.rackQty > 1) host.appendChild(h('p', { class: 'hint' }, '× ' + C.rackQty + ' racks iguales (las cantidades de rack y organizadores ya se multiplican en materiales).'));
    const over = C.rows.filter(r => r.item && r.ru > 0 && r.inf < 1);
    if (over.length) host.appendChild(h('p', { class: 'status bad' }, '❌ ' + over.length + ' equipo(s) no caben en el rack.'));
    const used = [...new Set(C.rows.filter(r => r.item).map(r => r.item.categoria))];
    host.appendChild(h('div', { class: 'legend' }, (left || right) ? h('span', null, h('i', { style: { background: '#8EA9DB' } }), 'Organizador vertical') : null, used.map(cn => { const it = C.rows.find(r => r.item && r.item.categoria === cn).item; return h('span', null, h('i', { style: { background: ix.colorOf(it) } }), cn); })));
  }

  /* =====================================================================
     ETIQUETADO DE PUERTOS
     ===================================================================== */
  function portsPane(room, B, refresh) {
    const cat = Store.catalog;
    const opts = [{ value: '', label: 'Auto' }].concat(cat.tiposSalida.map(t => ({ value: t.codigo, label: t.codigo === '-' ? '- (sin salida)' : t.codigo })));
    const C0 = Calc.calcRoom(room, cat, Store.project);
    const showAgain = () => render(document.getElementById('view'), room.id);
    const host = h('div', { class: 'stack' });
    host.appendChild(h('p', { class: 'hint' }, 'El tipo de salida viene del panel (lista de equipos). En "Ajuste" puede cambiarlo puerto por puerto, o elegir "-" para dejar el puerto sin salida. Etiqueta = Cuarto-Panel-Puerto.'));
    host.appendChild(h('div', { class: 'toolbar no-print' },
      UI.btn('Exportar etiquetas (CSV)', () => {
        const c = Calc.calcRoom(room, cat, Store.project);
        const rows = [['Cuarto', 'Panel', 'Puerto', 'Etiqueta', 'Tipo', 'Salida']];
        c.panels.forEach(P => P.ports.forEach(o => { if (o.tipo) rows.push([room.codigo, P.code, U.pad(o.n, 2), o.label, o.tipo, o.salida]); }));
        U.download('etiquetas-' + room.codigo + '.csv', U.csv(rows), 'text/csv;charset=utf-8');
      }),
      UI.btn('Quitar todos los ajustes por puerto', async () => { if (await UI.confirm('¿Quitar los ajustes manuales de este cuarto y volver al tipo del panel?', 'Quitar', true)) { room.portTipos = {}; Store.save(); showAgain(); } }, 'ghost')));
    if (!C0.panels.length) { host.appendChild(h('p', { class: 'empty' }, 'No hay patch panels de cobre en la lista de equipos. Agréguelos en "Rack y equipos".')); return host; }

    C0.panels.forEach(P0 => {
      const eq = P0.eq;
      const title = h('h4'); B.pane.push(c => { const P = c.panels.find(x => x.eq === eq); if (P) title.textContent = 'Panel ' + P.code + ' · ' + P.np + ' puertos' + (P.tipo ? ' · ' + P.tipo : '') + ' · ' + U.pct(P.np ? P.labeled / P.np : 0) + ' llenado'; });
      const grid = h('div', { class: 'port-grid' });
      for (let b = 0; b < P0.blocks; b++) {
        const tb = h('tbody');
        for (let n = b * 24 + 1; n <= Math.min(P0.np, b * 24 + 24); n++) {
          const key = eq.id + ':' + n;
          const sel = UI.select(opts, room.portTipos[key] || '', v => { if (v) room.portTipos[key] = v; else delete room.portTipos[key]; Store.save(); refresh(); }, { class: 'w-tipo', label: 'Ajuste puerto ' + n });
          const cS = h('td', { class: 'strong' }), cL = h('td', null);
          const tr = h('tr', null, h('td', { class: 'num' }, U.pad(n, 2)), h('td', null, sel), cS, cL);
          B.pane.push(c => { const P = c.panels.find(x => x.eq === eq); const o = P && P.ports[n - 1]; if (!o) return; cS.textContent = o.salida; cL.textContent = o.label; tr.classList.toggle('noout', !o.tipo); sel.classList.toggle('adj', !!o.ov); });
          tb.appendChild(tr);
        }
        grid.appendChild(h('table', { class: 'tbl compact ports' }, h('thead', null, h('tr', null, ['Puerto', 'Ajuste', 'Salida', 'Etiqueta'].map(t => h('th', null, t)))), tb));
      }
      host.appendChild(UI.card('', grid, null)); const card = host.lastChild; card.querySelector('.card-h h3').replaceWith(title);
    });
    return host;
  }

  g.RoomView = { render, drawElevation };
})(window);
