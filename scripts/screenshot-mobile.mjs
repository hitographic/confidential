/**
 * Screenshot langkah-langkah aplikasi (mobile portrait 9:16).
 *
 * Output : screenshots/01-*.png .. 11-*.png  (1080x1920 = 360x640 CSS @3x)
 * Data   : semua request ke backend GAS DI-MOCK (tidak menyentuh Sheet asli).
 *
 * Jalankan:
 *   npm run dev -- --port 5173 --strictPort   (terminal 1)
 *   node scripts/screenshot-mobile.mjs        (terminal 2)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'screenshots')
const BASE = 'http://localhost:5173'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const FOTO = path.join(ROOT, 'public', 'logo-confidential.png')

fs.mkdirSync(OUT, { recursive: true })

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
// index temuan "Tidak" di form (baris non-header)
const IDX_TIDAK = 4

const DETAIL = {
  id: 'AUD-2026-014',
  kategori: 'Halal',
  departemen: 'Produksi',
  tanggal: '2026-10-15T08:00:00.000Z',
  auditorName: 'Budi Santoso',
  auditeeName: 'Siti Aminah',
  hashIntegritas: 'b7f3c9e2a4d81f6053c1e8b9a7d24f6c8e0b5a3d9f7c2e1a6b4d8f0c3e5a7b9d',
  auditorSignature: '',
  auditeeSignature: '',
  capa: [],
  lampiran: [],
  checklistData: CHECKLIST.map((q) => {
    if (q.type) return { ...q, hasilPengamatan: '', kategoriVal: '', photos: [] }
    // temuan CAPA utk baris no 5 (Minor) dan no 7 (Major)
    if (q.no === 5) return { ...q, hasilPengamatan: 'Pemisahan bahan halal dan non-halal di area penyimpanan belum dilabeli dengan jelas.', kategoriVal: 'Minor', photos: [] }
    if (q.no === 7) return { ...q, hasilPengamatan: 'Produk halal dan non-halal diletakkan pada rak yang sama tanpa penandaan terpisah.', kategoriVal: 'Major', photos: [] }
    return { ...q, hasilPengamatan: q.pertanyaan, kategoriVal: 'C', photos: [] }
  }),
}

const MOCKS = {
  login: { success: true, nama: 'Budi Santoso', role: 'auditor,auditee' },
  getSignatureInfo: { success: true, exists: true, createdAt: '12 Januari 2026', updatedAt: '03 Oktober 2026' },
  getChecklist: { success: true, data: CHECKLIST },
  getDepartemen: {
    success: true,
    data: [
      { nama: 'Produksi' },
      { nama: 'QA/QC' },
      { nama: 'Pengemasan' },
      { nama: 'Gudang Bahan Baku' },
      { nama: 'Engineering' },
    ],
  },
  getList: {
    success: true,
    data: [
      { id: 'AUD-2026-014', kategori: 'Halal', auditee: 'Siti Aminah', auditor: 'Budi Santoso', departemen: 'Produksi', tanggal: '2026-10-15', status: 'Draft', hasAuditorSign: false, hasAuditeeSign: false },
      { id: 'AUD-2026-011', kategori: 'Halal', auditee: 'Rahmat Hidayat', auditor: 'Budi Santoso', departemen: 'QA/QC', tanggal: '2026-10-08', status: 'Submitted', hasAuditorSign: true, hasAuditeeSign: true },
      { id: 'AUD-2026-009', kategori: 'Halal', auditee: 'Dewi Lestari', auditor: 'Agus Priyanto', departemen: 'Gudang Bahan Baku', tanggal: '2026-09-28', status: 'Draft', hasAuditorSign: false, hasAuditeeSign: false },
    ],
    message: '',
  },
  getDetail: { success: true, data: DETAIL },
  fetchImages: { success: true, images: {} },
  getVersion: { success: true, version: '1.0.0' },
  saveDraft: { success: true, message: 'Data berhasil disimpan.' },
  submitFinal: { success: true, message: 'Data berhasil disubmit.' },
  saveCapa: { success: true, message: 'CAPA berhasil disimpan.' },
  deleteData: { success: true, message: 'Data berhasil dihapus.' },
  updateSignature: { success: true, message: 'Tanda tangan tersimpan.' },
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST,GET,OPTIONS',
  'access-control-allow-headers': '*',
}

// ---------------------------------------------------------------- helpers
async function setupInterception(page) {
  await page.setRequestInterception(true)
  page.on('request', (req) => {
    const url = req.url()
    if (url.includes('script.google.com')) {
      if (req.method() === 'OPTIONS') {
        return req.respond({ status: 204, headers: CORS, body: '' })
      }
      let body = {}
      try { body = JSON.parse(req.postData() || '{}') } catch {}
      const action = body.action
      const payload = MOCKS[action] || { success: true, data: [], message: '' }
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
  // stabilkan animasi/transisi dulu (double rAF + jeda)
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  await sleep(150)
  const file = path.join(OUT, `${name}.png`)
  await page.screenshot({ path: file })
  console.log(`  ✓ ${name}.png`)
}

async function waitText(page, text, timeout = 20000) {
  await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, text)
}

async function clickByText(page, selector, text, { exact = false } = {}) {
  const ok = await page.evaluate((sel, t, ex) => {
    const els = [...document.querySelectorAll(sel)]
    const el = els.find((e) => (ex ? e.textContent.trim() === t : e.textContent.replace(/\s+/g, ' ').includes(t)))
    if (!el) return false
    el.scrollIntoView({ block: 'center' })
    el.click()
    return true
  }, selector, text, exact)
  if (!ok) throw new Error(`Elemen tidak ketemu: ${selector} "${text}"`)
}

/** Klik kartu berdasarkan judul h3-nya (mis. "Auditor", "Halal"). */
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
  // font web (Plus Jakarta Sans + Font Awesome) harus sudah siap
  await page.evaluate(() => document.fonts.ready)
  await page.waitForFunction(() => document.fonts.check('900 1em "Font Awesome 6 Free"'), { timeout: 15000 }).catch(() => console.log('  ! Font Awesome belum terkonfirmasi (lanjut)'))
}

