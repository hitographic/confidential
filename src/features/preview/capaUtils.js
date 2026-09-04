export function getCapaFindings(checklistData) {
  return (checklistData || [])
    .filter((row) => {
      if (row.type == 1 || row.type == 2 || row.type == 3) return false
      const kat = String(row.kategoriVal || '').trim()
      if (!kat || kat === '-' || kat.toUpperCase() === 'C') return false
      const k = kat.toLowerCase()
      if (k !== 'minor' && k !== 'major' && k !== 'kritis') return false
      if (!row.hasilPengamatan || String(row.hasilPengamatan).trim() === '') return false
      return true
    })
    .map((row) => ({
      nc: String(row.hasilPengamatan || '').trim(),
      klausul: String(row.kriteria || '-').trim() || '-',
      hasilPengamatan: String(row.hasilPengamatan || '').trim(),
      kriteria: String(row.kriteria || '-').trim() || '-',
    }))
}

export function capaSemesterCode(kategori, tanggalObj) {
  const dt = tanggalObj instanceof Date ? tanggalObj : new Date(tanggalObj || new Date())
  const sem = dt.getMonth() <= 5 ? '1' : '2' // Jan-Jun=1, Jul-Des=2
  const kat = String(kategori || '').trim().toUpperCase()
  const base = kat === 'HALAL' || kat === '' ? 'IHA' : kat
  return `${base}-${sem}`
}

export function capaSuggestedNo(nFindings, tanggalObj, kategori) {
  const dt = tanggalObj instanceof Date ? tanggalObj : new Date(tanggalObj || new Date())
  const kode = capaSemesterCode(kategori, dt)
  const yr = dt.getFullYear()
  if (!nFindings || nFindings <= 1) return `1/CAPA/${kode}/${yr}`
  return `1-${nFindings}/CAPA/${kode}/${yr}`
}

export function formatIdDate(d) {
  const dt = d instanceof Date ? d : new Date(d || new Date())
  const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
  return `${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`
}

export function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
