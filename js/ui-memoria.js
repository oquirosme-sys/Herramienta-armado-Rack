/* Memoria de cálculo: consolida todos los niveles (equivale a la hoja Resumen del Excel,
   Solo lectura; se recalcula cada vez que se abre. */
(function (g) {
  'use strict';
  const h = U.h;

  function render(root) {
    U.clear(root);
    const p = Store.project, cat = Store.catalog;
    const P = Calc.calcProject(p, cat);
    const R = P.rooms;
    const th = arr => h('thead', null, h('tr', null, arr.map(t => h('th', null, t))));
    const roomCols = R.map(c => c.room.codigo);
    const num = (v, d) => h('td', { class: 'num' }, v ? U.fmt(v, d) : '–');

    if (!R.length) { root.appendChild(h('p', { class: 'empty' }, 'Agregue al menos un nivel en la pestaña Proyecto para generar la memoria de cálculo.')); return; }

    /* encabezado */
    const enc = h('div', { class: 'memo-head' },
      h('div', null, h('h2', null, 'Memoria de cálculo'), h('p', { class: 'muted' }, 'Etiquetado y racks de telecomunicaciones')),
      h('dl', null, [['Proyecto', p.nombre], ['Proyecto #', p.numero], ['Ubicación', p.ubicacion], ['Fecha', p.fecha], ['Elaboró', p.elaboro], ['Revisión', p.revision]].map(([k, v]) => [h('dt', null, k), h('dd', null, v || '—')])),
      h('div', { class: 'toolbar no-print' }, UI.btn('Imprimir / PDF', () => window.print()), UI.btn('Exportar materiales (CSV)', () => exportBom(P)), UI.btn('Exportar resumen a Word', () => ExportDoc.download(), 'primary'), UI.btn('Exportar resumen a Excel', () => ExportXlsx.download(), 'primary')));

    /* 1. cuartos */
    const t1 = h('table', { class: 'tbl' }, th(['Rack', 'Cuarto', 'Descripción', 'Rack / gabinete', 'RU ocupados', 'RU libres', '% llenado rack', 'Patch panels', 'Puertos', 'Salidas', '% llenado PP']),
      h('tbody', null, R.map(c => h('tr', { class: c.excede ? 'over' : '' }, h('td', null, h('b', null, c.room.codigo)), h('td', null, c.prefix + (c.cuarto && c.cuarto.tipo === 'principal' ? ' (principal)' : '')), h('td', null, c.room.descripcion), h('td', null, c.rack ? c.rack.parte + (c.rackQty > 1 ? ' ×' + c.rackQty : '') : '—'),
        num(c.ocupados), num(c.libres), h('td', { class: 'num' }, U.pct(c.pctRack)), num(c.panels.length), num(c.ports), num(c.outlets), h('td', { class: 'num' }, c.ports ? U.pct(c.pctPanel) : '–'))),
        h('tr', { class: 'total' }, h('td', { colspan: 4 }, 'TOTAL'), num(P.tot.ocupados), num(P.tot.totalRU - P.tot.ocupados), h('td', { class: 'num' }, U.pct(P.tot.totalRU ? P.tot.ocupados / P.tot.totalRU : 0)), num(P.tot.panels), num(P.tot.ports), num(P.tot.outlets), h('td', { class: 'num' }, P.tot.ports ? U.pct(P.tot.outlets / P.tot.ports) : '–'))));

    /* servicios, cobertura y fibra */
    const act = Calc.serviciosActivos(p, cat), plan = Calc.planning(p, cat, P), fib = Calc.fibra(p, cat);
    const tSrv = h('table', { class: 'tbl' }, th(['Red LAN', 'Servicios que la usan', 'Con PoE']), h('tbody', null, p.lans.map(l => { const sv = act.filter(t => p.servicios[t.codigo].lan === l.id); return h('tr', null, h('td', null, h('b', null, l.nombre)), h('td', null, sv.map(t => t.codigo + ' ' + t.nombre).join(', ') || '—'), h('td', null, sv.filter(t => p.servicios[t.codigo].poe).map(t => t.codigo).join(', ') || '—')); })));
    const covRows = []; plan.forEach(q => q.rows.forEach(r => covRows.push(h('tr', { class: r.falta ? 'over' : '' }, h('td', null, h('b', null, q.cuarto.codigo)), h('td', null, r.tipo.codigo + ' — ' + r.tipo.nombre), num(r.req), num(r.reqRes), num(r.prov), h('td', null, r.falta ? 'Faltan ' + r.falta + ' puertos' : 'Cubierto')))));
    const tCov = covRows.length ? h('table', { class: 'tbl' }, th(['Cuarto', 'Servicio', 'Salidas requeridas', 'Con reserva ' + p.reservaPct + ' %', 'Puertos en racks', 'Estado']), h('tbody', null, covRows)) : h('p', { class: 'empty' }, 'Sin salidas ingresadas en Proyecto.');
    const tFib = fib.length ? h('table', { class: 'tbl' }, th(['Cuarto secundario', 'Distancia (m)', 'Enlaces', 'Fibras base', 'Fibras con reserva ' + (p.fibra.reserva || 0) + ' %', 'Tipo sugerido']), h('tbody', null, fib.map(f => h('tr', null, h('td', null, h('b', null, f.cuarto.codigo)), num(f.distancia), num(f.enlaces), num(f.base), h('td', { class: 'num strong' }, U.fmt(f.total)), h('td', null, f.tipo || 'Falta la distancia'))))) : h('p', { class: 'empty' }, 'Sin cuartos secundarios.');

    /* 2. salidas por tipo */
    const tipoRows = cat.tiposSalida.filter(t => t.codigo !== '-').map(t => ({ t, tot: P.outlets[t.codigo] || 0 }));
    const sinSal = P.tot.ports - P.tot.outlets;
    const t2 = h('table', { class: 'tbl' }, th(['Código', 'Tipo de salida'].concat(roomCols, ['Total'])),
      h('tbody', null, tipoRows.filter(r => r.tot > 0 || true).map(r => h('tr', { class: r.tot ? '' : 'dim' }, h('td', null, h('b', null, r.t.codigo)), h('td', null, r.t.nombre), R.map(c => num(c.outletsByType[r.t.codigo])), h('td', { class: 'num strong' }, r.tot ? U.fmt(r.tot) : '–'))),
        h('tr', { class: 'dim' }, h('td', { colspan: 2 }, 'Puertos sin salida asignada'), R.map(c => num(c.ports - c.outlets)), h('td', { class: 'num' }, U.fmt(sinSal))),
        h('tr', { class: 'total' }, h('td', { colspan: 2 }, 'TOTAL SALIDAS'), R.map(c => num(c.outlets)), h('td', { class: 'num' }, U.fmt(P.tot.outlets)))));

    const sumCat = (rows, f) => rows.reduce((a, o) => a + f(o), 0);
    /* potencia */
    const t5 = h('table', { class: 'tbl' }, th(['Cuarto', 'Consumo (W)', 'PoE (W)', 'Carga UPS (W)', 'Calor (BTU/h)', 't.r.', 'Peso equipos (kg)', 'Cap. UPS (W)', '% UPS', 'Observación']),
      h('tbody', null, R.map(c => { const w = c.power; return h('tr', null, h('td', null, h('b', null, c.room.codigo)), num(w.consumo), num(w.poe), num(w.cargaUps), num(w.calorBTU), num(w.tr, 2), num(w.peso), num(w.capSum), h('td', { class: 'num' }, w.pctUps === null ? '–' : U.pct(w.pctUps)), h('td', { class: 'muted' }, [w.sinDato ? w.sinDato + ' equipo(s) sin dato' : '', w.pctUps > 0.8 ? 'UPS > 80 %' : ''].filter(Boolean).join(' · '))); }),
        h('tr', { class: 'total' }, h('td', null, 'TOTAL'), num(P.tot.consumo), num(sumCat(R, c => c.power.poe)), num(sumCat(R, c => c.power.cargaUps)), num(P.tot.calor), num(P.tot.calor / 12000, 2), num(P.tot.peso), h('td', { colspan: 3 }, ''))));

    /* 6. lista de materiales */
    const bom = Object.values(P.bom).filter(o => o.item).sort((a, b) => a.item.categoria.localeCompare(b.item.categoria) || a.item.descripcion.localeCompare(b.item.descripcion));
    let lastCat = '';
    const bodyB = h('tbody');
    bom.forEach(o => {
      if (o.item.categoria !== lastCat) { lastCat = o.item.categoria; bodyB.appendChild(h('tr', { class: 'grp' }, h('td', { colspan: 5 + R.length }, lastCat))); }
      bodyB.appendChild(h('tr', null, h('td', null, ''), h('td', null, o.item.descripcion), h('td', null, o.item.marca), h('td', { class: 'muted' }, o.item.parte), R.map(c => num(o.per[c.room.id])), h('td', { class: 'num strong' }, U.fmt(o.total))));
    });
    const t6 = h('table', { class: 'tbl' }, th(['', 'Descripción', 'Marca', 'N.º de parte'].concat(roomCols, ['Total'])), bodyB);

    root.appendChild(h('div', { class: 'stack memo' }, enc,
      UI.card('1. Resumen de racks y gabinetes', h('div', { class: 'table-wrap' }, t1)),
      UI.card('2. Servicios y redes LAN', [h('div', { class: 'table-wrap' }, tSrv), h('p', { class: 'hint' }, 'Reserva de puertos: ' + p.reservaPct + ' %. Salidas ingresadas por ' + (p.modoSalidas === 'nivel' ? 'nivel del edificio' : 'cuarto') + '.')]),
      UI.card('3. Cobertura de salidas por cuarto', h('div', { class: 'table-wrap' }, tCov)),
      UI.card('4. Fibra troncal entre cuartos (estimado: validar por el ingeniero)', [h('p', { class: 'hint' }, 'Cuarto principal: ' + ((p.cuartos.find(c => c.tipo === 'principal') || {}).codigo || '—') + '. Un enlace por red LAN (' + (p.fibra.redundante ? 'redundante' : 'sin redundancia') + '), 2 fibras por enlace.'), h('div', { class: 'table-wrap' }, tFib)]),
      UI.card('5. Vista de cada rack', h('div', { class: 'elev-grid' }, R.map(c => {
        const host = h('div', { class: 'elev-host' }); RoomView.drawElevation(host, c, c.room);
        return h('div', { class: 'elev-item' }, h('h4', null, c.room.codigo + ' · cuarto ' + c.prefix + (c.room.descripcion ? ' — ' + c.room.descripcion : '')), h('p', { class: 'muted' }, (c.rack ? c.rack.descripcion : 'Sin rack') + ' · ' + c.ocupados + ' / ' + c.totalRU + ' RU (' + U.pct(c.pctRack) + ')'), h('div', { class: 'elev-pair' }, host, RoomView.equipList(c)));
      }))),
      UI.card('6. Salidas por tipo', h('div', { class: 'table-wrap' }, t2)),
      UI.card('7. Potencia, calor y peso', h('div', { class: 'table-wrap' }, t5)),
      UI.card('8. Lista de materiales (rack, equipos y jacks)', [h('p', { class: 'hint' }, 'Incluye racks, organizadores, equipos de la lista, equipos fuera del rack y un jack por salida. No incluye espacios libres ni reservados.'), h('div', { class: 'table-wrap' }, t6)])));
  }

  function exportBom(P) {
    const R = P.rooms;
    const rows = [['Categoría', 'Descripción', 'Marca', 'N.º de parte'].concat(R.map(c => c.room.codigo), ['Total'])];
    Object.values(P.bom).filter(o => o.item).sort((a, b) => a.item.categoria.localeCompare(b.item.categoria)).forEach(o => rows.push([o.item.categoria, o.item.descripcion, o.item.marca, o.item.parte].concat(R.map(c => o.per[c.room.id] || ''), [o.total])));
    U.download('materiales.csv', U.csv(rows), 'text/csv;charset=utf-8');
  }
  g.MemoriaView = { render };
})(window);
