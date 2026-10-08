/* Pestañas "Tableros 3F" y "Tableros 1F": cuadro de cargas de cada tablero con el formato de las hojas del Excel
   (datos de cálculo, especificación, alimentador, interruptor principal, supresor, circuitos y posición en el tablero). */
(function () {
  'use strict';
  const h = U.h, f2 = v => U.fmt(v, 2), f1 = v => U.fmt(v, 1);
  const FASES = ['A', 'B', 'C'];

  /** Cuadro de un tablero. Se reutiliza en la exportación a Excel (mismas filas). */
  function filasCircuitos(r) {
    return r.rows.map(x => ({
      id: (r.tab.nombre || '') + '-' + x.polos.join(','), polos: x.polos, desc: x.descripcion, kva: x.J, cv: x.AY,
      bkModelo: x.breaker ? x.breaker.modelo || '' : '', marco: x.breaker && Number(x.breaker.marco) ? x.breaker.marco : '', amp: x.AF || '', unidad: x.breaker ? x.breaker.unidad : '',
      polosBk: x.J ? x.polosBreaker : '', sccr: x.breaker ? x.breaker.sccr : '', fasesTxt: x.AL ? x.fasesTxt : '', neutroTxt: x.neutroTxt, tierraTxt: x.tierraTxt,
      mat: x.J ? (x.mat === 'AL-MC' ? 'AL' : x.mat) : '', ais: x.J ? x.ais : '', tubo: x.tuboTxt, fase: x.fase,
    }));
  }

  function cuadro(r) {
    const t = r.tab, A = r.alim, nf = r.fases === 3 ? 3 : 2;
    const cell = (l, v, cls) => h('div', { class: 'ce ' + (cls || '') }, h('span', null, l), h('b', null, v === null || v === undefined || v === '' ? '—' : v));
    const sec = (titulo, cells, cls) => h('section', { class: 'cq-sec ' + (cls || '') }, h('h4', null, titulo), h('div', { class: 'cq-cells' }, cells));
    const rows = filasCircuitos(r);
    const tabla = h('table', { class: 'tbl cq' },
      h('thead', null,
        h('tr', { class: 'grp' }, h('th', { colspan: 4 }, 'Datos de circuitos ramales / alimentadores'), h('th', { colspan: 6 }, 'Datos de interruptores ramales'), h('th', { colspan: 5 }, 'Datos conductores ramales / alimentadores'), h('th', null, 'Tubo ' + 'EMT'), h('th', { colspan: nf }, 'Posición (kVA)')),
        h('tr', null, ['ID de circuito', 'Descripción de carga', 'kVA', 'ΔV total (%)', 'Modelo', 'Marco (A)', 'Amperios (A)', 'Tipo', 'Polos', 'SCCR (kA)', 'Fases', 'Neutro', 'Tierra', 'Tipo', 'Aislamiento', 'Ø (mm)'].concat(FASES.slice(0, nf).map(f => 'Fase ' + f)).map(x => h('th', null, x)))),
      h('tbody', null, rows.map(x => h('tr', null, h('td', { class: 'nowrap' }, x.id), h('td', null, x.desc), h('td', { class: 'r' }, f2(x.kva)), h('td', { class: 'r' }, x.cv !== null ? f2(x.cv) : ''),
        h('td', null, x.bkModelo), h('td', { class: 'r' }, x.marco), h('td', { class: 'r' }, x.amp), h('td', null, x.unidad), h('td', { class: 'r' }, x.polosBk), h('td', { class: 'r' }, x.sccr),
        h('td', null, x.fasesTxt), h('td', null, x.neutroTxt), h('td', null, x.tierraTxt), h('td', null, x.mat), h('td', null, x.ais), h('td', null, x.tubo),
        x.fase.slice(0, nf).map((v, i) => h('td', { class: 'r ph ph' + i }, v ? f2(v) : ''))))),
      h('tfoot', null, h('tr', null, h('th', { colspan: 2, class: 'r' }, 'kVA conectados sin reserva'), h('th', { class: 'r' }, f2(r.J116)), h('th', { colspan: 13 }), r.U116.slice(0, nf).map(v => h('th', { class: 'r' }, f2(v))))));

    return h('article', { class: 'cuadro' },
      h('header', { class: 'cq-h' }, h('h3', null, r.nombre), h('span', null, 'Alimentado desde: ', h('b', null, r.alimentadoDesde || '—'))),
      h('div', { class: 'cq-grid' },
        sec('Datos de cálculos eléctricos', [cell('kVA conectados', f2(r.W130)), cell('kVA demandados', f2(A.L139)), cell('kVA reserva', U.fmt((Number(t.reserva) || 0) * 100, 0) + ' %'),
          cell('Factor demanda', f2(A.R139)), cell('Factor diversidad', f2(A.S139)), cell('Factor potencia', f2(A.T139)),
          cell('Amperios por fase', A.AA139.slice(0, nf).map(v => f1(v)).join(' / ')), cell('Icc disponible (kA)', r.iccKA ? f2(r.iccKA) : '')]),
        sec('Especificación del tablero', [cell('Tensión nominal (V)', t.sistema), cell('Fases', r.fases), cell('Hilos', r.hilos), cell('Modelo', r.cat && r.cat.modelo), cell('Fabricante', r.marca), cell('Montaje', t.montaje),
          cell('Barras F / N / T (A)', r.cat ? r.cat.barraFase + ' / ' + r.cat.barraNeutro + ' / ' + r.cat.barraTierra : ''), cell('Espacios', r.cat && r.cat.espacios), cell('% Desbalance máx.', f2(r.desbalance))]),
        sec('Datos del alimentador / acometida', [cell('Fases (AWG)', A.fasesTxt), cell('Neutro (AWG)', A.neutroTxt), cell('Tierra (AWG)', A.tierraTxt), cell('Material', A.mat), cell('Aislamiento', A.ais),
          cell('Tubería (Ø mm)', (A.preN || '') + A.AR139), cell('Longitud (m)', f1(A.M139)), cell('Voltaje en bornes (V)', f2(A.AW139)), cell('Caída de voltaje (V)', f2(A.AX139)), cell('Caída total (%)', f2(A.AY139))], 'wide'),
        sec('Interruptor principal', [cell('Modelo', r.bkMain && r.bkMain.modelo), cell('Amperaje (A)', A.AF139), cell('Marco (A)', r.bkMain && Number(r.bkMain.marco) ? r.bkMain.marco : ''), cell('Tipo', r.bkMain && r.bkMain.unidad), cell('Polos', r.bkMain && r.bkMain.polos), cell('SCCR (kA)', r.bkMain && r.bkMain.sccr)]),
        sec('Supresor (SPD)', [cell('Modelo', r.spd && r.spd.modelo), cell('Capacidad (kA)', r.spd ? r.spd.kaLL + ' / ' + r.spd.kaLN : ''), cell('Montaje', r.spd && r.spd.montaje)])),
      h('div', { class: 'tbl-wrap', 'data-scroll': 'cq-' + t.id }, tabla),
      posiciones(r),
      h('p', { class: 'leyenda' }, Store.catalog.leyendaUnidades || ''));
  }

  /** Vista del tablero por posiciones (impares a la izquierda, pares a la derecha) con la fase de cada fila. */
  function posiciones(r) {
    const esp = Math.max(r.cat ? Number(r.cat.espacios) || 0 : 0, r.espaciosUsados, 2);
    const filas = Math.ceil(esp / 2), ocup = {};
    r.rows.forEach(x => x.polos.forEach((p, i) => { ocup[p] = { x, primero: i === 0 }; }));
    const lado = p => { const o = ocup[p]; if (!o) return h('div', { class: 'slot vacio' }, h('i', null, p), 'Espacio'); return h('div', { class: 'slot' + (o.primero ? '' : ' cont') }, h('i', null, p), o.primero ? h('span', null, o.x.descripcion || '—', h('small', null, ' ' + f2(o.x.J) + ' kVA · ' + (o.x.AF || '') + ' A/' + o.x.polosBreaker + 'P')) : h('span', { class: 'muted' }, '↑')); };
    const rowsEl = [];
    for (let k = 0; k < filas; k++) {
      const ph = Calc.fasePolo(2 * k + 1, r.fases);
      rowsEl.push(h('div', { class: 'prow' }, lado(2 * k + 1), h('div', { class: 'pfase ph' + ph }, FASES[ph]), lado(2 * k + 2)));
    }
    return h('details', { class: 'posiciones' }, h('summary', null, 'Posición en el tablero (' + esp + ' espacios)'), h('div', { class: 'panel' }, rowsEl));
  }

  function vista(tipo) {
    return function (view, R, id) {
      const lista = R.orden.filter(r => r.tab.tipo === tipo);
      view.appendChild(h('div', { class: 'page-h row no-print' }, h('div', null, h('h2', null, 'Tableros ' + tipo), h('p', { class: 'muted' }, 'Cuadro de cargas de cada tablero con el formato de las hojas TABLEROS ' + tipo + ' del Excel.')),
        h('div', { class: 'toolbar' }, UI.btn('Imprimir / PDF', () => window.print(), 'small'), UI.btn('Exportar a Excel', () => ExportExcel.download(R, { soloTipo: tipo }), 'small'))));
      if (!lista.length) { view.appendChild(h('div', { class: 'empty' }, 'No hay tableros ' + tipo + '.')); return; }
      const todos = id === 'todos', sel = todos ? null : (lista.find(r => r.tab.id === id) || lista[0]);
      view.appendChild(h('nav', { class: 'chips no-print' }, lista.map(r => h('a', { class: 'chip' + (sel && r.tab.id === sel.tab.id ? ' active' : ''), href: '#' + (tipo === '3F' ? 'tab3f' : 'tab1f') + '/' + r.tab.id }, r.nombre)),
        h('a', { class: 'chip' + (todos ? ' active' : ''), href: '#' + (tipo === '3F' ? 'tab3f' : 'tab1f') + '/todos' }, 'Todos (para imprimir)')));
      (todos ? lista : [sel]).forEach(r => view.appendChild(cuadro(r)));
    };
  }
  App.views.tab3f = vista('3F');
  App.views.tab1f = vista('1F');
  window.Cuadro = { filasCircuitos };
})();
