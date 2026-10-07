/* Exporta el resumen completo a un documento de Word (.doc, HTML con formato de Word):
   cuadro de cuartos, salidas por tipo, y por nivel: alzado del rack, lista de equipos y tablas de etiquetado.
   Todo son tablas de Word reales, para copiar y pegar en Revit (tabla/schedule, nota) o AutoCAD (TABLE / OLE). */
(function (g) {
  'use strict';
  const esc = s => String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const td = (t, o) => {
    o = o || {};
    return '<td' + (o.cs ? ' colspan="' + o.cs + '"' : '') + (o.rs ? ' rowspan="' + o.rs + '"' : '') + ' style="' + (o.w ? 'width:' + o.w + ';' : '') + (o.bg ? 'background:' + o.bg + ';' : '') + (o.al ? 'text-align:' + o.al + ';' : '') + (o.st || '') + '"' + (o.bg ? ' bgcolor="' + o.bg + '"' : '') + '>' + (o.raw ? t : (esc(t) || '&nbsp;')) + '</td>';
  };
  const th = (t, o) => td('<b>' + esc(t) + '</b>', Object.assign({ bg: '#D9D9D9', raw: true, al: 'center' }, o || {}));
  const tr = (cells, h) => '<tr' + (h ? ' style="height:' + h + '"' : '') + '>' + cells.join('') + '</tr>';
  const table = (rows, w) => '<table border="1" cellspacing="0" cellpadding="0" style="border-collapse:collapse;' + (w ? 'width:' + w + ';' : '') + '">' + rows.join('') + '</table>';
  const h2 = t => '<h2 style="font:bold 14pt Arial;margin:12pt 0 4pt">' + esc(t) + '</h2>';
  const h3 = t => '<h3 style="font:bold 10.5pt Arial;margin:10pt 0 3pt">' + esc(t) + '</h3>';
  const p = (t, st) => '<p style="font:9pt Arial;margin:2pt 0;' + (st || '') + '">' + esc(t) + '</p>';

  /** Alzado del rack como tabla de Word (una fila por RU; los equipos de varios RU se combinan). */
  function elevationTable(C, ix) {
    const room = C.room, org = ix.byId[room.orgVertId], u = room.orgVertUbic;
    const left = org && (u === 'Ambos lados' || u === 'Lado izquierdo'), right = org && (u === 'Ambos lados' || u === 'Lado derecho');
    const orgTxt = org ? 'ORGANIZADOR VERTICAL ' + org.parte : '';
    const orgCell = () => td(esc(orgTxt), { rs: C.totalRU, bg: '#8EA9DB', raw: true, w: '0.7cm', al: 'center', st: 'writing-mode:tb-rl;font-size:6pt;' });
    const H = '11pt', rows = [];
    let first = true;
    C.elevation.forEach(b => {
      const n = b.from - b.to + 1;
      for (let r = b.from; r >= b.to; r--) {
        const cells = [td(r, { w: '0.9cm', al: 'center', st: 'font-size:6.5pt;color:#555;' })];
        if (first && left) cells.push(orgCell());
        if (r === b.from) {
          if (!b.row) cells.push(td('', { w: '9.5cm', rs: n }));
          else {
            const it = b.row.item, P = b.row.panel;
            const label = P ? 'Patch panel ' + P.code + ' · ' + P.np + ' p' + (P.tipo ? ' · ' + P.tipo : '') : it.descripcion;
            cells.push(td(label, { w: '9.5cm', rs: n, bg: ix.colorOf(it), st: 'font-size:7pt;' + (n > 1 ? 'vertical-align:middle;' : '') }));
          }
        }
        if (first && right) cells.push(orgCell());
        cells.push(td(r, { w: '0.9cm', al: 'center', st: 'font-size:6.5pt;color:#555;' }));
        rows.push(tr(cells, H)); first = false;
      }
    });
    return table(rows);
  }

  function equiposTable(C) {
    const rows = [tr(['#', 'Equipo', 'N.º de parte', 'RU', 'RU sup.', 'RU inf.', 'Panel', 'Tipo salida', 'Salidas', 'Notas'].map(t => th(t)))];
    let i = 0;
    C.rows.filter(r => r.item).forEach(r => {
      i++; const P = r.panel;
      rows.push(tr([td(i, { al: 'center' }), td(r.item.descripcion), td(r.item.parte), td(r.ru || '', { al: 'center' }), td(r.sup === null ? '' : r.sup, { al: 'center' }), td(r.inf === null ? '' : r.inf, { al: 'center' }),
        td(P ? P.code : ''), td(P ? P.tipo : '', { al: 'center' }), td(P ? P.labeled + ' / ' + P.np : '', { al: 'center' }), td(r.eq.notas || '')]));
    });
    return table(rows);
  }
  function fueraTable(room, ix) {
    const list = (room.fuera || []).filter(f => ix.byId[f.itemId]);
    if (!list.length) return '';
    return h3('Equipos fuera del rack') + table([tr(['#', 'Equipo', 'N.º de parte', 'Cant.', 'Notas'].map(t => th(t)))].concat(list.map((f, i) => { const it = ix.byId[f.itemId]; return tr([td(i + 1, { al: 'center' }), td(it.descripcion), td(it.parte), td(f.cant, { al: 'center' }), td(f.notas || '')]); })));
  }

  /** Etiquetado: bloques de 24 puertos, 4 por fila (mismo formato que la hoja del Excel original). */
  function labelBands(C) {
    const bl = Calc.portBlocks(C), NB = 4, out = [], GREEN = '#00B050';
    const wd = ['0.9cm', '1.4cm', '1.5cm', '1cm', '2cm'];
    for (let i = 0; i < bl.length; i += NB) {
      const band = bl.slice(i, i + NB), rows = [], gap = () => td('', { w: '0.25cm', st: 'border:none;' });
      const rep = f => band.map((B, k) => (k ? [gap()] : []).concat(f(B))).reduce((a, x) => a.concat(x), []);
      rows.push(tr(rep(B => [td('<b>' + esc(B.title) + '</b>', { raw: true, cs: 5, bg: GREEN, al: 'center', st: 'color:#FFFFFF;' })])));
      rows.push(tr(rep(() => ['Tipo', 'Salida', 'Panel', 'Puerto', 'Etiqueta'].map((t, j) => th(t, { w: wd[j] })))));
      for (let r = 0; r < 24; r++) rows.push(tr(rep(B => { const o = B.ports[r]; return o ? [td(o.tipo, { al: 'center' }), td(o.salida, { al: 'center' }), td(B.P.code, { al: 'center' }), td(U.pad(o.n, 2), { al: 'center' }), td(o.label, { al: 'center' })] : [0, 1, 2, 3, 4].map(() => td('', { bg: '#F2F2F2' })); })));
      out.push('<table border="1" cellspacing="0" cellpadding="0" style="border-collapse:collapse;table-layout:fixed;font-size:6.5pt;">' + rows.join('') + '</table><p style="margin:3pt 0">&nbsp;</p>');
    }
    return out.join('');
  }

  function roomSection(C, ix, project) {
    const room = C.room;
    const s = [];
    s.push('<h1 style="font:bold 16pt Arial;margin:0 0 4pt;page-break-before:always">Nivel ' + esc(room.codigo) + (room.descripcion ? ' — ' + esc(room.descripcion) : '') + '</h1>');
    s.push(p((C.rack ? C.rack.descripcion + (C.rackQty > 1 ? ' × ' + C.rackQty : '') : 'Sin rack') + ' · ' + C.ocupados + ' de ' + C.totalRU + ' RU ocupados (' + Math.round(C.pctRack * 100) + ' %) · ' + C.panels.length + ' patch panel(es), ' + C.ports + ' puertos, ' + C.outlets + ' salidas etiquetadas'));
    s.push(h3('Alzado del rack'));
    s.push(elevationTable(C, ix));
    s.push(h3('Equipos en el rack (de arriba hacia abajo)'));
    s.push(equiposTable(C));
    s.push(fueraTable(room, ix));
    if (C.panels.length) {
      s.push('<br style="page-break-before:always" clear="all">');
      s.push(h2('Etiquetado de puertos — nivel ' + room.codigo));
      s.push(p('El tipo de salida viene del panel (lista de equipos). Etiqueta = Cuarto-Panel-Puerto. La etiqueta en la salida del puesto de trabajo es la misma que en el puerto del rack.'));
      s.push(labelBands(C));
    }
    return s.join('');
  }

  function build(project, catalog, onlyRoomId) {
    const P = Calc.calcProject(project, catalog), ix = P.ix;
    const rooms = onlyRoomId ? P.rooms.filter(c => c.room.id === onlyRoomId) : P.rooms;
    const R = P.rooms;
    const b = [];
    b.push('<h1 style="font:bold 18pt Arial;margin:0">Etiquetado y racks de telecomunicaciones</h1>');
    b.push(table([
      tr([th('Proyecto', { al: 'left' }), td(project.nombre), th('Proyecto N.º', { al: 'left' }), td(project.numero)]),
      tr([th('Ubicación', { al: 'left' }), td(project.ubicacion), th('Fecha', { al: 'left' }), td(project.fecha)]),
      tr([th('Elaboró', { al: 'left' }), td(project.elaboro), th('Revisión', { al: 'left' }), td(project.revision)])], '18cm'));
    if (!onlyRoomId) {
      b.push(h2('Resumen de cuartos'));
      b.push(table([tr(['Cuarto', 'Descripción', 'Rack / gabinete', 'RU ocupados', 'RU libres', '% rack', 'Patch panels', 'Puertos', 'Salidas', '% paneles'].map(t => th(t)))].concat(R.map(c => tr([
        td(c.room.codigo), td(c.room.descripcion), td(c.rack ? c.rack.parte + (c.rackQty > 1 ? ' ×' + c.rackQty : '') : ''), td(c.ocupados, { al: 'center' }), td(c.libres, { al: 'center' }), td(Math.round(c.pctRack * 100) + ' %', { al: 'center' }),
        td(c.panels.length, { al: 'center' }), td(c.ports, { al: 'center' }), td(c.outlets, { al: 'center' }), td(c.ports ? Math.round(c.pctPanel * 100) + ' %' : '', { al: 'center' })])))));
      const tipos = catalog.tiposSalida.filter(t => t.codigo !== '-');
      b.push(h2('Salidas por tipo'));
      b.push(table([tr([th('Código'), th('Tipo de salida')].concat(R.map(c => th(c.room.codigo)), [th('Total')]))].concat(tipos.map(t => tr([td('<b>' + esc(t.codigo) + '</b>', { raw: true, al: 'center' }), td(t.nombre)].concat(R.map(c => td(c.outletsByType[t.codigo] || '', { al: 'center' })), [td(P.outlets[t.codigo] || '', { al: 'center' })]))),
        [tr([td('<b>TOTAL</b>', { raw: true, cs: 2 })].concat(R.map(c => td('<b>' + c.outlets + '</b>', { raw: true, al: 'center' })), [td('<b>' + P.tot.outlets + '</b>', { raw: true, al: 'center' })]))])));
    }
    rooms.forEach(c => b.push(roomSection(c, ix, project)));
    if (!onlyRoomId) {
      const bom = Object.values(P.bom).filter(o => o.item).sort((a, c) => a.item.categoria.localeCompare(c.item.categoria) || a.item.descripcion.localeCompare(c.item.descripcion));
      b.push('<br style="page-break-before:always" clear="all">'); b.push(h2('Lista de materiales'));
      b.push(table([tr([th('Categoría'), th('Descripción'), th('Marca'), th('N.º de parte')].concat(R.map(c => th(c.room.codigo)), [th('Total')]))].concat(bom.map(o => tr([td(o.item.categoria), td(o.item.descripcion), td(o.item.marca), td(o.item.parte)].concat(R.map(c => td(o.per[c.room.id] || '', { al: 'center' })), [td('<b>' + o.total + '</b>', { raw: true, al: 'center' })]))))));
    }
    return '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Resumen de racks</title>'
      + '<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->'
      + '<style>@page WordSection1{size:841.9pt 595.3pt;mso-page-orientation:landscape;margin:36pt 36pt 36pt 36pt;} div.WordSection1{page:WordSection1;} body{font-family:Arial;} table{border-collapse:collapse;} td,th{border:1px solid #777;font:8pt Arial;padding:1pt 4pt;vertical-align:middle;mso-line-height-rule:exactly;line-height:9pt;}</style></head><body><div class="WordSection1">'
      + b.join('') + '</div></body></html>';
  }

  function download(onlyRoomId) {
    const room = onlyRoomId ? Store.findRoom(onlyRoomId) : null;
    const html = build(Store.project, Store.catalog, onlyRoomId);
    const name = (room ? 'rack-' + room.codigo : 'resumen-racks') + (Store.project.numero ? '-' + Store.project.numero : '') + '.doc';
    U.download(name, '﻿' + html, 'application/msword;charset=utf-8');
  }

  g.ExportDoc = { build, download };
})(window);
