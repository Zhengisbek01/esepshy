import * as XLSX from 'xlsx';

export function downloadBlob(name, content, type = 'text/plain;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportXlsx(name, sheets) {
  const wb = XLSX.utils.book_new();
  for (const [title, rows] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), title.slice(0, 31));
  XLSX.writeFile(wb, name);
}

export async function readTable(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', codepage: 65001 });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: '', raw: true });
}

export function imageToDataUrl(file, max = 360) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = reject; img.src = fr.result;
    };
    fr.onerror = reject; fr.readAsDataURL(file);
  });
}

export function printHtml(title, html) {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${title}</title><style>body{font:14px/1.5 Arial,sans-serif;color:#111;max-width:760px;margin:32px auto;padding:0 16px}h1{font-size:20px}h2{font-size:16px;margin-top:24px}table{border-collapse:collapse;width:100%;margin:8px 0}td,th{border:1px solid #bbb;padding:6px 8px;text-align:left;font-size:13px}th{background:#eee}.r{text-align:right}.muted{color:#666;font-size:12px}</style></head><body>${html}<script>setTimeout(()=>print(),300)</script></body></html>`);
  w.document.close();
  return true;
}