// ---------------------------------------------------------------- main
async function main() {
  console.log('Buka dev server…')
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(BASE)
      if (r.ok) break
    } catch {}
    if (i === 29) throw new Error('Dev server tidak jalan di ' + BASE)
    await sleep(1000)
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars', '--force-color-profile=srgb'],
  })
  const page = await browser.newPage()
  page.setDefaultTimeout(25000)
  await page.setViewport({ width: 360, height: 640, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')
  await setupInterception(page)
  // tangkap error runtime browser (berguna saat debug alur)
  page.on('pageerror', (e) => console.log('   [pageerror]', String(e).slice(0, 300)))

  // ---- 01 login
  console.log('Step 01 — Login')
  await page.goto(`${BASE}/#/login`, { waitUntil: 'networkidle2', timeout: 60000 })
  await waitReady(page)
  await waitText(page, 'Selamat Datang')
  await page.type('input[autocomplete="username"]', '1987654321')
  await page.type('input[type="password"]', 'rahasia123')
  await shot(page, '01-login')

  // ---- masuk → dialog tanda tangan
  console.log('Step 02 — Verifikasi TTD')
  await clickByText(page, 'button[type="submit"]', 'Masuk', { exact: false })
  await page.waitForSelector('.swal2-popup', { visible: true, timeout: 30000 })
  await waitText(page, 'Tanda Tangan Terdaftar')
  await shot(page, '02-verifikasi-ttd')
  await clickByText(page, '.swal2-confirm', 'Gunakan yang Sudah Ada', { exact: false })
  await page.waitForSelector('.swal2-container', { hidden: true, timeout: 20000 }).catch(() => {})

  // ---- 03 pilih role
  console.log('Step 03 — Pilih Role')
  await page.waitForSelector('.role-gate-grid', { visible: true, timeout: 30000 })
  await waitReady(page)
  await shot(page, '03-pilih-role')
  await clickCard(page, '.role-gate-grid', 'Auditor')

  // ---- 04 kategori
  console.log('Step 04 — Kategori')
  await page.waitForFunction(() => location.hash.startsWith('#/kategori'), { timeout: 20000 })
  await waitText(page, 'Pilih Kategori Audit')
  await waitReady(page)
  await shot(page, '04-kategori')
  await clickCard(page, '.menu-grid', 'Halal')

  // ---- 05 daftar pengamatan
  console.log('Step 05 — Daftar Pengamatan')
  await page.waitForFunction(() => location.hash.startsWith('#/list/'), { timeout: 20000 })
  await page.waitForSelector('.data-card', { visible: true, timeout: 30000 })
  await waitReady(page)
  await shot(page, '05-daftar-pengamatan')

  // ---- 06 modal audit baru
  console.log('Step 06 — Audit Baru')
  await clickByText(page, 'button', 'Tambah Data')
  await page.waitForSelector('.modal-overlay .modal-content', { visible: true })
  await waitText(page, 'Mulai Audit Baru')
  await shot(page, '06-audit-baru')
  await page.select('.modal-overlay .modal-content select', 'Produksi')
  await sleep(200)
  await clickByText(page, '.modal-overlay .modal-content button', 'Mulai Checklist')

  // ---- 07 form checklist
  console.log('Step 07 — Form Checklist')
  await page.waitForFunction(() => location.hash.startsWith('#/form'), { timeout: 20000 })
  await page.waitForSelector('table.checklist-table tbody tr', { visible: true, timeout: 30000 })
  await waitReady(page)

  // isi semua baris non-header "Ya", kecuali baris temuan
  const answered = await page.evaluate((skipIdx) => {
    let n = 0
    document.querySelectorAll('table.checklist-table tbody tr').forEach((tr, i) => {
      if (i === skipIdx) return
      const ya = tr.querySelector(`input[name="kesesuaian_${i}"][value="Ya"]`)
      if (ya) { ya.click(); n++ }
    })
    return n
  }, IDX_TIDAK)
  await sleep(200)

  // baris temuan: "Tidak" + kategori Minor + keterangan
  const rowSel = `table.checklist-table tbody tr:nth-child(${IDX_TIDAK + 1})`
  await page.evaluate((i) => {
    const el = document.querySelector(`input[name="kesesuaian_${i}"][value="Tidak"]`)
    if (el) el.click()
  }, IDX_TIDAK)
  await page.select(`${rowSel} select`, 'Minor')
  // ketik keterangan TANPA klik mouse (hindari risiko klik ke bottom-nav fixed)
  const typed = await page.evaluate((text) => {
    const ta = document.querySelector('table.checklist-table tbody tr:nth-child(5) textarea')
    if (!ta) return false
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
    setter.call(ta, text)
    ta.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  }, 'Pemisahan bahan halal dan non-halal di area penyimpanan belum dilabeli dengan jelas.')
  if (!typed) throw new Error('textarea keterangan tidak ketemu')
  await sleep(200)

  // foto wajib utk temuan "Tidak"
  console.log('  – upload foto temuan (CropPhotoModal)')
  const fileInput = await page.$(`#photoInput_${IDX_TIDAK}`)
  if (!fileInput) throw new Error('input foto temuan tidak ketemu')
  await fileInput.uploadFile(FOTO)
  await page.waitForSelector('#cropCanvas', { visible: true, timeout: 20000 })
  await waitReady(page)
  await shot(page, '07-potong-foto')
  await page.type('.modal-content input[placeholder^="Keterangan foto"]', 'Foto temuan pemisahan bahan')
  await clickByText(page, '.modal-content button', 'Simpan Foto')
  await page.waitForSelector('#cropCanvas', { hidden: true, timeout: 15000 })
  await page.waitForSelector(`${rowSel} .photo-thumb`, { visible: true, timeout: 15000 })
  console.log(`  (${answered} baris diisi Ya)`)

  // ---- 08 form (kiri-atas)
  console.log('Step 08 — Form terisi')
  await page.evaluate(() => {
    window.scrollTo(0, 0)
    const wrap = document.querySelector('.table-responsive')
    if (wrap) wrap.scrollLeft = 0
  })
  await shot(page, '08-form-checklist')

  // ---- 09 form (kolom temuan: kategori/keterangan/foto)
  console.log('Step 09 — Detail temuan')
  await page.evaluate((i) => {
    const tr = document.querySelectorAll('table.checklist-table tbody tr')[i]
    if (tr) tr.scrollIntoView({ block: 'center' })
    const wrap = document.querySelector('.table-responsive')
    if (wrap) wrap.scrollLeft = wrap.scrollWidth
  }, IDX_TIDAK)
  await shot(page, '09-form-temuan')

  // ---- 10 preview laporan MGT-003
  console.log('Step 10 — Preview Laporan')
  await clickByText(page, '.form-footer button', 'Review & Submit')
  await waitText(page, 'Preview Laporan', 30000)
  await page.waitForSelector('#previewArea', { visible: true })
  await waitReady(page)
  await shot(page, '10-preview-laporan')
  // tutup preview
  await page.evaluate(() => {
    const modal = [...document.querySelectorAll('.modal-content')].find((m) => m.textContent.includes('Preview Laporan'))
    const btn = modal && [...modal.querySelectorAll('button')].find((b) => b.querySelector('.fa-xmark'))
    if (btn) btn.click()
  })
  await page.waitForSelector('#previewArea', { hidden: true, timeout: 15000 }).catch(() => {})

  // ---- 11 CAPA MGT-004
  console.log('Step 11 — CAPA MGT-004')
  await clickByText(page, '.list-header .list-back-btn', 'Batal')
  await page.waitForFunction(() => location.hash.startsWith('#/list/'), { timeout: 20000 })
  await page.waitForSelector('.data-card', { visible: true, timeout: 30000 })
  await clickByText(page, '.data-card button', 'CAPA')
  await page.waitForSelector('.swal2-container', { hidden: true, timeout: 30000 }).catch(() => {})
  await page.waitForSelector('.modal-overlay .modal-content', { visible: true, timeout: 30000 })
  await waitReady(page)
  await shot(page, '11-capa-mgt004')

  await browser.close()
  console.log(`\nSelesai — ${fs.readdirSync(OUT).filter((f) => f.endsWith('.png')).length} screenshot di ${OUT}`)
}

main().catch(async (err) => {
  console.error('GAGAL:', err.message)
  process.exit(1)
})
