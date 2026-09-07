import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * Modal crop + enhance khusus upload tanda tangan.
 * - User mengatur area crop (seret kotak / titik sudut / buat kotak baru)
 * - Toggle "Enhance" mengubah hasil jadi hitam-putih + background transparan
 *   (cocok untuk foto TTD di atas kertas seperti di screenshot)
 */
export default function SignatureCropModal({ src, onCancel, onApply }) {
  const editorRef = useRef(null)
  const previewRef = useRef(null)
  const dragRef = useRef(null)
  const [img, setImg] = useState(null)
  // crop dalam koordinat normal 0-1 relatif ke gambar asli
  const [crop, setCrop] = useState({ x: 0.08, y: 0.3, w: 0.84, h: 0.4 })
  const [display, setDisplay] = useState({ w: 480, h: 270 })
  const [enhance, setEnhance] = useState(true)
  const [threshold, setThreshold] = useState(175)
  const [resultUrl, setResultUrl] = useState(null)

  // Load image
  useEffect(() => {
    if (!src) return
    const im = new Image()
    im.onload = () => {
      setImg(im)
      // Default: fokus ke area tengah (tempat TTD biasanya berada)
      // Jika foto landscape kertas seperti screenshot, kotak tengah 84%x40% pas.
      setCrop({ x: 0.08, y: 0.3, w: 0.84, h: 0.4 })
    }
    im.src = src
  }, [src])

  // Hitung ukuran display (fit ke lebar modal, max tinggi 320)
  useEffect(() => {
    if (!img) return
    const compute = () => {
      const maxW = 480
      const maxH = 320
      const iw = img.naturalWidth || img.width
      const ih = img.naturalHeight || img.height
      const scale = Math.min(maxW / iw, maxH / ih)
      setDisplay({ w: Math.round(iw * scale), h: Math.round(ih * scale) })
    }
    compute()
  }, [img])

  const cropToDisplay = useCallback((c, dw, dh) => ({
    x: c.x * dw, y: c.y * dh, w: c.w * dw, h: c.h * dh,
  }), [])

  // Gambar editor + overlay crop
  useEffect(() => {
    if (!img || !editorRef.current) return
    const canvas = editorRef.current
    canvas.width = display.w
    canvas.height = display.h
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    const r = cropToDisplay(crop, canvas.width, canvas.height)
    // Gelapkan area di luar crop
    ctx.save()
    ctx.fillStyle = 'rgba(15,23,42,0.55)'
    ctx.fillRect(0, 0, canvas.width, r.y)
    ctx.fillRect(0, r.y, r.x, r.h)
    ctx.fillRect(r.x + r.w, r.y, canvas.width - (r.x + r.w), r.h)
    ctx.fillRect(0, r.y + r.h, canvas.width, canvas.height - (r.y + r.h))
    ctx.restore()

    // Border crop
    ctx.save()
    ctx.strokeStyle = '#6366f1'
    ctx.lineWidth = 2
    ctx.setLineDash([6, 4])
    ctx.strokeRect(r.x, r.y, r.w, r.h)
    ctx.setLineDash([])
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1
    ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2)
    // Handles sudut
    const hs = 12
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = '#6366f1'
    ctx.lineWidth = 2
    const corners = [
      [r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h],
    ]
    corners.forEach(([cx, cy]) => {
      ctx.beginPath()
      ctx.rect(cx - hs / 2, cy - hs / 2, hs, hs)
      ctx.fill()
      ctx.stroke()
    })
    ctx.restore()
  }, [img, crop, display, cropToDisplay])

  // Bangun preview hasil (crop + enhance)
  useEffect(() => {
    if (!img || !previewRef.current) return
    const iw = img.naturalWidth || img.width
    const ih = img.naturalHeight || img.height
    const sx = Math.max(0, Math.round(crop.x * iw))
    const sy = Math.max(0, Math.round(crop.y * ih))
    let sw = Math.round(crop.w * iw)
    let sh = Math.round(crop.h * ih)
    if (sw < 10 || sh < 10) return
    if (sx + sw > iw) sw = iw - sx
    if (sy + sh > ih) sh = ih - sy

    const tmp = document.createElement('canvas')
    tmp.width = sw
    tmp.height = sh
    const tctx = tmp.getContext('2d')
    tctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)

    if (enhance) {
      try {
        const id = tctx.getImageData(0, 0, sw, sh)
        const d = id.data
        for (let i = 0; i < d.length; i += 4) {
          const rC = d[i], g = d[i + 1], b = d[i + 2]
          const gray = 0.299 * rC + 0.587 * g + 0.114 * b
          if (gray > threshold) {
            d[i + 3] = 0 // kertas / background -> transparan
          } else {
            // tinta -> hitam pekat (hitam-putih saja)
            d[i] = 0; d[i + 1] = 0; d[i + 2] = 0; d[i + 3] = 255
          }
        }
        tctx.putImageData(id, 0, 0)
      } catch {
        // abaikan (tainted canvas) — pakai hasil crop mentah
      }
    }

    let url = null
    try { url = tmp.toDataURL('image/png') } catch { url = null }
    setResultUrl(url)

    // Gambar ke preview box (contain)
    const pv = previewRef.current
    const maxPW = 440
    const maxPH = 130
    const scale = Math.min(maxPW / sw, maxPH / sh)
    pv.width = Math.max(1, Math.round(sw * scale))
    pv.height = Math.max(1, Math.round(sh * scale))
    const pctx = pv.getContext('2d')
    pctx.clearRect(0, 0, pv.width, pv.height)
    pctx.drawImage(tmp, 0, 0, pv.width, pv.height)
  }, [img, crop, enhance, threshold])

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect()
    const cx = e.touches ? e.touches[0].clientX : e.clientX
    const cy = e.touches ? e.touches[0].clientY : e.clientY
    return {
      x: (cx - rect.left) * (canvas.width / rect.width),
      y: (cy - rect.top) * (canvas.height / rect.height),
    }
  }

  const hitHandle = (p, r) => {
    const tol = 14
    if (Math.abs(p.x - r.x) < tol && Math.abs(p.y - r.y) < tol) return 'nw'
    if (Math.abs(p.x - (r.x + r.w)) < tol && Math.abs(p.y - r.y) < tol) return 'ne'
    if (Math.abs(p.x - r.x) < tol && Math.abs(p.y - (r.y + r.h)) < tol) return 'sw'
    if (Math.abs(p.x - (r.x + r.w)) < tol && Math.abs(p.y - (r.y + r.h)) < tol) return 'se'
    if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return 'move'
    return 'new'
  }

  const onDown = (e) => {
    e.preventDefault()
    const canvas = editorRef.current
    if (!canvas) return
    const p = getPos(e, canvas)
    const r = cropToDisplay(crop, canvas.width, canvas.height)
    const mode = hitHandle(p, r)
    dragRef.current = { mode, startX: p.x, startY: p.y, orig: { ...crop }, dw: canvas.width, dh: canvas.height }
  }

  const onMove = (e) => {
    const drag = dragRef.current
    if (!drag) return
    e.preventDefault()
    const canvas = editorRef.current
    const p = getPos(e, canvas)
    const dx = (p.x - drag.startX) / drag.dw
    const dy = (p.y - drag.startY) / drag.dh
    const o = drag.orig
    const minS = 0.05
    let n = { ...o }
    if (drag.mode === 'move') {
      n.x = Math.min(1 - o.w, Math.max(0, o.x + dx))
      n.y = Math.min(1 - o.h, Math.max(0, o.y + dy))
    } else if (drag.mode === 'new') {
      // Buat kotak baru dari titik awal tekan ke posisi sekarang
      const ax = drag.startX / drag.dw
      const ay = drag.startY / drag.dh
      const bx = p.x / drag.dw
      const by = p.y / drag.dh
      n.x = Math.min(ax, bx); n.y = Math.min(ay, by)
      n.w = Math.abs(bx - ax); n.h = Math.abs(by - ay)
    } else {
      // Tangani per corner (nw/ne/sw/se)
      if (drag.mode === 'nw') {
        const nx = Math.min(o.x + o.w - minS, Math.max(0, o.x + dx))
        const ny = Math.min(o.y + o.h - minS, Math.max(0, o.y + dy))
        n.w = o.w + (o.x - nx); n.h = o.h + (o.y - ny); n.x = nx; n.y = ny
      } else if (drag.mode === 'ne') {
        const ny = Math.min(o.y + o.h - minS, Math.max(0, o.y + dy))
        n.y = ny; n.h = o.h + (o.y - ny)
        n.w = Math.max(minS, Math.min(1 - o.x, o.w + dx))
      } else if (drag.mode === 'sw') {
        const nx = Math.min(o.x + o.w - minS, Math.max(0, o.x + dx))
        n.x = nx; n.w = o.w + (o.x - nx)
        n.h = Math.max(minS, Math.min(1 - o.y, o.h + dy))
      } else if (drag.mode === 'se') {
        n.w = Math.max(minS, Math.min(1 - o.x, o.w + dx))
        n.h = Math.max(minS, Math.min(1 - o.y, o.h + dy))
      }
    }
    // clamp
    n.x = Math.min(0.95, Math.max(0, n.x))
    n.y = Math.min(0.95, Math.max(0, n.y))
    n.w = Math.min(1 - n.x, Math.max(0.03, n.w))
    n.h = Math.min(1 - n.y, Math.max(0.03, n.h))
    setCrop(n)
  }

  const onUp = () => { dragRef.current = null }

  const resetCrop = () => setCrop({ x: 0.08, y: 0.3, w: 0.84, h: 0.4 })
  const fullCrop = () => setCrop({ x: 0, y: 0, w: 1, h: 1 })

  if (!src) return null
  return (
    <div className="modal-overlay" onClick={onCancel} style={{ zIndex: 1200 }}>
      <div className="modal-content" style={{ maxWidth: 580 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#818cf8)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
            <i className="fa-solid fa-crop-simple" style={{ color: 'white', fontSize: 20 }} />
          </div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: 17 }}>Atur &amp; Enhance Tanda Tangan</h3>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
            Seret kotak untuk memilih area tanda tangan. Geser titik putih di sudut untuk ubah ukuran, atau seret di luar kotak untuk buat area baru.
          </p>
        </div>

        <div
          style={{ position: 'relative', width: '100%', background: '#0f172a', borderRadius: 10, overflow: 'hidden', marginBottom: 10, display: 'flex', justifyContent: 'center', padding: 8 }}
        >
          <canvas
            ref={editorRef}
            style={{ width: display.w > 0 ? '100%' : 'auto', maxWidth: display.w, height: 'auto', cursor: 'crosshair', touchAction: 'none', borderRadius: 6 }}
            onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
            onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
          <button className="btn btn-outline btn-sm" onClick={resetCrop}>
            <i className="fa-solid fa-rotate-left" /> Reset Area
          </button>
          <button className="btn btn-outline btn-sm" onClick={fullCrop}>
            <i className="fa-solid fa-expand" /> Pilih Semua
          </button>
        </div>

        {/* Panel enhance */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, marginBottom: 14 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 10 }}>
            <span
              onClick={() => setEnhance(!enhance)}
              style={{
                width: 40, height: 22, borderRadius: 20, background: enhance ? '#6366f1' : '#cbd5e1',
                position: 'relative', transition: 'background 0.2s', flexShrink: 0, display: 'inline-block',
              }}
            >
              <span style={{
                position: 'absolute', top: 2, left: enhance ? 20 : 2, width: 18, height: 18,
                borderRadius: '50%', background: 'white', transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }} />
            </span>
            <span style={{ fontWeight: 700, fontSize: 13 }}>
              <i className="fa-solid fa-wand-magic-sparkles" style={{ color: '#6366f1' }} /> Enhance otomatis (hitam-putih)
            </span>
          </label>
          <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 10px 0' }}>
            {enhance
              ? 'Background kertas dihapus (transparan) & tinta dijadikan hitam pekat.'
              : 'Nonaktif — hasil sesuai foto asli hasil crop.'}
          </p>
          {enhance && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>Sensitivitas</span>
              <input
                type="range" min={100} max={220} value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                style={{ flex: 1, cursor: 'pointer' }}
              />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#334155', minWidth: 30, textAlign: 'right' }}>{threshold}</span>
            </div>
          )}
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
            Tips: naikkan nilai jika tinta tipis ikut hilang, turunkan jika background masih terlihat.
          </div>
        </div>

        {/* Preview hasil */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 8 }}>
            <i className="fa-solid fa-eye" style={{ color: '#6366f1' }} /> Pratinjau hasil
          </div>
          <div style={{
            border: '1px solid #e2e8f0', borderRadius: 10, minHeight: 90,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12,
            backgroundImage: 'linear-gradient(45deg,#e2e8f0 25%,transparent 25%),linear-gradient(-45deg,#e2e8f0 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e2e8f0 75%),linear-gradient(-45deg,transparent 75%,#e2e8f0 75%)',
            backgroundSize: '16px 16px', backgroundPosition: '0 0,0 8px,8px -8px,-8px 0',
            backgroundColor: '#fff',
          }}>
            <canvas ref={previewRef} style={{ maxWidth: '100%', height: 'auto' }} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn btn-outline" onClick={onCancel}>Batal</button>
          <button
            className="btn btn-primary"
            onClick={() => resultUrl && onApply?.(resultUrl)}
            disabled={!resultUrl}
            style={{ opacity: resultUrl ? 1 : 0.6 }}
          >
            <i className="fa-solid fa-check" /> Gunakan Tanda Tangan
          </button>
        </div>
      </div>
    </div>
  )
}
