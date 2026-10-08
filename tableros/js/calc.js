/* Motor de cálculo (sin DOM). Replica las fórmulas de la hoja ANACAR (bloque "Machote") y agrega la cascada entre tableros:
   - la carga de un tablero derivado sube al circuito del tablero que lo alimenta,
   - el voltaje en bornes de un tablero es el punto de partida del alimentador de sus derivados (caída de voltaje acumulada),
   - la corriente de cortocircuito baja por cada alimentador (método punto a punto).
   Referencias a celdas del Excel entre corchetes: [AE16] = ampacidad requerida del circuito, [AW139] = voltaje en bornes, etc. */
(function (g) {
  'use strict';
  let K = null; // catálogo activo

  const n = v => (v === null || v === undefined || v === '' || isNaN(Number(v)) ? 0 : Number(v));
  const r2 = v => Math.round(v * 100) / 100;

  /* ---------- búsquedas en tablas (equivalentes a VLOOKUP/INDEX-MATCH del Excel) ---------- */
  /** VLOOKUP(x, tabla, , TRUE): fila con el mayor umbral <= x. */
  function approx(tabla, campo, x) {
    let res = null;
    for (const f of tabla) { if (Number(f[campo]) <= x) res = f; else break; }
    return res;
  }
  /** MATCH(TRUE, x <= umbrales, 0): primera fila con umbral >= x. */
  function firstGE(tabla, campo, x) { return tabla.find(f => Number(f[campo]) >= x) || null; }
  const calStr = c => (c === null || c === undefined ? '' : String(c));

  const esAL = m => m === 'AL' || m === 'AL-MC';
  const esMC = m => m === 'CU-MC' || m === 'AL-MC';

  /** Protección (breaker) estándar para una ampacidad requerida [CONDISEÑO L124:M154]. */
  const proteccion = amp => { const f = approx(K.protecciones, 'amp', amp); return f ? f.prot : null; };
  /** Calibre por ampacidad [CONDISEÑO C6:D26 CU / C44:D64 AL]. */
  const calibre = (amp, mat) => { const f = approx(esAL(mat) ? K.ampAL : K.ampCU, 'amp', amp); return f ? f.cal : ''; };
  /** Tierra de equipo, tabla 250.122 [CONDISEÑO L76:P98]. */
  const tierra = (prot, mat) => { const f = firstGE(K.tierras, 'amp', prot); return f ? (f[mat] || f.CU) : ''; };
  /** Conductor del electrodo, tabla 250.66 [CONDISEÑO U76:Z95]. */
  function electrodo(cal, mat) {
    const al = esAL(mat), f = K.electrodo.find(x => (al ? x.calAL : x.calCU) === calStr(cal));
    return f ? (f[mat] || (al ? f.AL : f.CU)) : '';
  }
  /** Diámetro de tubería, tabla C.10 [CONDISEÑO L101:O118]. Igual que el Excel: "XHHW-2" usa la columna THHN. */
  function conduit(cal, mat, ais) {
    if (esMC(mat)) return 'MC';
    const f = K.conduit.find(x => x.cal === calStr(cal)); if (!f) return '';
    return ais === 'RHW' ? f.RHW : ais === 'XHHW' ? f.XHHW : f.THHN;
  }
  /** FAC de caída de tensión por calibre y factor de potencia [CONDISEÑO H5:AC9 CU / H21:AC25 AL, conduit magnético]. */
  function fac(cal, mat, fp) {
    const t = K.fac[esAL(mat) ? 'AL_mag' : 'CU_mag'];
    const fila = fp === 1 ? '1' : fp > 0.949 ? '0.95' : fp > 0.899 ? '0.9' : fp > 0.799 ? '0.8' : null;
    if (!fila || !t[fila]) return null;
    const v = t[fila][calStr(cal)];
    return v === undefined ? null : v;
  }
  /** FAC ajustado [AT16]: L-N y L-L monofásicos. */
  function facAjustado(f, O, P, extra240x2) {
    if (f === null) return null;
    if (P === 1 && (O === 120 || O === 230 || O === 277)) return f * 1.1547;
    if (P === 1 && (O === 208 || O === 240)) return f * 1.15;
    if (extra240x2 && P === 2 && O === 240) return f * 1.15;
    return f;
  }
  /** Voltaje línea-neutro del sistema [AU126:AV134, XLOOKUP exacto o siguiente mayor]. */
  function vLN(V) {
    const t = K.listas.lnVoltaje.slice().sort((a, b) => a[0] - b[0]);
    const f = t.find(x => x[0] >= V); return f ? f[1] : V / 1.732;
  }
  /** Corriente por fase [AA16]: mismas condiciones que el Excel. U = kVA conectados en la fase, X = kVA demandados. */
  function corriente(U, X, O, P) {
    if (!O) return 0;
    if (O === 120 && P === 1) return X * 1000 / O;
    if (O === 208 && P === 1) return X * 1000 / O;
    if (O === 208 && P === 2) return U * 2 * 1000 / O;
    if (O === 230 && P === 1) return X * 1000 / O;
    if (O === 240 && P === 1) return X * 1000 / (O / 2);
    if (O === 277 && P === 1) return X * 1000 / O;
    return X * 1000 / (O / 1.732);
  }
  /** Corriente del alimentador [AA139]. */
  function corrienteAlim(X, O, P) {
    if (O === 120 && P === 1) return X * 1000 / O;
    if (O === 208 && P === 1) return X * 1000 / O;
    if (O === 240 && P === 2) return X * 1000 / (O / 2);
    if (O === 230 && P === 1) return X * 1000 / O;
    if (O === 240 && P === 1) return X * 1000 / (O / 2);
    if (O === 277 && P === 1) return X * 1000 / O;
    return X * 1000 / (O / 1.732);
  }
  /** Conductores en paralelo automáticos [AI17]. */
  const paralelosAuto = amp => (amp > 1600 ? 5 : amp > 1000 ? 4 : amp > 600 ? 3 : amp > 300 ? 2 : 1);

  /** Fase de un polo (funciones VBA POLA/POLB/POLC y POLD/POLE): 3F → A,B,C cada 2 polos; 1F → A,B. */
  function fasePolo(polo, fasesTablero) {
    const k = Math.floor((polo - 1) / 2);
    if (fasesTablero === 3) return k % 3;
    if (fasesTablero === 2) return k % 2;
    return 0;
  }

  /* ---------- catálogo: breakers, supresores, tableros ---------- */
  const rango = s => { const m = String(s || '').match(/(\d+)\s*-\s*(\d+)/); return m ? [Number(m[1]), Number(m[2])] : null; };
  function breaker(marca, id, polos, amp) {
    const lista = K.breakers.filter(b => b.marca === marca);
    if (id) return lista.find(b => String(b.id) === String(id)) || null;
    // automático: interruptor estándar con los polos correctos cuyo rango incluye la protección
    const ok = b => { const r = rango(b.amperios); return Number(b.polos) === Number(polos) && (!r || (amp >= r[0] && amp <= r[1])); };
    return lista.find(b => b.unidad === 'STD' && ok(b)) || lista.find(ok) || null;
  }
  const normV = s => String(s || '').split('/').map(Number).filter(x => x).sort((a, b) => a - b).join('/');
  function supresor(marca, id, sistema, fases) {
    const lista = K.supresores.filter(b => b.marca === marca);
    if (id) return lista.find(b => String(b.id) === String(id)) || null;
    const fs = fases === 3 ? 3 : 1;
    return lista.find(b => normV(b.voltaje) === normV(sistema) && Number(b.fases) === fs) || null;
  }
  function tableroCat(tab, prot, espaciosUsados) {
    if (tab.catalogoId) return K.tablerosCat.find(t => String(t.id) === String(tab.catalogoId)) || null;
    const marca = tab.marca || K.marcaDefecto || 'Eaton';
    return K.tablerosCat.filter(t => t.fabricante === marca && n(t.barraFase) >= n(prot) && n(t.espacios) >= espaciosUsados)
      .sort((a, b) => n(a.barraFase) - n(b.barraFase) || n(a.espacios) - n(b.espacios))[0] || null;
  }

  /* ---------- un circuito ramal (fila 16 a 115 del Machote) ---------- */
  function circuito(c, tab, ctx) {
    const det = K.detallesCarga.find(d => String(d.id) === String(c.detalleId)) || {};
    const O = n(det.v), P = n(det.fases), Q = n(det.hilos), R = n(det.fd) || 1, S = n(det.fdiv) || 1, T = n(det.fp) || 1;
    const N = ctx.fases, J = n(c.kva);
    const polos = (c.polos || []).map(Number).filter(x => x > 0);
    // [U16:W16] reparto por fases
    const fase = [0, 0, 0];
    if (J && P) {
      if (N === 1) fase[0] = J;
      else polos.forEach(p => { fase[fasePolo(p, N)] = J / P; });
    }
    const dem = fase.map(x => x * R / S);                                      // [X16:Z16]
    const I = fase.map((u, i) => corriente(u, dem[i], O, P));                // [AA16:AC16]
    const AD = c.mult !== undefined && c.mult !== '' && c.mult !== null ? n(c.mult) : (det.mult || 1.25);
    const AE = !J ? null : N === 3 ? Math.max(I[0], I[1], I[2]) * AD : (fase[0] > 0 ? I[0] * AD : fase[1] > 0 ? I[1] * AD : fase[2] > 0 ? I[2] * AD : null);
    const AF = n(c.prot) || (AE !== null ? proteccion(AE) : null);          // protección
    const mat = c.material || 'CU', ais = c.aislamiento || 'THHN';
    const AI = n(c.paralelos) || (AE !== null ? paralelosAuto(AE) : 1);
    const AJ = c.aumento !== undefined && c.aumento !== '' ? n(c.aumento) : 1;
    const AL = AF ? calibre(AF * AJ / AI, mat) : '';
    const pre = AI === 1 ? (P === 3 ? '3#' : (O >= 208 && O <= 240 ? '2#' : ' ')) : AI + 'x' + (P === 3 ? '3#' : (O >= 208 && O <= 240 ? '2#' : ' '));
    const pre2 = AI === 1 ? ' ' : AI + 'x';
    const AN = Q === 0 ? ' ' : (O >= 208 && P === 3 && Q === 4) ? AL : (P === 3 && Q === 3) ? ' ' : (O >= 208 && P === 1 && Q === 3) ? ' ' : AL;
    const AP = AF ? tierra(AF, mat) : '';
    const AR = AL ? conduit(AL, mat, ais) : '';
    const AS = AL ? fac(AL, mat, T) : null, AT = facAjustado(AS, O, P, false);
    const AU = !J ? null : (O === ctx.V ? ctx.vBus : ctx.vBusLN);             // voltaje real de partida
    const Iv = fase[0] > 0 ? I[0] : fase[1] > 0 ? I[1] : I[2];
    const AV = J && AT !== null ? n(c.longitud) * 3.28 * Iv * AT / (10000 * AI) : null;
    const AW = AV !== null ? AU - AV : null, AX = AW !== null ? O - AW : null, AY = AX !== null && O ? AX * 100 / O : null;
    const BE = P === 3 ? 3 : (O >= 208 && O <= 240 ? 2 : P || 1);
    const bk = J ? breaker(ctx.marca, c.breakerId, BE, AF) : null;
    const err = [];
    if (J && !det.id) err.push('Sin detalle de carga');
    if (J && !polos.length) err.push('Sin posición');
    if (AY !== null && AY > ctx.cvMaxTotal) err.push('Caída total ' + r2(AY) + ' % > ' + ctx.cvMaxTotal + ' %');
    if (bk && bk.sccr && ctx.iccKA && n(bk.sccr) < ctx.iccKA) err.push('SCCR ' + bk.sccr + ' kA < Icc ' + r2(ctx.iccKA) + ' kA');
    if (J && AF && !AL) err.push('Sin calibre para ' + AF + ' A');
    return {
      c, det, O, P, Q, R, S, T, L: det.tipo, J, polos, fase, dem, I, AD, AE, AF, AI, AJ, mat, ais, AL, AN, AP, AR, AS, AT, AU, AV, AW, AX, AY,
      fasesTxt: pre + AL, neutroTxt: (AN === ' ' ? '' : pre2.trim() + AN), tierraTxt: AP ? pre2.trim() + AP : '', tuboTxt: AR ? pre2.trim() + AR : '',
      descripcion: c.descripcion || det.descripcion || '', breaker: bk, polosBreaker: BE, err,
    };
  }

  /* ---------- un tablero completo ---------- */
  /** Calcula un tablero. ctx: { vInicio, iccInicioA } que vienen del tablero que lo alimenta (cascada). */
  function tablero(tab, P, ctxIn) {
    const fases = n(tab.fases) || 3, V = n(tab.voltaje) || 208, al = tab.alim || {};
    const vInicio = ctxIn && ctxIn.vInicio ? ctxIn.vInicio : V;               // [AU139] (en el Excel siempre = nominal)
    const marcaTab = tab.catalogoId ? ((K.tablerosCat.find(t => String(t.id) === String(tab.catalogoId)) || {}).fabricante) : (tab.marca || K.marcaDefecto || 'Eaton');

    // --- 1) cargas y fases, sin voltaje (para conocer el alimentador primero)
    const circs = (tab.circuitos || []).slice().sort((a, b) => (Math.min(...(a.polos || [999])) - Math.min(...(b.polos || [999]))));
    const pre = circs.map(c => circuito(c, tab, { fases, V, vBus: V, vBusLN: vLN(V), marca: marcaTab, cvMaxTotal: 999 }));
    const J116 = pre.reduce((a, x) => a + x.J, 0);
    const U116 = [0, 1, 2].map(i => pre.reduce((a, x) => a + x.fase[i], 0));
    const J117 = J116 / 3, U117 = U116.map(x => (J117 ? x / J117 : 0));
    const mx = fases === 3 ? Math.max(...U116) : fases === 2 ? Math.max(U116[0], U116[1]) : 0;
    const mn = fases === 3 ? Math.min(...U116) : fases === 2 ? Math.min(U116[0], U116[1]) : 0;
    const desbalance = mx ? r2((mx - mn) / mx * 100) : 0;                    // [U118]

    // --- 2) factores de demanda por tipo de carga [filas 123 a 134]
    const reserva = n(tab.reserva);
    const tipos = K.tiposCarga.map(t => {
      const cs = pre.filter(x => String(x.L) === String(t.id));
      const conectados = cs.reduce((a, x) => a + x.J, 0), res = conectados * reserva, total = conectados + res;
      const ov = (tab.fd || {})[t.id];
      let fd, demandados;
      const fdiv = n((tab.fdiv || {})[t.id]) || n(t.fdiv) || 1;
      if (ov !== undefined && ov !== '' && ov !== null) { fd = n(ov); demandados = total * fd / fdiv; }
      else if (t.metodo === 'tomas') { demandados = total > 10 ? (total - 10) * 0.5 + 10 : total; fd = total > 0 ? demandados / total : 1; }
      else if (t.metodo === 'cocina') { const nn = cs.length, f = (K.demanda22056 || []).filter(x => nn >= x.n).pop(); fd = f ? f.fd : 1; demandados = total * fd / fdiv; }
      else if (t.metodo === '220.53') { fd = cs.length >= 4 ? 0.75 : 1; demandados = total * fd / fdiv; }
      else { fd = n(t.fd) || 1; demandados = total * fd / fdiv; }
      return { tipo: t, conectados, reserva: res, total, fd, fdiv, demandados, n: cs.length };
    });
    const W128 = tipos.reduce((a, t) => a + t.conectados, 0), W129 = tipos.reduce((a, t) => a + t.reserva, 0);
    const W130 = W128 + W129, J134 = tipos.reduce((a, t) => a + t.demandados, 0);

    // --- 3) alimentador / acometida [fila 139]
    const R139 = W130 ? J134 / W130 : 1, S139 = n(tab.fdivTablero) || 1, L139 = W130 * R139 * S139, T139 = n(al.fp) || 0.9;
    const X139 = U117.map(u => L139 * u / 3);
    const AA139 = X139.map(x => (x > 0 ? corrienteAlim(x, V, fases) : 0));
    const AD139 = al.mult !== undefined && al.mult !== '' ? n(al.mult) : 1.25;
    const AE139 = W130 > 0 ? (fases === 3 ? Math.max(...AA139) * AD139 : (U116[0] > 0 ? AA139[0] : U116[1] > 0 ? AA139[1] : AA139[2]) * AD139) : null;
    const AF139 = n(al.prot) || (AE139 ? proteccion(AE139) : null);
    const mat = al.material || 'CU', ais = al.aislamiento || 'XHHW-2';
    const AI139 = n(al.paralelos) || (AE139 ? paralelosAuto(AE139) : 1), AJ139 = al.aumento !== undefined && al.aumento !== '' ? n(al.aumento) : 1;
    const AL139 = AF139 ? calibre(AF139 * AJ139 / AI139, mat) : '';
    const hilos = n(tab.hilos) || 4;
    const pre139 = AI139 === 1 ? (fases === 3 ? '3#' : (V >= 208 && V <= 240 ? '2#' : ' ')) : AI139 + 'x' + (fases === 3 ? '3#' : (V >= 208 && V <= 240 ? '2#' : ' '));
    const preN = AI139 === 1 ? '' : AI139 + 'x';
    const AN139 = hilos === 0 ? '' : (V >= 208 && fases === 3 && hilos === 4) ? AL139 : (fases === 3 && hilos === 3) ? '' : (V >= 208 && fases === 1 && hilos === 3) ? '' : AL139;
    const AP139 = AF139 ? tierra(AF139, mat) : '', AP140 = AL139 ? electrodo(AL139, mat) : '';
    const AR139 = AL139 ? conduit(AL139, mat, ais) : '', tuberia = al.tuberia || 'EMT';
    const AS139 = AL139 ? fac(AL139, mat, T139) : null, AT139 = facAjustado(AS139, V, fases, true);
    const Iv = U116[0] > 0 ? AA139[0] : U116[1] > 0 ? AA139[1] : AA139[2];
    const M139 = n(tab.longitud);
    const AV139 = AT139 !== null && W130 ? M139 * 3.28 * Iv * AT139 / (10000 * AI139) : 0;
    const AW139 = vInicio - AV139, AX139 = V - AW139, AY139 = AX139 * 100 / V;   // bornes, caída total acumulada
    const AU140 = vLN(V), AV140 = AV139 / (V === 240 ? 2 : 1.732), AW140 = AU140 - (V - vInicio) / (V === 240 ? 2 : 1.732) - AV140;

    // verificación de ampacidad del alimentador con factores de corrección [AA10:AJ10]
    const tempF = ((K.tempFactor || {})[al.tempAmb || '26-30'] || {})[String(al.tempBorne || 90)] || 1;
    const agrF = (K.agrupamiento || {})[al.agrupamiento || '4-6'] || 1;
    const ampReq = AE139 ? AE139 / (tempF * agrF) : 0;
    const fAmp = (K.ampacidad31016 || []).find(x => x.cal === calStr(AL139));
    const ampCond = fAmp ? n(fAmp[mat + '|' + (al.tempBorne || 90)]) * AI139 : null;

    // --- 4) cortocircuito (punto a punto) [AQ8:AQ10]
    let iccA = null, iccFuente = '';
    const lmax = n(P && P.iccLongMax) || 0;
    const cIcc = () => {
      const f = (K.constC || []).find(x => x.cal === calStr(AL139)); if (!f) return null;
      const aisC = /XHHW/.test(ais) ? 'XHHW-2' : /RHW/.test(ais) ? 'RHW' : /barra/i.test(ais) ? 'DUCTOBARRA' : 'THHN';
      return n(f[aisC + '|' + (aisC === 'DUCTOBARRA' ? 'DUCTOBARRA' : tuberia)]) || null;
    };
    const p2p = I0 => {
      const C = cIcc(); if (!C || !I0) return I0;
      const Lm = lmax ? Math.min(M139, lmax) : M139, k = fases === 3 ? 1.732 : 2;
      return I0 / (1 + (k * (Lm / 0.3048) * I0) / (C * AI139 * V));
    };
    if (n(tab.iccManual)) { iccA = n(tab.iccManual) * 1000; iccFuente = 'manual'; }
    else if (tab.transformadorId) {
      const tr = K.transformadores.find(t => String(t.id) === String(tab.transformadorId));
      const k = tr ? (V >= 440 ? tr.kacc480 : V >= 230 ? tr.kacc240 : tr.kacc208) : null;
      if (k) { iccA = p2p(n(k)); iccFuente = 'transformador'; }
    } else if (ctxIn && ctxIn.iccInicioA) { iccA = p2p(ctxIn.iccInicioA); iccFuente = 'cascada'; }
    const iccKA = iccA ? iccA / 1000 : null;

    // --- 5) circuitos con el voltaje real del tablero y el Icc
    const espaciosUsados = Math.max(0, ...circs.map(c => Math.max(0, ...(c.polos || []).map(Number))));
    const cat = tableroCat(tab, AF139, espaciosUsados);
    const marca = cat ? cat.fabricante : marcaTab;
    const cvMaxTotal = n(P && P.cvMaxTotal) || 5;
    const rows = circs.map(c => circuito(c, tab, { fases, V, vBus: AW139, vBusLN: AW140, marca, cvMaxTotal, iccKA }));

    const polosBk = fases === 3 ? 3 : (V >= 208 && V <= 240 ? 2 : fases);
    const bkMain = breaker(marca, al.breakerId, polosBk, AF139);
    const spd = tab.sinSupresor ? null : supresor(marca, tab.supresorId, tab.sistema, fases);

    const avisos = [];
    if (AY139 > n(P && P.cvMaxAlim || 3)) avisos.push('Caída acumulada en bornes ' + r2(AY139) + ' % (máx. ' + n(P && P.cvMaxAlim || 3) + ' %)');
    if (ampCond !== null && AE139 && ampCond < ampReq) avisos.push('Ampacidad corregida del alimentador ' + r2(ampCond) + ' A < requerida ' + r2(ampReq) + ' A');
    if (cat && espaciosUsados > n(cat.espacios)) avisos.push('Circuitos usan ' + espaciosUsados + ' espacios; el tablero tiene ' + cat.espacios);
    if (!cat) avisos.push('No hay tablero de catálogo para ' + (AF139 || '?') + ' A y ' + espaciosUsados + ' espacios');
    if (bkMain && bkMain.sccr && iccKA && n(bkMain.sccr) < iccKA) avisos.push('SCCR del interruptor principal ' + bkMain.sccr + ' kA < Icc ' + r2(iccKA) + ' kA');
    const ocupados = {};
    rows.forEach(x => x.polos.forEach(p => { (ocupados[p] = ocupados[p] || []).push(x); }));
    Object.keys(ocupados).forEach(p => { if (ocupados[p].length > 1) avisos.push('Posición ' + p + ' repetida (' + ocupados[p].map(x => x.descripcion || '?').join(' / ') + ')'); });
    if (desbalance > n(P && P.desbalanceMax || 10) && J116) avisos.push('Desbalance ' + desbalance + ' % (máx. ' + n(P && P.desbalanceMax || 10) + ' %)');

    return {
      tab, nombre: nombreTablero(tab), fases, V, hilos, rows, J116, U116, U117, desbalance, tipos, W128, W129, W130, J134,
      alim: { R139, S139, L139, T139, X139, AA139, AD139, AE139, AF139, mat, ais, AI139, AJ139, AL139, AN139, AP139, AP140, AR139, tuberia, AS139, AT139,
        M139, vInicio, AV139, AW139, AX139, AY139, AU140, AV140, AW140, tempF, agrF, ampReq, ampCond,
        fasesTxt: pre139 + AL139, neutroTxt: AN139 ? preN + AN139 : '', tierraTxt: AP139 ? preN + AP139 : '', tuboTxt: AR139 ? preN + AR139 : '', preN, preF: pre139.trim() },
      iccA, iccKA, iccFuente, cat, marca, bkMain, spd, espaciosUsados, avisos,
    };
  }

  const nombreTablero = t => ((t.prefijo === undefined ? 'TABLERO' : t.prefijo) + ' ' + (t.nombre || '')).trim();

  /* ---------- proyecto completo (cascada) ---------- */
  function proyecto(P, catalog) {
    K = Object.assign({}, catalog, { marcaDefecto: P.marcaDefecto || 'Eaton' });
    const tabs = P.tableros || [], byId = {}; tabs.forEach(t => { byId[t.id] = t; });
    const hijos = {}; tabs.forEach(t => { if (t.padreId && byId[t.padreId]) (hijos[t.padreId] = hijos[t.padreId] || []).push(t); });
    // ciclos: un tablero no puede alimentarse de sí mismo ni de sus derivados
    const ciclo = new Set();
    tabs.forEach(t => { const seen = new Set(); let x = t; while (x && x.padreId) { if (seen.has(x.id)) { ciclo.add(t.id); break; } seen.add(x.id); x = byId[x.padreId]; } });
    const raiz = t => !t.padreId || !byId[t.padreId] || ciclo.has(t.id);

    // kVA de los tableros derivados hacia el circuito que los alimenta (de abajo hacia arriba)
    const total = {}, visit = new Set();
    function cargar(t) {
      if (visit.has(t.id)) return total[t.id] || 0; visit.add(t.id);
      (hijos[t.id] || []).forEach(cargar);
      (t.circuitos || []).forEach(c => {
        const hj = c.tableroHijoId && byId[c.tableroHijoId];
        if (hj && !ciclo.has(hj.id)) { c.kva = r4(total[hj.id] || 0); c.longitud = hj.longitud; c.descripcion = nombreTablero(hj); }
      });
      total[t.id] = tablero(t, P, null).W130;
      return total[t.id];
    }
    tabs.forEach(cargar);

    // voltaje y cortocircuito de arriba hacia abajo
    const res = {}, orden = [];
    function bajar(t, ctx, nivel) {
      const r = tablero(t, P, ctx); r.nivel = nivel; r.padre = ctx && ctx.padre; res[t.id] = r; orden.push(r);
      (hijos[t.id] || []).filter(h => !ciclo.has(h.id)).forEach(h => {
        const mismoV = n(h.voltaje) === r.V;
        bajar(h, { vInicio: mismoV ? r.alim.AW139 : null, iccInicioA: mismoV ? r.iccA : null, padre: r }, nivel + 1);
      });
    }
    tabs.filter(raiz).forEach(t => bajar(t, null, 0));
    orden.forEach(r => {
      r.alimentadoDesde = r.padre ? r.padre.nombre : (r.tab.conectadoA || '');
      r.circuitoPadre = r.padre ? (r.padre.rows.find(x => x.c.tableroHijoId === r.tab.id) || null) : null;
      if (r.padre && !r.circuitoPadre) r.avisos.push('El tablero ' + r.padre.nombre + ' no tiene un circuito asignado a este tablero');
      if (r.padre && n(r.tab.voltaje) !== r.padre.V) r.avisos.push('Voltaje distinto al de ' + r.padre.nombre + ': la caída y el Icc se reinician (transformador)');
      if (ciclo.has(r.tab.id)) r.avisos.push('Alimentación circular: revise "Alimentado desde"');
    });
    return { res, orden, byId, hijos };
  }
  const r4 = v => Math.round(v * 10000) / 10000;

  /* ---------- sugerencia de balanceo (hoja BALANCEO) ---------- */
  /** Propone intercambios de posición entre circuitos con el mismo número de polos y movimientos a espacios libres. */
  function balanceo(tab, catalog, maxMov) {
    K = catalog;
    const fases = n(tab.fases) || 3; if (fases === 1) return { movs: [], antes: 0, despues: 0 };
    const espacios = Math.max(n(tab.espacios) || 0, ...(tab.circuitos || []).map(c => Math.max(0, ...(c.polos || []).map(Number))));
    let cs = (tab.circuitos || []).map(c => ({ c, polos: (c.polos || []).map(Number), carga: circuito(c, tab, { fases, V: n(tab.voltaje), vBus: 0, vBusLN: 0, marca: '', cvMaxTotal: 999 }) }));
    const carga = arr => { const f = [0, 0, 0]; arr.forEach(x => x.polos.forEach(p => { f[fasePolo(p, fases)] += x.carga.J / (x.carga.P || 1); })); return f; };
    const des = f => { const v = fases === 3 ? f : f.slice(0, 2); const mx = Math.max(...v); return mx ? (mx - Math.min(...v)) / mx * 100 : 0; };
    const antes = des(carga(cs)); const movs = [];
    for (let it = 0; it < (maxMov || 10); it++) {
      const actual = des(carga(cs)); let best = null;
      const usados = new Set(); cs.forEach(x => x.polos.forEach(p => usados.add(p)));
      for (let i = 0; i < cs.length; i++) {
        if (!cs[i].carga.J) continue;
        for (let j = i + 1; j < cs.length; j++) {
          if (cs[j].polos.length !== cs[i].polos.length) continue;
          const prueba = cs.map((x, k) => (k === i ? { ...x, polos: cs[j].polos } : k === j ? { ...x, polos: cs[i].polos } : x));
          const d = des(carga(prueba)); if (d < actual - 0.01 && (!best || d < best.d)) best = { d, prueba, txt: 'Intercambiar [' + cs[i].polos.join(',') + '] ' + (cs[i].carga.descripcion || '') + ' ↔ [' + cs[j].polos.join(',') + '] ' + (cs[j].carga.descripcion || '') };
        }
        if (cs[i].polos.length === 1 && espacios) for (let p = 1; p <= espacios; p++) {
          if (usados.has(p)) continue;
          const prueba = cs.map((x, k) => (k === i ? { ...x, polos: [p] } : x));
          const d = des(carga(prueba)); if (d < actual - 0.01 && (!best || d < best.d)) best = { d, prueba, txt: 'Mover [' + cs[i].polos[0] + '] ' + (cs[i].carga.descripcion || '') + ' → posición libre ' + p };
        }
      }
      if (!best) break;
      cs = best.prueba; movs.push({ txt: best.txt, d: r2(best.d) });
    }
    return { movs, antes: r2(antes), despues: r2(des(carga(cs))), resultado: cs.map(x => ({ id: x.c.id, polos: x.polos })) };
  }

  /* ---------- importación de Revit: elegir detalle de carga ---------- */
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const CLAVES = [
    [/ilum|lumin|luz|luces|lamp/, 'ilum'], [/ups/, 'ups'], [/toma|tc\b|recept|enchuf|cortiner/, 'toma'], [/ascensor|elevador/, 'elevador'],
    [/cocina|horno|estufa|cocin|plantilla/, 'cocina'], [/extract/, 'extractor'], [/inyect/, 'inyector'], [/bomba/, 'bomba'],
    [/calentador|tanque agua|termo/, 'calentador'], [/aire|a\/?c|minisplit|split|fan ?coil|condensad|cu-|ah-|ms-|unidad/, 'clima'],
    [/tablero|panel/, 'tablero'], [/secaman/, 'secamanos'], [/cargador/, 'cargador'], [/porton/, 'porton'], [/refri/, 'refrigerador'],
  ];
  function detalleRevit(nombre, voltaje, polos, catalog) {
    K = catalog || K;
    const v = n(voltaje), p = n(polos) || 1, nm = norm(nombre);
    const cand = K.detallesCarga.filter(d => n(d.v) === v && n(d.fases) === p);
    const pool = cand.length ? cand : K.detallesCarga.filter(d => n(d.fases) === p);
    const clave = (CLAVES.find(([re]) => re.test(nm)) || [])[1];
    let best = null, bestS = -1;
    pool.forEach(d => {
      const dn = norm(d.descripcion); let s = 0;
      if (clave && (CLAVES.find(([re, k]) => k === clave && re.test(dn)))) s += 5;
      nm.split(/[^a-z0-9]+/).filter(w => w.length > 3).forEach(w => { if (dn.includes(w)) s += 2; });
      if (n(d.v) === v) s += 1;
      if (s > bestS) { bestS = s; best = d; }
    });
    return { detalle: best, seguro: !!cand.length && bestS >= 5 };
  }

  g.Calc = { proyecto, tablero, circuito, balanceo, detalleRevit, fasePolo, nombreTablero, vLN, setCatalog: c => { K = c; } };
})(typeof window !== 'undefined' ? window : globalThis);
