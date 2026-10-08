/* Glosario de equipos (módulo de ayuda): por categoría, una descripción con sus imágenes y las piezas del catálogo.
   Textos e imágenes los edita el administrador (Administración ▸ Categorías y Catálogo). */
(function (g) {
  'use strict';
  const h = U.h;
  let q = '';

  function render(root) {
    U.clear(root);
    const cat = Store.catalog;
    const search = h('input', { type: 'search', placeholder: 'Buscar equipo, marca o categoría…', value: q, 'aria-label': 'Buscar en el glosario' });
    const host = h('div', { class: 'stack' });
    search.addEventListener('input', () => { q = search.value; fill(); });
    function fill() {
      U.clear(host);
      const t = q.toLowerCase().trim();
      let n = 0;
      cat.categorias.forEach(c => {
        const items = cat.items.filter(i => i.categoria === c.nombre);
        const hit = i => !t || [i.descripcion, i.marca, i.parte, i.categoria].join(' ').toLowerCase().includes(t);
        const shown = items.filter(hit);
        if (!items.length && !c.descripcion) return;
        if (t && !shown.length && !(c.nombre + ' ' + (c.descripcion || '')).toLowerCase().includes(t)) return;
        n++;
        const imgs = (c.imagenes || []).filter(Boolean);
        host.appendChild(UI.card('', [
          h('div', { class: 'gl-cat' },
            h('div', null, h('h3', null, c.nombre), c.descripcion ? h('p', null, c.descripcion) : h('p', { class: 'muted' }, 'Sin descripción: el administrador puede agregarla en Administración ▸ Categorías.')),
            imgs.length ? h('div', { class: 'gl-imgs' }, imgs.map(s => h('img', { src: s, alt: c.nombre, loading: 'lazy' }))) : null),
          shown.length ? h('div', { class: 'gl-items' }, shown.map(i => h('div', { class: 'gl-it' }, UI.thumb(i, c.color, 64),
            h('div', null, h('b', null, i.descripcion), h('div', { class: 'muted' }, [i.marca, i.parte].filter(x => x && x !== 'Por definir').join(' · ') || 'Marca y parte por definir'),
              h('div', { class: 'muted' }, [i.ru > 0 ? i.ru + ' RU' : '', i.puertos ? i.puertos + ' puertos' : '', i.consumo ? '≈ ' + i.consumo + ' W' : '', i.notas].filter(Boolean).join(' · ')))))) : null]));
        host.lastChild.querySelector('.card-h').remove();
      });
      if (!n) host.appendChild(h('p', { class: 'empty' }, 'Sin resultados.'));
    }
    root.appendChild(h('div', { class: 'stack' },
      h('div', { class: 'room-head' }, h('div', null, h('h2', null, 'Glosario de equipos'), h('p', { class: 'muted' }, 'Qué es cada equipo del rack, para qué sirve y cómo se ve. Las imágenes y textos los mantiene el administrador.')), h('div', { class: 'toolbar no-print' }, search)),
      host));
    fill();
  }

  g.GlosarioView = { render };
})(window);
