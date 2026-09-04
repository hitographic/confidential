import ExcelJS from 'exceljs'

function setBoxBorders(ws, startRow, endRow, startCol, endCol, outerStyle = 'double', innerVerticals = []) {
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const cell = ws.getCell(r, c)
      cell.border = {
        top: r === startRow ? { style: outerStyle } : { style: 'thin', color: { argb: 'FFFFFFFF' } },
        bottom: r === endRow ? { style: outerStyle } : undefined,
        left: c === startCol ? { style: outerStyle } : undefined,
        right: c === endCol ? { style: outerStyle } : undefined,
      }
    }
  }
  innerVerticals.forEach((c) => {
    for (let r = startRow; r <= endRow; r++) {
      const cell = ws.getCell(r, c)
      cell.border = { ...(cell.border || {}), right: { style: 'thin' } }
    }
  })
}

function downloadWorkbook(workbook, filename) {
  return workbook.xlsx.writeBuffer().then((buffer) => {
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  })
}

function tick(cat, v) {
  return cat === v ? '☑' : '☐'
}

export async function exportListExcel(rows, kategori) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Data Pengamatan')
  ws.columns = [
    { header: 'Tanggal', key: 'tanggal', width: 16 },
    { header: 'Auditor', key: 'auditor', width: 22 },
    { header: 'Auditee', key: 'auditee', width: 22 },
    { header: 'Departemen', key: 'departemen', width: 18 },
    { header: 'Kategori', key: 'kategori', width: 12 },
    { header: 'Status', key: 'status', width: 12 },
  ]
  rows.forEach((r) => {
    ws.addRow({
      tanggal: r.tanggal ? new Date(r.tanggal).toLocaleDateString('id-ID') : '-',
      auditor: r.auditor,
      auditee: r.auditee,
      departemen: r.departemen || '-',
      kategori: r.kategori,
      status: r.status,
    })
  })
  ws.getRow(1).font = { bold: true }
  await downloadWorkbook(wb, `Data-Pengamatan-${kategori || 'Semua'}.xlsx`)
}

/** Export satu laporan MGT-003 ke Excel (port dari exportItemExcel di Index.html). */
export async function exportItemExcel(detail) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('MGT-003')
  ws.mergeCells('A1:D1')
  ws.getCell('A1').value = 'PT INDOFOOD CBP SUKSES MAKMUR Tbk — DIVISI NOODLE PABRIK CIBITUNG'
  ws.getCell('A1').font = { bold: true }
  ws.mergeCells('A2:D2')
  ws.getCell('A2').value = `PENGAMATAN INTERNAL AUDIT — ${detail.kategori} / ${detail.departemen || '-'} / ${detail.auditeeName}`
  ws.addRow(['NO.', 'HASIL PENGAMATAN', 'ELEMEN/KLAUSUL', 'KATEGORI'])
  ws.getRow(3).font = { bold: true }
  ;(detail.checklistData || []).forEach((q) => {
    ws.addRow([q.no, q.hasilPengamatan || q.pertanyaan, q.kriteria || '', q.kategoriVal || ''])
  })
  ws.columns.forEach((c) => { c.width = 28 })
  await downloadWorkbook(wb, `MGT-003-${detail.kategori}-${detail.auditeeName}.xlsx`)
}

/** Export CAPA MGT-004 landscape ke Excel (port dari exportCapaExcel). */
export async function exportCapaExcel({ detail, findings, no }) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('CAPA MGT-004')
  ws.mergeCells('A1:F1')
  ws.getCell('A1').value = 'PT INDOFOOD CBP SUKSES MAKMUR Tbk — DIVISI NOODLE PABRIK CIBITUNG'
  ws.getCell('A1').font = { bold: true }
  ws.mergeCells('A2:F2')
  ws.getCell('A2').value = `CAPA INTERNAL AUDIT  No: ${no}`
  ws.addRow(['Departemen', detail?.departemen || '-', 'Tgl. Audit', detail?.tanggal ? new Date(detail.tanggal).toLocaleDateString('id-ID') : '-', '', ''])
  ws.addRow(['KETIDAKSESUAIAN (NC)', 'ELEMEN/KLAUSUL', 'CORRECTION', 'INDIKASI PENYEBAB', 'CORRECTIVE ACTION', 'Target Selesai'])
  ws.getRow(4).font = { bold: true }
  findings.forEach((f) => {
    ws.addRow([f.hasilPengamatan, f.kriteria, '', '', '', ''])
  })
  ws.columns.forEach((c) => { c.width = 26 })
  await downloadWorkbook(wb, `CAPA-${detail?.kategori || 'AUDIT'}-${no.replaceAll('/', '-')}.xlsx`)
}

export { tick }
export default { exportListExcel, exportItemExcel, exportCapaExcel }
