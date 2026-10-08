/* Arranque, pestañas y menú Archivo. Cada vista se registra en App.views y recibe el cálculo completo del proyecto. */
(function (g) {
  'use strict';
  const h = U.h;

  const TABS = [
    { id: 'proyecto', label: 'Proyecto' },
    { id: 'revit', label: 'Importar de Revit' },
    { id: 'memoria', label: 'Memoria de cálculo' },
    { id: 'tab3f', label: 'Tableros 3F' },
    { id: 'tab1f', label: 'Tableros 1F' },
    { id: 'resumen', label: 'Tablas resumen' },
    { id: 'admin', label: 'Administración', admin: true },
  ];

  const App = {
    views: {},
    R: null,
    route: { view: 'proyecto', id: '' },

    calc() { App.R = Calc.proyecto(Store.project, Store.catalog); return App.R; },
    go(view, id) { location.hash = '#' + view + (id ? '/' + id : ''); },
    readHash() {
      const [v, id] = decodeURIComponent(location.hash.slice(1)).split('/');
      App.route = { view: TABS.some(t => t.id === v) ? v : 'proyecto', id: id || '' };
      if (App.route.view === 'admin' && !Auth.isAdmin()) App.route.view = 'proyecto';
    },

    /** Vuelve a calcular y dibujar la vista actual conservando el foco y el desplazamiento. */
    refresh() {
      const a = document.activeElement, fk = a && a.getAttribute && a.getAttribute('data-fk');
      const sx = window.scrollX, sy = window.scrollY;
      const wraps = Array.from(document.querySelectorAll('[data-scroll]')).map(e => [e.getAttribute('data-scroll'), e.scrollLeft, e.scrollTop]);
      App.render();
      window.scrollTo(sx, sy);
      wraps.forEach(([k, l, t]) => { const e = document.querySelector('[data-scroll="' + k + '"]'); if (e) { e.scrollLeft = l; e.scrollTop = t; } });
      if (fk) { const e = document.querySelector('[data-fk="' + CSS.escape(fk) + '"]'); if (e) e.focus({ preventScroll: true }); }
    },
    render() {
      App.calc();
      const nav = U.clear(document.getElementById('tabs'));
      TABS.filter(t => !t.admin || Auth.isAdmin()).forEach(t => nav.appendChild(h('a', { class: 'tab' + (t.admin ? ' admin' : '') + (App.route.view === t.id ? ' active' : ''), href: '#' + t.id, role: 'tab', 'aria-selected': App.route.view === t.id ? 'true' : 'false' }, t.label)));
      const view = U.clear(document.getElementById('view'));
      try { App.views[App.route.view](view, App.R, App.route.id); }
      catch (e) { console.error(e); view.appendChild(h('div', { class: 'empty err' }, 'Error al mostrar la vista: ' + e.message)); }
      App.actions();
    },

    actions() {
      const box = U.clear(document.getElementById('actions'));
      const st = h('span', { class: 'save-status' + (Store.status === 'error' ? ' error' : '') }, Store.status === 'saving' ? 'Guardando…' : Store.status === 'error' ? 'No se pudo guardar en el navegador' : 'Guardado en este navegador');
      const menu = h('details', { class: 'menu' }, h('summary', { class: 'btn' }, 'Archivo ▾'), h('div', { class: 'menu-b' },
        UI.btn('Nuevo proyecto', async () => { if (await UI.confirm('¿Empezar un proyecto nuevo? Exporte antes el actual si lo necesita.', 'Nuevo proyecto')) { Store.newProject(); App.go('proyecto'); App.render(); } }, 'ghost'),
        UI.btn('Abrir proyecto (.json)…', async () => { const f = await UI.pickFile('.json,application/json'); if (!f) return; try { Store.importProject(await UI.readText(f)); App.render(); UI.toast('Proyecto abierto', 'ok'); } catch (e) { UI.alert(e.message); } }, 'ghost'),
        UI.btn('Guardar proyecto (.json)', () => U.download(App.fileBase() + '.json', Store.exportProject(), 'application/json'), 'ghost'),
        h('hr'),
        UI.btn('Exportar a Excel (tablas resumen y tableros)', () => ExportExcel.download(App.R), 'ghost'),
        UI.btn('Imprimir / PDF de la vista', () => window.print(), 'ghost')));
      menu.addEventListener('click', e => { if (e.target.closest('.menu-b .btn')) menu.open = false; });
      const adm = Auth.isAdmin()
        ? UI.btn('Administrador ✓', async () => { if (await UI.confirm('¿Salir del modo administrador?', 'Salir', false)) { Auth.logout(); } }, 'admin-on', 'Salir del modo administrador')
        : UI.btn('Administrador', () => App.login(), 'ghost', 'Entrar como administrador para editar catálogos');
      box.append(st, menu, adm);
    },
    fileBase() { const p = Store.project; return ('ANACAR ' + (p.numero || '') + ' ' + (p.nombre || 'proyecto')).trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' '); },
    login() {
      const inp = h('input', { type: 'password', autocomplete: 'current-password' }), err = h('small', { class: 'err' });
      UI.modal('Modo administrador', h('div', null, h('p', { class: 'muted' }, 'El administrador puede agregar o modificar marcas, tableros, breakers, supresores, tipos de carga y tablas de conductores.'), UI.field('Contraseña', inp), err), [
        { label: 'Cancelar' },
        { label: 'Entrar', cls: 'primary', onclick: () => { if (!Auth.login(inp.value)) { err.textContent = 'Contraseña incorrecta.'; return false; } UI.toast('Modo administrador activo', 'ok'); } },
      ]);
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') document.querySelector('.modal-f .btn.primary').click(); });
    },
  };

  g.App = App;
  document.addEventListener('DOMContentLoaded', () => {
    Store.load(); Auth.init();
    Store.onChange(() => { const s = document.querySelector('.save-status'); if (s) { s.textContent = Store.status === 'saving' ? 'Guardando…' : Store.status === 'error' ? 'No se pudo guardar en el navegador' : 'Guardado en este navegador'; s.classList.toggle('error', Store.status === 'error'); } });
    Auth.onChange(() => { App.readHash(); App.render(); });
    window.addEventListener('hashchange', () => { App.readHash(); App.render(); window.scrollTo(0, 0); });
    App.readHash(); App.render();
  });
})(window);
