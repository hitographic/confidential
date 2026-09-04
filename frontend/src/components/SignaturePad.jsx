import { useEffect, useRef, useState } from 'react'

/**
 * Canvas tanda tangan — pengganti setupCanvas()/clearCanvas()/getCroppedDataURL().
 * Mendukung mouse + touch, warna & ketebalan, upload gambar, hapus.
 */
export default function SignaturePad({
  canvasId = 'sig',
  height = 150,
  color: extColor,
  thickness: extThickness,
  onReady,
}) {
  const canvasRef = useRef(null)
  const [color, setColor] = useState(extColor || '#000000')
  const [thickness, setThickness] = useState(extThickness || 3)
  const drawing = useRef(false)
  const lastPos = useRef(null)

  useEffect(() => { if (extColor) setColor(extColor) }, [extColor])
  useEffect(() => { if (extThickness) setThickness(extThickness) }, [extThickness])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      if (!rect.width) return
      const dpr = window.devicePixelRatio || 1
      const dataUrl = canvas.toDataURL()
      canvas.width = rect.width * dpr
      canvas.height = height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.lineWidth = thickness
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = color
      if (dataUrl && dataUrl.length > 100) {
        const img = new Image()
        img.onload = () => ctx.drawImage(img, 0, 0, rect.width, height)
        img.src = dataUrl
      }
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    if (onReady) onReady(api())
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.strokeStyle = color
    ctx.lineWidth = thickness
  }, [color, thickness])

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const cx = e.touches ? e.touches[0].clientX : e.clientX
    const cy = e.touches ? e.touches[0].clientY : e.clientY
    return { x: cx - rect.left, y: cy - rect.top }
  }

  const start = (e) => {
    e.preventDefault()
    drawing.current = true
    lastPos.current = getPos(e)
  }
  const move = (e) => {
    e.preventDefault()
    if (!drawing.current || !lastPos.current) return
    const pos = getPos(e)
    const ctx = canvasRef.current.getContext('2d')
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastPos.current = pos
  }
  const end = () => { drawing.current = false; lastPos.current = null }

  const clear = () => {
    const canvas = canvasRef.current
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
  }

  const isEmpty = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) return false
    return true
  }

  /** Crop otomatis ke bounding-box goresan (port getCroppedDataURL). */
  const getCroppedDataURL = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const w = canvas.width, h = canvas.height
    const data = ctx.getImageData(0, 0, w, h).data
    let minX = w, minY = h, maxX = 0, maxY = 0, found = false
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        if (data[(y * w + x) * 4 + 3] > 10) {
          found = true
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
    if (!found) return canvas.toDataURL('image/png')
    const pad = 10
    minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad)
    maxX = Math.min(w, maxX + pad); maxY = Math.min(h, maxY + pad)
    const cw = maxX - minX, ch = maxY - minY
    const tmp = document.createElement('canvas')
    tmp.width = cw; tmp.height = ch
    tmp.getContext('2d').drawImage(canvas, minX, minY, cw, ch, 0, 0, cw, ch)
    return tmp.toDataURL('image/png')
  }

  const loadImage = (dataUrl) => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    const img = new Image()
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, rect.width, height)
    }
    img.src = dataUrl
  }

  function api() {
    return { clear, isEmpty, getCroppedDataURL, loadImage, getCanvas: () => canvasRef.current }
  }

  const apiRef = useRef(null)
  apiRef.current = api()

  return (
    <div>
      <div className="sign-toolbar">
        <div style={{ display: 'flex', gap: 5 }}>
          {['#000000', '#333333', '#00008B', '#1E90FF'].map((c) => (
            <div
              key={c}
              onClick={() => setColor(c)}
              title={c}
              style={{
                width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer',
                border: '2px solid white',
                boxShadow: color === c ? '0 0 0 1px #000' : 'none',
              }}
            />
          ))}
        </div>
        <div style={{ width: 1, height: 20, background: '#cbd5e1', margin: '0 4px' }} />
        <input type="range" min="1" max="6" value={thickness} style={{ width: 60, cursor: 'pointer' }}
          onChange={(e) => setThickness(Number(e.target.value))} />
        <div style={{ flexGrow: 1 }} />
        <label style={{ cursor: 'pointer', color: 'var(--secondary)', margin: 0, fontSize: 15 }} title="Upload Gambar TTD">
          <i className="fa-solid fa-image" />
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
            const f = e.target.files?.[0]
            if (!f) return
            const r = new FileReader()
            r.onload = (ev) => loadImage(ev.target.result)
            r.readAsDataURL(f)
            e.target.value = ''
          }} />
        </label>
        <div style={{ cursor: 'pointer', color: '#ef4444', marginLeft: 8, fontSize: 15 }} title="Hapus Canvas" onClick={clear}>
          <i className="fa-solid fa-trash-can" />
        </div>
      </div>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
        <canvas
          id={canvasId}
          ref={canvasRef}
          className="sign-canvas"
          style={{ width: '100%', height, border: 'none', margin: 0, display: 'block' }}
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end}
        />
      </div>
    </div>
  )
}
