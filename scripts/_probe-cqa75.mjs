/**
 * Probe detail: dump inline style + computed font tiap sel preview CQA-75.
 * Jalankan: node scripts/_probe-cqa75.mjs [url] [nik] [pw]
 */
import path from 'node:path'
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
    const out = { tds: [], xcells: [], tableStyle: null, fontsUsed: {} }
    const table = document.querySelector('#c75Preview table.xsheet')
    out.tableStyle = table ? table.getAttribute('style') : null
    const tds = [...document.querySelectorAll('#c75Preview table.xsheet tbody tr:first-child td')]
    tds.slice(0, 12).forEach((td, i) => {
      const cs = getComputedStyle(td)
      out.tds.push({
        i,
        inline: (td.getAttribute('style') || '').slice(0, 220),
        font: cs.font,
        fontSize: cs.fontSize,
        family: cs.fontFamily.slice(0, 60),
        text: (td.textContent || '').slice(0, 30),
      })
    })
    const cells = [...document.querySelectorAll('#c75Preview .xcell')]
    cells.slice(0, 8).forEach((c, i) => {
      const cs = getComputedStyle(c)
      const td = c.closest('td')
      out.xcells.push({
        i,
        inline: (c.getAttribute('style') || '').slice(0, 200),
        tdInline: (td?.getAttribute('style') || '').slice(0, 220),
        fontSize: cs.fontSize,
        lineHeight: cs.lineHeight,
        family: cs.fontFamily.slice(0, 60),
        text: (c.textContent || '').slice(0, 30),
      })
    })
    // kumpulkan semua varian font-size yang dipakai sel
    document.querySelectorAll('#c75Preview table.xsheet td').forEach((td) => {
      const fs = getComputedStyle(td).fontSize
      out.fontsUsed[fs] = (out.fontsUsed[fs] || 0) + 1
    })
    return out
  })
  console.log(JSON.stringify(dump, null, 2))
} catch (e) {
  console.error('GAGAL:', e.message)
  process.exitCode = 1
} finally {
  await browser.close()
}
