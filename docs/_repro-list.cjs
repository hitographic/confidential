/** Reproduksi: form -> Batal -> list, dengan logging semua request GAS. */
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

function mock(body) {
  switch (body.action) {
    case 'login': return { success: true, nama: ME.nama, role: ME.role }
    case 'getSignatureInfo': return { success: true, exists: true, signatureUrl: '', createdAt: '-', updatedAt: '-' }
    case 'getList': return { success: true, data: ROWS, activeRole: 'auditor', roles: ['auditor'] }
    case 'getDepartemen': return { success: true, data: [{ id: 'd1', nama: 'Produksi 1' }, { id: 'd2', nama: 'Gudang' }] }
    case 'getChecklist': return { success: true, data: CHECKLIST }
    case 'getDetail': return { success: true, data: { id: 'a1', checklistData: [], kategori: 'Halal' } }
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

  const log = []
  await page.setRequestInterception(true)
  page.on('request', async (req) => {
    try {
      if (req.url().includes('script.google.com')) {
        let body = {}; try { body = JSON.parse(req.postData() || '{}') } catch {}
        const t0 = Date.now()
        // tiru latency GAS asli (cold start ~2-4 dtk)
        await sleep(body.action === 'getList' ? 1200 : 300)
        const res = mock(body)
        log.push({ t: new Date().toISOString(), action: body.action, payload: { ...body, action: undefined }, ms: Date.now() - t0, ok: res.success })
        return await req.respond({ status: 200, contentType: 'application/json; charset=utf-8', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(res) })
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

  // ke list via kategori
  await clickText(page, 'Halal', '.menu-card')
  await page.waitForFunction(() => location.hash.includes('list'), { timeout: 10000 })
  await sleep(2000)
  console.log('LANGKAH 1 — list via kategori:', 'cards =', await countCards(page), '| empty =', await emptyShown(page))

  // masuk form lewat Edit (agar ada isu form)
  await clickText(page, 'Edit', 'button')
  await page.waitForFunction(() => location.hash.includes('form'), { timeout: 10000 })
  await sleep(1500)
  console.log('LANGKAH 2 — di form:', await page.evaluate(() => location.hash))

  // klik Batal
  log.length = 0
  await clickText(page, 'Batal', 'button')
  await page.waitForFunction(() => location.hash.includes('list'), { timeout: 10000 })
  await sleep(300)
  const t0 = Date.now()
  let cards = -1
  for (let i = 0; i < 20; i++) {
    await sleep(400)
    cards = await countCards(page)
    if (cards > 0) break
  }
  console.log(`LANGKAH 3 — setelah Batal: cards = ${cards} | empty = ${await emptyShown(page)} | tunggu ${Date.now() - t0}ms`)

  await page.screenshot({ path: path.join(OUT, 'repro-form-ke-list.png') })
  console.log('\nRequest GAS setelah Batal:')
  console.log(JSON.stringify(log, null, 2))

  await browser.close()
})().catch((e) => { console.error('GAGAL:', e.message); process.exit(1) })
