/**
 * Probe 2: semua sel BERTEKS di preview — inline style lengkap + computed.
 * Jalankan: node scripts/_probe-cqa75.mjs2 [url] [nik] [pw]
 */
import puppeteer from 'puppeteer-core'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = process.argv[2] || 'https://confidential.my.id'
const NIK = process.argv[3] || '400377'
const PW = process.argv[4] || 'Ind0f00d26'

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--hide-scrollbars'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 1000 })

try {
  await page.goto(`${BASE}/#/login`, { waitUntil: 'networkidle2', timeout: 90000 })
  await page.waitForSelector('input[placeholder="Masukkan NIK Anda"]', { timeout: 30000 })
  await page.type('input[placeholder="Masukkan NIK Anda"]', NIK)
  await page.type('input[placeholder="Masukkan password"]', PW)
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => /#\/(kategori|pilih-role)/.test(location.hash), { timeout: 45000 })
  await page.goto(`${BASE}/#/CQA-75`, { waitUntil: 'networkidle2', timeout: 90000 })
  await page.waitForSelector('#c75Preview .xpage', { timeout: 90000 })
  await new Promise((r) => setTimeout(r, 1000))

  const dump = await page.evaluate(() => {
    const out = { textCells: [], header: null, geom: {} }
    const table = document.querySelector('#c75Preview table.xsheet')
    const tds = [...table.querySelectorAll('tbody td')].filter((td) => (td.textContent || '').trim())
    tds.slice(0, 25).forEach((td) => {
      const cs = getComputedStyle(td)
      out.textCells.push({
        text: td.textContent.trim().slice(0, 40),
        inline: td.getAttribute('style') || '',
        fontSize: cs.fontSize,
        family: cs.fontFamily.slice(0, 55),
        weight: cs.fontWeight,
        style: cs.fontStyle,
      })
    })
    // header tabel = style attribute LENGKAP utk font & lebar kolom
    out.header = table.getAttribute('style')
    const cols = [...table.querySelectorAll('col')].map((c) => c.style.width)
    out.geom = {
      zoom: table.style.zoom,
      colsPx: cols,
      colsSum: cols.reduce((a, w) => a + parseFloat(w || 0), 0),
      firstRowH: table.querySelector('tbody tr')?.style.height,
      rowCount: table.querySelectorAll('tbody tr').length,
      wrapW: document.querySelector('#c75Preview .xtable-wrap')?.getBoundingClientRect().width,
      fontFamTable: getComputedStyle(table).fontFamily,
      fontSzTable: getComputedStyle(table).fontSize,
    }
    return out
  })
  console.log(JSON.stringify(dump, null, 2))
} catch (e) {
  console.error('GAGAL:', e.message)
  process.exitCode = 1
} finally {
  await browser.close()
}
