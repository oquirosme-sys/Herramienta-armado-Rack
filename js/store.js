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
      return Store.defaults({
        id: U.uid(), nombre: '', numero: '', ubicacion: '', fecha: U.today(), elaboro: '', revision: '',
        jackId: Store.catalog.jackDefectoId || '', niveles: [],
      });
    },
    /** Completa los campos nuevos (servicios, redes, cuartos…) en proyectos nuevos o antiguos. */
    defaults(p) {
      const POE = ['C', 'W', 'A', 'B', 'G', 'R'], ACT = ['D', 'V', 'C', 'B', 'W', 'A'];
      if (p.reservaPct === undefined) p.reservaPct = 30;
      if (!p.modoSalidas) p.modoSalidas = 'cuarto';
      if (!p.lans || !p.lans.length) p.lans = [{ id: 1, nombre: 'LAN 1 — Datos' }];
      if (p.compartirRed === undefined) p.compartirRed = p.lans.length <= 1 && Object.values(p.servicios || {}).every(x => !x.lan || x.lan === 1);
      if (!p.cuartos) p.cuartos = [];
      if (!p.nivelesEdificio) p.nivelesEdificio = [];
      if (!p.fibra) p.fibra = { redundante: false, reserva: 20 };
      p.servicios = p.servicios || {};
      (Store.catalog.tiposSalida || []).forEach(t => {
        if (t.codigo === '-') return;
        if (!p.servicios[t.codigo]) p.servicios[t.codigo] = { activo: ACT.includes(t.codigo), poe: POE.includes(t.codigo), lan: 1 };
      });
      return p;
    },
    migrate() {
      const cat = Store.catalog, p = Store.project;
      // el catálogo guardado en el navegador puede ser anterior: agregar tipos de salida nuevos (G, R…)
      window.SEED.tiposSalida.forEach(t => {
        if (!cat.tiposSalida.some(x => x.codigo === t.codigo)) { const i = cat.tiposSalida.findIndex(x => x.codigo === '-'); cat.tiposSalida.splice(i < 0 ? cat.tiposSalida.length : i, 0, U.clone(t)); }
      });
      // categorías guardadas antes de existir el glosario: completar descripción
      // imágenes de fabricante incluidas en el catálogo inicial: completar las piezas que aún no tienen (una imagen quitada por el administrador queda vacía y no se repone)
      cat.items.forEach(it => { if (it.imagen === undefined) { const si = window.SEED.items.find(x => x.id === it.id && x.descripcion === it.descripcion); if (si && si.imagen) { it.imagen = si.imagen; it.imagenRef = si.imagenRef; } } });
      cat.categorias.forEach(c => { const sc0 = window.SEED.categorias.find(x => x.nombre === c.nombre); if ((!c.imagenes || !c.imagenes.length) && c.imagenesInit === undefined && sc0) { c.imagenes = (sc0.imagenes || []).slice(); c.imagenesInit = true; } });
      cat.categorias.forEach(c => { const sc = window.SEED.categorias.find(x => x.nombre === c.nombre); if (c.descripcion === undefined) c.descripcion = sc ? sc.descripcion : ''; if (!c.imagenes) c.imagenes = []; });
      Store.defaults(p);
      p.niveles.forEach(n => {
        n.equipos = n.equipos || []; n.fuera = n.fuera || []; n.tramos = n.tramos || []; n.portTipos = n.portTipos || {};
        n.equipos.forEach(e => { if (!e.id) e.id = U.uid(); });
      });
      // proyectos anteriores: cada rack pasa a tener su propio cuarto (el primero es el principal)
      if (!p.cuartos.length && p.niveles.length) {
        p.niveles.forEach((n, i) => { const c = { id: U.uid(), codigo: n.codigo, nombre: n.descripcion || '', tipo: i === 0 ? 'principal' : 'secundario', distancia: null, salidas: {} }; p.cuartos.push(c); n.cuartoId = c.id; });
      }
      p.niveles.forEach(n => { if (!n.cuartoId || !p.cuartos.some(c => c.id === n.cuartoId)) n.cuartoId = p.cuartos.length ? p.cuartos[0].id : ''; });
      if (p.cuartos.length && !p.cuartos.some(c => c.tipo === 'principal')) p.cuartos[0].tipo = 'principal';
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

    /* ---------- cuartos de telecomunicaciones ---------- */
    cuarto(id) { return Store.project.cuartos.find(c => c.id === id); },
    nextCuartoCode() {
      const used = new Set(Store.project.cuartos.map(n => n.codigo));
      for (let i = 1; i < 100; i++) { const c = i + 'A'; if (!used.has(c)) return c; }
      return U.uid();
    },
    nextRackCode(cuartoId) {
      const c = Store.cuarto(cuartoId), n = Store.project.niveles.filter(r => r.cuartoId === cuartoId).length;
      const used = new Set(Store.project.niveles.map(r => r.codigo)); let k = n + 1, code;
      do { code = (c ? c.codigo : 'TR') + '-R' + k++; } while (used.has(code));
      return code;
    },
    addCuarto(codigo, nombre, tipo) {
      const c = { id: U.uid(), codigo, nombre: nombre || '', tipo: tipo || 'secundario', distancia: null, salidas: {} };
      if (!Store.project.cuartos.length) c.tipo = 'principal';
      if (c.tipo === 'principal') Store.project.cuartos.forEach(o => { o.tipo = 'secundario'; });
      Store.project.cuartos.push(c); Store.save(); return c;
    },
    setPrincipal(id) { Store.project.cuartos.forEach(c => { c.tipo = c.id === id ? 'principal' : 'secundario'; }); Store.save(); },
    removeCuarto(id) {
      const p = Store.project; if (p.niveles.some(r => r.cuartoId === id)) return false;
      const era = (Store.cuarto(id) || {}).tipo; p.cuartos = p.cuartos.filter(c => c.id !== id);
      if (era === 'principal' && p.cuartos.length) p.cuartos[0].tipo = 'principal';
      p.nivelesEdificio.forEach(n => { if (n.cuartoId === id) n.cuartoId = ''; }); Store.save(); return true;
    },
    addNivelEdificio(nombre) { const n = { id: U.uid(), nombre, cuartoId: (Store.project.cuartos[0] || {}).id || '', salidas: {} }; Store.project.nivelesEdificio.push(n); Store.save(); return n; },

    /* ---------- niveles (racks y gabinetes) ---------- */
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
    addRoom(codigo, descripcion, plantilla, cuartoId) {
      const vacio = String(plantilla).startsWith('vacio:');
      const t = vacio ? null : window.SEED.plantillas[plantilla];
      const room = {
        id: U.uid(), codigo, cuartoId: cuartoId || ((Store.project.cuartos || [])[0] || {}).id || '', descripcion: descripcion || '', montaje: t ? t.montaje : (vacio ? plantilla.slice(6) : 'piso'),
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
      /* copia el rack en el mismo cuarto */
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
