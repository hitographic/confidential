import * as XLSX from 'xlsx'

export const normKey = (s) =>
  String(s || '').replace(/\s+/g, ' ').trim().toLowerCase()

export const splitNames = (v) =>
  String(v || '')
    .split('/')
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

/** Deteksi blok footer Auditor/Auditee. Pola CQA-75: label di baris r, nama di r+3, kolom D & E. */
export function parseWorkbook(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' })
  const sheetName = wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' })

  const blocks = []
  for (let r = 0; r < aoa.length; r++) {
    const row = aoa[r] || []
    for (let c = 0; c < row.length; c++) {
      const v = String(row[c] ?? '').trim()
      if (v === 'Auditor,') {
        const peer = String(row[c + 1] ?? '').trim()
        if (peer !== 'Auditee,') continue
        const nr = r + 3
        if (nr >= aoa.length) continue
        const auditorRaw = String((aoa[nr] || [])[c] ?? '')
        const auditeeRaw = String((aoa[nr] || [])[c + 1] ?? '')
        if (!auditorRaw.trim() && !auditeeRaw.trim()) continue
        blocks.push({
          id: blocks.length,
          page: blocks.length + 1,
          labelRow: r,          // 0-indexed
          nameRow: nr,          // 0-indexed
          auditorCol: c,        // 0-indexed (D=3)
          auditeeCol: c + 1,
          auditorRaw,
          auditeeRaw,
          auditorNames: splitNames(auditorRaw),
          auditeeNames: splitNames(auditeeRaw),
        })
      }
    }
  }

  // Daftar orang unik + hitung kemunculan
  const map = new Map()
  blocks.forEach((b) => {
    ;[
      { side: 'Auditor', names: b.auditorNames },
      { side: 'Auditee', names: b.auditeeNames },
    ].forEach(({ side, names }) => {
      names.forEach((name) => {
        const key = normKey(name)
        if (!map.has(key)) map.set(key, { key, name, count: 0, occ: [] })
        const p = map.get(key)
        // simpan ejaan pertama yang rapi
        p.count += 1
        p.occ.push({ blockId: b.id, page: b.page, side })
      })
    })
  })
  const persons = [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  return { sheetName, aoa, blocks, persons }
}

const cell = (row, i) => String((row || [])[i] ?? '').replace(/\s+/g, ' ').trim()

/**
 * Pecah sheet menjadi halaman laporan per blok footer.
 * Tiap halaman = kop + meta + judul + baris tabel + footer TTD + ekor.
 * Dipakai untuk preview ISI laporan (bukan cuma letak TTD).
 */
export function buildPages(aoa, blocks) {
  if (!blocks.length) return []
  const pages = []
  blocks.forEach((b, idx) => {
    const start = idx === 0 ? 0 : blocks[idx - 1].nameRow + 1
    const end = idx === blocks.length - 1 ? aoa.length : b.nameRow + 2
    const kop = []    // {r, left, formLabel, formVal}
    const meta = []   // {r, text}
    let title = ''
    let cabang = ''
    let tanggal = ''
    let departemen = ''
    const rows = []   // baris tabel isi
    const tail = []   // baris setelah footer terakhir (cth. 5 Kriteria SJPH)
    let headerSeen = false

    for (let r = start; r < end; r++) {
      const row = aoa[r] || []
      const joined = row.map((v) => String(v ?? '')).join(' ')
      // Lewati zona footer (label .. 1 baris setelah nama) — dirender terpisah
      if (r >= b.labelRow && r <= b.nameRow + 1) continue
      // Ekor setelah footer terakhir
      if (r > b.nameRow + 1) {
        if (joined.trim()) tail.push({ r, text: joined.replace(/\s+/g, ' ').trim() })
        continue
      }
      if (/PT\.?\s*INDOFOOD/i.test(joined) || /KODE FORM|NO\.?\s*TERBITAN|HALAMAN/i.test(joined)) {
        kop.push({
          r,
          left: cell(row, 2) || cell(row, 3),
          label: cell(row, 4),
          value: [cell(row, 7), cell(row, 8)].filter(Boolean).join(' '),
        })
        continue
      }
      if (/CHECK LIST AUDIT/i.test(joined)) {
        title = cell(row, 2) || joined.replace(/\s+/g, ' ').trim()
        continue
      }
      if (/Cabang|Tanggal Audit|Departemen\/Area/i.test(joined)) {
        const t = joined.replace(/\s+/g, ' ').trim()
        if (/Cabang/i.test(joined)) cabang = t
        else if (/Tanggal Audit/i.test(joined)) tanggal = t
        else departemen = t
        meta.push({ r, text: t })
        continue
      }
      if (/DAFTAR PERTANYAAN/i.test(joined)) { headerSeen = true; continue }
      if (/^\s*YA\s*$/.test(cell(row, 5)) && /TIDAK/i.test(joined)) continue // sub-header YA/TIDAK

      const no = cell(row, 2)
      const pertanyaan = String((row || [])[3] ?? '').replace(/\s+/g, ' ').trim()
      const kriteria = cell(row, 4)
      const ya = cell(row, 5)
      const tidak = cell(row, 6)
      const keterangan = [String((row || [])[7] ?? ''), String((row || [])[8] ?? '')]
        .map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' — ')
      if (!no && !pertanyaan && !kriteria && !ya && !tidak && !keterangan) continue
      const isSection = Boolean((no || pertanyaan) && !kriteria && !ya && !tidak && !keterangan)
      rows.push({ r, no, pertanyaan, kriteria, ya, tidak, keterangan, isSection })
    }

    pages.push({
      page: b.page,
      block: b,
      kop, meta, title, cabang, tanggal, departemen,
      rows, tail, headerSeen,
      start, end,
    })
  })
  return pages
}
