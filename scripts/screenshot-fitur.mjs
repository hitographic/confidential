/**
 * Screenshot FITUR — memvisualkan tiap baris tabel
 * "Langkah Lama -> Fitur di Aplikasi Confidential".
 *
 * Output: screenshots/fitur/tahap{1,2,3}-x-*.png (1080x1920 = 9:16)
 * Data  : semua request backend GAS di-mock (tidak menyentuh Sheet asli).
 *
 * Jalankan:
 *   npm run dev -- --port 5173 --strictPort   (terminal 1)
 *   node scripts/screenshot-fitur.mjs         (terminal 2)
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'
import { photoPng, signaturePng } from './_mock-assets.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'screenshots', 'fitur')
const BASE = 'http://localhost:5173'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

// "foto temuan" & tanda tangan mock (dibuat sendiri, bukan logo)
const OPENTMP = '/private/var/folders/3t/_9nv46zd4qgdk1xbv8ys47g40000gn/T/opencode'
const FOTO = path.join(fs.existsSync(OPENTMP) ? OPENTMP : os.tmpdir(), 'confidential-mock-photo.png')

fs.mkdirSync(OUT, { recursive: true })

const PHOTO_BUF = photoPng()
fs.writeFileSync(FOTO, PHOTO_BUF)
const PHOTO_DATAURL = `data:image/png;base64,${PHOTO_BUF.toString('base64')}`
const SIG_AUDITOR = `data:image/png;base64,${signaturePng(0).toString('base64')}`
const SIG_AUDITEE = `data:image/png;base64,${signaturePng(1).toString('base64')}`

// ---------------------------------------------------------------- mock data
const CHECKLIST = [
  { no: 'I', type: 1, pertanyaan: 'KETENTUAN UMUM — SYARAT SJPH', kriteria: '' },
  { no: 1, type: 0, pertanyaan: 'Apakah perusahaan telah menetapkan Kebijakan Halal yang ditinjau secara berkala?', kriteria: 'SJPH 4.1' },
  { no: 2, type: 0, pertanyaan: 'Apakah tanggung jawab manajemen puncak terhadap sistem Jaminan Halal telah didefinisikan?', kriteria: 'SJPH 4.2' },
  { no: 3, type: 0, pertanyaan: 'Apakah sumber daya yang dibutuhkan untuk memenuhi syarat SJPH telah tersedia?', kriteria: 'SJPH 4.3' },
  { no: 4, type: 0, pertanyaan: 'Apakah tujuan mutu Halal telah ditetapkan, dikomunikasikan, dan ditinjau?', kriteria: 'SJPH 4.4' },
  { no: 'II', type: 2, pertanyaan: 'PENGENDALIAN PROSES PRODUKSI HALAL', kriteria: '' },
  { no: 5, type: 0, pertanyaan: 'Apakah pemisahan antara bahan halal dan non-halal dilakukan di area penyimpanan?', kriteria: 'SJPH 5.2' },
  { no: 6, type: 0, pertanyaan: 'Apakah pembersihan dan sanitasi peralatan memakai pembersih yang halal?', kriteria: 'SJPH 5.3' },
  { no: 7, type: 0, pertanyaan: 'Apakah produk halal disimpan terpisah dari produk non-halal?', kriteria: 'SJPH 5.4' },
  { no: 8, type: 0, pertanyaan: 'Apakah pelatihan karyawan mengenai Halal telah dilakukan dan didokumentasikan?', kriteria: 'SJPH 6.1' },
]
const IDX_TIDAK = 4

// checklistData utk getDetail (berisi temuan Minor & Major + 1 temuan utk item 3)
const checklistData = (withFindings) => CHECKLIST.map((q) => {
  if (q.type) return { ...q, hasilPengamatan: '', kategoriVal: '', photos: [] }
  if (withFindings && q.no === 5) return { ...q, hasilPengamatan: 'Pemisahan bahan halal dan non-halal di area penyimpanan belum dilabeli dengan jelas.', kategoriVal: 'Minor', photos: [] }
  if (withFindings && q.no === 7) return { ...q, hasilPengamatan: 'Produk halal dan non-halal diletakkan pada rak yang sama tanpa penandaan terpisah.', kategoriVal: 'Major', photos: [] }
  if (!withFindings && q.no === 5) return { ...q, hasilPengamatan: 'Pemisahan bahan halal dan non-halal di area penyimpanan belum dilabeli dengan jelas.', kategoriVal: 'Minor', photos: [] }
  return { ...q, hasilPengamatan: q.pertanyaan, kategoriVal: 'C', photos: [] }
})

const capaTerisi = [{
  correction: 'Label rak penyimpanan bahan halal/non-halal sudah dipasang pada 20 Okt 2026.',
  indikasiPenyebab: 'Belum ada standar penandaan area penyimpanan bahan baku.',
  correctiveAction: 'Buat SOP penandaan area penyimpanan & audit mingguan oleh QA/QC.',
  targetSelesai: '30 November 2026',
  photos: [],
}]

const DETAILS = {
  'AUD-2026-014': { // draft milik Budi (untuk TTD Auditor)
    id: 'AUD-2026-014', kategori: 'Halal', departemen: 'Produksi', tanggal: '2026-10-15T08:00:00.000Z',
    auditorName: 'Budi Santoso', auditeeName: 'Siti Aminah',
    hashIntegritas: '', auditorSignature: '', auditeeSignature: '', capa: [], lampiran: [],
    checklistData: checklistData(false),
  },
  'AUD-2026-011': { // submitted, lengkap: temuan + lampiran + TTD + CAPA terisi
    id: 'AUD-2026-011', kategori: 'Halal', departemen: 'QA/QC', tanggal: '2026-10-08T08:00:00.000Z',
    auditorName: 'Budi Santoso', auditeeName: 'Rahmat Hidayat',
    hashIntegritas: 'b7f3c9e2a4d81f6053c1e8b9a7d24f6c8e0b5a3d9f7c2e1a6b4d8f0c3e5a7b9d',
    auditorSignature: SIG_AUDITOR, auditeeSignature: SIG_AUDITEE,
    capa: capaTerisi,
    lampiran: [{ itemIndex: 4, url: PHOTO_DATAURL, fileId: '', caption: 'Foto pemisahan bahan halal & non-halal' }],
    checklistData: checklistData(true),
  },
  'AUD-2026-008': { // submitted, milik Budi Santoso (utk mode Auditee isi CAPA)
    id: 'AUD-2026-008', kategori: 'Halal', departemen: 'Pengemasan', tanggal: '2026-09-30T08:00:00.000Z',
    auditorName: 'Agus Priyanto', auditeeName: 'Budi Santoso',
    hashIntegritas: 'c8a4d0f3b5e92a7164d2f9c0b8e35a7d9f1c6e4b0a8d3f5c7e2b9a6d4f8c0e2a',
    auditorSignature: SIG_AUDITOR, auditeeSignature: SIG_AUDITEE,
    capa: [],
    lampiran: [],
    checklistData: checklistData(true),
  },
}

const MOCKS = {
  getSignatureInfo: { success: true, exists: true, createdAt: '12 Januari 2026', updatedAt: '03 Oktober 2026' },
  getChecklist: { success: true, data: CHECKLIST },
  getDepartemen: { success: true, data: [{ nama: 'Produksi' }, { nama: 'QA/QC' }, { nama: 'Pengemasan' }, { nama: 'Gudang Bahan Baku' }, { nama: 'Engineering' }] },
  getList: {
    success: true,
    data: [
      { id: 'AUD-2026-014', kategori: 'Halal', auditee: 'Siti Aminah', auditor: 'Budi Santoso', departemen: 'Produksi', tanggal: '2026-10-15', status: 'Draft', hasAuditorSign: false, hasAuditeeSign: false },
      { id: 'AUD-2026-011', kategori: 'Halal', auditee: 'Rahmat Hidayat', auditor: 'Budi Santoso', departemen: 'QA/QC', tanggal: '2026-10-08', status: 'Submitted', hasAuditorSign: true, hasAuditeeSign: true },
      { id: 'AUD-2026-008', kategori: 'Halal', auditee: 'Budi Santoso', auditor: 'Agus Priyanto', departemen: 'Pengemasan', tanggal: '2026-09-30', status: 'Submitted', hasAuditorSign: true, hasAuditeeSign: true },
    ],
    message: '',
  },
  fetchImages: { success: true, images: {} },
  getVersion: { success: true, version: '1.0.0' },
  verifySignature: { success: true, signatureData: SIG_AUDITOR },
  saveDraft: { success: true, message: 'Data berhasil disimpan.' },
  submitFinal: { success: true, message: 'Data berhasil disubmit.' },
  saveCapa: { success: true, message: 'CAPA berhasil disimpan.' },
  deleteData: { success: true, message: 'Data berhasil dihapus.' },
  updateSignature: { success: true, message: 'Tanda tangan tersimpan.' },
}

const USERS = {
  '1987654321': { success: true, nama: 'Budi Santoso', role: 'auditor,auditee' },
  '1000000001': { success: true, nama: 'Hendra Wijaya', role: 'admin' },
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST,GET,OPTIONS',
  'access-control-allow-headers': '*',
}

// ---------------------------------------------------------------- helpers
function mockFor(action, body) {
  if (action === 'login') return USERS[body.nik] || { success: false, message: 'NIK tidak terdaftar.' }
  if (action === 'getDetail') return { success: true, data: DETAILS[body.id] || DETAILS['AUD-2026-011'] }
  return MOCKS[action] || { success: true, data: [], message: '' }
}

async function setupInterception(page) {
  await page.setRequestInterception(true)
  page.on('request', (req) => {
    const url = req.url()
    if (url.includes('script.google.com')) {
      if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: CORS, body: '' })
      let body = {}
      try { body = JSON.parse(req.postData() || '{}') } catch {}
      const payload = mockFor(body.action, body)
      return req.respond({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(payload) })
    }
    if (url.includes('api.ipify.org')) {
      return req.respond({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ ip: '103.94.128.77' }) })
    }
    return req.continue()
  })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function shot(page, name) {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  await sleep(150)
  await page.screenshot({ path: path.join(OUT, `${name}.png`) })
  console.log(`  ✓ ${name}.png`)
}

async function waitText(page, text, timeout = 20000) {
  await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, text)
}

async function clickByText(page, selector, text) {
  const ok = await page.evaluate((sel, t) => {
    const els = [...document.querySelectorAll(sel)]
    const el = els.find((e) => e.textContent.replace(/\s+/g, ' ').includes(t))
    if (!el) return false
    el.scrollIntoView({ block: 'center' })
    el.click()
    return true
  }, selector, text)
  if (!ok) throw new Error(`Elemen tidak ketemu: ${selector} "${text}"`)
}

/** Klik tombol di dalam kartu data yang mengandung teks tertentu (mis. nama auditee). */
async function clickCardButton(page, cardText, buttonText) {
  const ok = await page.evaluate((ct, bt) => {
    const card = [...document.querySelectorAll('.data-card')].find((c) => c.textContent.includes(ct))
    if (!card) return false
    const btn = [...card.querySelectorAll('button')].find((b) => b.textContent.replace(/\s+/g, ' ').includes(bt))
    if (!btn) return false
    btn.scrollIntoView({ block: 'center' })
    btn.click()
    return true
  }, cardText, buttonText)
  if (!ok) throw new Error(`Tombol tidak ketemu: kartu "${cardText}" → "${buttonText}"`)
}

