/* Pestaña Proyecto: datos generales, criterios, alta de tableros (cuántos y de cuál se alimenta cada uno) y diagrama de alimentación. */
(function () {
  'use strict';
  const h = U.h, f2 = v => U.fmt(v, 2);

  function crearVarios() {
    const cant = h('input', { type: 'number', min: 1, max: 60, value: 3 }), pref = h('input', { type: 'text', value: 'T' });
    const tipo = UI.select(['3F', '1F'], '3F', () => {}), sis = UI.select(Store.catalog.listas.sistemas, '120/208', () => {});
    const padre = UI.select(UI.opts(Store.project.tableros.map(t => ({ value: t.id, label: Calc.nombreTablero(t) })), '— Ninguno (acometida / externo) —'), '', () => {});
    const nombres = h('textarea', { rows: 3, placeholder: 'Opcional: un nombre por línea (TA, TB, TC… o 2G1, 2G2…). Si lo deja vacío se usa el prefijo + letra.' });
    UI.modal('Crear tableros', h('div', { class: 'grid2' },
      UI.field('Cantidad', cant), UI.field('Prefijo del nombre', pref, 'TA, TB, TC…'), UI.field('Tipo', tipo), UI.field('Sistema (V)', sis),
      UI.field('Alimentados desde', padre, 'Puede cambiarlo luego para cada tablero.', 'span2'), UI.field('Nombres', nombres, null, 'span2')), [
      { label: 'Cancelar' },
      { label: 'Crear', cls: 'primary', onclick: () => {
        const lista = nombres.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        const n = lista.length || Math.max(1, Math.min(60, Number(cant.value) || 1));
        for (let i = 0; i < n; i++) {
          const t = Store.nuevoTablero({ nombre: lista[i] || (pref.value.trim() + String.fromCharCode(65 + (i % 26)) + (i >= 26 ? Math.floor(i / 26) : '')), tipo: tipo.value, sistema: sis.value });
          if (padre.value) Store.cambiarPadre(t, padre.value);
        }
        App.refresh(); UI.toast(n + ' tablero(s) creados', 'ok');
      } },
    ]);
  }

  /** Árbol de alimentación (unifilar simplificado). */
  function arbol(R) {
    const raiz = R.orden.filter(r => r.nivel === 0);
    const nodo = r => h('li', null,
      h('a', { class: 'node' + (r.avisos.length ? ' warn' : ''), href: '#memoria/' + r.tab.id, title: r.avisos.join('\n') || 'Abrir memoria de cálculo' },
        h('b', null, r.nombre), h('span', { class: 'tag' }, r.tab.tipo + ' · ' + r.tab.sistema + ' V'),
        h('small', null, f2(r.W130) + ' kVA · ' + (r.alim.AF139 || '–') + ' A'),
        h('small', null, 'Bornes ' + f2(r.alim.AW139) + ' V · ΔV ' + f2(r.alim.AY139) + ' %'),
        h('small', null, 'Icc ' + (r.iccKA ? f2(r.iccKA) + ' kA' : '—'))),
      (R.hijos[r.tab.id] || []).length ? h('ul', null, R.hijos[r.tab.id].map(t => R.res[t.id]).filter(Boolean).map(nodo)) : null);
    return h('div', { class: 'tree', 'data-scroll': 'arbol' }, raiz.length ? h('ul', null, raiz.map(r => h('li', { class: 'root' }, h('div', { class: 'source' }, r.tab.conectadoA || 'Acometida'), h('ul', null, nodo(r))))) : h('p', { class: 'muted' }, 'Sin tableros.'));
  }

  App.views.proyecto = function (view, R) {
    const p = Store.project, L = Store.catalog.listas;
    view.appendChild(h('div', { class: 'page-h' }, h('h2', null, 'Proyecto'), h('p', { class: 'muted' }, 'Indique los datos del proyecto, cuántos tableros tiene y de cuál se alimenta cada uno. Las caídas de voltaje y el cortocircuito se calculan en cascada desde la acometida.')));

    view.appendChild(h('div', { class: 'cols' },
      UI.card('Datos del proyecto', h('div', { class: 'grid3' },
        UI.field('Nombre', UI.input(p, 'nombre', { fk: 'p:nombre' }), null, 'span2'), UI.field('Proyecto N.º', UI.input(p, 'numero', { fk: 'p:numero' })),
        UI.field('Ubicación', UI.input(p, 'ubicacion', { fk: 'p:ubic' }), null, 'span2'), UI.field('Fecha', UI.input(p, 'fecha', { type: 'date', fk: 'p:fecha' })),
        UI.field('Elaboró', UI.input(p, 'elaboro', { fk: 'p:elab' }), null, 'span2'), UI.field('Revisión', UI.input(p, 'revision', { fk: 'p:rev' })))),
      UI.card('Criterios de diseño', h('div', { class: 'grid3' },
        UI.field('ΔV máx. alimentador (%)', UI.input(p, 'cvMaxAlim', { type: 'num', fk: 'p:cva' }), 'Acumulada hasta los bornes del tablero'),
        UI.field('ΔV máx. total (%)', UI.input(p, 'cvMaxTotal', { type: 'num', fk: 'p:cvt' }), 'Alimentadores + circuito ramal'),
        UI.field('Desbalance máx. (%)', UI.input(p, 'desbalanceMax', { type: 'num', fk: 'p:des' })),
        UI.field('Marca por defecto', UI.bind(p, 'marcaDefecto', Store.catalog.marcas, { fk: 'p:marca' }), 'Para elegir tablero, breakers y supresor automáticamente'),
        UI.field('Long. máx. para Icc (m)', UI.input(p, 'iccLongMax', { type: 'num', fk: 'p:icl' }), 'Igual que el Excel (20 m). 0 = sin límite'),
      ))));

    // ---- tableros
    const cuerpo = h('tbody');
    R.orden.concat(p.tableros.filter(t => !R.res[t.id]).map(t => ({ tab: t, nivel: 0, avisos: ['No calculado'], alim: {} }))).forEach(r => {
      const t = r.tab, k = 't:' + t.id + ':';
      const padres = Store.posiblesPadres(t);
      const selPadre = UI.select(UI.opts(padres.map(o => ({ value: o.id, label: Calc.nombreTablero(o) })), '— Acometida / externo —'), t.padreId, v => { Store.cambiarPadre(t, v); App.refresh(); }, { fk: k + 'padre', label: 'Alimentado desde' });
      cuerpo.appendChild(h('tr', null,
        h('td', { class: 'nm', style: { paddingLeft: (0.4 + r.nivel * 1.1) + 'rem' } }, r.nivel ? h('span', { class: 'muted' }, '└ ') : null, UI.input(t, 'nombre', { fk: k + 'nombre', class: 'w-nm', label: 'Nombre del tablero' })),
        h('td', null, UI.select(['3F', '1F'], t.tipo, v => { t.tipo = v; Object.assign(t, Store.voltajeDe(t.sistema, v)); Store.save(); App.refresh(); }, { fk: k + 'tipo', label: 'Tipo' })),
        h('td', null, UI.select(L.sistemas, t.sistema, v => { t.sistema = v; Object.assign(t, Store.voltajeDe(v, t.tipo)); Store.save(); App.refresh(); }, { fk: k + 'sis', label: 'Sistema' })),
        h('td', null, selPadre, !t.padreId ? UI.input(t, 'conectadoA', { fk: k + 'con', placeholder: 'Conectado a (p. ej. MÓDULO MEDIDORES)', class: 'mt' }) : null),
        h('td', null, UI.input(t, 'longitud', { type: 'num', fk: k + 'long', class: 'w-num', label: 'Longitud del alimentador (m)' })),
        h('td', { class: 'r' }, f2(r.W130)), h('td', { class: 'r' }, r.alim.AF139 || ''),
        h('td', { class: 'r' }, f2(r.alim.AW139)), h('td', { class: 'r ' + (r.alim.AY139 > p.cvMaxAlim ? 'bad' : '') }, f2(r.alim.AY139)),
        h('td', { class: 'r' }, r.iccKA ? f2(r.iccKA) : h('span', { class: 'muted' }, '—'), r.iccFuente ? h('small', { class: 'muted d' }, r.iccFuente) : null),
        h('td', null, r.avisos.length ? h('span', { class: 'badge warn', title: r.avisos.join('\n') }, r.avisos.length + ' aviso(s)') : h('span', { class: 'badge ok' }, 'OK')),
        h('td', { class: 'acc' },
          UI.iconBtn('✎', 'Memoria de cálculo', () => App.go('memoria', t.id)),
          UI.iconBtn('⧉', 'Duplicar', () => { Store.duplicarTablero(t.id); App.refresh(); }),
          UI.iconBtn('🗑', 'Eliminar', async () => { if (await UI.confirm('¿Eliminar ' + Calc.nombreTablero(t) + ' y sus ' + t.circuitos.length + ' circuitos?', 'Eliminar')) { Store.eliminarTablero(t.id); App.refresh(); } }, 'danger'))));
    });
    view.appendChild(UI.card('Tableros (' + p.tableros.length + ')',
      p.tableros.length ? h('div', { class: 'tbl-wrap', 'data-scroll': 'tabs' }, h('table', { class: 'tbl' },
        h('thead', null, h('tr', null, ['Tablero', 'Tipo', 'Sistema (V)', 'Alimentado desde', 'Long. alim. (m)', 'kVA totales', 'Breaker (A)', 'V bornes', 'ΔV acum. (%)', 'Icc (kA)', 'Estado', ''].map(x => h('th', null, x)))), cuerpo))
        : h('div', { class: 'empty' }, 'Aún no hay tableros. Créelos aquí o impórtelos desde la tabla de circuitos de Revit.'),
      h('div', { class: 'toolbar' },
        UI.btn('+ Tablero', () => { const t = Store.nuevoTablero({ nombre: 'T' + String.fromCharCode(65 + (p.tableros.length % 26)) }); App.refresh(); setTimeout(() => { const e = document.querySelector('[data-fk="t:' + t.id + ':nombre"]'); if (e) e.select(); }, 0); }, 'primary small'),
        UI.btn('Crear varios…', crearVarios, 'small'),
        UI.btn('Importar de Revit…', () => App.go('revit'), 'small'))));

    view.appendChild(UI.card('Diagrama de alimentación', arbol(R), h('small', { class: 'muted' }, 'Clic en un tablero para abrir su memoria de cálculo')));
  };
})();
