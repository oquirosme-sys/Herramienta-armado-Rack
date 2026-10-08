/* Armado automático de racks y gabinetes a partir de las salidas por servicio, las redes LAN y la fibra troncal.
   Genera filas marcadas como "auto" (el ingeniero las revisa, las cambia o las fija); las filas manuales no se tocan.
   Reglas (editables aquí): patch panel de 48 o 24 puertos por bloque de salidas, un switch por panel (PoE si algún
   servicio del panel es PoE), organizador horizontal, bandeja de fibra según las fibras troncales, tapas ciegas en
   los RU libres, UPS por carga y energía/tierra según el tipo de rack (horizontal en rack, vertical en gabinete). */
(function (g) {
  'use strict';
  const POE_W = 12;            // W promedio por dispositivo PoE (supuesto de planificación)
  const UPS_MAX = 0.8;         // no pasar del 80 % de la capacidad del UPS
  const MONTAJE = { 'Rack': 'piso', 'Gabinete': 'gabinete', 'Rack de pared': 'pared', 'Gabinete de pared': 'pared' };

  function picks(cat) {
    const P = p => cat.items.find(i => i.parte === p), D = f => cat.items.find(i => i.descripcion.includes(f));
    return {
      pp48: P('CPPA48FMWBLY'), pp24: P('CPPA24FMWBLY'), orgH: P('WMPH2E'),
      sw: { '48P': P('C9200L-48P-4G'), '24P': P('C9200L-24P-4G'), '48T': P('C9200L-48T-4G'), '24T': P('C9200L-24T-4G') },
      f12: D('FMD1 + FAP12'), f96: P('FCE1U'), f192: P('FCE2U'), f288: P('FCE4U'), ice: D('fibra del proveedor'),
      pduH12: D('PDU horizontal 1RU 12 tomas'), pduH8: D('PDU horizontal 1RU 8 tomas'), pduV: D('PDU vertical 0U'), gndH: P('RGRB19Y'), gndV: D('Barra de tierra vertical'),
      ups3k: D('SMT3000RM2U'), ups15: D('UPS rack 2RU 1500 VA'), tapa: P('TLBP1S-V'),
      rackGab: P('XGL84212B'), rackPared: P('PZWMC12W'), rackPiso: P('R2P'),
    };
  }
  const row = (it, extra) => Object.assign({ id: U.uid(), itemId: it ? it.id : '', tipo: '', salidas: null, notas: '', auto: true }, extra || {});

  function run(project, cat) {
    const K = picks(cat), ix = Calc.index(cat), res = (Number(project.reservaPct) || 0) / 100;
    const act = Calc.serviciosActivos(project, cat), fib = Calc.fibra(project, cat);
    const lanName = id => ((project.lans || []).find(l => l.id === id) || {}).nombre || 'LAN ' + id;
    const report = [];
    const ruOf = r => { const it = ix.byId[r.itemId]; return it && it.ru > 0 ? it.ru : 0; };

    project.cuartos.forEach(c => {
      const R = { cuarto: c.codigo, nuevosRacks: 0, paneles: 0, switches: 0, puertos: 0, fibras: 0, ups: 0, avisos: [] };
      report.push(R);
      const dem = Calc.demandaCuarto(project, c);
      const services = act.filter(t => (dem[t.codigo] || 0) > 0);

      /* 1) bloques: patch panel + switch + organizador */
      const byLan = {}; services.forEach(t => { const l = project.servicios[t.codigo].lan || 1; (byLan[l] = byLan[l] || []).push(t); });
      const blocks = [];
      Object.keys(byLan).map(Number).sort((a, b) => a - b).forEach(lan => {
        const q = byLan[lan].map(t => ({ tipo: t.codigo, n: Math.ceil(dem[t.codigo] * (1 + res) - 1e-9), poe: !!project.servicios[t.codigo].poe }));
        let total = q.reduce((a, s) => a + s.n, 0);
        while (total > 0) {
          const cap = total > 24 ? 48 : 24, take = Math.min(cap, total); total -= take;
          const segs = []; let need = take;
          while (need > 0) { const s = q[0], m = Math.min(s.n, need); segs.push({ tipo: s.tipo, n: m, poe: s.poe }); s.n -= m; need -= m; if (s.n === 0) q.shift(); }
          const poe = segs.some(s => s.poe), pp = cap === 48 ? K.pp48 : K.pp24, sw = K.sw[(take > 24 ? '48' : '24') + (poe ? 'P' : 'T')];
          if (!pp || !sw || !K.orgH) { R.avisos.push('Faltan piezas en el catálogo para armar los patch panels / switches (revise Administración ▸ Catálogo).'); continue; }
          const first = segs[0];
          const ppRow = row(pp, { tipo: first.tipo, salidas: (segs.length === 1 && first.n === cap) ? null : first.n, mas: segs.slice(1).map(s => ({ tipo: s.tipo, cant: s.n })), notas: lanName(lan) });
          const rows = [ppRow, row(sw, { notas: lanName(lan) + (poe ? ' · PoE' : '') }), row(K.orgH, { notas: 'Organizador' })];
          blocks.push({ rows, ru: rows.reduce((a, r) => a + ruOf(r), 0), poePorts: segs.filter(s => s.poe).reduce((a, s) => a + s.n, 0) });
          R.paneles++; R.switches++; R.puertos += take;
        }
      });

      /* 2) fibra troncal de este cuarto */
      let fibras = 0;
      if (c.tipo === 'principal') fibras = fib.reduce((a, f) => a + f.total, 0) + 12;
      else { const f = fib.find(x => x.cuarto === c); fibras = f ? f.total : 0; }
      const head = [];
      if (fibras > 0) {
        R.fibras = fibras;
        if (fibras <= 12 && K.f12) head.push(row(K.f12, { notas: c.tipo === 'principal' ? 'Fibra del proveedor y troncal' : 'Fibra troncal al cuarto principal' }));
        else if (fibras <= 96 && K.f96) head.push(row(K.f96, { notas: fibras + ' fibras' }));
        else if (fibras <= 192 && K.f192) head.push(row(K.f192, { notas: fibras + ' fibras' }));
        else if (K.f288) for (let k = 0; k < Math.ceil(fibras / 288); k++) head.push(row(K.f288, { notas: fibras + ' fibras en total' }));
        else R.avisos.push('Faltan bandejas de fibra en el catálogo.');
      }
      if (c.tipo === 'principal' && K.ice) head.push(row(K.ice, { notas: 'Reserva para la fibra del proveedor de servicio' }));

      if (!blocks.length && !head.length) { R.avisos.push('Sin salidas ni fibra: no se armó ningún rack.'); return; }

      /* 3) racks del cuarto (se crean si no hay o si no alcanzan) */
      const racks = project.niveles.filter(r => r.cuartoId === c.id);
      const needRU = head.reduce((a, r) => a + ruOf(r), 0) + blocks.reduce((a, b) => a + b.ru, 0) + 4;
      const newRack = (like) => {
        const it = like ? ix.byId[like.rackId] : (needRU <= 9 ? K.rackPared : K.rackGab);
        if (!it) { R.avisos.push('Falta el rack o gabinete base en el catálogo.'); return null; }
        const mont = MONTAJE[it.categoria] || 'gabinete';
        const room = Store.addRoom(Store.nextRackCode(c.id), '', 'vacio:' + mont, c.id);
        room.rackId = it.id; room.orgVertUbic = mont === 'piso' ? 'Ambos lados' : 'Sin organizador'; if (like) { room.orgVertId = like.orgVertId; room.orgVertUbic = like.orgVertUbic; }
        R.nuevosRacks++; racks.push(room); return room;
      };
      if (!racks.length && !newRack(null)) return;
      racks.forEach(r => { r.equipos = (r.equipos || []).filter(e => !e.auto); r.fuera = (r.fuera || []).filter(f => !f.auto); r.poeW = null; });

      const st = racks.map(r => {
        const it = ix.byId[r.rackId], mont = MONTAJE[it ? it.categoria : ''] || 'gabinete';
        return { r, mont, cap: it && it.ru > 0 ? it.ru : 45, used: r.equipos.reduce((a, e) => a + ruOf(e), 0), reserve: mont === 'gabinete' ? 2 : 4, auto: [], poe: 0 };
      });
      const place = (rows, ru, poe, first) => {
        let s = st.find(x => x.used + ru <= x.cap - x.reserve);
        if (!s) { const nr = newRack(st[st.length - 1].r); if (!nr) return false; s = { r: nr, mont: st[st.length - 1].mont, cap: st[st.length - 1].cap, used: 0, reserve: st[st.length - 1].reserve, auto: [], poe: 0 }; st.push(s); }
        s.auto.push(...rows); s.used += ru; s.poe += poe; return true;
      };
      if (head.length) { const s0 = st[0]; s0.auto.push(...head); s0.used += head.reduce((a, r) => a + ruOf(r), 0); }
      blocks.forEach(b => place(b.rows, b.ru, b.poePorts));

      /* 4) por rack: UPS, energía, tierra y tapas ciegas */
      st.forEach(s => {
        const r = s.r;
        r.equipos = s.auto.concat(r.equipos);
        r.poeW = s.poe ? s.poe * POE_W : null;
        const ups = s.mont === 'pared' ? K.ups15 : K.ups3k;
        const load = Calc.calcRoom(r, cat, project, ix).power.cargaUps;
        const tail = [];
        if (load > 0 && ups && ups.capacidad) { const n = Math.max(1, Math.ceil(load / (UPS_MAX * ups.capacidad))); for (let k = 0; k < n; k++) tail.push(row(ups, { notas: Math.round(load) + ' W estimados' })); R.ups += n; }
        else if (load > 0) R.avisos.push('Falta el UPS en el catálogo.');
        if (s.mont === 'gabinete') {
          if (K.pduV) r.fuera.push({ id: U.uid(), itemId: K.pduV.id, cant: 2, notas: 'Vertical, a los lados del gabinete', auto: true });
          if (K.gndV) r.fuera.push({ id: U.uid(), itemId: K.gndV.id, cant: 1, notas: 'Vertical', auto: true });
        } else {
          const pdu = s.mont === 'pared' ? K.pduH8 : K.pduH12;
          if (pdu) tail.push(row(pdu, { notas: 'Energía' })); if (K.gndH) tail.push(row(K.gndH, { notas: 'Barra de tierra' }));
        }
        const cap = s.cap, usedAll = r.equipos.reduce((a, e) => a + ruOf(e), 0) + tail.reduce((a, e) => a + ruOf(e), 0);
        const libre = cap - usedAll;
        if (libre < 0) R.avisos.push('El rack ' + r.codigo + ' excede su capacidad en ' + (-libre) + ' RU: elija un rack mayor o agregue otro.');
        const tapas = []; if (K.tapa) for (let k = 0; k < Math.max(0, libre); k++) tapas.push(row(K.tapa, {}));
        r.equipos = r.equipos.concat(tapas, tail);
      });
    });
    Store.save();
    return report;
  }

  g.Armado = { run, POE_W };
})(window);
