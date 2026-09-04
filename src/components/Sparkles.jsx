import { useEffect, useRef } from 'react'

const PALETTE = [
  { rgb: '255,255,255', w: 0.6 },
  { rgb: '199,220,255', w: 0.25 },
  { rgb: '165,190,255', w: 0.1 },
  { rgb: '255,236,200', w: 0.05 },
]

const rand = (a, b) => a + Math.random() * (b - a)

function pickColor() {
  let r = Math.random()
  for (const c of PALETTE) {
    r -= c.w
    if (r <= 0) return c.rgb
  }
  return PALETTE[0].rgb
}

/** Sprite glow radial yang di-render sekali — jauh lebih lembut & cepat dari shadowBlur. */
function makeSprite(rgb) {
  const s = 64
  const c = document.createElement('canvas')
  c.width = c.height = s
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  grad.addColorStop(0, `rgba(${rgb},1)`)
  grad.addColorStop(0.22, `rgba(${rgb},0.55)`)
  grad.addColorStop(0.55, `rgba(${rgb},0.12)`)
  grad.addColorStop(1, `rgba(${rgb},0)`)
  g.fillStyle = grad
  g.fillRect(0, 0, s, s)
  return c
}

/**
 * Latar bintang profesional ala hero antigravity.google:
 * langit gelap + nebula + bintang berlapis kedalaman (jauh redup, dekat berhalo),
 * twinkle halus, flare ✦ ramping pada bintang terang, meteor sesekali,
 * parallax + cahaya mengikuti cursor. Murni canvas 2D agar ringan di HP.
 */
