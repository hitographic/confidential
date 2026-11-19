import ExcelJS from 'exceljs'
import { excelColorToCss } from './themeColor.js'

// Ukuran halaman A4 landscape persis seperti Page Setup file (paper 9 = A4).
export const PT_PX = 96 / 72
// Lebar kolom Excel (chars, Calibri 11) -> px. Rumus standar MDW=7 + padding 5.
export const charsToPx = (chars) => Math.max(0, Math.round(Number(chars || 8.43) * 7 + 5))
export const ptToPx = (pt) => (Number(pt) || 12.75) * PT_PX

const MERGE_TYPE = (ExcelJS.ValueType && ExcelJS.ValueType.Merge) || 1

const BORDER_W = {
  thin: '1px', medium: '2px', thick: '3px', double: '3px', hair: '1px',
  dotted: '1px', dashed: '1px', dashDot: '1px', dashDotDot: '1px',
  mediumDashed: '2px', mediumDashDot: '2px', mediumDashDotDot: '2px', slantDashDot: '1px',
}
const BORDER_S = {
  thin: 'solid', medium: 'solid', thick: 'solid', double: 'double', hair: 'solid',
  dotted: 'dotted', dashed: 'dashed', dashDot: 'dashed', dashDotDot: 'dotted',
  mediumDashed: 'dashed', mediumDashDot: 'dashed', mediumDashDotDot: 'dotted', slantDashDot: 'dashed',
}

function borderSideCss(side) {
  if (!side || !side.style || side.style === 'none') return ''
  const w = BORDER_W[side.style] || '1px'
  const s = BORDER_S[side.style] || 'solid'
  const c = excelColorToCss(side.color) || '#000000'
  return `${w} ${s} ${c}`
}

function cellText(v) {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (v instanceof Date) {
    const p = (n) => String(n).padStart(2, '0')
    return `${p(v.getDate())}/${p(v.getMonth() + 1)}/${v.getFullYear()}`
  }
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((t) => (t && t.text) || '').join('')
    if (v.text !== undefined && v.result === undefined) return String(v.text)
    if (v.result !== undefined) return cellText(v.result)
    if (v.text !== undefined) return String(v.text)
  }
  return ''
}

/**
 * Membangun model setia-1:1 dari sheet pertama: nilai, merge, font, fill,
 * border, alignment, tinggi baris & lebar kolom — untuk preview semirip Excel.
 * values+styles dibaca via ExcelJS (style tidak tersedia di SheetJS).
 */
