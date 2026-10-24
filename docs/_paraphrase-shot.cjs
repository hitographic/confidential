/** Screenshot preview MGT-003 terparafrasa (mock data tersimpan). */
const fs = require('fs')
const path = require('path')
const puppeteer = require('puppeteer-core')

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = 'http://localhost:5173'
const OUT = path.join(__dirname, '_ui-preview')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const ME = { nik: '19870412', nama: 'Rina Kusumawati', role: 'auditor,auditee' }

// bentuk data TERSIMPAN (hasilPengamatan mentah seperti dikirim FormPage)
const Q = {
  sosis: 'Ada kegiatan sosialisasi Kebijakan Halal; sebutkan bentuk sosialisasinya',
  pelatihan: 'Terdapat kegiatan pelatihan ( internal & eksternal ) SJPH untuk karyawan . JifKA',
  rutin: 'Pelatihan Halal dilakukan secara rutin / terjadwal minimal 1 kali dalam 1 tahun Jika "YA", periksa bukti tertulis',
  trainer: 'Trainer telah lulus pelatihan SJPH ( eksternal / internal ), periksa sertifikat',
  evaluasi: 'Dilakukan evaluasi terhadap hasil training SJPH',
  ikuti: 'Pelatihan diikuti oleh semua karyawan yang terlibat dalam aktivitas kritis dan karyawan baru',
}
// lengkapi (terpisah agar tidak terpotong di atas)
Q.pelatihan = 'Terdapat kegiatan pelatihan ( internal & eksternal ) SJPH untuk karyawan . Jika "YA", kapan terakhir dilakukan pelatihan ?'

const CHECKLIST_DATA = [
  { no: 'I', type: 1, pertanyaan: 'KOMITMEN DAN TANGGUNG JAWAB', kriteria: '', hasilPengamatan: '', kategoriVal: '', photos: [] },
  { no: '1.1.c', type: 0, pertanyaan: Q.sosis, kriteria: '1', hasilPengamatan: Q.sosis, kategoriVal: 'C', photos: [] },
  { no: '1.3.a', type: 0, pertanyaan: Q.pelatihan, kriteria: '1', hasilPengamatan: Q.pelatihan, kategoriVal: 'C', photos: [] },
  { no: '1.3.b', type: 0, pertanyaan: Q.rutin, kriteria: '1', hasilPengamatan: Q.rutin, kategoriVal: 'C', photos: [] },
  { no: '1.3.c', type: 0, pertanyaan: Q.trainer, kriteria: '1', hasilPengamatan: Q.trainer, kategoriVal: 'C', photos: [] },
  { no: '1.3.d', type: 0, pertanyaan: Q.evaluasi, kriteria: '1', hasilPengamatan: Q.evaluasi, kategoriVal: 'C', photos: [] },
  { no: '1.3.e', type: 0, pertanyaan: Q.ikuti, kriteria: '1', hasilPengamatan: Q.ikuti, kategoriVal: 'C', photos: [] },
  // temuan (Tidak + keterangan)
  { no: '1.3.g', type: 0, pertanyaan: Q.sosis, kriteria: '2', hasilPengamatan: 'Tidak ditemukan bukti sosialisasi tertulis di papan informasi', kategoriVal: 'Minor', photos: [] },
]

const sig = (n) => 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="70"><rect width="220" height="70" fill="white"/><text x="110" y="42" font-family="cursive" font-size="21" text-anchor="middle">${n}</text></svg>`
)

const ROWS = [
  { id: 'a1', tanggal: '2026-10-14T07:41:29.361Z', auditor: ME.nama, auditee: 'Budi Santoso', kategori: 'Halal', status: 'Submitted', hasAuditorSign: true, hasAuditeeSign: true, departemen: 'HR' },
]

const DETAIL = {
  id: 'a1', tanggal: '2026-10-14T07:41:29.361Z', auditorName: ME.nama, auditeeName: 'Budi Santoso',
  kategori: 'Halal', departemen: 'HR', checklistData: CHECKLIST_DATA, status: 'Submitted',
  auditorSignature: sig(ME.nama), auditeeSignature: sig('Budi Santoso'),
  hashIntegritas: '9f2c7e41a8d3b65c0e7f4a2d91c8b3e5', lampiran: [], capa: [],
}

function mock(body) {
  switch (body.action) {
    case 'login': return { success: true, nama: ME.nama, role: ME.role }
    case 'getSignatureInfo': return { success: true, exists: true, signatureUrl: sig(ME.nama), createdAt: '12 Maret 2026', updatedAt: '2 Oktober 2026' }
    case 'getList': return { success: true, data: ROWS, activeRole: 'auditor', roles: ['auditor', 'auditee'] }
    case 'getDetail': return { success: true, data: DETAIL }
    default: return { success: true, data: [], message: 'mock' }
  }
}

async function clickText(page, text, sel = 'button, .menu-card, .dropdown-item, a') {
  return page.evaluate((t, s) => {
    const el = [...document.querySelectorAll(s)].find((e) => e.textContent.replace(/\s+/g, ' ').trim().includes(t))
    if (!el) return false
    el.click(); return true
  }, text, sel)
}

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] })
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 2 })
  await page.setRequestInterception(true)
  page.on('request', async (req) => {
    try {
      if (req.url().includes('script.google.com')) {
        let body = {}; try { body = JSON.parse(req.postData() || '{}') } catch {}
        return await req.respond({ status: 200, contentType: 'application/json; charset=utf-8', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(mock(body)) })
      }
      return await req.continue()
    } catch { try { await req.continue() } catch {} }
  })

  await page.goto(`${BASE}/#/login`, { waitUntil: 'networkidle2', timeout: 60000 })
  await sleep(700)
  await page.type('input[placeholder="Masukkan NIK Anda"]', ME.nik)
  await page.type('input[placeholder="Masukkan password"]', 'contoh')
  await page.click('button[type="submit"]')
  await sleep(1000)
  await page.waitForSelector('.swal2-popup', { timeout: 8000 }).catch(() => {})
  await sleep(300)
  await clickText(page, 'Gunakan yang Sudah Ada', '.swal2-actions button').catch(() => {})
  await page.waitForFunction(() => location.hash.includes('pilih-role') || location.hash.includes('kategori'), { timeout: 10000 })
  await sleep(600)

  await page.goto(`${BASE}/#/list/${encodeURIComponent('Halal')}`, { waitUntil: 'networkidle2' })
  await sleep(1500)
  await clickText(page, 'Preview', 'button')
  await sleep(2500)
  await page.screenshot({ path: path.join(OUT, '04-preview-terparafrasa.png'), fullPage: false })
  console.log('  ✔ 04-preview-terparafrasa.png')

  // crop area tabel hasil pengamatan agar teks terbaca
  const el = await page.$('#previewArea')
  if (el) {
    await el.screenshot({ path: path.join(OUT, '05-mgt003-detail.png') })
    console.log('  ✔ 05-mgt003-detail.png')
  }

  await browser.close()
  console.log('Selesai ->', OUT)
})().catch((e) => { console.error('GAGAL:', e.message); process.exit(1) })
