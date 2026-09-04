import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

async function elementToPdfLandscape(el, filename) {
  const canvas = await html2canvas(el, { scale: 2, useCORS: true })
  const img = canvas.toDataURL('image/png')
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const ratio = Math.min(pageW / canvas.width, pageH / canvas.height)
  const w = canvas.width * ratio
  const h = canvas.height * ratio
  pdf.addImage(img, 'PNG', (pageW - w) / 2, (pageH - h) / 2, w, h)
  pdf.save(filename)
}

async function elementToPdfPortrait(el, filename) {
  const canvas = await html2canvas(el, { scale: 2, useCORS: true })
  const img = canvas.toDataURL('image/png')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const ratio = Math.min(pageW / canvas.width, pageH / canvas.height)
  const w = canvas.width * ratio
  const h = canvas.height * ratio
  pdf.addImage(img, 'PNG', (pageW - w) / 2, 8, w, h)
  pdf.save(filename)
}

export async function exportPreviewPdf(elementId = 'previewArea', filename = 'MGT-003.pdf') {
  const el = document.getElementById(elementId)
  if (!el) throw new Error('Elemen preview tidak ditemukan')
  await elementToPdfPortrait(el, filename)
}

export async function exportCapaPdf(elementId = 'capaPreviewArea', filename = 'CAPA-MGT-004.pdf') {
  const el = document.getElementById(elementId)
  if (!el) throw new Error('Elemen CAPA tidak ditemukan')
  await elementToPdfLandscape(el, filename)
}

export default { exportPreviewPdf, exportCapaPdf }
