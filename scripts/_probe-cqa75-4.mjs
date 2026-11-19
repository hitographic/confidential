/** Verifikasi mobile (tab File/TTD/Preview) + mode Pas (fit zoom). */
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT = '/private/var/folders/3t/_9nv46zd4qgdk1xbv8ys47g40000gn/T/opencode/cqa75-shots'
const BASE = process.argv[2] || 'http://localhost:5173'

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true, args: ['--no-sandbox', '--hide-scrollbars'],
})

try {
  // ===== MOBILE 390px =====
  const m = await browser.newPage()
  await m.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
  await m.goto(`${BASE}/#/login`, { waitUntil: 'networkidle2', timeout: 90000 })
  await m.waitForSelector('input[placeholder="Masukkan NIK Anda"]', { timeout: 30000 })
  await m.type('input[placeholder="Masukkan NIK Anda"]', '400377')
  await m.type('input[placeholder="Masukkan password"]', 'Ind0f00d26')
  await m.click('button[type="submit"]')
  await m.waitForFunction(() => /#\/(kategori|pilih-role)/.test(location.hash), { timeout: 45000 })
  await m.goto(`${BASE}/#/CQA-75`, { waitUntil: 'networkidle2', timeout: 90000 })
  await m.waitForSelector('#c75Preview .xpage', { timeout: 90000 })
  await new Promise((r) => setTimeout(r, 1500))

  const vis = async (tab) => {
    await m.evaluate((t) => {
      const btn = [...document.querySelectorAll('.mtab button')].find((b) => b.textContent.includes(t))
      btn?.click()
    }, tab)
    await new Promise((r) => setTimeout(r, 350))
    return m.evaluate(() => {
      const show = (s) => {
        const el = document.querySelector(s)
        if (!el) return null
        return getComputedStyle(el).display !== 'none'
      }
      const table = document.querySelector('#c75Preview table.xsheet')
      return {
        file: show('.pane-file'),
        nama: show('.pane-nama'),
        preview: show('.pane-preview'),
        zoom: table?.style.zoom,
        pageW: document.querySelector('.c75-page')?.getBoundingClientRect().width,
        overflowX: document.documentElement.scrollWidth > window.innerWidth,
      }
    })
  }
  console.log('MOBILE tab File   :', JSON.stringify(await vis('File')))
  console.log('MOBILE tab TTD    :', JSON.stringify(await vis('TTD')))
  console.log('MOBILE tab Preview:', JSON.stringify(await vis('Preview')))
  await m.screenshot({ path: path.join(OUT, 'mobile-preview.png') })
  await m.close()

  // ===== DESKTOP: mode Pas (fit) =====
  const d = await browser.newPage()
  await d.setViewport({ width: 1600, height: 1000 })
  await d.goto(`${BASE}/#/login`, { waitUntil: 'networkidle2', timeout: 90000 })
  await d.waitForSelector('input[placeholder="Masukkan NIK Anda"]', { timeout: 30000 })
  await d.type('input[placeholder="Masukkan NIK Anda"]', '400377')
  await d.type('input[placeholder="Masukkan password"]', 'Ind0f00d26')
  await d.click('button[type="submit"]')
  await d.waitForFunction(() => /#\/(kategori|pilih-role)/.test(location.hash), { timeout: 45000 })
  await d.goto(`${BASE}/#/CQA-75`, { waitUntil: 'networkidle2', timeout: 90000 })
  await d.waitForSelector('#c75Preview .xpage', { timeout: 90000 })
  await new Promise((r) => setTimeout(r, 1500))

  const before = await d.evaluate(() => document.querySelector('#c75Preview table.xsheet')?.style.zoom)
  await d.click('.pvrow.tools .seg.small button:first-child') // "Pas"
  await new Promise((r) => setTimeout(r, 500))
  const after = await d.evaluate(() => {
    const table = document.querySelector('#c75Preview table.xsheet')
    const wrap = document.querySelector('#c75Preview .xtable-wrap')
    return {
      zoom: table?.style.zoom,
      tableW: table?.getBoundingClientRect().width,
      wrapW: wrap?.getBoundingClientRect().width,
      scrollW: wrap?.scrollWidth,
    }
  })
  console.log('DESKTOP zoom default (1:1):', before, '| setelah klik Pas:', JSON.stringify(after))
  await d.screenshot({ path: path.join(OUT, 'desktop-fit.png') })
  await d.close()
  console.log('OK')
} catch (e) {
  console.error('GAGAL:', e.message)
  process.exitCode = 1
} finally {
  await browser.close()
}
