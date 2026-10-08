/* Tablas resumen para los planos de Revit (hojas TABLA RESUMEN, (VERTICAL), DU(VERTICAL) y ORIGINAL) y orden/exclusión de tableros
   (hoja ORDEN TABLEROS). Resumen.* construye los datos; la vista y la exportación a Excel los usan igual. */
(function () {
  'use strict';
  const h = U.h;
  const t2 = v => (v === null || v === undefined ? '' : String(v).trim());
  const r2 = v => (v === null || v === undefined || v === '' || isNaN(v) ? '' : Math.round(Number(v) * 100) / 100);

  const Resumen = {
    /** Tableros en el orden de la tabla resumen: número de orden y luego el orden de alimentación; sin los excluidos. */
    ordenados(R) {
      return R.orden.map((r, i) => ({ r, i })).filter(x => !x.r.tab.excluirResumen)
        .sort((a, b) => (num(a.r.tab.orden) - num(b.r.tab.orden)) || (a.i - b.i)).map(x => x.r);
    },
    grupos: [['Tablero / Equipo', 1], ['Alimentado desde', 1], ['kVA Totales', 1], ['kVA Demandados', 1], ['Factor demanda', 1], ['Factor diversidad', 1], ['Factor potencia', 1],
      ['Calibres conductores alimentador', 8], ['Tubería', 3], ['Longitud (m)', 1], ['Voltaje bornes (V)', 1], ['Caída de voltaje total (V)', 1], ['Caída de voltaje total (%)', 1],
      ['Corriente cortocircuito disponible (kA)', 1], ['Capacidad de breaker (A)', 1], ['DATOS DEL TABLERO', 8], ['DATOS DEL SUPRESOR', 7], ['DATOS INTERRUPTOR PRINCIPAL', 7]],
    sub: ['', '', '', '', '', '', '', 'Fases (AWG)', '', 'Neutro (AWG)', '', 'Tierra (AWG)', '', 'Material', 'Aislamiento', 'Cantidad', 'Ø (mm)', 'Tipo', '', '', '', '', '', '',
      'Tablero / Equipo', 'Modelo de referencia', 'Fabricante', 'Barras Fase', 'Barras Neutro', 'Barras Tierra', 'Espacios', 'Montaje',
      'Fabricante', 'Modelo de referencia', 'Montaje', 'Supresión L-L (kA)', 'Supresión L-N / L-T / N-T (kA)', 'Voltaje (V)', 'Fases',
      'Fabricante', 'Modelo de referencia', 'Marco (A)', 'Amperios (A)', 'Tipo de unidad', '# polos', 'SCCR (kA)'],
    /** Fila de la TABLA RESUMEN horizontal (columnas I:BB de la fila 144 del Machote). */
    horizontal(r) {
      const A = r.alim, cat = r.cat || {}, spd = r.spd || {}, bk = r.bkMain || {};
      return [r.nombre, r.alimentadoDesde, r2(r.W130), r2(A.L139), r2(A.R139), r2(A.S139), r2(A.T139),
        A.preF, t2(A.AL139), t2(A.preN), t2(A.AN139), t2(A.preN), t2(A.AP139), A.mat, A.ais, t2(A.preN), A.AR139, A.tuberia,
        r2(A.M139), r2(A.AW139), r2(A.AX139), r2(A.AY139), r.iccKA ? r2(r.iccKA) : '', A.AF139 || '',
        r.nombre, cat.modelo || '', r.marca || '', cat.barraFase || '', cat.barraNeutro || '', cat.barraTierra || '', cat.espacios || '', r.tab.montaje || '',
        spd.modelo ? r.marca : '', spd.modelo || '', spd.montaje || '', spd.kaLL || '', spd.kaLN || '', spd.voltaje || '', spd.fases || '',
        bk.modelo !== undefined ? r.marca : '', bk.modelo || '', Number(bk.marco) ? bk.marco : '', bk.amperios || '', bk.unidad || '', bk.polos || '', bk.sccr || ''];
    },
    /** TABLA RESUMEN (VERTICAL): [etiqueta, valor, valor2] (BU18:BW39). */
    vertical(r) {
      const A = r.alim;
      return [['Tablero / Equipo', r.nombre], ['Alimentado desde', r.alimentadoDesde], ['kVA Conectados', r2(r.W130)], ['kVA Demandados', r2(A.L139)], ['Factor demanda', r2(A.R139)],
        ['Factor potencia', r2(A.T139)], ['Factor de diversidad', r2(A.S139)], ['Calibres conductores alimentador', ''], ['Fases (AWG)', A.preF, t2(A.AL139)],
        ['Neutro (AWG)', t2(A.preN), t2(A.AN139)], ['Tierra (AWG)', t2(A.preN), t2(A.AP139)], ['Material', A.mat], ['Aislamiento', A.ais], ['Tubería', ''], ['Ø (mm)', t2(A.preN), A.AR139], ['Tipo', A.tuberia],
        ['Longitud (m)', r2(A.M139)], ['Voltaje bornes (V)', r2(A.AW139)], ['Caída de voltaje total (V)', r2(A.AX139)], ['Caída de voltaje total (%)', r2(A.AY139)],
        ['Corriente cortocircuito disponible (kA)', r.iccKA ? r2(r.iccKA) : ''], ['Capacidad de breaker (A)', A.AF139 || '']];
    },
    /** TABLA RESUMEN DU (VERTICAL) (BR18:BT30). */
    du(r) {
      const A = r.alim;
      return [['Tablero / Equipo', r.nombre], ['Conectado a', r.alimentadoDesde], ['kVA Conectados', r2(r.W130)], ['kVA Demandados', r2(A.L139)], ['Factor de demanda', r2(A.R139)],
        ['Capacidad de breaker (A)', A.AF139 || ''], ['Fases (AWG)', A.preF, t2(A.AL139)], ['Neutro (AWG)', t2(A.preN), t2(A.AN139)], ['Tierra (AWG)', t2(A.preN), t2(A.AP139)],
        ['Material', A.mat], ['Aislamiento', A.ais], ['Ø (mm)', t2(A.preN), A.AR139], ['Tipo', A.tuberia]];
    },
    /** TABLA RESUMEN ORIGINAL (BZ18:CB56), incluye los datos del transformador si se indicaron. */
    original(r) {
      const A = r.alim, tr = r.tab.trafo || {};
      return [['Tablero', r.nombre], ['Capacidad del transformador (kVA)', tr.kva || ''], ['Impedancia (%Z)', tr.z || ''], ['Fases', tr.fases || ''], ['Voltaje devanado primario (kV)', tr.primario || ''],
        ['Voltaje devanado secundario (V)', tr.secundario || ''], ['Corriente de cortocircuito calculada (kA)', r.iccKA ? r2(r.iccKA) : ''], ['Potencia total (kVA)', r2(r.W130)], ['Potencia neta (kVA)', r2(A.L139)],
        ['Factor de demanda', r2(A.R139)], ['Factor de potencia', r2(A.T139)], ['Factor de diversidad', r2(A.S139)], ['Alimentadores', ''],
        ['Fases', A.preF, t2(A.AL139)], ['Neutro', t2(A.preN), t2(A.AN139)], ['Puesta a tierra', t2(A.preN), t2(A.AP139)], ['Distancia (m)', r2(A.M139)],
        ['Voltaje nominal (V)', r.V], ['Voltaje en bornes (V)', r2(A.AW139)], ['Caída de voltaje (V)', r2(A.AX139)], ['Caída de voltaje (%)', r2(A.AY139)]];
    },
  };
  const num = v => (v === '' || v === null || v === undefined || isNaN(Number(v)) ? 1e9 : Number(v));

  function tablaVertical(lista, fn, titulo) {
    if (!lista.length) return h('div', { class: 'empty' }, 'Sin tableros.');
    const filas = lista.map(fn), n = filas[0].length;
    return h('div', { class: 'tbl-wrap', 'data-scroll': 'v-' + titulo }, h('table', { class: 'tbl vert' },
      h('thead', null, h('tr', null, h('th', null, titulo), lista.map(r => h('th', { colspan: 2 }, r.nombre)))),
      h('tbody', null, Array.from({ length: n }, (_, i) => h('tr', { class: filas[0][i][1] === '' && filas[0][i].length === 2 && i ? 'sub' : '' }, h('th', null, filas[0][i][0]),
        filas.map(f => f[i].length > 2 ? [h('td', { class: 'r' }, f[i][1]), h('td', null, f[i][2])] : h('td', { colspan: 2 }, f[i][1])))))));
  }

  App.views.resumen = function (view, R, sub) {
    sub = sub || 'horizontal';
    const lista = Resumen.ordenados(R);
    view.appendChild(h('div', { class: 'page-h row no-print' }, h('div', null, h('h2', null, 'Tablas resumen'), h('p', { class: 'muted' }, 'Tablas para los planos de Revit. Se actualizan solas; ya no hace falta correr macros.')),
      h('div', { class: 'toolbar' }, UI.btn('Exportar a Excel', () => ExportExcel.download(R), 'primary small'),
        UI.btn('CSV (tabla horizontal)', () => U.download(App.fileBase() + ' - tabla resumen.csv', U.csv([Resumen.grupos.flatMap(([g, n]) => [g].concat(Array(n - 1).fill(''))), Resumen.sub].concat(lista.map(Resumen.horizontal))), 'text/csv'), 'small'),
        UI.btn('Imprimir', () => window.print(), 'small'))));

    // orden / exclusión (hoja ORDEN TABLEROS)
    view.appendChild(h('details', { class: 'card fold no-print' }, h('summary', { class: 'card-h' }, h('h3', null, 'Orden y tableros incluidos (' + lista.length + ' de ' + R.orden.length + ')')),
      h('div', { class: 'card-b' }, h('p', { class: 'muted' }, 'Número para ordenar; desmarque para excluir de las tablas. Sin número se ubican al final en el orden de alimentación.'),
        h('table', { class: 'tbl narrow' }, h('thead', null, h('tr', null, h('th', null, 'Tablero'), h('th', null, 'Orden'), h('th', null, 'Incluir'))),
          h('tbody', null, R.orden.map(r => h('tr', null, h('td', null, r.nombre), h('td', null, UI.input(r.tab, 'orden', { type: 'num', class: 'w-num', fk: 'ord:' + r.tab.id })),
            h('td', null, h('input', { type: 'checkbox', checked: !r.tab.excluirResumen, onchange: e => { r.tab.excluirResumen = !e.target.checked; Store.save(); App.refresh(); } })))))))));

    const tabs = [['horizontal', 'Horizontal'], ['vertical', 'Vertical'], ['du', 'DU (vertical)'], ['original', 'Original']];
    view.appendChild(h('nav', { class: 'chips no-print' }, tabs.map(([k, l]) => h('a', { class: 'chip' + (sub === k ? ' active' : ''), href: '#resumen/' + k }, l))));

    if (sub === 'horizontal') {
      const head = h('thead', null,
        h('tr', null, Resumen.grupos.map(([g, n]) => h('th', { colspan: n, rowspan: n === 1 ? 2 : 1 }, g))),
        h('tr', null, Resumen.sub.map((s, i) => { const grp = colGrupo(i); return grp && grp[1] > 1 ? h('th', null, s) : null; })));
      view.appendChild(UI.card('TABLA RESUMEN — TABLEROS ELÉCTRICOS', lista.length ? h('div', { class: 'tbl-wrap', 'data-scroll': 'res-h' }, h('table', { class: 'tbl res' }, head,
        h('tbody', null, lista.map(r => h('tr', null, Resumen.horizontal(r).map((v, i) => h('td', { class: typeof v === 'number' ? 'r' : '' }, typeof v === 'number' ? U.fmt(v, 2) : v))))))) : h('div', { class: 'empty' }, 'Sin tableros.')));
    } else if (sub === 'vertical') view.appendChild(UI.card('TABLA RESUMEN (VERTICAL)', tablaVertical(lista, Resumen.vertical, 'Tablero / Alimentadores')));
    else if (sub === 'du') view.appendChild(UI.card('TABLA RESUMEN DU (VERTICAL)', tablaVertical(lista, Resumen.du, 'Tablero / Alimentadores')));
    else view.appendChild(UI.card('TABLA RESUMEN ORIGINAL', tablaVertical(lista, Resumen.original, 'Datos'), h('small', { class: 'muted' }, 'Los datos del transformador se llenan en la memoria de cálculo de cada tablero.')));
  };
  function colGrupo(i) { let c = 0; for (const g of Resumen.grupos) { if (i < c + g[1]) return g; c += g[1]; } return null; }
  window.Resumen = Resumen;
})();
