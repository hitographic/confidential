/** Probe singkat: font sel wrap BERTEKS + screenshot viewport halaman CQA-75. */
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT = '/private/var/folders/3t/_9nv46zd4qgdk1xbv8ys47g40000gn/T/opencode/cqa75-shots'
const BASE = process.argv[2] || 'http://localhost:5173'

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true, args: ['--no-sandbox', '--hide-scrollbars'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 1000 })

try {
  await page.goto(`${BASE}/#/login`, { waitUntil: 'networkidle2', timeout: 90000 })
  await page.waitForSelector('input[placeholder="Masukkan NIK Anda"]', { timeout: 30000 })
  await page.type('input[placeholder="Masukkan NIK Anda"]', '400377')
  await page.type('input[placeholder="Masukkan password"]', 'Ind0f00d26')
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => /#\/(kategori|pilih-role)/.test(location.hash), { timeout: 45000 })
  await page.goto(`${BASE}/#/CQA-75`, { waitUntil: 'networkidle2', timeout: 90000 })
  await page.waitForSelector('#c75Preview .xpage', { timeout: 90000 })
  await new Promise((r) => setTimeout(r, 1200))

  const dump = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('#c75Preview .xcell')]
      .filter((c) => (c.textContent || '').trim())
      .slice(0, 6)
      .map((c) => {
        const cs = getComputedStyle(c)
        return {
          text: c.textContent.trim().slice(0, 45),
          fontSize: cs.fontSize,
          family: cs.fontFamily.slice(0, 45),
          weight: cs.fontWeight,
        }
      })
    // bandingkan dgn sel td langsung (nowrap)
    const tdText = [...document.querySelectorAll('#c75Preview table.xsheet td')]
      .filter((t) => (t.textContent || '').trim() && !t.querySelector('.xcell'))
      .slice(0, 3)
      .map((t) => {
        const cs = getComputedStyle(t)
        return { text: t.textContent.trim().slice(0, 30), fontSize: cs.fontSize, family: cs.fontFamily.slice(0, 45) }
      })
    return { wrapCells: cells, nowrapCells: tdText }
  })
  console.log(JSON.stringify(dump, null, 2))

  await page.screenshot({ path: path.join(OUT, 'layout-top.png') })
  await page.evaluate(() => window.scrollTo(0, 650))
  await new Promise((r) => setTimeout(r, 400))
  await page.screenshot({ path: path.join(OUT, 'layout-scroll.png') })
  console.log('OK screenshots')
} catch (e) {
  console.error('GAGAL:', e.message)
  process.exitCode = 1
} finally {
  await browser.close()
}
