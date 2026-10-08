/* Pestaña "Proyecto": datos generales, servicios y redes LAN, cuartos (principal / secundarios),
   salidas por servicio, racks y gabinetes (cada uno crea su pestaña), demanda vs. oferta y fibra troncal. */
(function (g) {
  'use strict';
  const h = U.h;

  const PLANTILLAS = [
    { v: 'vacio:piso', t: 'Vacío — rack de piso (2 postes)' },
    { v: 'vacio:gabinete', t: 'Vacío — gabinete de piso' },
    { v: 'vacio:pared', t: 'Vacío — gabinete de pared' },
    { v: 'piso', t: 'Machote — rack de piso 2 postes 45RU (con equipos de ejemplo)' },
    { v: 'gabinete', t: 'Machote — gabinete FlexFusion 42RU (con switches y 96 salidas)' },
    { v: 'pared', t: 'Machote — gabinete de pared PanZone 12RU' },
  ];
  const MONTAJE = { piso: 'Rack de piso', gabinete: 'Gabinete', pared: 'Pared' };
  const RESERVAS = [0, 10, 15, 20, 25, 30, 35, 40, 50].map(v => ({ value: String(v), label: v + ' %' }));
  const SINO = [{ value: 'si', label: 'Sí' }, { value: 'no', label: 'No' }];

  function render(root) {
    U.clear(root);
    const p = Store.project, cat = Store.catalog;
    const again = () => { App.refreshTabs(); render(root); };
    const tipos = () => cat.tiposSalida.filter(t => t.codigo !== '-');
    const activos = () => Calc.serviciosActivos(p, cat);

    /* ---------------- datos del proyecto ---------------- */
    const jacks = Store.itemsByRole('jack');
    const datos = h('div', { class: 'grid cols-3' },
      UI.field('Nombre del proyecto', UI.input(p, 'nombre', { placeholder: 'Ej. Edificio Corporativo' }), null, 'span-2'),
      UI.field('Proyecto #', UI.input(p, 'numero', { placeholder: 'Ej. 2026-014' })),
      UI.field('Ubicación', UI.input(p, 'ubicacion', { placeholder: 'Ej. San José, Costa Rica' }), null, 'span-2'),
      UI.field('Fecha', UI.input(p, 'fecha', { type: 'date' })),
      UI.field('Elaboró', UI.input(p, 'elaboro', { placeholder: 'Ej. Nombre del ingeniero' })),
      UI.field('Revisión del plano', UI.input(p, 'revision', { placeholder: 'Ej. Rev. A' })),
      UI.field('Jack por defecto', UI.select(UI.itemOptions(jacks, '— sin jack —'), p.jackId, v => { p.jackId = v; Store.save(); }), 'Se cuenta uno por cada salida etiquetada en la lista de materiales.'));

    /* ---------------- servicios y redes LAN ---------------- */
    // Cantidad de redes LAN disponibles (siempre) y, si hay más de una, una sola pregunta: ¿los servicios comparten red?
    const multi = p.lans.length > 1, compartir = !multi || p.compartirRed !== false;
    const lanCount = UI.select([1, 2, 3, 4].map(n => ({ value: String(n), label: String(n) })), String(p.lans.length), v => {
      const n = Number(v);
      while (p.lans.length < n) p.lans.push({ id: p.lans.length + 1, nombre: 'LAN ' + (p.lans.length + 1) });
      while (p.lans.length > n) p.lans.pop();
      for (const k in p.servicios) if (p.servicios[k].lan > n) p.servicios[k].lan = 1;
      if (n === 1) p.compartirRed = true;
      Store.save(); render(root);
    });
    const preguntaRed = UI.select(SINO, compartir ? 'si' : 'no', v => {
      p.compartirRed = v === 'si';
      if (p.compartirRed) for (const k in p.servicios) p.servicios[k].lan = 1;
      Store.save(); render(root);
    });
    const lanNames = h('div', { class: 'grid cols-4' }, p.lans.map((l, i) => UI.field('Nombre de la red ' + (i + 1), UI.input(l, 'nombre', { after: () => render(root) }))));
    const sbody = h('tbody');
    tipos().forEach(t => {
      const s = p.servicios[t.codigo], isData = t.codigo === 'D';
      const cells = [
        h('td', null, h('input', { type: 'checkbox', checked: s.activo, disabled: isData, 'aria-label': 'Activo', onchange: e => { s.activo = e.target.checked; Store.save(); render(root); } })),
        h('td', null, h('b', null, t.codigo)), h('td', null, t.nombre),
        h('td', null, h('input', { type: 'checkbox', checked: s.poe, disabled: !s.activo, 'aria-label': 'PoE', onchange: e => { s.poe = e.target.checked; Store.save(); } }))];
      if (!compartir) cells.push(h('td', null, UI.select(p.lans.map(l => ({ value: String(l.id), label: l.nombre })), String(s.lan), v => { s.lan = Number(v); Store.save(); render(root); }, { disabled: isData || !s.activo, label: 'Red asignada' })));
      sbody.appendChild(h('tr', { class: s.activo ? '' : 'dim' }, cells));
    });
    const lanResumen = multi ? h('ul', { class: 'steps' }, p.lans.map(l => { const sv = activos().filter(t => p.servicios[t.codigo].lan === l.id).map(t => t.nombre); return h('li', null, h('b', null, l.nombre + ': '), sv.length ? sv.join(', ') : h('span', { class: compartir ? 'muted' : 'status bad' }, compartir ? 'disponible, sin servicios asignados' : 'sin servicios')); })) : null;
    const servicios = h('div', { class: 'stack' },
      h('div', { class: 'grid cols-4' },
        UI.field('Cantidad de redes LAN disponibles', lanCount, 'Cada red tiene sus propios switches y patch panels.'),
        multi ? UI.field('¿Todos los servicios comparten una misma red LAN?', preguntaRed, compartir ? 'Sí: todos los servicios usan la LAN 1; las demás quedan disponibles.' : 'No: asigne cada servicio a una red en la tabla.', 'span-2') : null),
      lanNames,
      h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ['Activo', 'Código', 'Servicio', 'PoE'].concat(compartir ? [] : ['Red asignada']).map(t => h('th', null, t)))), sbody)),
      lanResumen);

    /* ---------------- cuartos ---------------- */
    const cbody = h('tbody');
    p.cuartos.forEach(c => {
      const nRacks = p.niveles.filter(r => r.cuartoId === c.id).length, principal = c.tipo === 'principal';
      cbody.appendChild(h('tr', null,
        h('td', null, UI.input(c, 'codigo', { class: 'w-code', label: 'Código del cuarto', validate: v => { if (!v) { UI.toast('El código no puede quedar vacío.', 'warn'); return false; } if (p.cuartos.some(o => o !== c && o.codigo === v)) { UI.toast('Ya existe un cuarto con ese código.', 'warn'); return false; } return true; }, after: again })),
        h('td', null, UI.input(c, 'nombre', { placeholder: 'Ej. Cuarto de telecomunicaciones nivel 1', label: 'Nombre del cuarto' })),
        h('td', null, UI.select([{ value: 'principal', label: 'Principal' }, { value: 'secundario', label: 'Secundario' }], c.tipo, v => { if (v === 'principal') Store.setPrincipal(c.id); else if (principal) { UI.toast('Debe haber un cuarto principal: marque otro como principal.', 'warn'); } render(root); }, { label: 'Tipo' })),
        h('td', null, principal ? h('span', { class: 'muted' }, '—') : UI.input(c, 'distancia', { type: 'number', min: 0, step: 1, class: 'w-num', label: 'Distancia al cuarto principal (m)', after: () => renderDerived() })),
        h('td', { class: 'num' }, nRacks),
        h('td', { class: 'row-actions' }, UI.iconBtn('✕', 'Eliminar cuarto', async () => {
          if (nRacks) { UI.alert('El cuarto tiene ' + nRacks + ' rack(s) o gabinete(s). Muévalos o elimínelos primero.'); return; }
          if (await UI.confirm('¿Eliminar el cuarto ' + c.codigo + '?', 'Eliminar')) { Store.removeCuarto(c.id); again(); }
        }, 'danger'))));
    });
    const cuartos = h('div', null,
      p.cuartos.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ['Código', 'Nombre', 'Tipo', 'Distancia al principal (m)', 'Racks', ''].map(t => h('th', null, t)))), cbody))
        : h('p', { class: 'empty' }, 'Agregue los cuartos de telecomunicaciones. Marque uno como principal; los demás son secundarios y se enlazan con fibra al principal. El código es el prefijo de las etiquetas (ej. 1A-AA-01).'),
      h('div', { class: 'toolbar' }, UI.btn('+ Agregar cuarto', () => cuartoDialog(again), 'primary')));

    /* ---------------- salidas por servicio ---------------- */
    const modo = UI.select([{ value: 'cuarto', label: 'Por cuarto de telecomunicaciones' }, { value: 'nivel', label: 'Por nivel del edificio' }], p.modoSalidas, v => { p.modoSalidas = v; Store.save(); render(root); });
    const reserva = UI.select(RESERVAS, String(p.reservaPct), v => { p.reservaPct = Number(v); Store.save(); renderDerived(); });
    const matrixHost = h('div', { class: 'stack' });
    function matrix() {
      U.clear(matrixHost);
      const act = activos();
      const cols = p.modoSalidas === 'nivel' ? p.nivelesEdificio : p.cuartos;
      if (p.modoSalidas === 'nivel') {
        const nb = h('tbody');
        p.nivelesEdificio.forEach(n => nb.appendChild(h('tr', null,
          h('td', null, UI.input(n, 'nombre', { label: 'Nivel del edificio', after: matrix })),
          h('td', null, UI.select([{ value: '', label: '— cuarto que lo atiende —' }].concat(p.cuartos.map(c => ({ value: c.id, label: c.codigo + (c.nombre ? ' — ' + c.nombre : '') }))), n.cuartoId, v => { n.cuartoId = v; Store.save(); renderDerived(); }, { label: 'Cuarto que atiende el nivel' })),
          h('td', { class: 'row-actions' }, UI.iconBtn('✕', 'Quitar nivel', () => { p.nivelesEdificio = p.nivelesEdificio.filter(x => x !== n); Store.save(); matrix(); renderDerived(); }, 'danger')))));
        matrixHost.appendChild(h('div', null, h('h4', null, 'Niveles del edificio'),
          p.nivelesEdificio.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ['Nivel', 'Cuarto que lo atiende', ''].map(t => h('th', null, t)))), nb)) : h('p', { class: 'empty' }, 'Agregue los niveles del edificio y asigne a cada uno el cuarto que lo atiende.'),
          h('div', { class: 'toolbar' }, UI.btn('+ Agregar nivel del edificio', async () => { const nm = await UI.prompt('Nivel del edificio', 'Nombre', 'Nivel ' + (p.nivelesEdificio.length + 1), v => v ? '' : 'Escriba un nombre.'); if (nm) { Store.addNivelEdificio(nm); matrix(); renderDerived(); } }))));
      }
      if (!cols.length) { matrixHost.appendChild(h('p', { class: 'empty' }, p.modoSalidas === 'nivel' ? 'Agregue niveles del edificio para ingresar sus salidas.' : 'Agregue cuartos para ingresar sus salidas.')); return; }
      const totCells = {};
      const body = h('tbody');
      act.forEach(t => {
        const tt = h('td', { class: 'num strong' });
        const upd = () => { tt.textContent = U.fmt(cols.reduce((a, c) => a + (Number((c.salidas || {})[t.codigo]) || 0), 0)); };
        upd(); totCells[t.codigo] = upd;
        body.appendChild(h('tr', null, h('td', null, h('b', null, t.codigo)), h('td', null, t.nombre),
          cols.map(c => { c.salidas = c.salidas || {}; return h('td', null, UI.input(c.salidas, t.codigo, { type: 'number', min: 0, step: 1, class: 'w-num', placeholder: '0', label: t.nombre + ' — ' + (c.codigo || c.nombre), after: () => { upd(); renderDerived(); } })); }), tt));
      });
      matrixHost.appendChild(h('div', null, h('h4', null, 'Salidas por servicio (cantidad de salidas en los puestos de trabajo)'), h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' },
        h('thead', null, h('tr', null, ['Código', 'Servicio'].concat(cols.map(c => c.codigo || c.nombre), ['Total']).map(t => h('th', null, t)))), body))));
    }
    const salidas = h('div', { class: 'stack' },
      h('div', { class: 'grid cols-4' }, UI.field('Ingresar las salidas', modo, 'Puede ingresarlas por cuarto o por nivel del edificio (cada nivel se asigna a un cuarto).', 'span-2'),
        UI.field('Reserva de puertos', reserva, 'Se suma a las salidas requeridas para calcular los puertos de patch panel.')),
      matrixHost);

    /* ---------------- racks y gabinetes ---------------- */
    const tbody = h('tbody');
    const calc = Calc.calcProject(p, cat);
    p.niveles.forEach((n, i) => {
      const c = calc.rooms[i];
      tbody.appendChild(h('tr', null,
        h('td', null, UI.input(n, 'codigo', { class: 'w-code', label: 'Código del rack',
          validate: v => { if (!v) { UI.toast('El código no puede quedar vacío.', 'warn'); return false; } if (p.niveles.some(o => o !== n && o.codigo === v)) { UI.toast('Ya existe un rack con ese código.', 'warn'); return false; } return true; }, after: again })),
        h('td', null, UI.select(p.cuartos.map(q => ({ value: q.id, label: q.codigo + (q.tipo === 'principal' ? ' (principal)' : '') })), n.cuartoId, v => { n.cuartoId = v; Store.save(); again(); }, { label: 'Cuarto' })),
        h('td', null, UI.input(n, 'descripcion', { label: 'Descripción', placeholder: 'Ej. Rack de datos', after: () => App.refreshTabs() })),
        h('td', null, MONTAJE[n.montaje] || n.montaje),
        h('td', { class: 'num' }, c ? c.ocupados + ' / ' + c.totalRU : ''), h('td', { class: 'num' }, c ? c.outlets : ''),
        h('td', { class: 'row-actions' },
          UI.btn('Abrir', () => App.go('nivel/' + n.id), 'small primary'),
          UI.iconBtn('▲', 'Subir', () => { Store.moveRoom(n.id, -1); again(); }), UI.iconBtn('▼', 'Bajar', () => { Store.moveRoom(n.id, 1); again(); }),
          UI.iconBtn('⧉', 'Duplicar', async () => {
            const code = await UI.prompt('Duplicar rack', 'Código del nuevo rack', Store.nextRackCode(n.cuartoId), v => !v ? 'Escriba un código.' : (p.niveles.some(o => o.codigo === v) ? 'Ya existe.' : ''));
            if (code) { Store.duplicateRoom(n.id, code); again(); UI.toast('Rack duplicado.'); }
          }),
          UI.iconBtn('✕', 'Eliminar', async () => { if (await UI.confirm('¿Eliminar el rack ' + n.codigo + ' con todos sus equipos y etiquetado? No se puede deshacer.', 'Eliminar')) { Store.removeRoom(n.id); again(); } }, 'danger'))));
    });
    const racks = h('div', null,
      p.niveles.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ['Código', 'Cuarto', 'Descripción', 'Montaje', 'RU usados', 'Salidas', ''].map(t => h('th', null, t)))), tbody))
        : h('p', { class: 'empty' }, p.cuartos.length ? 'Todavía no hay racks ni gabinetes. Cada uno se asigna a un cuarto y crea su propia pestaña.' : 'Primero agregue al menos un cuarto de telecomunicaciones.'),
      h('div', { class: 'toolbar' }, UI.btn('+ Agregar rack / gabinete', () => { if (!p.cuartos.length) { UI.alert('Primero agregue un cuarto de telecomunicaciones.'); return; } rackDialog(again); }, 'primary', p.cuartos.length ? null : 'Primero agregue un cuarto')));

    /* ---------------- demanda vs oferta y fibra ---------------- */
    const derivedHost = h('div', { class: 'stack' });
    const fibraCtl = h('div', { class: 'grid cols-4' },
      UI.field('Enlaces redundantes', UI.select(SINO, p.fibra.redundante ? 'si' : 'no', v => { p.fibra.redundante = v === 'si'; Store.save(); renderDerived(); }), 'Duplica los enlaces de fibra entre cuartos.'),
      UI.field('Reserva de fibra', UI.select(RESERVAS, String(p.fibra.reserva), v => { p.fibra.reserva = Number(v); Store.save(); renderDerived(); })));
    function renderDerived() {
      U.clear(derivedHost);
      const P = Calc.calcProject(p, cat), plan = Calc.planning(p, cat, P), fib = Calc.fibra(p, cat);
      const rows = [];
      plan.forEach(q => q.rows.forEach(r => rows.push(h('tr', { class: r.falta ? 'over' : '' }, h('td', null, h('b', null, q.cuarto.codigo)), h('td', null, r.tipo.codigo + ' — ' + r.tipo.nombre), h('td', { class: 'num' }, r.req), h('td', { class: 'num' }, r.reqRes), h('td', { class: 'num' }, r.prov),
        h('td', null, r.falta ? '⚠ faltan ' + r.falta + ' puertos' : '✓ cubierto')))));
      derivedHost.appendChild(h('div', null, h('h4', null, 'Salidas requeridas contra puertos asignados en los racks'),
        rows.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'tbl compact' }, h('thead', null, h('tr', null, ['Cuarto', 'Servicio', 'Salidas', 'Con reserva ' + p.reservaPct + ' %', 'Puertos en racks', 'Estado'].map(t => h('th', null, t)))), h('tbody', null, rows)))
          : h('p', { class: 'empty' }, 'Ingrese las salidas por servicio para ver si los racks las cubren. Los puertos se asignan en cada rack (tipo de salida de cada patch panel).')));
      derivedHost.appendChild(h('div', null, h('h4', null, 'Fibra troncal entre el cuarto principal y los secundarios (estimado)'),
        fib.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'tbl compact' }, h('thead', null, h('tr', null, ['Cuarto secundario', 'Distancia (m)', 'Enlaces', 'Fibras base', 'Fibras con reserva', 'Tipo sugerido'].map(t => h('th', null, t)))),
          h('tbody', null, fib.map(f => h('tr', { class: f.falta ? 'over' : '' }, h('td', null, h('b', null, f.cuarto.codigo)), h('td', { class: 'num' }, f.distancia || '⚠ ingrese la distancia'), h('td', { class: 'num' }, f.enlaces), h('td', { class: 'num' }, f.base), h('td', { class: 'num strong' }, f.total), h('td', null, f.tipo || '—'))))))
          : h('p', { class: 'empty' }, 'Con un cuarto principal y al menos un secundario se calcula la fibra. Un enlace por red LAN, 2 fibras por enlace; multimodo hasta 300 m, monomodo si es más. Estimado: valide por el ingeniero.')));
    }

    root.appendChild(h('div', { class: 'stack' },
      UI.card('1. Datos del proyecto', datos),
      UI.card('2. Servicios y redes LAN', servicios),
      UI.card('3. Cuartos de telecomunicaciones', cuartos),
      UI.card('4. Salidas por servicio', salidas),
      UI.card('5. Racks y gabinetes', racks),
      UI.card('6. Cobertura de salidas y fibra troncal', [fibraCtl, derivedHost]),
      h('div', { class: 'grid cols-2' },
        UI.card('Nomenclatura de tipos de salida', [h('table', { class: 'tbl compact' }, h('thead', null, h('tr', null, h('th', null, 'Código'), h('th', null, 'Tipo de salida'))), h('tbody', null, cat.tiposSalida.map(t => h('tr', null, h('td', null, h('b', null, t.codigo)), h('td', null, t.nombre))))),
          h('p', { class: 'hint' }, 'Etiqueta: [Cuarto]-[Panel]-[Puerto], ej. 1A-AA-01. Los códigos los administra el administrador.')]),
        UI.card('Marcas de referencia por sistema', h('table', { class: 'tbl compact' }, h('thead', null, h('tr', null, h('th', null, 'Sistema'), h('th', null, 'Marca'))), h('tbody', null, cat.referencias.map(t => h('tr', null, h('td', null, t.sistema), h('td', null, t.marca))))))),
      UI.card('Instrucciones', instrucciones())));
    matrix(); renderDerived();
  }

  function instrucciones() {
    return h('ol', { class: 'steps' },
      h('li', null, 'Llene los datos del proyecto y defina los servicios activos y cuántas redes LAN habrá; indique cuáles servicios comparten red.'),
      h('li', null, 'Agregue los cuartos de telecomunicaciones: uno principal y los demás secundarios (con su distancia al principal).'),
      h('li', null, 'Ingrese las salidas de cada servicio, por cuarto o por nivel del edificio, y la reserva de puertos.'),
      h('li', null, 'Agregue los racks o gabinetes de cada cuarto: cada uno crea su pestaña con el alzado, los equipos y el etiquetado.'),
      h('li', null, 'A cada patch panel asígnele su tipo de salida y cuántas salidas usa (o varios tipos con "+ tipo").'),
      h('li', null, 'La Memoria de cálculo consolida cuartos, servicios, fibra, salidas, potencia y lista de materiales; se exporta a Word y Excel.'),
      h('li', null, 'Si necesita una marca o equipo que no está en la lista, pídaselo al administrador (el catálogo solo lo edita el administrador).'),
      h('li', null, 'Los datos se guardan en este navegador; use Archivo ▸ Exportar proyecto para respaldarlos o compartirlos.'));
  }

  function cuartoDialog(done) {
    const p = Store.project;
    const code = h('input', { type: 'text', value: Store.nextCuartoCode() }), nom = h('input', { type: 'text', placeholder: 'Ej. Cuarto de telecomunicaciones nivel 1' });
    const tipo = UI.select([{ value: 'principal', label: 'Principal' }, { value: 'secundario', label: 'Secundario' }], p.cuartos.length ? 'secundario' : 'principal', () => { });
    const err = h('small', { class: 'err' });
    UI.modal('Agregar cuarto de telecomunicaciones', h('div', { class: 'stack' }, UI.field('Código del cuarto', code, 'Prefijo de las etiquetas. Ej. 1A.'), UI.field('Nombre', nom), UI.field('Tipo', tipo, p.cuartos.length ? 'Si lo marca principal, el actual pasa a secundario.' : 'El primer cuarto es el principal.'), err), [
      { label: 'Cancelar' }, { label: 'Agregar', cls: 'primary', onclick: () => {
        const c = code.value.trim(); if (!c) { err.textContent = 'Escriba un código.'; return false; } if (p.cuartos.some(o => o.codigo === c)) { err.textContent = 'Ya existe un cuarto con ese código.'; return false; }
        Store.addCuarto(c, nom.value.trim(), tipo.value); done();
      } }]);
  }

  function rackDialog(done) {
    const p = Store.project;
    const cuarto = UI.select(p.cuartos.map(c => ({ value: c.id, label: c.codigo + (c.nombre ? ' — ' + c.nombre : '') + (c.tipo === 'principal' ? ' (principal)' : '') })), p.cuartos[0].id, v => { code.value = Store.nextRackCode(v); });
    const code = h('input', { type: 'text', value: Store.nextRackCode(p.cuartos[0].id) }), desc = h('input', { type: 'text', placeholder: 'Ej. Rack de datos' });
    const pl = UI.select(PLANTILLAS.map(x => ({ value: x.v, label: x.t })), 'vacio:piso', () => { });
    const err = h('small', { class: 'err' });
    UI.modal('Agregar rack / gabinete', h('div', { class: 'stack' }, UI.field('Cuarto al que pertenece', cuarto), UI.field('Código del rack', code, 'Nombre de la pestaña.'), UI.field('Descripción', desc),
      UI.field('Empezar desde', pl, 'Los machotes traen equipos de ejemplo que luego puede cambiar.'), err), [
      { label: 'Cancelar' }, { label: 'Crear', cls: 'primary', onclick: () => {
        const c = code.value.trim(); if (!c) { err.textContent = 'Escriba un código.'; return false; } if (p.niveles.some(o => o.codigo === c)) { err.textContent = 'Ya existe un rack con ese código.'; return false; }
        const room = Store.addRoom(c, desc.value.trim(), pl.value, cuarto.value); App.refreshTabs(); App.go('nivel/' + room.id);
      } }]);
  }

  g.ProjectView = { render, instrucciones };
})(window);
