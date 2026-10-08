/* Lector mínimo de .xlsx/.xlsm (sin librerías): descomprime con DecompressionStream y devuelve las hojas como filas de valores.
   Suficiente para leer la tabla de circuitos exportada de Revit ("Circuitos revit-excel.xlsm"). */
(function (g) {
  'use strict';
  async function inflate(bytes) {
    const ds = new DecompressionStream('deflate-raw');
    const out = new Response(new Blob([bytes]).stream().pipeThrough(ds));
    return new Uint8Array(await out.arrayBuffer());
  }
  async function unzip(buf) {
    const dv = new DataView(buf), u8 = new Uint8Array(buf), files = {};
    let eocd = -1;
    for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('El archivo no es un Excel válido (.xlsx/.xlsm).');
    const count = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true);
    const dec = new TextDecoder();
    for (let k = 0; k < count; k++) {
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
      const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
      files[name] = { method, csize, off };
      p += 46 + nlen + xlen + clen;
    }
    return {
      names: Object.keys(files),
      async text(name) {
        const f = files[name]; if (!f) return null;
        const lnl = dv.getUint16(f.off + 26, true), lxl = dv.getUint16(f.off + 28, true), start = f.off + 30 + lnl + lxl;
        const raw = u8.subarray(start, start + f.csize);
        return dec.decode(f.method === 8 ? await inflate(raw) : raw);
      },
    };
  }
  const colIdx = ref => { const m = /^([A-Z]+)/.exec(ref); let n = 0; for (const ch of m[1]) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };

  async function read(buf) {
    if (typeof DecompressionStream === 'undefined') throw new Error('Este navegador no puede leer Excel. Exporte la tabla de Revit como .txt/.csv o pegue las filas.');
    const z = await unzip(buf), P = new DOMParser();
    const xml = async n => { const t = await z.text(n); return t ? P.parseFromString(t, 'application/xml') : null; };
    const ss = [], sst = await xml('xl/sharedStrings.xml');
    if (sst) Array.from(sst.getElementsByTagName('si')).forEach(si => ss.push(Array.from(si.getElementsByTagName('t')).map(t => t.textContent).join('')));
    const wb = await xml('xl/workbook.xml'), rels = await xml('xl/_rels/workbook.xml.rels'), target = {};
    Array.from(rels.getElementsByTagName('Relationship')).forEach(r => { target[r.getAttribute('Id')] = r.getAttribute('Target'); });
    const sheets = [];
    for (const s of Array.from(wb.getElementsByTagName('sheet'))) {
      const rid = s.getAttribute('r:id') || s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
      let path = target[rid] || ''; path = path.startsWith('/') ? path.slice(1) : 'xl/' + path.replace(/^\.\//, '');
      const doc = await xml(path); if (!doc) continue;
      const rows = [];
      Array.from(doc.getElementsByTagName('row')).forEach(row => {
        const r = Number(row.getAttribute('r')) - 1, arr = rows[r] = [];
        Array.from(row.getElementsByTagName('c')).forEach(c => {
          const t = c.getAttribute('t'), v = c.getElementsByTagName('v')[0], is = c.getElementsByTagName('is')[0];
          let val = v ? v.textContent : (is ? is.textContent : '');
          if (t === 's') val = ss[Number(val)] || ''; else if (t === 'b') val = val === '1'; else if (t !== 'str' && t !== 'inlineStr' && val !== '' && !isNaN(Number(val))) val = Number(val);
          arr[colIdx(c.getAttribute('r'))] = val;
        });
      });
      sheets.push({ name: s.getAttribute('name'), state: s.getAttribute('state') || 'visible', rows: Array.from(rows, x => x || []) });
    }
    return sheets;
  }
  g.XlsxRead = { read };
})(window);
