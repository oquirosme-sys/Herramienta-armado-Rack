/* Estado de la aplicación y persistencia.
   Toda la lectura/escritura pasa por Store.* para que el paso 2 (Supabase) solo reemplace este archivo
   (o agregue un adaptador) sin tocar la interfaz. Hoy: localStorage + importar/exportar JSON.
   Modelo:
     Catálogo (solo administrador): tiposCarga, detallesCarga, tablerosCat, breakers, supresores, transformadores, tablas NEC…
     Proyecto: datos generales + tableros[] → cada tablero con su alimentador (alim), circuitos[] y padreId (de quién se alimenta). */
(function (g) {
  'use strict';
  const K_PROJECT = 'anacar.proyecto.v1';
  const K_CATALOG = 'anacar.catalogo.v1';
  const K_ADMINPW = 'anacar.adminhash.v1';

  const listeners = [];
  let saveTimer = null;

  const Store = {
    project: null,
    catalog: null,
    status: 'ok',

    onChange(fn) { listeners.push(fn); },
    _emit() { listeners.forEach(f => f(Store.status)); },

    load() {
      let p = null, c = null;
      try { p = JSON.parse(localStorage.getItem(K_PROJECT)); } catch (e) { /* ignora */ }
      try { c = JSON.parse(localStorage.getItem(K_CATALOG)); } catch (e) { /* ignora */ }
      Store.catalog = c && c.detallesCarga && c.breakers ? c : Store.seedCatalog();
      Store.project = p && p.tableros ? p : Store.emptyProject();
      Store.migrate();
    },
    seedCatalog() { const s = U.clone(window.SEED); s.marcas = Store.marcasDe(s); return s; },
    marcasDe(c) { return Array.from(new Set([].concat(c.tablerosCat.map(t => t.fabricante), c.breakers.map(b => b.marca), c.supresores.map(b => b.marca)).filter(Boolean))).sort(); },
    emptyProject() {
      return {
        id: U.uid(), nombre: '', numero: '', ubicacion: '', fecha: U.today(), elaboro: '', revision: '',
        cvMaxRamal: 3, cvMaxAlim: 3, cvMaxTotal: 5, desbalanceMax: 10, iccLongMax: 20, marcaDefecto: 'Eaton', tableros: [],
      };
    },
    migrate() {
      const c = Store.catalog, s = window.SEED;
      Object.keys(s).forEach(k => { if (c[k] === undefined) c[k] = U.clone(s[k]); });
      if (!c.marcas) c.marcas = Store.marcasDe(c);
      const p = Store.project;
      ['cvMaxRamal', 'cvMaxAlim', 'cvMaxTotal', 'desbalanceMax', 'iccLongMax', 'marcaDefecto'].forEach(k => { if (p[k] === undefined) p[k] = Store.emptyProject()[k]; });
      p.tableros.forEach(t => Store.completarTablero(t));
    },

    /* ---------- tableros y circuitos ---------- */
    /** Voltaje línea-línea y fases a partir del sistema (120/208, 277/480…) y del tipo 3F/1F. */
    voltajeDe(sistema, tipo) {
      const nums = String(sistema || '').split('/').map(Number).filter(x => x);
      const vmax = nums.length ? Math.max(...nums) : 208;
      return { voltaje: vmax, fases: tipo === '1F' ? (nums.length > 1 ? 2 : 1) : 3, hilos: tipo === '1F' ? (nums.length > 1 ? 3 : 2) : 4 };
    },
    completarTablero(t) {
      if (!t.id) t.id = U.uid();
      if (!t.tipo) t.tipo = Number(t.fases) === 3 || t.fases === undefined ? '3F' : '1F';
      if (!t.sistema) t.sistema = t.tipo === '1F' ? '120/240' : '120/208';
      if (t.voltaje === undefined || t.fases === undefined) Object.assign(t, Store.voltajeDe(t.sistema, t.tipo));
      if (t.prefijo === undefined) t.prefijo = 'TABLERO';
      if (t.reserva === undefined) t.reserva = 0.1;
      if (t.longitud === undefined) t.longitud = 10;
      t.alim = Object.assign({ material: 'CU', aislamiento: 'XHHW-2', fp: 0.9, mult: 1.25, tuberia: 'EMT', paralelos: '', aumento: 1, tempAmb: '26-30', tempBorne: 90, agrupamiento: '4-6', breakerId: '', prot: '' }, t.alim || {});
      t.circuitos = t.circuitos || []; t.fd = t.fd || {}; t.trafo = t.trafo || {};
      t.circuitos.forEach(c => { if (!c.id) c.id = U.uid(); if (!Array.isArray(c.polos)) c.polos = []; });
      if (t.montaje === undefined) t.montaje = 'Superficial';
      return t;
    },
    nuevoTablero(datos) {
      const t = Store.completarTablero(Object.assign({ id: U.uid(), nombre: '', tipo: '3F', sistema: '120/208', padreId: '', conectadoA: '', circuitos: [] }, datos || {}));
      Object.assign(t, Store.voltajeDe(t.sistema, t.tipo));
      Store.project.tableros.push(t); Store.save();
      return t;
    },
    tablero(id) { return Store.project.tableros.find(t => t.id === id) || null; },
    eliminarTablero(id) {
      const p = Store.project;
      p.tableros.forEach(t => {
        if (t.padreId === id) t.padreId = '';
        t.circuitos.forEach(c => { if (c.tableroHijoId === id) c.tableroHijoId = ''; });
      });
      p.tableros = p.tableros.filter(t => t.id !== id); Store.save();
    },
    duplicarTablero(id) {
      const o = Store.tablero(id); if (!o) return null;
      const t = U.clone(o); t.id = U.uid(); t.nombre = (o.nombre || '') + ' (copia)';
      t.circuitos.forEach(c => { c.id = U.uid(); c.tableroHijoId = ''; });
      Store.project.tableros.splice(Store.project.tableros.indexOf(o) + 1, 0, t); Store.save();
      return t;
    },
    /** Siguiente posición libre en el tablero para un circuito de n polos (los polos de un mismo lado van de 2 en 2). */
    posicionLibre(t, nPolos) {
      const usados = new Set(); t.circuitos.forEach(c => (c.polos || []).forEach(p => usados.add(Number(p))));
      for (let p = 1; p < 400; p++) {
        const set = Array.from({ length: nPolos }, (_, i) => p + 2 * i);
        if (set.every(x => !usados.has(x))) return set;
      }
      return [];
    },
    nuevoCircuito(t, datos) {
      const det = Store.catalog.detallesCarga.find(d => String(d.id) === String((datos || {}).detalleId || 8)) || {};
      const nPolos = Number(det.fases) === 3 ? 3 : (Number(det.v) >= 208 && Number(det.v) <= 240 && Number(det.fases) === 2 ? 2 : 1);
      const c = Object.assign({ id: U.uid(), polos: Store.posicionLibre(t, nPolos), detalleId: det.id || 8, descripcion: '', kva: '', longitud: '', material: 'CU', aislamiento: 'THHN', mult: '', paralelos: '', aumento: 1, breakerId: '', prot: '', tableroHijoId: '' }, datos || {});
      t.circuitos.push(c); Store.save();
      return c;
    },

    /** Detalle de carga (DCARGAS) adecuado para el circuito que alimenta a un tablero derivado. */
    detalleTablero(t) {
      const d = Store.catalog.detallesCarga, f = Number(t.fases) === 3 ? 3 : 2;
      return (d.find(x => /tablero/i.test(x.descripcion) && Number(x.fases) === f && Number(x.v) === Number(t.voltaje)) ||
        d.find(x => /tablero/i.test(x.descripcion) && Number(x.fases) === f) || d[0]).id;
    },
    /** Cambia de quién se alimenta un tablero y crea/mueve el circuito que lo alimenta en el tablero padre. */
    cambiarPadre(t, padreId) {
      const p = Store.project;
      p.tableros.forEach(o => { o.circuitos = o.circuitos.filter(c => !(c.tableroHijoId === t.id && c.auto)); o.circuitos.forEach(c => { if (c.tableroHijoId === t.id) c.tableroHijoId = ''; }); });
      t.padreId = padreId || '';
      const padre = Store.tablero(padreId);
      if (padre) {
        const det = Store.detalleTablero(t), dd = Store.catalog.detallesCarga.find(x => x.id === det) || {};
        const np = Number(dd.fases) === 3 ? 3 : 2;
        padre.circuitos.push({ id: U.uid(), polos: Store.posicionLibre(padre, np), detalleId: det, descripcion: '', kva: 0, longitud: t.longitud, material: 'CU', aislamiento: 'THHN', mult: '', paralelos: '', aumento: 1, breakerId: '', prot: '', tableroHijoId: t.id, auto: true });
      }
      Store.save();
    },
    /** Tableros que pueden alimentar a t (no él mismo ni sus derivados). */
    posiblesPadres(t) {
      const p = Store.project, desc = new Set([t.id]);
      let cambio = true;
      while (cambio) { cambio = false; p.tableros.forEach(o => { if (o.padreId && desc.has(o.padreId) && !desc.has(o.id)) { desc.add(o.id); cambio = true; } }); }
      return p.tableros.filter(o => !desc.has(o.id));
    },

    /* ---------- persistencia ---------- */
    save() {
      clearTimeout(saveTimer);
      Store.status = 'saving'; Store._emit();
      saveTimer = setTimeout(Store.flush, 250);
    },
    flush() {
      clearTimeout(saveTimer);
      try {
        localStorage.setItem(K_PROJECT, JSON.stringify(Store.project));
        localStorage.setItem(K_CATALOG, JSON.stringify(Store.catalog));
        Store.status = 'ok';
      } catch (e) { Store.status = 'error'; }
      Store._emit();
    },
    exportProject() { return JSON.stringify({ tipo: 'anacar-proyecto', version: 1, proyecto: Store.project }, null, 1); },
    importProject(text) {
      const o = JSON.parse(text), p = o && (o.proyecto || o);
      if (!p || !Array.isArray(p.tableros)) throw new Error('El archivo no es un proyecto de esta herramienta.');
      Store.project = p; Store.migrate(); Store.save();
    },
    newProject() { Store.project = Store.emptyProject(); Store.save(); },
    exportCatalog() { return JSON.stringify({ tipo: 'anacar-catalogo', version: 1, catalogo: Store.catalog }, null, 1); },
    importCatalog(text) {
      const o = JSON.parse(text), c = o && (o.catalogo || o);
      if (!c || !Array.isArray(c.detallesCarga) || !Array.isArray(c.breakers)) throw new Error('El archivo no es un catálogo de esta herramienta.');
      Store.catalog = c; Store.migrate(); Store.save();
    },
    resetCatalog() { Store.catalog = Store.seedCatalog(); Store.save(); },
    adminHash() { try { return localStorage.getItem(K_ADMINPW) || window.CONFIG.ADMIN_PASSWORD_SHA256; } catch (e) { return window.CONFIG.ADMIN_PASSWORD_SHA256; } },
    setAdminHash(h) { localStorage.setItem(K_ADMINPW, h); },
  };
  window.addEventListener('beforeunload', () => { if (Store.status === 'saving') Store.flush(); });
  g.Store = Store;
})(window);