async function clickCard(page, containerSel, headingText) {
  const ok = await page.evaluate((sel, t) => {
    const host = document.querySelector(sel)
    if (!host) return false
    const card = [...host.children].find((c) => c.querySelector('h3')?.textContent.trim() === t)
    if (!card) return false
    card.scrollIntoView({ block: 'center' })
    card.click()
    return true
  }, containerSel, headingText)
  if (!ok) throw new Error(`Kartu tidak ketemu: ${containerSel} h3="${headingText}"`)
}

async function waitReady(page) {
  await page.waitForFunction(() => {
    const root = document.getElementById('root')
    return root && root.children.length > 0
  }, { timeout: 30000 })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForFunction(() => document.fonts.check('900 1em "Font Awesome 6 Free"'), { timeout: 15000 }).catch(() => {})
}

/** Set nilai input/textarea terkontrol React tanpa klik mouse. */
async function setReactValue(page, selector, value) {
  const ok = await page.evaluate((sel, val) => {
    const el = document.querySelector(sel)
    if (!el) return false
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, val)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  }, selector, value)
  if (!ok) throw new Error(`Set nilai gagal: ${selector}`)
}

async function newSession(browser, nik, password) {
  const page = await browser.newPage()
  page.setDefaultTimeout(25000)
  await page.setViewport({ width: 360, height: 640, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')
  await setupInterception(page)
  page.on('pageerror', (e) => console.log('   [pageerror]', String(e).slice(0, 250)))

  await page.goto(`${BASE}/#/login`, { waitUntil: 'networkidle2', timeout: 60000 })
  await waitReady(page)
  await waitText(page, 'Selamat Datang')
  await page.type('input[autocomplete="username"]', nik)
  await page.type('input[type="password"]', password)
  await clickByText(page, 'button[type="submit"]', 'Masuk')
  await page.waitForSelector('.swal2-popup', { visible: true, timeout: 30000 })
  await clickByText(page, '.swal2-confirm', 'Gunakan yang Sudah Ada')
  await page.waitForSelector('.swal2-container', { hidden: true, timeout: 20000 }).catch(() => {})
  return page
}

// ---------------------------------------------------------------- main
async function main() {
  for (let i = 0; i < 30; i++) {
    try { if ((await fetch(BASE)).ok) break } catch {}
    if (i === 29) throw new Error('Dev server tidak jalan di ' + BASE)
    await sleep(1000)
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars', '--force-color-profile=srgb'],
  })

  // ================= SESI A: Auditor + Auditee (Budi Santoso) =================
  console.log('Sesi A — Budi Santoso (auditor,auditee)')
  const page = await newSession(browser, '1987654321', 'rahasia123')

  // Tahap 1.a — checklist otomatis dari database
  console.log('Tahap 1.a — checklist dari database')
  await page.waitForSelector('.role-gate-grid', { visible: true, timeout: 30000 })
  await clickCard(page, '.role-gate-grid', 'Auditor')
  await page.waitForFunction(() => location.hash.startsWith('#/kategori'), { timeout: 20000 })
  await clickCard(page, '.menu-grid', 'Halal')
  await page.waitForFunction(() => location.hash.startsWith('#/list/'), { timeout: 20000 })
  await page.waitForSelector('.data-card', { visible: true, timeout: 30000 })
  await clickByText(page, 'button', 'Tambah Data')
  await page.waitForSelector('.modal-overlay .modal-content', { visible: true })
  await page.select('.modal-overlay .modal-content select', 'Produksi')
  await sleep(200)
  await clickByText(page, '.modal-overlay .modal-content button', 'Mulai Checklist')
  await page.waitForFunction(() => location.hash.startsWith('#/form'), { timeout: 20000 })
  await page.waitForSelector('table.checklist-table tbody tr', { visible: true, timeout: 30000 })
  await waitReady(page)
  await page.evaluate(() => { window.scrollTo(0, 0); const w = document.querySelector('.table-responsive'); if (w) w.scrollLeft = 0 })
  await shot(page, 'tahap1-a-checklist-database')

  // Tahap 2.a — isi form digital (Ya/Tidak + kategori + keterangan + foto)
  console.log('Tahap 2.a — isi form digital')
  await page.evaluate((skipIdx) => {
    document.querySelectorAll('table.checklist-table tbody tr').forEach((tr, i) => {
      if (i === skipIdx) return
      const ya = tr.querySelector(`input[name="kesesuaian_${i}"][value="Ya"]`)
      if (ya) ya.click()
    })
  }, IDX_TIDAK)
  await sleep(200)
  const rowSel = `table.checklist-table tbody tr:nth-child(${IDX_TIDAK + 1})`
  await page.evaluate((i) => {
    const el = document.querySelector(`input[name="kesesuaian_${i}"][value="Tidak"]`)
    if (el) el.click()
  }, IDX_TIDAK)
  await page.select(`${rowSel} select`, 'Minor')
  await setReactValue(page, `${rowSel} textarea`, 'Pemisahan bahan halal dan non-halal di area penyimpanan belum dilabeli dengan jelas.')
  await sleep(200)

  // Tahap 2.c — foto temuan (crop 1:1)
  console.log('Tahap 2.c — foto temuan')
  const fileInput = await page.$(`#photoInput_${IDX_TIDAK}`)
  if (!fileInput) throw new Error('input foto tidak ketemu')
  await fileInput.uploadFile(FOTO)
  await page.waitForSelector('#cropCanvas', { visible: true, timeout: 20000 })
  await page.type('.modal-content input[placeholder^="Keterangan foto"]', 'Pemisahan bahan halal & non-halal')
  await waitReady(page)
  await shot(page, 'tahap2-c-foto-temuan')
  await clickByText(page, '.modal-content button', 'Simpan Foto')
  await page.waitForSelector('#cropCanvas', { hidden: true, timeout: 15000 })
  await page.waitForSelector(`${rowSel} .photo-thumb`, { visible: true, timeout: 15000 })

  // Tahap 1.b — checklist terurut per bagian + kriteria SJPH
  // Zoom tabel 0.45 supaya seluruh kolom (No, Parameter, Kriteria SJPH,
  // Kesesuaian, Kategori) muat dalam viewport 360px — bagian I & II terlihat.
  console.log('Tahap 1.b — checklist terurut')
  await page.evaluate(() => {
    const w = document.querySelector('.table-responsive')
    const t = document.querySelector('.checklist-table')
    if (w) w.scrollLeft = 0
    if (t) t.style.zoom = '0.45'
    if (t) window.scrollTo(0, t.getBoundingClientRect().top + window.scrollY - 150)
  })
  await shot(page, 'tahap1-b-checklist-terurut')

  // Tahap 2.a (lanjutan) — kolom isian temuan (foto + badge Wajib foto)
  await page.evaluate((i) => {
    const t = document.querySelector('.checklist-table')
    if (t) t.style.zoom = '' // kembali ke ukuran normal (zoom tadi hanya untuk shot 1.b)
    const tr = document.querySelectorAll('table.checklist-table tbody tr')[i]
    if (tr) tr.scrollIntoView({ block: 'center' })
    const w = document.querySelector('.table-responsive')
    if (w) w.scrollLeft = w.scrollWidth
  }, IDX_TIDAK)
  await shot(page, 'tahap2-a-form-mgt003')

  // kembali ke daftar
  await clickByText(page, '.list-header .list-back-btn', 'Batal')
  await page.waitForFunction(() => location.hash.startsWith('#/list/'), { timeout: 20000 })
  await page.waitForSelector('.data-card', { visible: true, timeout: 30000 })
  await waitReady(page)

  // Tahap 1.c — data tercatat di sistem, status DRAFT
  console.log('Tahap 1.c — data tercatat (DRAFT)')
  await page.evaluate(() => window.scrollTo(0, 0))
  await shot(page, 'tahap1-c-data-draft-tercatat')

  // Tahap 2.d — TTD digital (PIN auditor)
  console.log('Tahap 2.d — TTD digital')
  await clickCardButton(page, 'Siti Aminah', 'TTD Auditor')
  await page.waitForSelector('.modal-content', { visible: true, timeout: 20000 })
  await waitText(page, 'Tanda Tangan Auditor')
  await page.type('.modal-content input[type="password"]', '123456')
  await sleep(200)
  await shot(page, 'tahap2-d-ttd-digital')
  await clickByText(page, '.modal-content button', 'Batal')
  await page.waitForSelector('.modal-content', { hidden: true, timeout: 15000 }).catch(() => {})

  // Tahap 3.a — preview MGT-003 dari daftar (lengkap tanda tangan)
  console.log('Tahap 3.a — preview MGT-003')
  await clickCardButton(page, 'Rahmat Hidayat', 'Preview')
  await waitText(page, 'Preview Laporan', 30000)
  await page.waitForSelector('#previewArea', { visible: true })
  await waitReady(page)
  await shot(page, 'tahap3-a-preview-mgt003')
  await page.evaluate(() => {
    const modal = [...document.querySelectorAll('.modal-content')].find((m) => m.textContent.includes('Preview Laporan'))
    const btn = modal && [...modal.querySelectorAll('button')].find((b) => b.querySelector('.fa-xmark'))
    if (btn) btn.click()
  })
  await page.waitForSelector('#previewArea', { hidden: true, timeout: 15000 }).catch(() => {})
  await sleep(500)

  // Tahap 3.b — CAPA terisi, mode Auditor (baca-saja)
  console.log('Tahap 3.b — CAPA baca (auditor)')
  await clickCardButton(page, 'Rahmat Hidayat', 'CAPA')
  await page.waitForSelector('.swal2-container', { hidden: true, timeout: 30000 }).catch(() => {})
  await page.waitForSelector('#capaPreviewArea', { visible: true, timeout: 30000 })
  await waitReady(page)
  // zoom 0.45 + scroll horizontal: kolom CORRECTION s/d TARGET terlihat semua
  await page.evaluate(() => {
    const area = document.querySelector('#capaPreviewArea')
    const wrap = area && area.parentElement
    if (area) area.style.zoom = '0.42'
    if (wrap) wrap.scrollLeft = 155
  })
  await sleep(300)
  await shot(page, 'tahap3-b-capa-baca')
  await page.evaluate(() => {
    const modal = [...document.querySelectorAll('.modal-content')].find((m) => m.textContent.includes('CAPA'))
    const btn = modal && [...modal.querySelectorAll('button')].find((b) => b.querySelector('.fa-xmark'))
    if (btn) btn.click()
  })
  await page.waitForSelector('#capaPreviewArea', { hidden: true, timeout: 15000 }).catch(() => {})

  // Tahap 2.b — mode Auditee isi CAPA (milik Budi Santoso)
  console.log('Tahap 2.b — isi CAPA (auditee)')
  await page.evaluate(() => sessionStorage.setItem('matrika_active_role', 'auditee'))
  await page.reload({ waitUntil: 'networkidle2', timeout: 60000 })
  await waitReady(page)
  await page.waitForSelector('.data-card', { visible: true, timeout: 30000 })
  await clickCardButton(page, 'Budi Santoso', 'CAPA')
  await page.waitForSelector('.swal2-container', { hidden: true, timeout: 30000 }).catch(() => {})
  await page.waitForSelector('#capaNoInput', { visible: true, timeout: 30000 })
  await waitReady(page)
  // isi kolom CAPA per temuan (3 textarea + input date target selesai)
  const isiPerTemuan = [
    ['Label rak penyimpanan bahan halal & non-halal sudah dipasang & difoto pada 20 Okt 2026.',
      'Belum ada standar penandaan area penyimpanan bahan baku.',
      'SOP penandaan area penyimpanan disahkan & audit mingguan oleh QA/QC.', '2026-11-30'],
    ['Produk halal & non-halal dipindahkan ke rak terpisah dengan penandaan warna.',
      'Batasan alokasi rak produk halal/non-halal belum ditetapkan dalam SOP.',
      'Tetapkan alokasi rak & audit kepatuhan mingguan oleh QA/QC.', '2026-12-15'],
  ]
  await page.evaluate((data) => {
    const area = document.querySelector('#capaPreviewArea')
    const rows = [...area.querySelectorAll('tbody tr')].filter((r) => r.querySelector('textarea'))
    rows.forEach((row, i) => {
      const d = data[i] || data[0]
      const vals = [d[0], d[1], d[2]]
      row.querySelectorAll('textarea').forEach((el, k) => {
        Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(el, vals[k] || '')
        el.dispatchEvent(new Event('input', { bubbles: true }))
      })
      const dt = row.querySelector('input[type="date"]')
      if (dt) {
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(dt, d[3])
        dt.dispatchEvent(new Event('input', { bubbles: true }))
      }
    })
  }, isiPerTemuan)
  await sleep(350)
  // zoom 0.45 + scroll horizontal: kolom CORRECTION s/d TARGET terlihat semua
  await page.evaluate(() => {
    const area = document.querySelector('#capaPreviewArea')
    const wrap = area && area.parentElement
    if (area) area.style.zoom = '0.45'
    if (wrap) wrap.scrollLeft = 166
  })
  await sleep(300)
  await shot(page, 'tahap2-b-capa-mgt004-isi')

  await page.close()

  // ================= SESI B: Admin (export Excel + filter status) =================
  console.log('Sesi B — Hendra Wijaya (admin)')
  const admin = await newSession(browser, '1000000001', 'admin123')
  await admin.waitForFunction(() => location.hash.startsWith('#/kategori'), { timeout: 30000 }) // admin auto-skip role
  await clickCard(admin, '.menu-grid', 'Halal')
  await admin.waitForFunction(() => location.hash.startsWith('#/list/'), { timeout: 20000 })
  await admin.waitForSelector('.data-card', { visible: true, timeout: 30000 })
  await waitReady(admin)
  await admin.select('.search-bar select', 'Submitted')
  await sleep(400)
  await admin.evaluate(() => window.scrollTo(0, 0))
  await shot(admin, 'tahap3-c-filter-export-excel')

  await admin.close()
  await browser.close()
  console.log(`\nSelesai — ${fs.readdirSync(OUT).filter((f) => f.endsWith('.png')).length} screenshot di ${OUT}`)
}

main().catch((err) => {
  console.error('GAGAL:', err.message)
  process.exit(1)
})
