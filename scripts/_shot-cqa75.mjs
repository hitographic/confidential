/**
 * Screenshot diagnostik halaman CQA-75 (live site) — untuk memperbaiki
 * fidelity preview Excel (tampilan/font/layout vs Excel asli).
 *
 * Jalankan:  node scripts/_shot-cqa75.mjs [url] [nik] [pw]
 * Output  :  $TMP/opencode/cqa75-shots/*.png + MEASURE json di stdout
 */
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT = path.join('/private/var/folders/3t/_9nv46zd4qgdk1xbv8ys47g40000gn/T/opencode', 'cqa75-shots')
const BASE = process.argv[2] || 'https://confidential.my.id'
const NIK = process.argv[3] || '400377'
const PW = process.argv[4] || 'Ind0f00d26'
const TAG = process.argv[5] || 'live'

fs.mkdirSync(OUT, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--hide-scrollbars'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 })

try {
  // ---- login ----
  await page.goto(`${BASE}/#/login`, { waitUntil: 'networkidle2', timeout: 90000 })
  await page.waitForSelector('input[placeholder="Masukkan NIK Anda"]', { timeout: 30000 })
  await page.type('input[placeholder="Masukkan NIK Anda"]', NIK)
  await page.type('input[placeholder="Masukkan password"]', PW)
  await page.click('button[type="submit"]')
  await page.waitForFunction(
    () => /#\/(kategori|pilih-role|list|form)/.test(location.hash),
    { timeout: 45000 }
  )

  // ---- buka halaman CQA-75 ----
  await page.goto(`${BASE}/#/CQA-75`, { waitUntil: 'networkidle2', timeout: 90000 })
  await page.waitForSelector('#c75Preview .xpage', { timeout: 90000 })
  await new Promise((r) => setTimeout(r, 1200))

  const measure = await page.evaluate(() => {
    const q = (s) => document.querySelector(s)
    const table = q('#c75Preview table.xsheet')
    const wrap = q('#c75Preview .xtable-wrap')
    const xpage = q('#c75Preview .xpage')
    const pane = q('.pane-preview')
    const layout = q('.c75-page .layout')
    const td = table?.querySelector('tbody tr td')
    const cs = td ? getComputedStyle(td) : null
    const cellDiv = table?.querySelector('.xcell')
    const ccs = cellDiv ? getComputedStyle(cellDiv) : null
    return {
      viewport: innerWidth,
      container: q('.container')?.getBoundingClientRect().width,
      layoutWidth: layout?.getBoundingClientRect().width,
      panePreviewWidth: pane?.getBoundingClientRect().width,
      wrapWidth: wrap?.getBoundingClientRect().width,
      tableCssWidth: table?.style.width,
      tableRenderedWidth: table?.getBoundingClientRect().width,
      zoom: table?.style.zoom,
      xpageWidth: xpage?.getBoundingClientRect().width,
      tdFont: cs?.font,
      tdFontSize: cs?.fontSize,
      xcellFont: ccs?.font,
      xcellFontSize: ccs?.fontSize,
      sheetNrows: document.querySelectorAll('#c75Preview table.xsheet tbody tr').length,
      fontCalibriLoaded: document.fonts.check('11pt Calibri'),
    }
  })
  console.log('MEASURE ' + TAG + ': ' + JSON.stringify(measure, null, 2))

  await page.screenshot({ path: path.join(OUT, `${TAG}-full.png`), fullPage: true })
  const el = await page.$('#c75Preview')
  if (el) await el.screenshot({ path: path.join(OUT, `${TAG}-preview.png`) })

  // mode 1:1 (ukuran asli Excel)
  const btn11 = await page.$('.pvrow.tools .seg.small button:last-child')
  if (btn11) {
    await btn11.click()
    await new Promise((r) => setTimeout(r, 600))
    await page.screenshot({ path: path.join(OUT, `${TAG}-full-1to1.png`), fullPage: true })
  }

  console.log('OK -> ' + OUT)
} catch (e) {
  console.error('GAGAL:', e.message)
  try {
    await page.screenshot({ path: path.join(OUT, `${TAG}-error.png`), fullPage: true })
  } catch {}
  process.exitCode = 1
} finally {
  await browser.close()
}
