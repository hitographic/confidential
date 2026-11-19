import { useNavigate } from 'react-router-dom'
import { CATEGORIES } from '../config'
import { useAudit } from '../context/AuditContext'

export default function CategoryPage() {
  const navigate = useNavigate()
  const { setAudit } = useAudit()

  const open = (key) => {
    setAudit({ category: key })
    navigate(`/list/${encodeURIComponent(key)}`)
  }

  return (
    <div>
      <h2 className="page-title">
        Pilih Kategori Audit
        <small>Pilih standar audit yang ingin kamu kerjakan</small>
      </h2>
      <div className="menu-grid">
        {CATEGORIES.map((c) => (
          <div
            key={c.key}
            className={`glass-card menu-card${c.disabled ? ' menu-card--disabled' : ''}`}
            aria-disabled={c.disabled ? 'true' : undefined}
            onClick={c.disabled ? undefined : () => open(c.key)}
          >
            <div className={`menu-icon icon3d ${c.cls}`}><i className={`fa-solid ${c.icon}`} /></div>
            <h3>{c.label}</h3>
            {c.disabled && <span className="menu-soon">Segera Hadir</span>}
          </div>
        ))}
        {/* Tools non-kategori: tanda tangan Form CQA-75 (berlaku untuk semua role) */}
        <div className="glass-card menu-card" onClick={() => navigate('/CQA-75')}>
          <div className="menu-icon icon3d teal"><i className="fa-solid fa-clipboard-check" /></div>
          <h3>Form CQA-75</h3>
          <span className="menu-badge-tool">Tanda Tangan</span>
        </div>
      </div>
    </div>
  )
}