export async function buildSheetModel(arrayBuffer) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(arrayBuffer)
  const ws = wb.worksheets[0]
  if (!ws) throw new Error('Sheet tidak ditemukan')

  // Batas isi:
  // - BARIS: yang punya nilai, fill solid, atau border (termasuk ekor "5 Kriteria").
  // - KOLOM: hanya area form (punya border / fill solid / bagian merge multi-sel).
  //   Kolom helper polos di kanan (list validasi "New Point" dsb, tanpa border/fill)
  //   sengaja dikecualikan agar preview = area cetak A..J.
  let maxR = 0
  const colCount = ws.columnCount || 0
  const rowCount = ws.rowCount || 0
  const cellHasStyle = (cell) => {
    const fill = cell.fill
    if (fill && fill.pattern === 'solid' && excelColorToCss(fill.fgColor)) return true
    const bd = cell.border || {}
    return ['left', 'right', 'top', 'bottom'].some((s) => bd[s] && bd[s].style && bd[s].style !== 'none')
  }
  const styledCols = new Set()
  for (let r = 1; r <= rowCount; r++) {
    const row = ws.getRow(r)
    let rowUsed = false
    for (let c = 1; c <= colCount; c++) {
      const cell = row.getCell(c)
      const t = cellText(cell.value)
      if (t !== '') rowUsed = true
      if (cellHasStyle(cell)) {
        rowUsed = true
        styledCols.add(c)
      }
    }
    if (rowUsed) maxR = r
  }
  if (!maxR) throw new Error('Sheet kosong')

  // Peta merge: kelompokkan slave + master.
  const groups = new Map() // masterAddr -> {r0,r1,c0,c1}
  const addr = (r, c) => `${r}:${c}`
  for (let r = 1; r <= maxR; r++) {
    for (let c = 1; c <= colCount; c++) {
      const cell = ws.getCell(r, c)
      let key
      if (cell.type === MERGE_TYPE && cell.master) {
        key = addr(cell.master.row, cell.master.col)
      } else {
        key = addr(r, c)
      }
      const g = groups.get(key)
      if (g) {
        if (r < g.r0) g.r0 = r
        if (r > g.r1) g.r1 = r
        if (c < g.c0) g.c0 = c
        if (c > g.c1) g.c1 = c
      } else {
        groups.set(key, { r0: r, r1: r, c0: c, c1: c })
      }
    }
  }
  const slaveToMaster = new Map()
  const masterSpan = new Map()
  groups.forEach((g, key) => {
    if (g.r0 === g.r1 && g.c0 === g.c1) return
    masterSpan.set(key, { rs: g.r1 - g.r0 + 1, cs: g.c1 - g.c0 + 1 })
    for (let r = g.r0; r <= g.r1; r++) {
      for (let c = g.c0; c <= g.c1; c++) {
        const k = addr(r, c)
        if (k !== key) slaveToMaster.set(k, key)
      }
    }
  })
  let maxC = 0
  styledCols.forEach((c) => { if (c > maxC) maxC = c })
  // Catatan: merge (judul C:I, keterangan H:I, dsb) selalu berada di dalam
  // area berbingkai, jadi tidak dipakai memperluas batas. Merge helper di
  // luar form (M19:Y19 dsb, tanpa border/fill) otomatis terkecualikan.
  // Sel catatan berbingkai seperti M302:N302 ikut via styledCols.
  if (!maxR || !maxC) throw new Error('Sheet kosong')

  // Tabel style ter-dedupe.
  const fonts = [], fills = [], bords = [], aligns = []
  const fIdx = new Map(), bIdx = new Map(), oIdx = new Map(), aIdx = new Map()
  const pushDedupe = (arr, map, key, val) => {
    if (map.has(key)) return map.get(key)
    arr.push(val)
    map.set(key, arr.length - 1)
    return arr.length - 1
  }

  const rows = []
  for (let r = 1; r <= maxR; r++) {
    const excelRow = ws.getRow(r)
    const h = excelRow.height || 12.75
    const cells = new Array(maxC).fill(0)
    const skip = new Array(maxC).fill(0)
    const spans = {} // colIdx(0-based) -> {rs, cs}
    for (let c = 1; c <= maxC; c++) {
      if (slaveToMaster.has(addr(r, c))) { skip[c - 1] = 1; continue }
      const cell = ws.getCell(r, c)
      const v = cellText(cell.value)
      const f = cell.font || {}
      const fSize = Number(f.size) || 11
      const fColor = excelColorToCss(f.color) || '#000000'
      const fFam = f.name ? `"${f.name}", Arial, sans-serif` : 'Calibri, Arial, sans-serif'
      const fKey = `${fFam}|${fSize}|${f.bold ? 1 : 0}|${f.italic ? 1 : 0}|${f.underline ? 1 : 0}|${fColor}`
      const fi = pushDedupe(fonts, fIdx, fKey, {
        css: `${f.italic ? 'italic ' : ''}${f.bold ? '700' : '400'} ${fSize}pt ${fFam}`,
        size: fSize,
        color: fColor,
        underline: Boolean(f.underline),
      })
      const bg = (cell.fill && cell.fill.pattern === 'solid' && excelColorToCss(cell.fill.fgColor)) || ''
      const bi = pushDedupe(fills, bIdx, bg, bg)
      const bd = cell.border || {}
      const bKey = [borderSideCss(bd.left), borderSideCss(bd.right), borderSideCss(bd.top), borderSideCss(bd.bottom)].join('|')
      const oi = pushDedupe(bords, oIdx, bKey, bKey.split('|'))
      const al = cell.alignment || {}
      let hAlign = al.horizontal || ''
      if (!hAlign || hAlign === 'general' || hAlign === 'justify') {
        hAlign = v !== '' && !Number.isNaN(Number(v)) && v.trim() !== '' && typeof cell.value === 'number' ? 'right' : 'left'
      }
      if (hAlign === 'centerContinuous' || hAlign === 'distributed') hAlign = 'center'
      let vAlign = al.vertical || 'bottom'
      if (vAlign === 'center') vAlign = 'middle'
      const wrap = al.wrapText === true
      const aKey = `${hAlign}|${vAlign}|${wrap ? 1 : 0}|${al.indent || 0}`
      const ai = pushDedupe(aligns, aIdx, aKey, { h: hAlign, v: vAlign, wrap, indent: al.indent || 0 })
      if (v === '' && fi === 0 && bi === 0 && oi === 0 && ai === 0) continue // sel default kosong
      cells[c - 1] = { v, f: fi, bg: bi, bd: oi, al: ai }
      const sp = masterSpan.get(addr(r, c))
      if (sp) spans[c - 1] = sp
    }
    rows.push({ h, cells, skip, spans })
  }

  const colW = []
  for (let c = 1; c <= maxC; c++) colW.push(ws.getColumn(c).width || 8.43)

  return { nrows: maxR, ncols: maxC, colW, rows, fonts, fills, bords, aligns }
}
