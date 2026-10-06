/* Arranque, pestañas y navegación. */
(function (g) {
  'use strict';
  const h = U.h;
  let route = 'proyecto';

  const App = {
    init() {
      Auth.init(); Store.load();
      Store.onChange(updateStatus);
      Auth.onChange(() => { buildHeader(); App.refreshTabs(); if (route === 'admin' && !Auth.isAdmin()) App.go('proyecto'); else show(); });
      window.addEventListener('hashchange', () => { route = location.hash.slice(1) || 'proyecto'; show(); });
      window.addEventListener('beforeunload', () => Store.flush());
      buildHeader();
      route = location.hash.slice(1) || 'proyecto';
      show();
    },
    go(r) { if (location.hash.slice(1) === r) { route = r; show(); } else location.hash = r; },
    refreshTabs() { buildTabs(); },
  };

  function validRoute() {
    if (route === 'proyecto' || route === 'memoria') return true;
    if (route === 'admin') return Auth.isAdmin();
    if (route.startsWith('nivel/')) return !!Store.findRoom(route.slice(6));
    return false;
  }

  function show() {
    if (!validRoute()) route = 'proyecto';
    buildTabs();
    const view = document.getElementById('view');
    window.scrollTo(0, 0);
    if (route === 'proyecto') ProjectView.render(view);
    else if (route === 'memoria') MemoriaView.render(view);
    else if (route === 'admin') AdminView.render(view);
    else RoomView.render(view, route.slice(6));
  }

  function buildTabs() {
    const bar = document.getElementById('tabs'); U.clear(bar);
    const tab = (r, label, extra) => bar.appendChild(h('a', { href: '#' + r, class: 'tab ' + (extra || '') + (r === route ? ' active' : ''), role: 'tab', 'aria-selected': r === route ? 'true' : 'false', title: extra === 'level' ? label.title : null }, label.text || label));
    tab('proyecto', 'Proyecto');
    Store.project.niveles.forEach(n => tab('nivel/' + n.id, { text: n.codigo, title: n.descripcion }, 'level'));
    tab('memoria', 'Memoria de cálculo');
    if (Auth.isAdmin()) tab('admin', 'Administración', 'admin');
    bar.querySelectorAll('.tab.level').forEach(a => { const n = Store.findRoom(a.getAttribute('href').slice(7)); if (n) a.title = n.descripcion || ''; });
    const act = bar.querySelector('.tab.active'); if (act && act.scrollIntoView) act.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function updateStatus(s) {
    const el = document.getElementById('save-status'); if (!el) return;
    el.textContent = s === 'pending' ? 'Guardando…' : s === 'error' ? '⚠ No se pudo guardar' : '✓ Guardado en este navegador';
    el.className = 'save-status ' + s;
  }

  function buildHeader() {
    const host = document.getElementById('actions'); U.clear(host);
    const file = h('input', { type: 'file', accept: '.json', style: { display: 'none' } });
    file.addEventListener('change', async () => {
      try { Store.importProject(await file.files[0].text()); UI.toast('Proyecto importado.'); route = 'proyecto'; location.hash = 'proyecto'; show(); } catch (e) { UI.alert(e.message); }
      file.value = '';
    });
    const menu = h('details', { class: 'menu' }, h('summary', { class: 'btn' }, 'Archivo ▾'),
      h('div', { class: 'menu-list' },
        h('button', { type: 'button', onclick: async () => { closeMenus(); if (await UI.confirm('Se borrará el proyecto actual de este navegador (el catálogo se conserva). Exporte antes si lo necesita. ¿Continuar?', 'Nuevo proyecto')) { Store.newProject(); location.hash = 'proyecto'; route = 'proyecto'; show(); } } }, 'Nuevo proyecto'),
        h('button', { type: 'button', onclick: () => { closeMenus(); U.download('proyecto-' + (Store.project.numero || 'rack') + '.json', Store.exportProject(), 'application/json'); } }, 'Exportar proyecto (JSON)'),
        h('button', { type: 'button', onclick: () => { closeMenus(); file.click(); } }, 'Importar proyecto…'),
        h('button', { type: 'button', onclick: () => { closeMenus(); UI.modal('Ayuda e instrucciones', ProjectView.instrucciones(), [{ label: 'Cerrar', cls: 'primary' }]); } }, 'Ayuda')));
    const adm = Auth.isAdmin()
      ? h('button', { type: 'button', class: 'btn admin-on', onclick: () => Auth.logout(), title: 'Salir del modo administrador' }, '🔓 Administrador · Salir')
      : h('button', { type: 'button', class: 'btn', onclick: loginDialog }, '🔒 Acceso administrador');
    host.appendChild(h('span', { id: 'save-status', class: 'save-status ok' }, '✓ Guardado en este navegador'));
    host.appendChild(menu); host.appendChild(file); host.appendChild(adm);
  }
  function closeMenus() { document.querySelectorAll('details.menu').forEach(d => d.removeAttribute('open')); }
  document.addEventListener('click', e => { if (!e.target.closest('details.menu')) closeMenus(); });

  function loginDialog() {
    const pw = h('input', { type: 'password', autocomplete: 'current-password' }), err = h('small', { class: 'err' });
    UI.modal('Acceso de administrador', h('div', { class: 'stack' }, UI.field('Contraseña', pw), err, h('p', { class: 'hint' }, 'El administrador puede agregar marcas, tipos de canasta, tubería, cableado y equipos al catálogo.')), [
      { label: 'Cancelar' }, { label: 'Entrar', cls: 'primary', onclick: () => { if (!Auth.login(pw.value)) { err.textContent = 'Contraseña incorrecta.'; pw.select(); return false; } UI.toast('Modo administrador activado.'); } }]);
    pw.addEventListener('keydown', e => { if (e.key === 'Enter') document.querySelector('.modal-f .btn.primary').click(); });
  }

  g.App = App;
  document.addEventListener('DOMContentLoaded', App.init);
})(window);
