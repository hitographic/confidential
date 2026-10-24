/**
 * Uji skenario GAGAL jaringan: list sudah tampil -> buka form -> kembali
 * tapi request getList GAGAL. Seharusnya data TIDAK hilang.
 */
const fs = require('fs')
const path = require('path')
const puppeteer = require('puppeteer-core')

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = 'http://localhost:5173'
const OUT = path.join(__dirname, '_ui-preview')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const ME = { nik: '19870412', nama: 'Rina Kusumawati', role: 'auditor' }
const ROWS = [
  { id: 'a1', tanggal: '2026-10-14T07:41:29.361Z', auditor: ME.nama, auditee: 'Budi Santoso', kategori: 'Halal', status: 'Draft', hasAuditorSign: false, hasAuditeeSign: false, departemen: 'Produksi 1' },
  { id: 'a2', tanggal: '2026-10-16T02:10:00.000Z', auditor: ME.nama, auditee: 'Siti Aminah', kategori: 'Halal', status: 'Submitted', hasAuditorSign: true, hasAuditeeSign: true, departemen: 'Gudang' },
]
const CHECKLIST = [
  { no: 'I', type: 1, kriteria: '', pertanyaan: 'Kebijakan Halal' },
  { no: '1.1', type: 0, kriteria: 'SJPH 4.1', pertanyaan: 'Apakah kebijakan halal tertulis?' },
]

const DETAIL = {
  id: 'a1', tanggal: '2026-10-14T07:41:29.361Z', auditorName: ME.nama, auditeeName: 'Budi Santoso',
  kategori: 'Halal', departemen: 'Produksi 1', status: 'Draft',
  checklistData: CHECKLIST.map((q) => ({ ...q, hasilPengamatan: '', kategoriVal: '', photos: [] })),
  auditorSignature: '', auditeeSignature: '', hashIntegritas: '', lampiran: [], capa: [],
}

let FAIL_LIST = false // saklar: bikin getList gagal

function mock(body) {
  switch (body.action) {
    case 'login': return { success: true, nama: ME.nama, role: ME.role }
    case 'getSignatureInfo': return { success: true, exists: true, signatureUrl: '', createdAt: '-', updatedAt: '-' }
    case 'getList': return { success: true, data: ROWS, activeRole: 'auditor', roles: ['auditor'] }
    case 'getDetail': return { success: true, data: DETAIL }
    case 'getDepartemen': return { success: true, data: [{ id: 'd1', nama: 'Produksi 1' }] }
    case 'getChecklist': return { success: true, data: CHECKLIST }
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
const countCards = (page) => page.evaluate(() => document.querySelectorAll('.data-card').length)
const emptyShown = (page) => page.evaluate(() => !!document.querySelector('.empty-state'))

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] })
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })

  await page.setRequestInterception(true)
  page.on('request', async (req) => {
    try {
      if (req.url().includes('script.google.com')) {
        let body = {}; try { body = JSON.parse(req.postData() || '{}') } catch {}
        if (FAIL_LIST && body.action === 'getList') {
          return await req.abort('failed') // simulasi jaringan putus
        }
        return await req.respond({ status: 200, contentType: 'application/json; charset=utf-8', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(mock(body)) })
      }
      return await req.continue()
    } catch { try { await req.continue() } catch {} }
  })

  await page.goto(`${BASE}/#/login`, { waitUntil: 'networkidle2', timeout: 60000 })
  await sleep(600)
  await page.type('input[placeholder="Masukkan NIK Anda"]', ME.nik)
  await page.type('input[placeholder="Masukkan password"]', 'x')
  await page.click('button[type="submit"]')
  await sleep(1200)
  await page.waitForFunction(() => !location.hash.includes('login'), { timeout: 10000 })

  await clickText(page, 'Halal', '.menu-card')
  await page.waitForFunction(() => location.hash.includes('list'), { timeout: 10000 })
  await sleep(2500) // beri waktu utk isi cache
  console.log('LANGKAH 1 — list awal: cards =', await countCards(page))

  // masuk form lalu kembali, tapi SEKARANG getList gagal total
  FAIL_LIST = true
  await clickText(page, 'Edit', 'button')
  await page.waitForFunction(() => location.hash.includes('form'), { timeout: 10000 })
  await sleep(1200)
  await clickText(page, 'Batal', 'button')
  await page.waitForFunction(() => location.hash.includes('list'), { timeout: 10000 })
  await sleep(4000) // beri waktu retry habis

  const cards = await countCards(page)
  const empty = await emptyShown(page)
  console.log(`LANGKAH 2 — dgn getList GAGAL: cards = ${cards} | empty = ${empty}`)
  console.log(cards > 0 ? '  ✔ LULUS — data TETAP tampil dari cache (tidak hilang)' : '  ✘ GAGAL — list kosong lagi')
  await page.screenshot({ path: path.join(OUT, 'repro-gagal-jaringan.png') })

  await browser.close()
})().catch((e) => { console.error('GAGAL:', e.message); process.exit(1) })