export default function Sparkles({ density = 1 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const sprites = {}
    const sprite = (rgb) => sprites[rgb] || (sprites[rgb] = makeSprite(rgb))

    let raf = 0
    let w = 0
    let h = 0
    let stars = []
    let flares = []
    let bgGrad = null
    let nebulas = []
    let vignette = null
    let meteor = null
    let nextMeteorAt = 0
    const mouse = { x: 0, y: 0, tx: 0, ty: 0, px: -9999, py: -9999 }
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    function build() {
      w = window.innerWidth
      h = window.innerHeight
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.floor(w * dpr))
      canvas.height = Math.max(1, Math.floor(h * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const count = Math.round(Math.min(240, Math.max(80, (w * h) / 9500)) * density)
      stars = Array.from({ length: count }, () => {
        const depth = Math.pow(Math.random(), 1.4) // mayoritas bintang jauh
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          r: 0.5 + depth * 1.8,
          color: pickColor(),
          phase: Math.random() * Math.PI * 2,
          speed: rand(0.3, 1.2) * (0.5 + depth * 0.5),
          base: 0.25 + depth * 0.6,
          depth,
          drift: rand(0.04, 0.2) * (0.3 + depth),
          sway: rand(0, Math.PI * 2),
        }
      })
      // Flare hanya untuk segelintir bintang dekat yang terang.
      flares = stars
        .filter((s) => s.depth > 0.62)
        .sort((a, b) => b.base - a.base)
        .slice(0, Math.max(6, Math.round(count * 0.05)))
        .map((s) => ({ s, len: rand(9, 20) }))

      bgGrad = ctx.createLinearGradient(0, 0, 0, h)
      bgGrad.addColorStop(0, '#04060d')
      bgGrad.addColorStop(0.55, '#070c18')
      bgGrad.addColorStop(1, '#04060d')

      const neb = (x, y, r, c) => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r)
        g.addColorStop(0, c)
        g.addColorStop(1, 'rgba(0,0,0,0)')
        return { g, x, y, r }
      }
      const R = Math.max(w, h)
      nebulas = [
        neb(w * 0.15, h * 0.08, R * 0.45, 'rgba(38,80,180,0.20)'),
        neb(w * 0.9, h * 0.88, R * 0.4, 'rgba(99,102,241,0.13)'),
        neb(w * 0.55, h * 0.28, R * 0.35, 'rgba(56,189,248,0.07)'),
        neb(w * 0.5, -h * 0.25, R * 0.5, 'rgba(120,160,255,0.06)'),
      ]
      vignette = ctx.createRadialGradient(
        w / 2, h / 2, Math.min(w, h) * 0.35,
        w / 2, h / 2, Math.max(w, h) * 0.75
      )
      vignette.addColorStop(0, 'rgba(0,0,0,0)')
      vignette.addColorStop(1, 'rgba(0,0,0,0.55)')
    }

    function glow(x, y, size, rgb, alpha) {
      if (alpha <= 0.01) return
      ctx.save()
      ctx.globalAlpha = Math.min(1, alpha)
      ctx.drawImage(sprite(rgb), x - size / 2, y - size / 2, size, size)
      ctx.restore()
    }

    /** Flare ✦ ramping: dua berkas lembut + inti terang. */
    function drawFlare(x, y, len, rgb, alpha) {
      const sp = sprite(rgb)
      ctx.save()
      ctx.globalAlpha = Math.min(1, alpha * 0.55)
      ctx.drawImage(sp, x - len, y - 1, len * 2, 2) // berkas horizontal
      ctx.drawImage(sp, x - 1, y - len * 0.7, 2, len * 1.4) // berkas vertikal
      ctx.globalAlpha = Math.min(1, alpha)
      const core = len * 0.45
      ctx.drawImage(sp, x - core / 2, y - core / 2, core, core)
      ctx.restore()
    }

    function spawnMeteor(now) {
      const speed = rand(9, 14)
      const ang = rand(Math.PI * 0.72, Math.PI * 0.82) // diagonal turun-kiri
      meteor = {
        x: rand(w * 0.25, w + 40),
        y: rand(-20, h * 0.25),
        vx: Math.cos(ang) * speed,
        vy: -Math.sin(ang) * speed * -1,
        tail: rand(10, 16),
        born: now,
        life: rand(700, 1100),
      }
      nextMeteorAt = now + rand(5000, 11000)
    }

    function drawMeteor(now) {
      if (!meteor) {
        if (now >= nextMeteorAt) spawnMeteor(now)
        return
      }
      const p = (now - meteor.born) / meteor.life
      if (p >= 1 || meteor.x < -260 || meteor.y > h + 60) {
        meteor = null
        return
      }
      const alpha = p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85
      const tx = meteor.x - meteor.vx * meteor.tail
      const ty = meteor.y - meteor.vy * meteor.tail
      const grad = ctx.createLinearGradient(meteor.x, meteor.y, tx, ty)
      grad.addColorStop(0, `rgba(235,242,255,${0.85 * alpha})`)
      grad.addColorStop(1, 'rgba(235,242,255,0)')
      ctx.save()
      ctx.strokeStyle = grad
      ctx.lineWidth = 1.6
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(meteor.x, meteor.y)
      ctx.lineTo(tx, ty)
      ctx.stroke()
      ctx.restore()
      glow(meteor.x, meteor.y, 14, '235,242,255', alpha)
    }

    let last = 0
    function frame(t) {
      const dt = Math.min(50, t - last || 16.67) / 16.67
      last = t
      mouse.x += (mouse.tx - mouse.x) * 0.045
      mouse.y += (mouse.ty - mouse.y) * 0.045
      mouse.px += (mouse.tx * w * 0.5 - mouse.px) * 0.06
      mouse.py += (mouse.ty * h * 0.5 - mouse.py) * 0.06

      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, w, h)
      nebulas.forEach((n) => {
        ctx.fillStyle = n.g
        ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2)
      })

      for (const s of stars) {
        s.y -= s.drift * dt
        s.sway += 0.002 * dt
        s.x += Math.sin(s.sway) * 0.08 * dt
        if (s.y < -20) { s.y = h + 20; s.x = Math.random() * w }
        if (s.x < -20) s.x = w + 20
        else if (s.x > w + 20) s.x = -20

        // Twinkle dengan kurva halus (fade natural, bukan kedip linear).
        const tw = 0.5 + 0.5 * Math.sin(t * 0.001 * s.speed + s.phase)
        let a = s.base * (0.15 + 0.85 * Math.pow(tw, 1.5))

        const px = s.x - mouse.x * 22 * s.depth
        const py = s.y - mouse.y * 22 * s.depth

        // Cahaya cursor: bintang di sekitar mouse sedikit menyala.
        const mdx = px - (w / 2 + mouse.px)
        const mdy = py - (h / 2 + mouse.py)
        const md = Math.hypot(mdx, mdy)
        let halo = s.r * 7
        if (md < 150) {
          const f = 1 - md / 150
          a += f * 0.45
          halo *= 1 + f * 0.8
        }

        glow(px, py, halo, s.color, a * 0.7)
        // Inti tajam 1px agar bintang terlihat kristal.
        ctx.save()
        ctx.globalAlpha = Math.min(1, a + 0.1)
        ctx.fillStyle = `rgba(${s.color},1)`
        ctx.beginPath()
        ctx.arc(px, py, Math.max(0.6, s.r * 0.55), 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      for (const f of flares) {
        const tw = 0.5 + 0.5 * Math.sin(t * 0.001 * f.s.speed * 0.7 + f.s.phase)
        if (tw < 0.5) continue
        const px = f.s.x - mouse.x * 22 * f.s.depth
        const py = f.s.y - mouse.y * 22 * f.s.depth
        drawFlare(px, py, f.len * (0.65 + 0.35 * tw), f.s.color, f.s.base * tw + 0.1)
      }

      drawMeteor(t)

      ctx.fillStyle = vignette
      ctx.fillRect(0, 0, w, h)

      raf = requestAnimationFrame(frame)
    }

    const onMove = (e) => {
      mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2
      mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2
    }

    build()
    nextMeteorAt = performance.now() + rand(2500, 5000)
    if (reduced) {
      // Satu frame statis untuk prefers-reduced-motion.
      const t = 1200
      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, w, h)
      nebulas.forEach((n) => {
        ctx.fillStyle = n.g
        ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2)
      })
      for (const s of stars) {
        const tw = 0.5 + 0.5 * Math.sin(t * 0.001 * s.speed + s.phase)
        glow(s.x, s.y, s.r * 7, s.color, s.base * tw * 0.7)
      }
      ctx.fillStyle = vignette
      ctx.fillRect(0, 0, w, h)
    } else {
      raf = requestAnimationFrame(frame)
    }

    window.addEventListener('resize', build)
    window.addEventListener('mousemove', onMove)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', build)
      window.removeEventListener('mousemove', onMove)
    }
  }, [density])

  return (
    <>
      <canvas ref={canvasRef} className="sparkles-canvas" aria-hidden="true" />
      <div className="sparkles-grain" aria-hidden="true" />
    </>
  )
}
