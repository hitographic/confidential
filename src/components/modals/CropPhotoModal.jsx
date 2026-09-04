import { useEffect, useRef, useState } from 'react'

/** Crop 1:1 sederhana (port cropModal) — center-square 400x400 + caption. */
export default function CropPhotoModal({ image, onCancel, onSave }) {
  const canvasRef = useRef(null)
  const [caption, setCaption] = useState('')

  useEffect(() => {
    if (!image) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const size = Math.min(image.width, image.height)
    const sx = (image.width - size) / 2
    const sy = (image.height - size) / 2
    canvas.width = 400
    canvas.height = 400
    ctx.drawImage(image, sx, sy, size, size, 0, 0, 400, 400)
  }, [image])

  const save = () => {
    const dataUrl = canvasRef.current.toDataURL('image/png')
    onSave?.(dataUrl, caption.trim())
  }

  if (!image) return null
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginBottom: 15 }}>Potong Foto (1:1)</h3>
        <div className="crop-container"><canvas id="cropCanvas" ref={canvasRef} /></div>
        <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Keterangan foto (opsional)..."
          style={{ width: '100%', marginBottom: 15, padding: '10px 12px', border: '1.5px solid rgba(0,0,0,0.08)', borderRadius: 10 }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn btn-outline" onClick={onCancel}>Batal</button>
          <button className="btn btn-primary" onClick={save}><i className="fa-solid fa-check" /> Simpan Foto</button>
        </div>
      </div>
    </div>
  )
}
