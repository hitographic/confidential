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
      <h2 style={{ marginBottom: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Pilih Kategori Audit</h2>
      <div className="menu-grid">
        {CATEGORIES.map((c) => (
          <div key={c.key} className="glass-card menu-card" onClick={() => open(c.key)}>
            <div className={`menu-icon ${c.cls}`}><i className={`fa-solid ${c.icon}`} /></div>
            <h3>{c.label}</h3>
          </div>
        ))}
      </div>
    </div>
  )
}
