/* Diagrama de conexión entre cuartos y racks / gabinetes (SVG autocontenido).
   Se usa en la Memoria de cálculo y se incrusta como imagen en los resúmenes de Word y Excel. */
(function (g) {
  'use strict';
  const LANC = ['#1f77b4', '#d62728', '#2ca02c', '#ff7f0e'];
  const MONT = { piso: 'Rack de piso', gabinete: 'Gabinete', pared: 'Pared' };
  const FILL = { piso: '#e8f0fe', gabinete: '#e6f4ea', pared: '#fff4e0' };
  const esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const trunc = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s));
  const FONT = 'font-family="Arial, Helvetica, sans-serif"';
  const txt = (x, y, t, o) => { o = o || {}; return '<text x="' + x + '" y="' + y + '" ' + FONT + ' font-size="' + (o.sz || 11) + '" text-anchor="' + (o.al || 'middle') + '"' + (o.b ? ' font-weight="bold"' : '') + ' fill="' + (o.c || '#1d2733') + '">' + esc(t) + '</text>'; };

  function build(project, cat, P) {
    const cuartos = project.cuartos || [];
    if (!cuartos.length) return null;
    P = P || Calc.calcProject(project, cat);
    const principal = cuartos.find(c => c.tipo === 'principal') || cuartos[0];
    const sec = cuartos.filter(c => c !== principal);
    const act = Calc.serviciosActivos(project, cat);
    const lanIds = [...new Set(act.map(t => project.servicios[t.codigo].lan || 1))].sort((a, b) => a - b);
    const lanName = id => ((project.lans || []).find(l => l.id === id) || {}).nombre || 'LAN ' + id;
    const fib = {}; Calc.fibra(project, cat).forEach(f => { fib[f.cuarto.id] = f; });

    const RW = 156, RH = 62, PAD = 12, TITLE = 36, GAP = 36;
    const box = c => {
      const racks = P.rooms.filter(r => r.room.cuartoId === c.id), per = Math.min(3, Math.max(1, racks.length)), rows = Math.max(1, Math.ceil(racks.length / per));
      const w = Math.max(290, per * (RW + PAD) + PAD), bus = racks.length > 1 ? 18 : 0;
      const out = {}; racks.forEach(r => { for (const k in r.outletsByType) out[k] = (out[k] || 0) + r.outletsByType[k]; });
      const tot = Object.values(out).reduce((a, b) => a + b, 0);
      return { c, racks, per, rows, w, h: TITLE + bus + rows * (RH + PAD) + PAD + 30, bus, out, tot };
    };
    const bp = box(principal), bs = sec.map(box);
    const secW = bs.reduce((a, b) => a + b.w, 0) + Math.max(0, bs.length - 1) * GAP;
    const W = Math.max(bp.w, secW) + 60;
    const yProv = 14, hProv = 34, yP = 100, yS = yP + bp.h + 40 + 120;
    bp.x = (W - bp.w) / 2; bp.y = yP;
    let x = (W - secW) / 2; bs.forEach(b => { b.x = x; b.y = yS; x += b.w + GAP; });
    const sH = bs.length ? Math.max(...bs.map(b => b.h)) : 0;
    const bottom = (bs.length ? yS + sH : yP + bp.h) + 22;
    const H = bottom + 28 + 6;
    const s = [];

    // proveedor de servicio -> principal
    s.push('<rect x="' + (W / 2 - 110) + '" y="' + yProv + '" width="220" height="' + hProv + '" rx="17" fill="#f3f3f3" stroke="#888" stroke-dasharray="4 3"/>' + txt(W / 2, yProv + 21, 'Acometida / proveedor de servicio', { sz: 11 }));
    s.push('<line x1="' + W / 2 + '" y1="' + (yProv + hProv) + '" x2="' + W / 2 + '" y2="' + yP + '" stroke="#888" stroke-width="2" stroke-dasharray="5 4"/>');

    const drawCuarto = (b, principalo) => {
      const c = b.c;
      s.push('<rect x="' + b.x + '" y="' + b.y + '" width="' + b.w + '" height="' + b.h + '" rx="10" fill="#ffffff" stroke="' + (principalo ? '#0b5cab' : '#4a5a6a') + '" stroke-width="' + (principalo ? 2.5 : 1.6) + '"/>');
      s.push('<rect x="' + b.x + '" y="' + b.y + '" width="' + b.w + '" height="' + TITLE + '" rx="10" fill="' + (principalo ? '#0b5cab' : '#4a5a6a') + '"/><rect x="' + b.x + '" y="' + (b.y + 14) + '" width="' + b.w + '" height="' + (TITLE - 14) + '" fill="' + (principalo ? '#0b5cab' : '#4a5a6a') + '"/>');
      s.push(txt(b.x + b.w / 2, b.y + 15, 'Cuarto ' + c.codigo + (principalo ? ' — PRINCIPAL' : ' — secundario'), { c: '#fff', b: true, sz: 12 }));
      s.push(txt(b.x + b.w / 2, b.y + 29, trunc(c.nombre || '', 34), { c: '#e8eef6', sz: 10 }));
      const y0 = b.y + TITLE + b.bus + PAD / 2;
      if (b.racks.length > 1) {
        const yb = b.y + TITLE + 9;
        s.push('<line x1="' + (b.x + 20) + '" y1="' + yb + '" x2="' + (b.x + b.w - 20) + '" y2="' + yb + '" stroke="#777" stroke-width="2"/>');
        s.push(txt(b.x + b.w - 22, yb - 2, 'interconexión entre racks', { al: 'end', sz: 8, c: '#666' }));
      }
      if (!b.racks.length) s.push(txt(b.x + b.w / 2, b.y + TITLE + 28, 'Sin racks asignados', { c: '#a33', sz: 11 }));
      b.racks.forEach((r, i) => {
        const col = i % b.per, row = Math.floor(i / b.per);
        const rx = b.x + PAD + col * (RW + PAD) + (b.w - (b.per * (RW + PAD) + PAD)) / 2, ry = y0 + row * (RH + PAD);
        if (b.racks.length > 1) s.push('<line x1="' + (rx + RW / 2) + '" y1="' + (b.y + TITLE + 9) + '" x2="' + (rx + RW / 2) + '" y2="' + ry + '" stroke="#777" stroke-width="1.6"/>');
        s.push('<rect x="' + rx + '" y="' + ry + '" width="' + RW + '" height="' + RH + '" rx="6" fill="' + (FILL[r.room.montaje] || '#f4f4f4') + '" stroke="#4a5a6a"/>');
        s.push(txt(rx + RW / 2, ry + 16, trunc(r.room.codigo, 22), { b: true, sz: 12 }));
        s.push(txt(rx + RW / 2, ry + 30, (MONT[r.room.montaje] || '') + ' · ' + r.totalRU + ' RU', { sz: 10, c: '#333' }));
        s.push(txt(rx + RW / 2, ry + 43, r.ocupados + ' RU usados (' + Math.round(r.pctRack * 100) + ' %)', { sz: 9.5, c: '#333' }));
        s.push(txt(rx + RW / 2, ry + 56, r.panels.length + ' patch panel · ' + r.outlets + ' salidas', { sz: 9.5, c: '#333' }));
      });
      // salidas a los puestos de trabajo (pie del cuarto)
      const items = Object.keys(b.out).map(k => k + ' ' + b.out[k]).join('  ·  '), yf = b.y + b.h - 26;
      s.push('<line x1="' + (b.x + 10) + '" y1="' + yf + '" x2="' + (b.x + b.w - 10) + '" y2="' + yf + '" stroke="#ddd"/>');
      s.push(txt(b.x + b.w / 2, yf + 17, 'Salidas → puestos de trabajo: ' + (items ? trunc(items, 40) + '  =  ' : '') + b.tot, { sz: 10, b: true, c: '#5a4a00' }));
    };
    drawCuarto(bp, true);
    bs.forEach(b => drawCuarto(b, false));

    // fibra troncal: una línea por red LAN, en paralelo
    const yStart = yP + bp.h, yEnd = yS;
    bs.forEach((b, i) => {
      const f = fib[b.c.id], n = lanIds.length || 1, sx = b.x + b.w / 2;
      lanIds.forEach((id, k) => {
        const off = (k - (n - 1) / 2) * 9, col = LANC[(id - 1) % LANC.length];
        const px = bp.x + bp.w / 2 + off + (i - (bs.length - 1) / 2) * 0, midY = yStart + 40 + (i % 2) * 18 + k * 5;
        // sale del borde inferior del principal, evitando el cuadro de salidas (a un costado)
        const startX = bp.x + 30 + ((bp.w - 60) * (bs.length === 1 ? 0.5 : i / (bs.length - 1))) + off;
        s.push('<path d="M' + startX + ' ' + yStart + ' V' + midY + ' H' + (sx + off) + ' V' + yEnd + '" fill="none" stroke="' + col + '" stroke-width="2.4"/>');
      });
      const lbl = f && f.distancia ? f.total + ' fibras ' + (f.tipo || '') + ' · ' + f.distancia + ' m' : (f ? f.total + ' fibras · falta distancia' : '');
      const lx = sx, ly = yEnd - 12;
      s.push('<rect x="' + (lx - 92) + '" y="' + (ly - 14) + '" width="184" height="18" rx="4" fill="#fff" stroke="#bbb"/>' + txt(lx, ly - 1, lbl, { sz: 10, b: true }));
    });

    // leyenda
    let ly = bottom + 8, lx = 24;
    s.push(txt(lx, ly + 10, 'Redes LAN (fibra troncal):', { al: 'start', sz: 10, b: true }));
    lx += 150;
    lanIds.forEach(id => { const col = LANC[(id - 1) % LANC.length]; s.push('<line x1="' + lx + '" y1="' + (ly + 6) + '" x2="' + (lx + 24) + '" y2="' + (ly + 6) + '" stroke="' + col + '" stroke-width="3"/>' + txt(lx + 30, ly + 10, lanName(id), { al: 'start', sz: 10 })); lx += 40 + lanName(id).length * 6; });
    s.push('<rect x="' + (lx + 10) + '" y="' + (ly) + '" width="12" height="12" fill="' + FILL.piso + '" stroke="#4a5a6a"/>' + txt(lx + 26, ly + 10, 'Rack', { al: 'start', sz: 10 }));
    s.push('<rect x="' + (lx + 70) + '" y="' + (ly) + '" width="12" height="12" fill="' + FILL.gabinete + '" stroke="#4a5a6a"/>' + txt(lx + 86, ly + 10, 'Gabinete', { al: 'start', sz: 10 }));
    s.push('<rect x="' + (lx + 150) + '" y="' + (ly) + '" width="12" height="12" fill="' + FILL.pared + '" stroke="#4a5a6a"/>' + txt(lx + 166, ly + 10, 'Pared', { al: 'start', sz: 10 }));

    const w = Math.ceil(Math.max(W, lx + 230)), hh = Math.ceil(H);
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + hh + '" viewBox="0 0 ' + w + ' ' + hh + '"><defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#555"/></marker></defs><rect width="100%" height="100%" fill="#ffffff"/>' + s.join('') + '</svg>';
    return { svg, w, h: hh };
  }

  /** Rasteriza el SVG a PNG (para Word y Excel). Devuelve Uint8Array. */
  function toPng(svg, w, h, scale) {
    scale = scale || 2;
    return new Promise((res, rej) => {
      const img = new Image(), url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = w * scale; c.height = h * scale;
        const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(b => { if (!b) return rej(new Error('No se pudo generar la imagen del diagrama.')); b.arrayBuffer().then(a => res(new Uint8Array(a))); }, 'image/png');
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('No se pudo generar la imagen del diagrama.')); };
      img.src = url;
    });
  }

  g.Diagrama = { build, toPng };
})(window);
