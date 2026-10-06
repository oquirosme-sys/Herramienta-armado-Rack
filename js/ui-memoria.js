/* Memoria de cálculo: consolida todos los niveles (equivale a la hoja Resumen del Excel,
   más resúmenes de canalización y cableado). Solo lectura; se recalcula cada vez que se abre. */
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
      h('div', { class: 'toolbar no-print' }, UI.btn('Imprimir / PDF', () => window.print(), 'primary'), UI.btn('Exportar materiales (CSV)', () => exportBom(P)), UI.btn('Exportar resumen de cuartos (CSV)', () => exportRooms(P))));

    /* 1. cuartos */
    const t1 = h('table', { class: 'tbl' }, th(['Cuarto', 'Descripción', 'Rack / gabinete', 'RU ocupados', 'RU libres', '% llenado rack', 'Patch panels', 'Puertos', 'Salidas', '% llenado PP']),
      h('tbody', null, R.map(c => h('tr', { class: c.excede ? 'over' : '' }, h('td', null, h('b', null, c.room.codigo)), h('td', null, c.room.descripcion), h('td', null, c.rack ? c.rack.parte + (c.rackQty > 1 ? ' ×' + c.rackQty : '') : '—'),
        num(c.ocupados), num(c.libres), h('td', { class: 'num' }, U.pct(c.pctRack)), num(c.panels.length), num(c.ports), num(c.outlets), h('td', { class: 'num' }, c.ports ? U.pct(c.pctPanel) : '–'))),
        h('tr', { class: 'total' }, h('td', { colspan: 3 }, 'TOTAL'), num(P.tot.ocupados), num(P.tot.totalRU - P.tot.ocupados), h('td', { class: 'num' }, U.pct(P.tot.totalRU ? P.tot.ocupados / P.tot.totalRU : 0)), num(P.tot.panels), num(P.tot.ports), num(P.tot.outlets), h('td', { class: 'num' }, P.tot.ports ? U.pct(P.tot.outlets / P.tot.ports) : '–'))));

    /* 2. salidas por tipo */
    const tipoRows = cat.tiposSalida.filter(t => t.codigo !== '-').map(t => ({ t, tot: P.outlets[t.codigo] || 0 }));
    const sinSal = P.tot.ports - P.tot.outlets;
    const t2 = h('table', { class: 'tbl' }, th(['Código', 'Tipo de salida'].concat(roomCols, ['Total'])),
      h('tbody', null, tipoRows.filter(r => r.tot > 0 || true).map(r => h('tr', { class: r.tot ? '' : 'dim' }, h('td', null, h('b', null, r.t.codigo)), h('td', null, r.t.nombre), R.map(c => num(c.outletsByType[r.t.codigo])), h('td', { class: 'num strong' }, r.tot ? U.fmt(r.tot) : '–'))),
        h('tr', { class: 'dim' }, h('td', { colspan: 2 }, 'Puertos sin salida asignada'), R.map(c => num(c.ports - c.outlets)), h('td', { class: 'num' }, U.fmt(sinSal))),
        h('tr', { class: 'total' }, h('td', { colspan: 2 }, 'TOTAL SALIDAS'), R.map(c => num(c.outlets)), h('td', { class: 'num' }, U.fmt(P.tot.outlets)))));

    /* 3. canalización */
    const canal = Object.values(P.canal).sort((a, b) => a.item.categoria.localeCompare(b.item.categoria) || a.item.descripcion.localeCompare(b.item.descripcion));
    const sumCat = (rows, f) => rows.reduce((a, o) => a + f(o), 0);
    const t3 = canal.length ? h('table', { class: 'tbl' }, th(['Categoría', 'Tipo', 'Marca / parte'].concat(roomCols.map(c => c + ' (m)'), ['Tramos', 'Total (m)', 'Piezas'])),
      h('tbody', null, canal.map(o => h('tr', null, h('td', null, o.item.categoria), h('td', null, o.item.descripcion), h('td', { class: 'muted' }, [o.item.marca, o.item.parte].filter(x => x && x !== 'Por definir').join(' · ') || '—'),
        R.map(c => num(o.per[c.room.id], 1)), num(o.tramos), h('td', { class: 'num strong' }, U.fmt(o.L, 1)), h('td', { class: 'num strong' }, o.piezas === null ? '—' : o.piezas + ' × ' + U.fmt(o.item.largoPieza, 2) + ' m'))),
        h('tr', { class: 'total' }, h('td', { colspan: 3 }, 'TOTAL canalización'), R.map(c => num(sumCat(canal, o => o.per[c.room.id] || 0), 1)), num(sumCat(canal, o => o.tramos)), h('td', { class: 'num' }, U.fmt(sumCat(canal, o => o.L), 1)), h('td', null, '')))) : h('p', { class: 'empty' }, 'Aún no hay tramos de canasta o tubería registrados en los niveles.');

    /* 4. cableado */
    const cable = Object.values(P.cable).sort((a, b) => a.item.descripcion.localeCompare(b.item.descripcion));
    const t4 = cable.length ? h('table', { class: 'tbl' }, th(['Tipo de cableado', 'Marca / parte'].concat(roomCols.map(c => c + ' (m)'), ['Cables', 'Neto (m)', 'Con reserva ' + (p.reservaCable || 0) + ' % (m)', 'Rollos / bobinas'])),
      h('tbody', null, cable.map(o => h('tr', null, h('td', null, o.item.descripcion), h('td', { class: 'muted' }, [o.item.marca, o.item.parte].filter(x => x && x !== 'Por definir').join(' · ') || '—'),
        R.map(c => num(o.per[c.room.id], 1)), num(o.cables), num(o.L, 1), h('td', { class: 'num strong' }, U.fmt(o.Lres, 1)), h('td', { class: 'num' }, o.piezas === null ? '—' : o.piezas + ' × ' + U.fmt(o.item.largoPieza, 0) + ' m'))))) : h('p', { class: 'empty' }, 'Aún no hay cableado asignado a los tramos.');

    /* 5. potencia */
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
      UI.card('1. Resumen de cuartos', h('div', { class: 'table-wrap' }, t1)),
      UI.card('2. Salidas por tipo', h('div', { class: 'table-wrap' }, t2)),
      UI.card('3. Canalización — resumen de tramos de canastas y tuberías', h('div', { class: 'table-wrap' }, t3)),
      UI.card('4. Cableado', h('div', { class: 'table-wrap' }, t4)),
      UI.card('5. Potencia, calor y peso', h('div', { class: 'table-wrap' }, t5)),
      UI.card('6. Lista de materiales (rack, equipos y jacks)', [h('p', { class: 'hint' }, 'Incluye racks, organizadores, equipos de la lista, equipos fuera del rack y un jack por salida. No incluye espacios libres ni reservados.'), h('div', { class: 'table-wrap' }, t6)])));
  }

  function exportBom(P) {
    const R = P.rooms;
    const rows = [['Categoría', 'Descripción', 'Marca', 'N.º de parte'].concat(R.map(c => c.room.codigo), ['Total'])];
    Object.values(P.bom).filter(o => o.item).sort((a, b) => a.item.categoria.localeCompare(b.item.categoria)).forEach(o => rows.push([o.item.categoria, o.item.descripcion, o.item.marca, o.item.parte].concat(R.map(c => o.per[c.room.id] || ''), [o.total])));
    Object.values(P.canal).forEach(o => rows.push([o.item.categoria, o.item.descripcion + ' (m)', o.item.marca, o.item.parte].concat(R.map(c => o.per[c.room.id] || ''), [o.L])));
    Object.values(P.cable).forEach(o => rows.push([o.item.categoria, o.item.descripcion + ' (m c/reserva)', o.item.marca, o.item.parte].concat(R.map(c => o.per[c.room.id] || ''), [o.Lres])));
    U.download('materiales.csv', U.csv(rows), 'text/csv;charset=utf-8');
  }
  function exportRooms(P) {
    const rows = [['Cuarto', 'Descripción', 'RU ocupados', 'RU libres', '% rack', 'Patch panels', 'Puertos', 'Salidas', 'Consumo W', 'Calor BTU/h']];
    P.rooms.forEach(c => rows.push([c.room.codigo, c.room.descripcion, c.ocupados, c.libres, Math.round(c.pctRack * 100), c.panels.length, c.ports, c.outlets, c.power.consumo, c.power.calorBTU]));
    U.download('resumen-cuartos.csv', U.csv(rows), 'text/csv;charset=utf-8');
  }

  g.MemoriaView = { render };
})(window);
