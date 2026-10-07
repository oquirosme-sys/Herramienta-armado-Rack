/* Exporta el resumen a un libro de Excel (.xlsx real, sin librerías externas):
   Resumen, Materiales, y por nivel: "Rack <cod>" (alzado + equipos) y "Etiq <cod>" (lista plana de puertos),
   más "Etiquetas" con todos los puertos del proyecto (para importar a Revit / CAD / rotuladoras). */
(function (g) {
  'use strict';
  const enc = new TextEncoder();
  const xe = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const colName = n => { let s = ''; for (n++; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };

  /* ---------- zip mínimo (sin compresión) ---------- */
  const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zip(files) {
    const parts = [], central = []; let off = 0;
    files.forEach(f => {
      const name = enc.encode(f.name), data = enc.encode(f.data), crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true); lh.setUint16(10, 0, true); lh.setUint16(12, 0x21, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true); ch.setUint16(12, 0, true); ch.setUint16(14, 0x21, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true); ch.setUint32(42, off, true);
      central.push(new Uint8Array(ch.buffer), name);
      off += 30 + name.length + data.length;
    });
    const csize = central.reduce((a, b) => a + b.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, csize, true); end.setUint32(16, off, true);
    return new Blob(parts.concat(central, [new Uint8Array(end.buffer)]), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  /* ---------- estilos ---------- */
  function Styles() {
    const fonts = [{ b: 0, sz: 9, color: '' }], fills = [], xfs = [{}], idx = {};
    const fontIdx = o => { const k = JSON.stringify([o.b ? 1 : 0, o.sz || 9, o.color || '']); let i = fonts.findIndex(f => JSON.stringify([f.b, f.sz, f.color]) === k); if (i < 0) { fonts.push({ b: o.b ? 1 : 0, sz: o.sz || 9, color: o.color || '' }); i = fonts.length - 1; } return i; };
    const fillIdx = bg => { if (!bg) return 0; const c = bg.replace('#', '').toUpperCase(); let i = fills.indexOf(c); if (i < 0) { fills.push(c); i = fills.length - 1; } return i + 2; };
    return {
      get(o) { if (!o) return 0; const k = JSON.stringify(o); if (idx[k] !== undefined) return idx[k]; xfs.push({ f: fontIdx(o), fl: fillIdx(o.bg), o }); idx[k] = xfs.length - 1; return idx[k]; },
      xml() {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
          + '<fonts count="' + fonts.length + '">' + fonts.map(f => '<font>' + (f.b ? '<b/>' : '') + '<sz val="' + f.sz + '"/>' + (f.color ? '<color rgb="FF' + f.color.replace('#', '') + '"/>' : '') + '<name val="Arial"/></font>').join('') + '</fonts>'
          + '<fills count="' + (fills.length + 2) + '"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' + fills.map(c => '<fill><patternFill patternType="solid"><fgColor rgb="FF' + c + '"/><bgColor indexed="64"/></patternFill></fill>').join('') + '</fills>'
          + '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FF8C8C8C"/></left><right style="thin"><color rgb="FF8C8C8C"/></right><top style="thin"><color rgb="FF8C8C8C"/></top><bottom style="thin"><color rgb="FF8C8C8C"/></bottom><diagonal/></border></borders>'
          + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
          + '<cellXfs count="' + xfs.length + '">' + xfs.map((x, i) => i === 0 ? '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
            : '<xf numFmtId="' + (x.o.pct ? 9 : 0) + '" applyNumberFormat="1" fontId="' + x.f + '" fillId="' + x.fl + '" borderId="' + (x.o.border === false ? 0 : 1) + '" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="' + (x.o.al || 'left') + '" vertical="center"' + (x.o.wrap ? ' wrapText="1"' : '') + (x.o.rot ? ' textRotation="' + x.o.rot + '"' : '') + '/></xf>').join('') + '</cellXfs>'
          + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
      },
    };
  }

  /* ---------- hoja ---------- */
  function Sheet(name, st) {
    const rows = [], merges = [], widths = []; let filter = null;
    const api = {
      name,
      set(r, c, v, style) { (rows[r] = rows[r] || [])[c] = { v, s: st.get(style) }; return api; },
      merge(r1, c1, r2, c2) { merges.push(colName(c1) + (r1 + 1) + ':' + colName(c2) + (r2 + 1)); return api; },
      width(c, w) { widths[c] = w; return api; },
      autofilter(r1, c1, r2, c2) { filter = colName(c1) + (r1 + 1) + ':' + colName(c2) + (r2 + 1); return api; },
      xml() {
        const sd = rows.map((row, r) => row ? '<row r="' + (r + 1) + '">' + row.map((c, ci) => {
          if (!c) return ''; const ref = colName(ci) + (r + 1);
          if (c.v === null || c.v === undefined || c.v === '') return '<c r="' + ref + '" s="' + c.s + '"/>';
          if (typeof c.v === 'number') return '<c r="' + ref + '" s="' + c.s + '"><v>' + c.v + '</v></c>';
          return '<c r="' + ref + '" s="' + c.s + '" t="inlineStr"><is><t xml:space="preserve">' + xe(c.v) + '</t></is></c>';
        }).join('') + '</row>' : '').join('');
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>'
          + '<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews><sheetFormatPr defaultRowHeight="13"/>'
          + (widths.length ? '<cols>' + widths.map((w, i) => w ? '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>' : '').join('') + '</cols>' : '')
          + '<sheetData>' + sd + '</sheetData>' + (filter ? '<autoFilter ref="' + filter + '"/>' : '')
          + (merges.length ? '<mergeCells count="' + merges.length + '">' + merges.map(m => '<mergeCell ref="' + m + '"/>').join('') + '</mergeCells>' : '')
          + '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>';
      },
    };
    return api;
  }

  /* ---------- libro ---------- */
  const H = { b: 1, bg: '#D9D9D9', al: 'center', wrap: true };
  const T = { sz: 14, b: 1, border: false };
  const L = { b: 1, bg: '#EDEDED' };
  const C = { al: 'center' };
  const W = { wrap: true };

  function build(project, catalog, onlyRoomId) {
    const P = Calc.calcProject(project, catalog), ix = P.ix, st = Styles();
    const sheets = [], used = {};
    const mk = n => { let b = n.replace(/[:\\/?*\[\]]/g, '-').slice(0, 28), nn = b, i = 2; while (used[nn.toLowerCase()]) nn = b.slice(0, 26) + '_' + i++; used[nn.toLowerCase()] = 1; const s = Sheet(nn, st); sheets.push(s); return s; };
    const R = onlyRoomId ? P.rooms.filter(c => c.room.id === onlyRoomId) : P.rooms;
    const hdr = (s, r, c0, arr) => arr.forEach((t, i) => s.set(r, c0 + i, t, H));

    /* Resumen */
    if (!onlyRoomId) {
      const s = mk('Resumen'); s.set(0, 0, 'Etiquetado y racks de telecomunicaciones — Resumen', T);
      [['Proyecto', project.nombre], ['Proyecto N.º', project.numero], ['Ubicación', project.ubicacion], ['Fecha', project.fecha], ['Elaboró', project.elaboro], ['Revisión', project.revision]].forEach(([k, v], i) => { s.set(2 + i, 0, k, L); s.set(2 + i, 1, v || '', {}); s.merge(2 + i, 1, 2 + i, 3); });
      let r = 9; s.set(r - 1, 0, 'Resumen de cuartos', { b: 1, sz: 11, border: false });
      hdr(s, r, 0, ['Cuarto', 'Descripción', 'Rack / gabinete', 'RU ocupados', 'RU libres', '% llenado rack', 'Patch panels', 'Puertos', 'Salidas', '% llenado paneles']);
      P.rooms.forEach((c, i) => { const q = r + 1 + i; s.set(q, 0, c.room.codigo, { b: 1 }); s.set(q, 1, c.room.descripcion, {}); s.set(q, 2, c.rack ? c.rack.parte + (c.rackQty > 1 ? ' ×' + c.rackQty : '') : '', {}); [c.ocupados, c.libres, Math.round(c.pctRack * 100) / 100, c.panels.length, c.ports, c.outlets, c.ports ? Math.round(c.pctPanel * 100) / 100 : ''].forEach((v, k) => s.set(q, 3 + k, v, (k === 2 || k === 6) ? { al: 'center', pct: true } : C)); });
      r += P.rooms.length + 3; s.set(r - 1, 0, 'Salidas por tipo', { b: 1, sz: 11, border: false });
      hdr(s, r, 0, ['Código', 'Tipo de salida'].concat(P.rooms.map(c => c.room.codigo), ['Total']));
      const tipos = catalog.tiposSalida.filter(t => t.codigo !== '-');
      tipos.forEach((t, i) => { const q = r + 1 + i; s.set(q, 0, t.codigo, { b: 1, al: 'center' }); s.set(q, 1, t.nombre, {}); P.rooms.forEach((c, k) => s.set(q, 2 + k, c.outletsByType[t.codigo] || '', C)); s.set(q, 2 + P.rooms.length, P.outlets[t.codigo] || '', { al: 'center', b: 1 }); });
      const q = r + 1 + tipos.length; s.set(q, 0, 'TOTAL', { b: 1, bg: '#EDEDED' }); s.set(q, 1, '', { bg: '#EDEDED' }); P.rooms.forEach((c, k) => s.set(q, 2 + k, c.outlets, { al: 'center', b: 1, bg: '#EDEDED' })); s.set(q, 2 + P.rooms.length, P.tot.outlets, { al: 'center', b: 1, bg: '#EDEDED' });
      [10, 38, 30, 12, 10, 12, 12, 10, 10, 12].forEach((w, i) => s.width(i, w)); for (let k = 0; k < P.rooms.length; k++) s.width(2 + k, Math.max(s.__w || 0, 12));
    }

    /* Por nivel */
    const todas = [['Cuarto', 'Panel', 'Puerto', 'Etiqueta', 'Tipo', 'Salida']];
    R.forEach(c => {
      const room = c.room, org = ix.byId[room.orgVertId], u = room.orgVertUbic;
      const left = org && (u === 'Ambos lados' || u === 'Lado izquierdo'), right = org && (u === 'Ambos lados' || u === 'Lado derecho');
      const s = mk('Rack ' + room.codigo);
      s.set(0, 0, 'Nivel ' + room.codigo + (room.descripcion ? ' — ' + room.descripcion : ''), T);
      s.set(1, 0, (c.rack ? c.rack.descripcion + (c.rackQty > 1 ? ' × ' + c.rackQty : '') : 'Sin rack') + ' · ' + c.ocupados + ' de ' + c.totalRU + ' RU ocupados (' + Math.round(c.pctRack * 100) + ' %) · ' + c.panels.length + ' patch panel(es) · ' + c.ports + ' puertos · ' + c.outlets + ' salidas', { border: false });
      hdr(s, 3, 0, ['RU', 'Org. V.', 'Equipo (alzado)', 'Org. V.', 'RU']);
      const orgTxt = org ? 'ORGANIZADOR VERTICAL ' + org.parte : '';
      let r = 4; const r0 = r;
      c.elevation.forEach(b => {
        const n = b.from - b.to + 1;
        const it = b.row && b.row.item, P1 = b.row && b.row.panel;
        const label = it ? (P1 ? 'Patch panel ' + P1.code + ' · ' + P1.np + ' p' + (P1.tipo ? ' · ' + P1.tipo : '') : it.descripcion) : '';
        for (let k = 0; k < n; k++) { s.set(r + k, 0, b.from - k, { al: 'center', sz: 8 }); s.set(r + k, 4, b.from - k, { al: 'center', sz: 8 }); s.set(r + k, 1, '', left ? { bg: '#8EA9DB' } : {}); s.set(r + k, 3, '', right ? { bg: '#8EA9DB' } : {}); s.set(r + k, 2, k === 0 ? label : '', { bg: it ? ix.colorOf(it) : '', wrap: true }); }
        if (n > 1) s.merge(r, 2, r + n - 1, 2);
        r += n;
      });
      if (left) { s.set(r0, 1, orgTxt, { bg: '#8EA9DB', rot: 90, al: 'center', sz: 7 }); s.merge(r0, 1, r - 1, 1); }
      if (right) { s.set(r0, 3, orgTxt, { bg: '#8EA9DB', rot: 90, al: 'center', sz: 7 }); s.merge(r0, 3, r - 1, 3); }
      [6, 5, 52, 5, 6, 3].forEach((w, i) => s.width(i, w));
      // equipos
      hdr(s, 3, 6, ['#', 'Equipo', 'N.º de parte', 'RU', 'RU sup.', 'RU inf.', 'Panel', 'Tipo salida', 'Salidas', 'Notas']);
      let q = 4, n = 0;
      c.rows.filter(x => x.item).forEach(x => { n++; const Pn = x.panel; s.set(q, 6, n, C); s.set(q, 7, x.item.descripcion, W); s.set(q, 8, x.item.parte, {}); s.set(q, 9, x.ru || '', C); s.set(q, 10, x.sup === null ? '' : x.sup, C); s.set(q, 11, x.inf === null ? '' : x.inf, C); s.set(q, 12, Pn ? Pn.code : '', {}); s.set(q, 13, Pn ? Pn.tipo : '', C); s.set(q, 14, Pn ? Pn.labeled + ' / ' + Pn.np : '', C); s.set(q, 15, x.eq.notas || '', W); q++; });
      const fu = (room.fuera || []).filter(f => ix.byId[f.itemId]);
      if (fu.length) { q += 1; s.set(q, 6, 'Equipos fuera del rack', { b: 1, border: false }); q++; hdr(s, q, 6, ['#', 'Equipo', 'N.º de parte', 'Cant.']); q++; fu.forEach((f, i) => { const it = ix.byId[f.itemId]; s.set(q, 6, i + 1, C); s.set(q, 7, it.descripcion, W); s.set(q, 8, it.parte, {}); s.set(q, 9, f.cant, C); q++; }); }
      [4, 50, 22, 5, 7, 7, 10, 11, 10, 26].forEach((w, i) => s.width(6 + i, w));

      // etiquetado (lista plana)
      if (c.panels.length) {
        const e = mk('Etiq ' + room.codigo); const rows = [['Cuarto', 'Panel', 'Puerto', 'Etiqueta', 'Tipo', 'Salida']];
        c.panels.forEach(Pn => Pn.ports.forEach(o => rows.push([room.codigo, Pn.code, U.pad(o.n, 2), o.label, o.tipo, o.salida])));
        hdr(e, 0, 0, rows[0]); rows.slice(1).forEach((row, i) => row.forEach((v, k) => e.set(1 + i, k, v, k === 0 || k >= 2 ? C : {}))); e.autofilter(0, 0, rows.length - 1, 5);
        [9, 11, 8, 14, 7, 11].forEach((w, i) => e.width(i, w));
        rows.slice(1).forEach(x => todas.push(x));
      }
    });

    if (!onlyRoomId) {
      if (todas.length > 1) { const e = mk('Etiquetas'); hdr(e, 0, 0, todas[0]); todas.slice(1).forEach((row, i) => row.forEach((v, k) => e.set(1 + i, k, v, k === 0 || k >= 2 ? C : {}))); e.autofilter(0, 0, todas.length - 1, 5); [9, 11, 8, 14, 7, 11].forEach((w, i) => e.width(i, w)); }
      const m = mk('Materiales'); const bom = Object.values(P.bom).filter(o => o.item).sort((a, b) => a.item.categoria.localeCompare(b.item.categoria) || a.item.descripcion.localeCompare(b.item.descripcion));
      hdr(m, 0, 0, ['Categoría', 'Descripción', 'Marca', 'N.º de parte'].concat(P.rooms.map(c => c.room.codigo), ['Total']));
      bom.forEach((o, i) => { m.set(1 + i, 0, o.item.categoria, {}); m.set(1 + i, 1, o.item.descripcion, W); m.set(1 + i, 2, o.item.marca, {}); m.set(1 + i, 3, o.item.parte, {}); P.rooms.forEach((c, k) => m.set(1 + i, 4 + k, o.per[c.room.id] || '', C)); m.set(1 + i, 4 + P.rooms.length, o.total, { al: 'center', b: 1 }); });
      m.autofilter(0, 0, bom.length, 4 + P.rooms.length); [22, 60, 16, 24].forEach((w, i) => m.width(i, w)); for (let k = 0; k <= P.rooms.length; k++) m.width(4 + k, 9);
    }

    const files = [
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map((s, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') + '</Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + sheets.map((s, i) => '<sheet name="' + xe(s.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</sheets></workbook>' },
      { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map((s, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') + '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
    ];
    sheets.forEach((s, i) => files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: s.xml() }));
    files.splice(3, 0, { name: 'xl/styles.xml', data: st.xml() }); // los estilos se generan al final (después de armar las hojas)
    return zip(files);
  }

  function download(onlyRoomId) {
    const room = onlyRoomId ? Store.findRoom(onlyRoomId) : null;
    const blob = build(Store.project, Store.catalog, onlyRoomId);
    const name = (room ? 'rack-' + room.codigo : 'resumen-racks') + (Store.project.numero ? '-' + Store.project.numero : '') + '.xlsx';
    U.download(name, blob, blob.type);
  }

  g.ExportXlsx = { build, download };
})(window);
