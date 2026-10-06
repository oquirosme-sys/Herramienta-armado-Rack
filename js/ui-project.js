/* Pestaña "Proyecto": datos generales y alta de niveles (cada nivel crea su pestaña). */
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

  function render(root) {
    U.clear(root);
    const p = Store.project;
    const calc = Calc.calcProject(p, Store.catalog);

    /* --- Datos del proyecto --- */
    const jacks = Store.itemsByRole('jack');
    const datos = h('div', { class: 'grid cols-3' },
      UI.field('Nombre del proyecto', UI.input(p, 'nombre', { placeholder: 'Ej. Edificio Corporativo' }), null, 'span-2'),
      UI.field('Proyecto #', UI.input(p, 'numero')),
      UI.field('Ubicación', UI.input(p, 'ubicacion'), null, 'span-2'),
      UI.field('Fecha', UI.input(p, 'fecha', { type: 'date' })),
      UI.field('Elaboró', UI.input(p, 'elaboro')),
      UI.field('Revisión del plano', UI.input(p, 'revision')),
      UI.field('Jack por defecto', UI.select(UI.itemOptions(jacks, '— sin jack —'), p.jackId, v => { p.jackId = v; Store.save(); }), 'Se cuenta uno por cada salida etiquetada en la lista de materiales.', 'span-2'),
      UI.field('Reserva de cableado (%)', UI.input(p, 'reservaCable', { type: 'number', min: 0, step: 1 }), 'Se suma a la longitud de cable de los tramos (curvas, remates, reserva).'),
    );

    /* --- Niveles --- */
    const tbody = h('tbody');
    p.niveles.forEach((n, i) => {
      const c = calc.rooms[i];
      tbody.appendChild(h('tr', null,
        h('td', { class: 'num' }, i + 1),
        h('td', null, UI.input(n, 'codigo', {
          class: 'w-code', label: 'Código del nivel',
          validate: (v, el) => {
            if (!v) { UI.toast('El código no puede quedar vacío.', 'warn'); return false; }
            if (p.niveles.some(o => o !== n && o.codigo === v)) { UI.toast('Ya existe un nivel con ese código.', 'warn'); return false; }
            return true;
          },
          after: () => { App.refreshTabs(); render(root); },
        })),
        h('td', null, UI.input(n, 'descripcion', { label: 'Descripción del nivel', placeholder: 'Ej. Nivel 1 — Cuarto de telecomunicaciones principal', after: () => App.refreshTabs() })),
        h('td', null, MONTAJE[n.montaje] || n.montaje),
        h('td', { class: 'num' }, c ? c.ocupados + ' / ' + c.totalRU : ''),
        h('td', { class: 'num' }, c ? c.outlets : ''),
        h('td', { class: 'row-actions' },
          UI.btn('Abrir', () => App.go('nivel/' + n.id), 'small primary'),
          UI.iconBtn('▲', 'Subir', () => { Store.moveRoom(n.id, -1); App.refreshTabs(); render(root); }),
          UI.iconBtn('▼', 'Bajar', () => { Store.moveRoom(n.id, 1); App.refreshTabs(); render(root); }),
          UI.iconBtn('⧉', 'Duplicar nivel', async () => {
            const code = await UI.prompt('Duplicar nivel', 'Código del nuevo nivel', Store.nextCode(), v => !v ? 'Escriba un código.' : (p.niveles.some(o => o.codigo === v) ? 'Ya existe.' : ''));
            if (code) { Store.duplicateRoom(n.id, code); App.refreshTabs(); render(root); UI.toast('Nivel duplicado.'); }
          }),
          UI.iconBtn('✕', 'Eliminar nivel', async () => {
            if (await UI.confirm('¿Eliminar el nivel ' + n.codigo + ' con todos sus equipos, etiquetado y tramos? No se puede deshacer.', 'Eliminar')) {
              Store.removeRoom(n.id); App.refreshTabs(); render(root);
            }
          }, 'danger'),
        )));
    });
    const niveles = h('div', null,
      p.niveles.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' },
        h('thead', null, h('tr', null, ['#', 'Código', 'Descripción', 'Montaje', 'RU usados', 'Salidas', ''].map(t => h('th', null, t)))), tbody))
        : h('p', { class: 'empty' }, 'Todavía no hay niveles. Agregue el primero: cada nivel (cuarto de telecomunicaciones / rack) crea su propia pestaña con su rack, equipos, etiquetado y tramos.'),
      h('div', { class: 'toolbar' }, UI.btn('+ Agregar nivel', () => addDialog(root), 'primary')),
    );

    /* --- Referencias --- */
    const tipos = h('table', { class: 'tbl compact' }, h('thead', null, h('tr', null, h('th', null, 'Código'), h('th', null, 'Tipo de salida'))),
      h('tbody', null, Store.catalog.tiposSalida.map(t => h('tr', null, h('td', null, h('b', null, t.codigo)), h('td', null, t.nombre)))));
    const refs = h('table', { class: 'tbl compact' }, h('thead', null, h('tr', null, h('th', null, 'Sistema'), h('th', null, 'Marca'))),
      h('tbody', null, Store.catalog.referencias.map(t => h('tr', null, h('td', null, t.sistema), h('td', null, t.marca)))));

    root.appendChild(h('div', { class: 'stack' },
      UI.card('Datos del proyecto', datos),
      UI.card('Niveles / cuartos de telecomunicaciones', niveles),
      h('div', { class: 'grid cols-2' },
        UI.card('Nomenclatura de tipos de salida', [tipos, h('p', { class: 'hint' }, 'Formato de etiqueta: [Cuarto]-[Panel]-[Puerto], ej. 1A-AA-01. La etiqueta en la salida del puesto de trabajo es la misma que en el puerto del rack. Los códigos los administra el administrador.')]),
        UI.card('Marcas de referencia por sistema', refs)),
      UI.card('Instrucciones', instrucciones())));
  }

  function instrucciones() {
    return h('ol', { class: 'steps' },
      h('li', null, 'Llene los datos del proyecto y agregue los niveles (cuartos de telecomunicaciones). Cada nivel aparece como una pestaña.'),
      h('li', null, 'En cada nivel: elija el rack, los organizadores verticales y los equipos de arriba hacia abajo; la vista del rack y el etiquetado se generan solos.'),
      h('li', null, 'A cada patch panel asígnele su tipo de salida (D, C, W…) y cuántas salidas usa; el etiquetado se llena solo y se puede ajustar puerto por puerto (pestaña Etiquetado).'),
      h('li', null, 'En "Tramos" registre las canastas y tuberías de cada nivel (longitud, tipo y cableado).'),
      h('li', null, 'La Memoria de cálculo consolida cuartos, salidas por tipo, canalización, cableado, potencia y lista de materiales.'),
      h('li', null, 'Si necesita una marca, equipo, tipo de canasta, tubería o cable que no está en la lista, pídaselo al administrador (el catálogo solo lo edita el administrador).'),
      h('li', null, 'Los datos se guardan en este navegador; use Archivo ▸ Exportar proyecto para respaldarlos o compartirlos.'));
  }

  function addDialog(root) {
    const p = Store.project;
    const code = h('input', { type: 'text', value: Store.nextCode() });
    const desc = h('input', { type: 'text', placeholder: 'Ej. Nivel 1 — Cuarto principal' });
    const pl = UI.select(PLANTILLAS.map(x => ({ value: x.v, label: x.t })), 'vacio:piso', () => { });
    const err = h('small', { class: 'err' });
    UI.modal('Agregar nivel', h('div', { class: 'stack' },
      UI.field('Código del nivel / cuarto', code, 'Se usa en las etiquetas: [Cuarto]-[Panel]-[Puerto]. Ej. 1A.'), UI.field('Descripción', desc),
      UI.field('Empezar desde', pl, 'Los machotes traen equipos de ejemplo que luego puede cambiar.'), err), [
      { label: 'Cancelar' },
      {
        label: 'Crear nivel', cls: 'primary', onclick: () => {
          const c = code.value.trim();
          if (!c) { err.textContent = 'Escriba un código.'; return false; }
          if (p.niveles.some(o => o.codigo === c)) { err.textContent = 'Ya existe un nivel con ese código.'; return false; }
          const room = Store.addRoom(c, desc.value.trim(), pl.value);
          App.refreshTabs(); App.go('nivel/' + room.id);
        },
      }]);
  }

  g.ProjectView = { render, instrucciones };
})(window);
