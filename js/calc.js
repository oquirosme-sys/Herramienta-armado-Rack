/* Motor de cálculo (puro, sin DOM). Reproduce la lógica de las hojas MUESTRA / Resumen del Excel:
   posición en el rack, etiquetado de puertos, lista de materiales, potencia y calor,
   más los tramos de canalización (canastas / tuberías) y cableado. */
(function (g) {
  'use strict';
  const pad = (n, w) => String(n).padStart(w, '0');
  const NO_BOM = ['libre', 'reservado'];

  function index(cat) {
    const byId = {}, role = {}, color = {};
    cat.items.forEach(i => { byId[i.id] = i; });
    cat.categorias.forEach(c => { role[c.nombre] = c.rol; color[c.nombre] = c.color; });
    return {
      byId,
      roleOf: i => (i ? (role[i.categoria] || 'equipo') : ''),
      colorOf: i => (i ? (color[i.categoria] || '#E7E6E6') : '#fff'),
    };
  }
  const panelLetters = n => String.fromCharCode(65 + Math.floor((n - 1) / 26)) + String.fromCharCode(65 + ((n - 1) % 26));
  const orgQty = u => (u === 'Ambos lados' ? 2 : (u === 'Lado izquierdo' || u === 'Lado derecho') ? 1 : 0);

  /** Un rack o gabinete. `st` lleva la numeración de paneles y salidas compartida por todos los racks de un mismo cuarto. */
  function calcRack(room, cat, project, ix, st) {
    ix = ix || index(cat);
    const cuarto = (project.cuartos || []).find(c => c.id === room.cuartoId);
    const prefix = cuarto ? cuarto.codigo : room.codigo;
    const rack = ix.byId[room.rackId];
    const rackQty = Math.max(1, Number(room.rackQty) || 1);
    const totalRU = rack && rack.ru > 0 ? rack.ru : 45;
    const rows = [], panels = [], counters = st.counters, outletsByType = {};
    let cum = 0, libreRU = 0, outlets = 0, ports = 0;
    let consumo = 0, peso = 0, capSum = 0, capMax = 0, upsN = 0, sinDato = 0;
    const bom = {}; const add = (id, q) => { if (q) bom[id] = (bom[id] || 0) + q; };

    (room.equipos || []).forEach((eq, idx) => {
      const item = ix.byId[eq.itemId];
      const row = { eq, item, idx, role: item ? ix.roleOf(item) : '', ru: 0, sup: null, inf: null };
      rows.push(row);
      if (!item) return;
      const ru = item.ru > 0 ? item.ru : 0;
      row.ru = ru;
      if (ru > 0) { row.sup = totalRU - cum; row.inf = row.sup - ru + 1; }
      cum += ru;
      if (row.role === 'libre') libreRU += ru;
      if (!NO_BOM.includes(row.role)) {
        add(item.id, 1);
        if (item.consumo === null || item.consumo === undefined) sinDato++;
      }
      consumo += item.consumo || 0;
      peso += item.peso || 0;
      if (item.capacidad) { capSum += item.capacidad; capMax = Math.max(capMax, item.capacidad); }
      if (row.role === 'ups') upsN++;

      if (row.role === 'panel') {
        st.panelN++;
        const np = item.puertos || 0;
        // Tramos de tipos de salida consecutivos: el principal (tipo/salidas) y los adicionales (eq.mas)
        const mas = (eq.mas || []).filter(m => m.tipo && Number(m.cant) > 0);
        const masSum = mas.reduce((a, m) => a + Number(m.cant), 0);
        const blank = eq.salidas === null || eq.salidas === undefined || eq.salidas === '';
        const first = blank ? Math.max(0, np - masSum) : Math.min(np, Number(eq.salidas) || 0);
        const segs = [{ tipo: eq.tipo || '', cant: first }].concat(mas.map(m => ({ tipo: m.tipo, cant: Number(m.cant) })));
        const byPort = []; segs.forEach(sg => { for (let k = 0; k < sg.cant && byPort.length < np; k++) byPort.push(sg.tipo); });
        const used = byPort.length;
        const code = prefix + '-' + panelLetters(st.panelN);
        const tiposTxt = [...new Set(segs.filter(sg => sg.tipo && sg.cant > 0).map(sg => sg.tipo))].join('/');
        const P = { row, eq, code, np, used, tipo: tiposTxt, ports: [], labeled: 0, blocks: Math.ceil(np / 24) };
        for (let p = 1; p <= np; p++) {
          const ov = (room.portTipos || {})[eq.id + ':' + p] || '';
          const t = ov ? (ov === '-' ? '' : ov) : (byPort[p - 1] || '');
          let salida = '';
          if (t) {
            counters[t] = (counters[t] || 0) + 1;
            salida = t + '-' + pad(counters[t], 3);
            outletsByType[t] = (outletsByType[t] || 0) + 1;
            P.labeled++; outlets++;
          }
          P.ports.push({ n: p, ov, tipo: t, salida, label: code + '-' + pad(p, 2) });
        }
        ports += np;
        row.panel = P; panels.push(P);
      }
    });

    // Materiales propios del cuarto
    const orgv = ix.byId[room.orgVertId];
    const nOrg = orgv ? orgQty(room.orgVertUbic) * rackQty : 0;
    if (rack) add(rack.id, rackQty);
    if (orgv) add(orgv.id, nOrg);
    if (project.jackId && outlets > 0) add(project.jackId, outlets);
    (room.fuera || []).forEach(f => {
      const it = ix.byId[f.itemId];
      if (it && !NO_BOM.includes(ix.roleOf(it))) add(it.id, Number(f.cant) || 0);
    });

    // Vista del rack (de arriba hacia abajo)
    const elevation = [];
    let n = totalRU;
    while (n >= 1) {
      const r = rows.find(x => x.inf !== null && x.inf <= n && x.sup >= n);
      if (r) { const to = Math.max(r.inf, 1); elevation.push({ row: r, from: n, to }); n = to - 1; }
      else { elevation.push({ row: null, from: n, to: n }); n--; }
    }

    const ocupados = cum - libreRU;
    const poe = Number(room.poeW) || 0;
    const cargaUps = consumo + poe;

    // Tramos de canalización y cableado
    const reserva = 1 + (Number(project.reservaCable) || 0) / 100;
    const tramos = (room.tramos || []).map(t => {
      const canal = ix.byId[t.canalId], cable = ix.byId[t.cableId];
      const L = Number(t.longitud) || 0, nc = Number(t.ncables) || 0;
      return { t, canal, cable, L, nc, cableL: L * nc, cableLres: L * nc * reserva };
    });
    const canalPor = {}, cablePor = {};
    tramos.forEach(x => {
      if (x.canal) { const o = canalPor[x.canal.id] || (canalPor[x.canal.id] = { item: x.canal, tramos: 0, L: 0 }); o.tramos++; o.L += x.L; }
      if (x.cable && x.nc > 0) { const o = cablePor[x.cable.id] || (cablePor[x.cable.id] = { item: x.cable, cables: 0, L: 0, Lres: 0 }); o.cables += x.nc; o.L += x.cableL; o.Lres += x.cableLres; }
    });

    return {
      room, cuarto, prefix, rack, rackQty, totalRU, rows, panels, elevation, outlets, ports, outletsByType, bom,
      ocupados, libres: totalRU - ocupados, usoRU: cum, excede: cum > totalRU,
      pctRack: totalRU ? ocupados / totalRU : 0,
      pctPanel: ports ? outlets / ports : null,
      power: {
        consumo, poe, cargaUps, calorBTU: Math.round(consumo * 3.412), tr: consumo * 3.412 / 12000,
        peso, capSum, upsN, sinDato,
        pctUps: capSum ? cargaUps / capSum : null,
        pctUno: capMax ? cargaUps / capMax : null,
      },
      tramos, canalPor, cablePor,
    };
  }

  const newSt = () => ({ panelN: 0, counters: {} });
  /** Calcula un rack respetando la numeración de los demás racks de su cuarto. */
  function calcRoom(room, cat, project, ix) {
    ix = ix || index(cat);
    const st = newSt();
    const sib = room.cuartoId ? (project.niveles || []).filter(r => r.cuartoId === room.cuartoId) : [];
    if (sib.includes(room)) { for (const r of sib) { const c = calcRack(r, cat, project, ix, st); if (r === room) return c; } }
    return calcRack(room, cat, project, ix, st);
  }

  /** Salidas requeridas por cuarto y servicio (por cuarto, o sumando los niveles del edificio que atiende). */
  function demandaCuarto(project, cuarto) {
    const out = {};
    if (project.modoSalidas === 'nivel') {
      (project.nivelesEdificio || []).filter(n => n.cuartoId === cuarto.id).forEach(n => { for (const k in (n.salidas || {})) out[k] = (out[k] || 0) + (Number(n.salidas[k]) || 0); });
    } else for (const k in (cuarto.salidas || {})) out[k] = Number(cuarto.salidas[k]) || 0;
    return out;
  }
  const serviciosActivos = (project, cat) => (cat.tiposSalida || []).filter(t => t.codigo !== '-' && (project.servicios || {})[t.codigo] && project.servicios[t.codigo].activo);

  /** Demanda vs. oferta por cuarto y servicio (la oferta son los puertos etiquetados en los racks del cuarto). */
  function planning(project, cat, P) {
    const res = (Number(project.reservaPct) || 0) / 100;
    const act = serviciosActivos(project, cat);
    return (project.cuartos || []).map(c => {
      const dem = demandaCuarto(project, c), racks = P.rooms.filter(r => r.room.cuartoId === c.id);
      const rows = act.map(t => {
        const req = dem[t.codigo] || 0, reqRes = Math.ceil(req * (1 + res) - 1e-9);
        const prov = racks.reduce((a, r) => a + (r.outletsByType[t.codigo] || 0), 0);
        return { tipo: t, req, reqRes, prov, falta: Math.max(0, reqRes - prov) };
      }).filter(r => r.req || r.prov);
      return { cuarto: c, racks, rows, faltan: rows.reduce((a, r) => a + r.falta, 0) };
    });
  }

  /** Estimado de fibra troncal entre el cuarto principal y cada secundario (validar por el ingeniero). */
  function fibra(project, cat) {
    const cu = project.cuartos || [], pr = cu.find(c => c.tipo === 'principal');
    const lans = new Set(serviciosActivos(project, cat).map(t => project.servicios[t.codigo].lan || 1));
    const nLan = Math.max(1, lans.size), f = project.fibra || {};
    const enlaces = nLan * (f.redundante ? 2 : 1), base = enlaces * 2;
    let total = Math.ceil(base * (1 + (Number(f.reserva) || 0) / 100) - 1e-9); if (total % 2) total++;
    return cu.filter(c => c.tipo !== 'principal').map(c => {
      const d = Number(c.distancia) || 0;
      return { cuarto: c, principal: pr, distancia: d, enlaces, base, total, tipo: d ? (d > 300 ? 'OS2 monomodo' : 'OM4 multimodo') : '', falta: !d };
    });
  }

  function calcProject(project, cat) {
    const ix = index(cat);
    const sts = {};
    const rooms = (project.niveles || []).map(r => { const k = r.cuartoId || ('r' + r.id); return calcRack(r, cat, project, ix, sts[k] || (sts[k] = newSt())); });
    const out = { ix, rooms, outlets: {}, bom: {}, canal: {}, cable: {}, tot: { ocupados: 0, totalRU: 0, panels: 0, ports: 0, outlets: 0, consumo: 0, calor: 0, peso: 0 } };
    rooms.forEach(c => {
      const id = c.room.id;
      out.tot.ocupados += c.ocupados; out.tot.totalRU += c.totalRU * c.rackQty;
      out.tot.panels += c.panels.length; out.tot.ports += c.ports; out.tot.outlets += c.outlets;
      out.tot.consumo += c.power.consumo; out.tot.calor += c.power.calorBTU; out.tot.peso += c.power.peso;
      for (const t in c.outletsByType) out.outlets[t] = (out.outlets[t] || 0) + c.outletsByType[t];
      for (const k in c.bom) { const o = out.bom[k] || (out.bom[k] = { item: ix.byId[k], total: 0, per: {} }); o.total += c.bom[k]; o.per[id] = c.bom[k]; }
      for (const k in c.canalPor) { const o = out.canal[k] || (out.canal[k] = { item: c.canalPor[k].item, tramos: 0, L: 0, per: {} }); o.tramos += c.canalPor[k].tramos; o.L += c.canalPor[k].L; o.per[id] = c.canalPor[k].L; }
      for (const k in c.cablePor) { const o = out.cable[k] || (out.cable[k] = { item: c.cablePor[k].item, cables: 0, L: 0, Lres: 0, per: {} }); o.cables += c.cablePor[k].cables; o.L += c.cablePor[k].L; o.Lres += c.cablePor[k].Lres; o.per[id] = c.cablePor[k].Lres; }
    });
    const pieces = (L, it) => (it && it.largoPieza > 0 ? Math.ceil(L / it.largoPieza - 1e-9) : null);
    for (const k in out.canal) out.canal[k].piezas = pieces(out.canal[k].L, out.canal[k].item);
    for (const k in out.cable) out.cable[k].piezas = pieces(out.cable[k].Lres, out.cable[k].item);
    return out;
  }

  /** Bloques de 24 puertos por panel (formato de la hoja de etiquetado del Excel). */
  function portBlocks(C) {
    const out = [];
    C.panels.forEach(P => {
      for (let b = 0; b < P.blocks; b++) {
        const from = b * 24 + 1, to = Math.min(P.np, from + 23), ports = P.ports.slice(from - 1, to);
        const lab = ports.filter(o => o.tipo).length, tipos = [...new Set(ports.filter(o => o.tipo).map(o => o.tipo))].join('/');
        out.push({ P, from, to, ports, title: 'Panel ' + P.code + '  (puertos ' + from + '-' + to + ')' + (tipos ? '  · ' + tipos : '') + '  · ' + Math.round(ports.length ? lab / ports.length * 100 : 0) + ' %' });
      }
    });
    return out;
  }

  g.Calc = { index, calcRoom, calcProject, panelLetters, orgQty, portBlocks, demandaCuarto, serviciosActivos, planning, fibra };
})(typeof window !== 'undefined' ? window : globalThis);
