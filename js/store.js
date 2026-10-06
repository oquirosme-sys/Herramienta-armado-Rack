/* Estado de la aplicación y persistencia.
   Toda la lectura/escritura pasa por Store.* para que el paso 2 (Supabase) solo reemplace este archivo
   (o agregue un adaptador) sin tocar la interfaz. Hoy: localStorage + importar/exportar JSON. */
(function (g) {
  'use strict';
  const K_PROJECT = 'rackcode.proyecto.v1';
  const K_CATALOG = 'rackcode.catalogo.v1';
  const K_ADMINPW = 'rackcode.adminhash.v1';

  const listeners = [];
  let saveTimer = null;

  const Store = {
    project: null,
    catalog: null,
    status: 'ok',

    onChange(fn) { listeners.push(fn); },
    _emit() { listeners.forEach(f => f(Store.status)); },

    /* ---------- carga ---------- */
    load() {
      let p = null, c = null;
      try { p = JSON.parse(localStorage.getItem(K_PROJECT)); } catch (e) { /* ignora */ }
      try { c = JSON.parse(localStorage.getItem(K_CATALOG)); } catch (e) { /* ignora */ }
      Store.catalog = c && c.items && c.categorias ? c : Store.seedCatalog();
      Store.project = p && p.niveles ? p : Store.emptyProject();
      Store.migrate();
    },
    seedCatalog() {
      const s = U.clone(window.SEED);
      return { categorias: s.categorias, items: s.items, marcas: s.marcas, tiposSalida: s.tiposSalida, referencias: s.referencias, revisiones: s.revisiones, listas: s.listas, jackDefectoId: s.jackDefectoId };
    },
    emptyProject() {
      return {
        id: U.uid(), nombre: '', numero: '', ubicacion: '', fecha: U.today(), elaboro: '', revision: '',
        jackId: Store.catalog.jackDefectoId || '', reservaCable: 10, niveles: [],
      };
    },
    migrate() {
      const p = Store.project;
      p.niveles.forEach(n => {
        n.equipos = n.equipos || []; n.fuera = n.fuera || []; n.tramos = n.tramos || []; n.portTipos = n.portTipos || {};
        n.equipos.forEach(e => { if (!e.id) e.id = U.uid(); });
      });
    },

    /* ---------- guardado ---------- */
    save() {
      Store.status = 'pending'; Store._emit();
      clearTimeout(saveTimer);
      saveTimer = setTimeout(Store.flush, 250);
    },
    flush() {
      try {
        localStorage.setItem(K_PROJECT, JSON.stringify(Store.project));
        Store.status = 'ok';
      } catch (e) { Store.status = 'error'; }
      Store._emit();
    },
    saveCatalog() {
      try { localStorage.setItem(K_CATALOG, JSON.stringify(Store.catalog)); Store.status = 'ok'; } catch (e) { Store.status = 'error'; }
      Store._emit();
    },

    /* ---------- proyecto ---------- */
    newProject() { Store.project = Store.emptyProject(); Store.flush(); },
    exportProject() { return JSON.stringify({ tipo: 'rackcode-proyecto', version: 1, proyecto: Store.project }, null, 1); },
    importProject(text) {
      const o = JSON.parse(text);
      const p = o.proyecto || o;
      if (!p || !Array.isArray(p.niveles)) throw new Error('El archivo no es un proyecto válido.');
      Store.project = p; Store.migrate(); Store.flush();
    },

    /* ---------- niveles ---------- */
    findRoom(id) { return Store.project.niveles.find(n => n.id === id); },
    firstRackOf(montaje) {
      const cats = { piso: ['Rack'], gabinete: ['Gabinete'], pared: ['Gabinete de pared', 'Rack de pared'] }[montaje] || ['Rack'];
      for (const c of cats) { const it = Store.catalog.items.find(i => i.categoria === c); if (it) return it; }
      return undefined;
    },
    nextCode() {
      const used = new Set(Store.project.niveles.map(n => n.codigo));
      for (let i = 1; i < 100; i++) { const c = i + 'A'; if (!used.has(c)) return c; }
      return U.uid();
    },
    /** Crea un nivel/cuarto. plantilla: 'piso' | 'gabinete' | 'pared' | 'vacio:<montaje>' */
    addRoom(codigo, descripcion, plantilla) {
      const vacio = String(plantilla).startsWith('vacio:');
      const t = vacio ? null : window.SEED.plantillas[plantilla];
      const room = {
        id: U.uid(), codigo, descripcion: descripcion || '', montaje: t ? t.montaje : (vacio ? plantilla.slice(6) : 'piso'),
        rackId: '', rackQty: 1, orgVertId: '', orgVertUbic: 'Ambos lados', equipos: [], fuera: [], poeW: null, portTipos: {}, tramos: [],
      };
      if (t) {
        const tipoExiste = id => Store.catalog.items.some(i => i.id === id);
        room.rackId = tipoExiste(t.rackId) ? t.rackId : '';
        room.rackQty = t.rackQty || 1; room.orgVertId = tipoExiste(t.orgVertId) ? t.orgVertId : ''; room.orgVertUbic = t.orgVertUbic;
        if (!descripcion) room.descripcion = t.descripcion;
        room.equipos = t.equipos.filter(e => tipoExiste(e.itemId)).map(e => ({ id: U.uid(), itemId: e.itemId, tipo: e.tipo || '', salidas: e.salidas, notas: e.notas || '' }));
        room.fuera = t.fuera.filter(e => tipoExiste(e.itemId)).map(e => ({ id: U.uid(), itemId: e.itemId, cant: e.cant, notas: e.notas || '' }));
      } else {
        const rk = Store.firstRackOf(room.montaje); room.rackId = rk ? rk.id : '';
        const ov = Store.catalog.items.find(i => i.categoria === 'Organizador vertical'); room.orgVertId = ov ? ov.id : '';
        room.orgVertUbic = room.montaje === 'piso' ? 'Ambos lados' : 'Sin organizador';
      }
      Store.project.niveles.push(room); Store.save();
      return room;
    },
    duplicateRoom(id, codigo) {
      const src = Store.findRoom(id); if (!src) return null;
      const c = U.clone(src); c.id = U.uid(); c.codigo = codigo; c.descripcion = src.descripcion + ' (copia)';
      const map = {}; c.equipos.forEach(e => { const n = U.uid(); map[e.id] = n; e.id = n; });
      const pt = {}; for (const k in c.portTipos) { const [eid, p] = k.split(':'); if (map[eid]) pt[map[eid] + ':' + p] = c.portTipos[k]; }
      c.portTipos = pt; c.fuera.forEach(f => { f.id = U.uid(); }); c.tramos.forEach(t => { t.id = U.uid(); });
      Store.project.niveles.push(c); Store.save(); return c;
    },
    removeRoom(id) { Store.project.niveles = Store.project.niveles.filter(n => n.id !== id); Store.save(); },
    moveRoom(id, d) {
      const a = Store.project.niveles, i = a.findIndex(n => n.id === id), j = i + d;
      if (i < 0 || j < 0 || j >= a.length) return;
      [a[i], a[j]] = [a[j], a[i]]; Store.save();
    },

    /* ---------- catálogo (solo administrador) ---------- */
    item(id) { return Store.catalog.items.find(i => i.id === id); },
    roleOfCat(nombre) { const c = Store.catalog.categorias.find(x => x.nombre === nombre); return c ? c.rol : 'equipo'; },
    /** Items cuyo rol de categoría está en `roles` */
    itemsByRole(roles, filtro) {
      const rs = Array.isArray(roles) ? roles : [roles];
      return Store.catalog.items.filter(i => rs.includes(Store.roleOfCat(i.categoria)) && (!filtro || filtro(i)));
    },
    /** Dónde se usa un item (para impedir borrarlo) */
    usageOfItem(id) {
      const p = Store.project; let n = 0;
      if (p.jackId === id) n++;
      p.niveles.forEach(r => {
        if (r.rackId === id || r.orgVertId === id) n++;
        n += r.equipos.filter(e => e.itemId === id).length + r.fuera.filter(e => e.itemId === id).length;
        n += r.tramos.filter(t => t.canalId === id || t.cableId === id).length;
      });
      return n;
    },
    nextItemId() {
      let m = 0; Store.catalog.items.forEach(i => { const k = parseInt(String(i.id).replace(/\D/g, ''), 10); if (k > m) m = k; });
      return 'it-' + String(m + 1).padStart(3, '0');
    },
    resetCatalog() { Store.catalog = Store.seedCatalog(); Store.saveCatalog(); },
    exportCatalog() { return JSON.stringify({ tipo: 'rackcode-catalogo', version: 1, catalogo: Store.catalog }, null, 1); },
    importCatalog(text) {
      const o = JSON.parse(text); const c = o.catalogo || o;
      if (!c || !Array.isArray(c.items) || !Array.isArray(c.categorias)) throw new Error('El archivo no es un catálogo válido.');
      Store.catalog = c; Store.saveCatalog();
    },

    /* ---------- contraseña de administrador local ---------- */
    adminHash() { try { return localStorage.getItem(K_ADMINPW) || window.CONFIG.ADMIN_PASSWORD_SHA256; } catch (e) { return window.CONFIG.ADMIN_PASSWORD_SHA256; } },
    setAdminPassword(pw) { localStorage.setItem(K_ADMINPW, U.sha256(pw)); },
  };
  g.Store = Store;
})(window);
