import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Halaman pemilihan "topi" (role mode) — gerbang setelah login.
 * Hanya tampil untuk user dengan role ganda (Auditor + Auditee).
 * User role tunggal / Admin dilewatkan langsung ke /kategori.
 *
 * Setelah memilih, halaman kategori & daftar (mis. /list/Halal) otomatis
 * terfilter sesuai topi yang dipilih — lihat handleGetList di Code.gs.
 */
const OPTIONS = [
  {
    key: 'auditor',
    icon: 'fa-user-tie',
    cls: 'auditor',
    title: 'Auditor',
    desc: 'Membuat, mengisi, dan menandatangani laporan pengamatan.',
  },
  {
    key: 'auditee',
    icon: 'fa-user-check',
    cls: 'auditee',
    title: 'Auditee',
    desc: 'Melihat audit atas unit Anda dan mengisi tindakan korektif (CAPA).',
  },
]

export default function RolePage() {
  const { user, isAuditor, isAuditee, hasMultipleRoles, setActiveRole, logout } = useAuth()
  const navigate = useNavigate()

  // Role tunggal / Admin tidak perlu ditanya — langsung lanjut.
  useEffect(() => {
    if (!hasMultipleRoles) navigate('/kategori', { replace: true })
  }, [hasMultipleRoles, navigate])

  const pick = (key) => {
    setActiveRole(key)
    navigate('/kategori')
  }

  if (!hasMultipleRoles) return null

  const visible = OPTIONS.filter((o) => (o.key === 'auditor' ? isAuditor : isAuditee))

  return (
    <div>
      <div className="role-gate-head">
        <h2>Masuk sebagai apa?</h2>
        <p>
          Halo <b>{user?.nama || '-'}</b> — akun Anda memiliki dua peran.
          Pilih mode kerja untuk melanjutkan.
        </p>
      </div>

      <div className="menu-grid role-gate-grid">
        {visible.map((o) => (
          <div key={o.key} className="glass-card menu-card" onClick={() => pick(o.key)}>
            <div className={`menu-icon icon3d ${o.cls}`}><i className={`fa-solid ${o.icon}`} /></div>
            <h3>{o.title}</h3>
            <p className="role-gate-desc">{o.desc}</p>
          </div>
        ))}
      </div>

      <div className="role-gate-foot">
        <button className="btn btn-outline btn-sm" onClick={() => { logout(); navigate('/login') }}>
          <i className="fa-solid fa-right-from-bracket" /> Keluar
        </button>
      </div>
    </div>
  )
}
