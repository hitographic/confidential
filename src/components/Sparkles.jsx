import { useEffect, useRef } from 'react'

const STAR_COLORS = ['255,255,255', '207,228,255', '169,198,255', '235,242,255']

const rand = (a, b) => a + Math.random() * (b - a)

/**
 * Latar bintang berkelip ala hero antigravity.google:
 * langit gelap + nebula biru samar + ratusan bintang twinkle +
 * sesekali flare 4-titik (✦) + drift lambat + parallax mengikuti mouse.
 * Murni canvas 2D (tanpa three.js) agar ringan di HP.
 */
export default function Sparkles({ density = 1 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    let raf = 0
    let w = 0
    let h = 0
    let stars = []
    let bgGrad = null
    let nebulas = []
    let vignette = null
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 }
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    function build() {
      w = window.innerWidth
      h = window.innerHeight
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.floor(w * dpr))
      canvas.height = Math.max(1, Math.floor(h * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const count = Math.round(Math.min(260, Math.max(90, (w * h) / 8500)) * density)
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: rand(0.4, 1.7),
        color: STAR_COLORS[(Math.random() * STAR_COLORS.length) | 0],
        phase: Math.random() * Math.PI * 2,
        speed: rand(0.4, 1.4),
        base: rand(0.35, 0.9),
        depth: rand(0.2, 1),
        drift: rand(0.04, 0.22),
        sway: rand(0, Math.PI * 2),
        flare: Math.random() < 0.08,
        len: rand(6, 16),
      }))

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
      nebulas = [
        neb(w * 0.15, h * 0.1, Math.max(w, h) * 0.45, 'rgba(38,80,180,0.20)'),
        neb(w * 0.9, h * 0.85, Math.max(w, h) * 0.4, 'rgba(99,102,241,0.14)'),
        neb(w * 0.55, h * 0.3, Math.max(w, h) * 0.35, 'rgba(56,189,248,0.07)'),
      ]
      vignette = ctx.createRadialGradient(
        w / 2, h / 2, Math.min(w, h) * 0.35,
        w / 2, h / 2, Math.max(w, h) * 0.75
      )
      vignette.addColorStop(0, 'rgba(0,0,0,0)')
      vignette.addColorStop(1, 'rgba(0,0,0,0.55)')
    }

    function drawFlare(x, y, len, color, alpha) {
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.fillStyle = `rgba(${color},1)`
      ctx.shadowColor = `rgba(${color},0.9)`
      ctx.shadowBlur = 12
      ctx.beginPath()
      ctx.moveTo(x, y - len)
      ctx.quadraticCurveTo(x, y, x + len, y)
      ctx.quadraticCurveTo(x, y, x, y + len)
      ctx.quadraticCurveTo(x, y, x - len, y)
      ctx.quadraticCurveTo(x, y, x, y - len)
      ctx.fill()
      ctx.restore()
    }

    let last = 0
    function frame(t) {
      const dt = Math.min(50, t - last || 16.67) / 16.67
      last = t
      mouse.x += (mouse.tx - mouse.x) * 0.045
      mouse.y += (mouse.ty - mouse.y) * 0.045

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

        const tw = 0.5 + 0.5 * Math.sin(t * 0.001 * s.speed + s.phase)
        const a = s.base * (0.22 + 0.78 * tw)
        const px = s.x - mouse.x * 22 * s.depth
        const py = s.y - mouse.y * 22 * s.depth

        if (s.flare && tw > 0.55) {
          drawFlare(px, py, s.len * (0.6 + 0.4 * tw), s.color, Math.min(1, a + 0.15))
        } else {
          ctx.save()
          ctx.globalAlpha = a
          ctx.fillStyle = `rgba(${s.color},1)`
          ctx.shadowColor = `rgba(${s.color},0.9)`
          ctx.shadowBlur = 6
          ctx.beginPath()
          ctx.arc(px, py, s.r, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }
      }

      ctx.fillStyle = vignette
      ctx.fillRect(0, 0, w, h)

      raf = requestAnimationFrame(frame)
    }

    const onMove = (e) => {
      mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2
      mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2
    }

    build()
    if (reduced) {
      last = 0
      // Satu frame statis (tanpa loop) untuk prefers-reduced-motion.
      const t = 1200
      mouse.x = 0; mouse.y = 0
      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, w, h)
      nebulas.forEach((n) => {
        ctx.fillStyle = n.g
        ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2)
      })
      for (const s of stars) {
        const tw = 0.5 + 0.5 * Math.sin(t * 0.001 * s.speed + s.phase)
        ctx.save()
        ctx.globalAlpha = s.base * (0.22 + 0.78 * tw)
        ctx.fillStyle = `rgba(${s.color},1)`
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
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

  return <canvas ref={canvasRef} className="sparkles-canvas" aria-hidden="true" />
}
