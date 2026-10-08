/* Memoria de cálculo por tablero (equivale a un bloque de la hoja ANACAR): datos del tablero, circuitos ramales,
   factores de demanda, alimentador con caída de voltaje en cascada, cortocircuito y balanceo. */
(function () {
  'use strict';
  const h = U.h, f2 = v => U.fmt(v, 2), f1 = v => U.fmt(v, 1), f0 = v => U.fmt(v, 0);
  const pos = c => (c.polos || []).join(',');

  /** Selector de tableros en orden de alimentación. */
  function selector(R, id) {
    return h('nav', { class: 'chips', 'aria-label': 'Tableros' }, R.orden.map(r => h('a', {
      class: 'chip' + (r.tab.id === id ? ' active' : '') + (r.avisos.length ? ' warn' : ''), href: '#memoria/' + r.tab.id,
      style: { marginLeft: r.nivel ? '0' : null }, title: r.avisos.join('\n') || null,
    }, (r.nivel ? '↳ '.repeat(1) : '') + r.nombre)));
  }

  const detOpts = () => {
    const tipos = {}; Store.catalog.tiposCarga.forEach(t => { tipos[t.id] = t.nombre; });
    return Store.catalog.detallesCarga.map(d => ({ value: d.id, label: d.id + ' · ' + d.descripcion + ' (' + d.v + ' V ' + d.fases + 'F)', group: tipos[d.tipo] || 'Tipo ' + d.tipo }));
  };
  const bkOpts = (marca, auto) => [{ value: '', label: auto ? 'Auto: ' + auto : 'Automático' }].concat(Store.catalog.breakers.filter(b => b.marca === marca).map(b => ({
    value: b.id, label: b.id + ' · ' + (b.modelo || '—') + ' ' + (b.amperios || '') + ' A ' + (b.unidad || '') + ' ' + (b.polos || '') + 'P ' + (b.sccr || '') + ' kA', group: (b.polos || '?') + ' polos',
  })));

  function datosTablero(t, r, R) {
    const L = Store.catalog.listas, k = 'd:' + t.id + ':', C = Store.catalog;
    const marcaOpts = UI.opts(Store.catalog.marcas, 'Del proyecto (' + Store.project.marcaDefecto + ')');
    const catOpts = [{ value: '', label: r.cat ? 'Auto: ' + r.cat.modelo + ' (' + r.cat.fabricante + ')' : 'Automático' }].concat(C.tablerosCat.map(x => ({ value: x.id, label: x.id + ' · ' + x.modelo + ' · ' + x.barraFase + ' A · ' + x.espacios + ' esp.', group: x.fabricante })));
    const spdOpts = [{ value: '', label: r.spd ? 'Auto: ' + r.spd.modelo : 'Automático' }].concat(C.supresores.filter(x => x.marca === r.marca).map(x => ({ value: x.id, label: x.id + ' · ' + x.modelo + ' · ' + x.voltaje + ' V ' + x.fases + 'F · ' + x.kaLL + ' kA', group: x.montaje })));
    const trOpts = UI.opts(C.transformadores.map(x => ({ value: x.id, label: x.nombre, group: x.tipo })), '— Ninguno —');
    const padres = Store.posiblesPadres(t);
    return UI.card('Datos del tablero', h('div', { class: 'grid4' },
      UI.field('Prefijo', UI.input(t, 'prefijo', { fk: k + 'pre' })), UI.field('Nombre / ID', UI.input(t, 'nombre', { fk: k + 'nom' })),
      UI.field('Tipo', UI.select(['3F', '1F'], t.tipo, v => { t.tipo = v; Object.assign(t, Store.voltajeDe(t.sistema, v)); Store.save(); App.refresh(); }, { fk: k + 'tipo' })),
      UI.field('Sistema (V)', UI.select(L.sistemas, t.sistema, v => { t.sistema = v; Object.assign(t, Store.voltajeDe(v, t.tipo)); Store.save(); App.refresh(); }, { fk: k + 'sis' }), 'Voltaje nominal ' + t.voltaje + ' V · ' + t.fases + ' fases · ' + t.hilos + ' hilos'),
      UI.field('Fases', UI.bind(t, 'fases', [3, 2, 1], { num: true, fk: k + 'fas' })), UI.field('Hilos', UI.bind(t, 'hilos', [4, 3, 2], { num: true, fk: k + 'hil' })),
      UI.field('% Reserva', UI.input(t, 'reserva', { type: 'num', fk: k + 'res' }), 'Fracción: 0,1 = 10 %'),
      UI.field('Factor diversidad del tablero', UI.input(t, 'fdivTablero', { type: 'num', fk: k + 'fdv', placeholder: '1' })),
      UI.field('Alimentado desde', UI.select(UI.opts(padres.map(o => ({ value: o.id, label: Calc.nombreTablero(o) })), '— Acometida / externo —'), t.padreId, v => { Store.cambiarPadre(t, v); App.refresh(); }, { fk: k + 'pad' })),
      !t.padreId ? UI.field('Conectado a', UI.input(t, 'conectadoA', { fk: k + 'con', placeholder: 'MÓDULO MEDIDORES' })) : UI.field('Circuito en ' + (r.padre ? r.padre.nombre : ''), h('div', { class: 'ro' }, r.circuitoPadre ? 'Posición ' + pos(r.circuitoPadre.c) : 'Sin circuito')),
      UI.field('Longitud alimentador (m)', UI.input(t, 'longitud', { type: 'num', fk: k + 'lon' })),
      UI.field('Icc disponible (kA)', UI.input(t, 'iccManual', { type: 'num', fk: k + 'icc', placeholder: r.iccKA ? f2(r.iccKA) + ' (' + r.iccFuente + ')' : 'Ingrese o elija transformador' }), t.padreId ? 'Vacío = cascada desde ' + (r.padre ? r.padre.nombre : 'el padre') : 'En bornes del tablero'),
      !t.padreId || (r.padre && r.padre.V !== r.V) ? UI.field('Transformador (Icc)', UI.bind(t, 'transformadorId', trOpts, { fk: k + 'tr' }), 'Calcula el Icc con su KACC y el alimentador') : null,
      UI.field('Marca', UI.bind(t, 'marca', marcaOpts, { fk: k + 'mar' })),
      UI.field('Tablero (catálogo)', UI.bind(t, 'catalogoId', catOpts, { fk: k + 'cat' }), r.cat ? 'Barras ' + r.cat.barraFase + '/' + r.cat.barraNeutro + '/' + r.cat.barraTierra + ' A · ' + r.cat.espacios + ' espacios (usa ' + r.espaciosUsados + ')' : null, 'span2'),
      UI.field('Montaje', UI.bind(t, 'montaje', L.montajes, { fk: k + 'mon' })),
      UI.field('Supresor (SPD)', UI.bind(t, 'supresorId', spdOpts, { fk: k + 'spd' }), r.spd ? r.spd.montaje + ' · ' + r.spd.kaLL + '/' + r.spd.kaLN + ' kA' : null),
    ));
  }

  function alimentador(t, r) {
    const a = t.alim, A = r.alim, L = Store.catalog.listas, k = 'a:' + t.id + ':';
    const fila = (l, v, cls) => h('tr', { class: cls || '' }, h('th', null, l), h('td', null, v));
    const ok = A.ampCond === null ? '—' : A.ampCond >= A.ampReq ? h('span', { class: 'badge ok' }, 'Cumple') : h('span', { class: 'badge bad' }, 'No cumple');
    return UI.card('Alimentador / acometida', h('div', { class: 'cols' },
      h('div', { class: 'grid3' },
        UI.field('Material', UI.bind(a, 'material', L.materiales, { fk: k + 'mat' })),
        UI.field('Aislamiento', UI.bind(a, 'aislamiento', Store.catalog.aislamientos, { fk: k + 'ais' })),
        UI.field('Tubería', UI.bind(a, 'tuberia', L.tuberias, { fk: k + 'tub' })),
        UI.field('# en paralelo', UI.input(a, 'paralelos', { type: 'num', fk: k + 'par', placeholder: 'Auto ' + A.AI139 })),
        UI.field('Aumento de calibre', UI.input(a, 'aumento', { type: 'num', fk: k + 'aum' }), '1 = sin aumento'),
        UI.field('Factor de potencia', UI.input(a, 'fp', { type: 'num', fk: k + 'fp' })),
        UI.field('Factor multiplicador', UI.input(a, 'mult', { type: 'num', fk: k + 'mul' }), '1,25 carga continua'),
        UI.field('Protección (A)', UI.input(a, 'prot', { type: 'num', fk: k + 'pro', placeholder: 'Auto ' + (A.AF139 || '') })),
        UI.field('Interruptor principal', UI.bind(a, 'breakerId', bkOpts(r.marca, r.bkMain && !a.breakerId ? r.bkMain.modelo + ' ' + r.bkMain.amperios + ' A' : ''), { fk: k + 'bk' }), null, 'span3'),
        UI.field('Temp. ambiente (°C)', UI.bind(a, 'tempAmb', L.temperaturas, { fk: k + 'ta' })),
        UI.field('Temp. bornes (°C)', UI.bind(a, 'tempBorne', [60, 75, 90], { num: true, fk: k + 'tb' })),
        UI.field('Cond. portadores (agrup.)', UI.bind(a, 'agrupamiento', L.agrupamientos, { fk: k + 'ag' })),
      ),
      h('table', { class: 'kv' }, h('tbody', null,
        fila('Corriente demandada A / B / C (A)', [0, 1, 2].slice(0, r.fases === 3 ? 3 : 2).map(i => f1(A.AA139[i])).join(' / ')),
        fila('Ampacidad requerida (A)', f2(A.AE139)),
        fila('Protección (A)', A.AF139 || '—'),
        fila('Conductores', h('b', null, A.fasesTxt + (A.neutroTxt ? ' + ' + A.neutroTxt + ' N' : '') + (A.tierraTxt ? ' + ' + A.tierraTxt + ' T' : '') + ' AWG ' + A.mat + ' ' + A.ais)),
        fila('Tubería', (A.preN || '') + A.AR139 + ' mm ' + A.tuberia),
        fila('Conductor del electrodo (250.66)', A.AP140 ? A.AP140 + ' AWG' : '—'),
        fila('Ampacidad corregida (310.16 × ' + U.fmt(A.tempF * A.agrF, 2) + ')', h('span', null, f1(A.ampCond) + ' A vs ' + f1(A.ampReq) + ' A ', ok)),
        fila('FAC tabla / ajustado', f2(A.AS139) + ' / ' + f2(A.AT139)),
        fila('Voltaje de partida (V)', h('span', null, f2(A.vInicio), r.padre && A.vInicio !== r.V ? h('small', { class: 'muted' }, ' (bornes de ' + r.padre.nombre + ')') : null)),
        fila('Caída en el alimentador (V)', f2(A.AV139)),
        fila('Voltaje en bornes L-L / L-N (V)', f2(A.AW139) + ' / ' + f2(A.AW140)),
        fila('Caída acumulada (V / %)', h('b', { class: A.AY139 > Store.project.cvMaxAlim ? 'bad' : '' }, f2(A.AX139) + ' V · ' + f2(A.AY139) + ' %')),
        fila('Interruptor principal', r.bkMain ? (r.bkMain.modelo || '—') + ' · ' + (r.bkMain.amperios || '') + ' A · ' + r.bkMain.unidad + ' · ' + r.bkMain.polos + 'P · ' + r.bkMain.sccr + ' kA' : '—'),
        fila('Cortocircuito en bornes', r.iccKA ? f2(r.iccKA) + ' kA (' + r.iccFuente + ')' : '—'),
      ))));
  }

  function circuitos(t, r, R) {
    const k = c => 'c:' + c.id + ':', L = Store.catalog.listas, dOpts = detOpts();
    const head = h('thead', null,
      h('tr', { class: 'grp' }, h('th', { colspan: 9 }, 'Datos de circuitos ramales / alimentadores'), h('th', { colspan: r.fases === 3 ? 3 : 2 }, 'Balance (kVA)'),
        h('th', { colspan: 8 }, 'Cálculo de conductores'), h('th', { colspan: 3 }, 'Caída de voltaje'), h('th', { colspan: 4 }, 'Interruptor ramal'), h('th', null, '')),
      h('tr', null, ['Posición', 'Detalle de carga', 'Descripción', 'kVA', 'Long. (m)', 'V', 'F', 'Mult.', 'I (A)'].concat(r.fases === 3 ? ['A', 'B', 'C'] : ['A', 'B'],
        ['Amp. req.', 'Prot. (A)', 'Material', 'Aislam.', '# par.', 'Aum.', 'Calibres F / N / T', 'Tubo (mm)', 'V real', 'ΔV (V)', 'ΔV total %', 'Tipo', 'Modelo', 'Polos', 'SCCR', '']).map(x => h('th', null, x))));
    const body = h('tbody');
    r.rows.forEach(x => {
      const c = x.c, kk = k(c), hijo = c.tableroHijoId && Store.tablero(c.tableroHijoId);
      const polos = UI.input({ v: pos(c) }, 'v', { fk: kk + 'pol', class: 'w-pos', label: 'Posición', save: false, after: v => {
        const arr = String(v).split(/[^0-9]+/).map(Number).filter(z => z > 0);
        c.polos = arr; Store.save(); App.refresh();
      } });
      body.appendChild(h('tr', { class: (x.err.length ? 'row-warn' : '') + (hijo ? ' row-link' : ''), title: x.err.join('\n') || null },
        h('td', { class: 'sticky' }, polos),
        h('td', null, hijo ? h('a', { href: '#memoria/' + hijo.id, class: 'link' }, '→ ' + Calc.nombreTablero(hijo)) : null, UI.bind(c, 'detalleId', dOpts, { num: true, fk: kk + 'det', class: 'w-det', label: 'Detalle de carga' })),
        h('td', null, hijo ? h('span', { class: 'ro' }, x.descripcion) : UI.input(c, 'descripcion', { fk: kk + 'des', class: 'w-desc', placeholder: x.det.descripcion || '' })),
        h('td', null, hijo ? h('span', { class: 'ro r' }, f2(x.J)) : UI.input(c, 'kva', { type: 'num', fk: kk + 'kva', class: 'w-num' })),
        h('td', null, hijo ? h('span', { class: 'ro r' }, f1(c.longitud)) : UI.input(c, 'longitud', { type: 'num', fk: kk + 'lon', class: 'w-num' })),
        h('td', { class: 'r' }, x.O || ''), h('td', { class: 'r' }, x.P || ''),
        h('td', null, UI.input(c, 'mult', { type: 'num', fk: kk + 'mul', class: 'w-xs', placeholder: f2(x.det.mult || 1.25) })),
        h('td', { class: 'r' }, x.J ? f1(Math.max(...x.I)) : ''),
        x.fase.slice(0, r.fases === 3 ? 3 : 2).map((v, i) => h('td', { class: 'r ph ph' + i }, v ? f2(v) : '')),
        h('td', { class: 'r' }, x.AE ? f1(x.AE) : ''),
        h('td', null, UI.input(c, 'prot', { type: 'num', fk: kk + 'pro', class: 'w-xs', placeholder: x.AF && !c.prot ? String(x.AF) : '' })),
        h('td', null, UI.bind(c, 'material', L.materiales, { fk: kk + 'mat', class: 'w-xs' })),
        h('td', null, UI.bind(c, 'aislamiento', Store.catalog.aislamientos, { fk: kk + 'ais', class: 'w-ais' })),
        h('td', null, UI.input(c, 'paralelos', { type: 'num', fk: kk + 'par', class: 'w-xxs', placeholder: String(x.AI) })),
        h('td', null, UI.input(c, 'aumento', { type: 'num', fk: kk + 'aum', class: 'w-xxs' })),
        h('td', { class: 'nowrap' }, x.AL ? x.fasesTxt + (x.neutroTxt ? ' · ' + x.neutroTxt : '') + (x.tierraTxt ? ' · ' + x.tierraTxt : '') : ''),
        h('td', { class: 'r' }, x.tuboTxt), h('td', { class: 'r' }, x.AU ? f1(x.AU) : ''), h('td', { class: 'r' }, x.AV !== null ? f2(x.AV) : ''),
        h('td', { class: 'r ' + (x.AY > Store.project.cvMaxTotal ? 'bad' : '') }, x.AY !== null ? f2(x.AY) : ''),
        h('td', null, UI.bind(c, 'breakerId', bkOpts(r.marca, x.breaker && !c.breakerId ? (x.breaker.modelo || x.breaker.unidad) : ''), { fk: kk + 'bk', class: 'w-bk' })),
        h('td', null, x.breaker ? (x.breaker.modelo || '—') + ' ' + (x.breaker.unidad || '') : ''), h('td', { class: 'r' }, x.J ? x.polosBreaker : ''), h('td', { class: 'r' }, x.breaker ? x.breaker.sccr : ''),
        h('td', { class: 'acc' },
          UI.iconBtn('⧉', 'Duplicar circuito', () => { const n = U.clone(c); n.id = U.uid(); n.tableroHijoId = ''; n.auto = false; n.polos = Store.posicionLibre(t, Math.max(1, c.polos.length)); t.circuitos.push(n); Store.save(); App.refresh(); }),
          UI.iconBtn('🗑', 'Eliminar circuito', async () => {
            if (hijo && !(await UI.confirm('Este circuito alimenta a ' + Calc.nombreTablero(hijo) + '. ¿Eliminarlo? El tablero quedará como acometida/externo.', 'Eliminar'))) return;
            t.circuitos = t.circuitos.filter(z => z !== c); if (hijo) hijo.padreId = ''; Store.save(); App.refresh();
          }, 'danger'))));
    });
    const tot = h('tfoot', null, h('tr', null, h('th', { colspan: 3, class: 'r' }, 'Totales'), h('th', { class: 'r' }, f2(r.J116)), h('th', { colspan: 5 }),
      r.U116.slice(0, r.fases === 3 ? 3 : 2).map(v => h('th', { class: 'r' }, f2(v))), h('th', { colspan: 16, class: 'l' }, 'Desbalance máximo: ' + f2(r.desbalance) + ' %')));
    const hijosSinCircuito = Store.project.tableros.filter(o => o.padreId === t.id && !t.circuitos.some(c => c.tableroHijoId === o.id));
    return UI.card('Circuitos ramales (' + r.rows.length + ')', h('div', null,
      r.rows.length ? h('div', { class: 'tbl-wrap', 'data-scroll': 'circ-' + t.id }, h('table', { class: 'tbl calc' }, head, body, tot)) : h('div', { class: 'empty' }, 'Sin circuitos. Agréguelos o impórtelos de Revit.'),
      h('div', { class: 'toolbar' },
        UI.btn('+ Circuito', () => { const c = Store.nuevoCircuito(t); App.refresh(); setTimeout(() => { const e = document.querySelector('[data-fk="c:' + c.id + ':kva"]'); if (e) e.focus(); }, 0); }, 'primary small'),
        UI.btn('+ Tablero derivado…', () => nuevoDerivado(t), 'small', 'Crea un tablero alimentado desde este y su circuito'),
        hijosSinCircuito.length ? UI.btn('Asignar circuito a derivados (' + hijosSinCircuito.length + ')', () => { hijosSinCircuito.forEach(o => Store.cambiarPadre(o, t.id)); App.refresh(); }, 'small') : null,
        UI.btn('Sugerir balanceo…', () => balanceo(t), 'small'),
        h('span', { class: 'grow' }),
        h('small', { class: 'muted' }, 'Posición: polos separados por coma (1,3,5). Campos vacíos usan el valor automático que se muestra en gris.'))));
  }

  function nuevoDerivado(padre) {
    UI.prompt('Nuevo tablero derivado de ' + Calc.nombreTablero(padre), 'Nombre del tablero', '', v => (v ? '' : 'Escriba un nombre')).then(nombre => {
      if (!nombre) return;
      const t = Store.nuevoTablero({ nombre, tipo: padre.tipo, sistema: padre.sistema });
      Store.cambiarPadre(t, padre.id); App.refresh(); UI.toast('Tablero ' + nombre + ' creado y conectado', 'ok');
    });
  }

  function balanceo(t) {
    const b = Calc.balanceo(t, Store.catalog, 12);
    if (!b.movs.length) { UI.alert('No se encontraron movimientos que mejoren el desbalance (' + U.fmt(b.antes, 2) + ' %).', 'Balanceo'); return; }
    UI.modal('Balanceo sugerido — ' + Calc.nombreTablero(t), h('div', null,
      h('p', null, 'Desbalance actual ', h('b', null, U.fmt(b.antes, 2) + ' %'), ' → con los cambios ', h('b', { class: 'okc' }, U.fmt(b.despues, 2) + ' %')),
      h('ol', { class: 'movs' }, b.movs.map(m => h('li', null, m.txt, h('small', { class: 'muted' }, ' (' + U.fmt(m.d, 2) + ' %)')))),
      h('p', { class: 'muted' }, 'Solo intercambia circuitos con el mismo número de polos o mueve circuitos de 1 polo a espacios libres. Revise que las posiciones resultantes sean coherentes con el plano.')), [
      { label: 'Cerrar' },
      { label: 'Aplicar cambios', cls: 'primary', onclick: () => { b.resultado.forEach(x => { const c = t.circuitos.find(z => z.id === x.id); if (c) c.polos = x.polos; }); Store.save(); App.refresh(); UI.toast('Posiciones actualizadas', 'ok'); } },
    ], { wide: true });
  }

  function demanda(t, r) {
    const body = h('tbody');
    r.tipos.filter(x => x.conectados || (t.fd || {})[x.tipo.id] !== undefined).forEach(x => {
      const id = x.tipo.id;
      body.appendChild(h('tr', null, h('td', null, x.tipo.nombre), h('td', { class: 'r' }, x.n), h('td', { class: 'r' }, f2(x.conectados)), h('td', { class: 'r' }, f2(x.reserva)), h('td', { class: 'r' }, f2(x.total)),
        h('td', null, UI.input(t.fd, String(id), { type: 'num', fk: 'fd:' + t.id + ':' + id, class: 'w-num', placeholder: U.fmt(x.fd, 3) + (x.tipo.metodo === 'tomas' ? ' (10 kVA + 50 %)' : '') })),
        h('td', { class: 'r' }, f2(x.fdiv)), h('td', { class: 'r' }, f2(x.demandados))));
    });
    return UI.card('Factores de demanda y diversidad', h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' },
      h('thead', null, h('tr', null, ['Tipo de carga', 'Circuitos', 'kVA conectados', 'Reserva', 'kVA totales', 'Factor demanda', 'F. diversidad', 'kVA demandados'].map(x => h('th', null, x)))),
      body, h('tfoot', null, h('tr', null, h('th', null, 'Totales'), h('th'), h('th', { class: 'r' }, f2(r.W128)), h('th', { class: 'r' }, f2(r.W129)), h('th', { class: 'r' }, f2(r.W130)), h('th', { class: 'r' }, f2(r.alim.R139)), h('th'), h('th', { class: 'r' }, f2(r.J134)))))),
      h('small', { class: 'muted' }, 'Deje el factor vacío para usar el del catálogo. Tomas: 100 % de los primeros 10 kVA + 50 % del resto (NEC 220.44).'));
  }

  function transformador(t) {
    const tr = t.trafo, k = 'tr:' + t.id + ':';
    return h('details', { class: 'card fold' }, h('summary', { class: 'card-h' }, h('h3', null, 'Transformador (opcional, para la tabla resumen original)')),
      h('div', { class: 'card-b grid4' },
        UI.field('Capacidad (kVA)', UI.input(tr, 'kva', { type: 'num', fk: k + 'kva' })), UI.field('Impedancia (%Z)', UI.input(tr, 'z', { type: 'num', fk: k + 'z' })),
        UI.field('Fases', UI.input(tr, 'fases', { type: 'num', fk: k + 'f' })), UI.field('Primario (kV)', UI.input(tr, 'primario', { type: 'num', fk: k + 'p' })),
        UI.field('Secundario (V)', UI.input(tr, 'secundario', { fk: k + 's', placeholder: '480/277' }))));
  }

  App.views.memoria = function (view, R, id) {
    if (!R.orden.length) { view.appendChild(h('div', { class: 'empty' }, 'No hay tableros. Créelos en la pestaña Proyecto o impórtelos de Revit.')); return; }
    const r = R.res[id] || R.orden[0], t = r.tab;
    view.appendChild(selector(R, t.id));
    view.appendChild(h('div', { class: 'page-h row' }, h('div', null, h('h2', null, r.nombre), h('p', { class: 'muted' }, t.tipo + ' · ' + t.sistema + ' V · alimentado desde ' + (r.alimentadoDesde || '—'))),
      h('div', { class: 'toolbar' }, UI.btn('Ver tablero ' + t.tipo, () => App.go(t.tipo === '1F' ? 'tab1f' : 'tab3f', t.id), 'small'))));
    if (r.avisos.length) view.appendChild(UI.avisos(r.avisos));
    const A = r.alim;
    view.appendChild(h('div', { class: 'kpis' },
      UI.kpi('kVA conectados', f2(r.W130), 'con ' + f0(n100(t.reserva)) + ' % reserva'), UI.kpi('kVA demandados', f2(A.L139), 'FD ' + f2(A.R139)),
      UI.kpi('Corriente por fase', [0, 1, 2].slice(0, r.fases === 3 ? 3 : 2).map(i => f0(A.AA139[i])).join(' / ') + ' A'),
      UI.kpi('Desbalance', f2(r.desbalance) + ' %', null, r.desbalance > Store.project.desbalanceMax ? 'warn' : ''),
      UI.kpi('Interruptor principal', (A.AF139 || '—') + ' A', A.fasesTxt + ' AWG'),
      UI.kpi('Voltaje en bornes', f2(A.AW139) + ' V', 'ΔV acumulada ' + f2(A.AY139) + ' %', A.AY139 > Store.project.cvMaxAlim ? 'warn' : ''),
      UI.kpi('Cortocircuito', r.iccKA ? f2(r.iccKA) + ' kA' : '—', r.iccFuente)));
    view.appendChild(h('div', { class: 'cols' }, datosTablero(t, r, R)));
    view.appendChild(circuitos(t, r, R));
    view.appendChild(h('div', { class: 'cols' }, demanda(t, r)));
    view.appendChild(alimentador(t, r));
    view.appendChild(transformador(t));
  };
  const n100 = v => (Number(v) || 0) * 100;
})();
