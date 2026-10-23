import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import ChangePasswordModal from './modals/ChangePasswordModal'
import RegisterSignatureModal from './modals/RegisterSignatureModal'

export default function Navbar() {
  const { user, logout, isAdmin, isAuditor, isAuditee, activeRole, setActiveRole, hasChosenRole } = useAuth()
  const navigate = useNavigate()
  const loc = useLocation()
  const [open, setOpen] = useState(false)
  const [showSig, setShowSig] = useState(false)
  const [showPw, setShowPw] = useState(false)

  const initial = (user?.nama || 'U').charAt(0).toUpperCase()
  // Switcher hanya berguna untuk user dengan role ganda (Auditor + Auditee).
  // Admin lihat semua data, jadi ganti topi tidak ada artinya.
  const showSwitcher = !isAdmin && isAuditor && isAuditee
  const roleLabel = isAdmin ? 'Admin' : activeRole === 'auditee' ? 'Auditee' : 'Auditor'
  const roleCls = activeRole === 'auditee' ? 'auditee' : ''

  const doLogout = () => {
    setOpen(false)
    logout()
    navigate('/login')
  }

  const goHome = () => navigate('/kategori')
  const isHome = loc.pathname === '/kategori'

  return (
    <>
      {/* ---- TOP NAV (desktop) ---- */}
      <nav className="navbar" id="navbar">
        <Link to="/kategori" className="brand-link">
          <img src="./logo-confidential.png" alt="Confidential" className="brand-logo" />
        </Link>
        <div className="user-dropdown">
          <button className="user-avatar-btn" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}>
            <span>{initial}</span>
          </button>
          <div className={`user-dropdown-menu ${open ? 'show' : ''}`}>
            <div className="dropdown-user-info">
              <div className="user-name">
                {user?.nama || '-'}
                {(isAdmin || hasChosenRole) && <span className={`role-badge ${roleCls}`}>{roleLabel}</span>}
              </div>
              <div className="user-nik">NIK: {user?.nik || '-'}</div>
            </div>
            {showSwitcher && (
              <div className="role-switch">
                <span className="role-switch-label">Mode kerja</span>
                <div className="role-switch-options">
                  <button type="button" className={`role-switch-btn ${activeRole === 'auditor' ? 'active' : ''}`}
                    onClick={() => setActiveRole('auditor')}>
                    <i className="fa-solid fa-user-tie" /> Auditor
                  </button>
                  <button type="button" className={`role-switch-btn auditee ${activeRole === 'auditee' ? 'active' : ''}`}
                    onClick={() => setActiveRole('auditee')}>
                    <i className="fa-solid fa-user-check" /> Auditee
                  </button>
                </div>
              </div>
            )}
            <button className="dropdown-item" onClick={() => { setOpen(false); setTimeout(() => setShowSig(true), 150) }}>
              <i className="fa-solid fa-pen-nib" /> Ganti Tanda Tangan
            </button>
            <button className="dropdown-item" onClick={() => { setOpen(false); setTimeout(() => setShowPw(true), 150) }}>
              <i className="fa-solid fa-lock" /> Ganti Password
            </button>
            <div className="dropdown-divider" />
            <button className="dropdown-item danger" onClick={doLogout}>
              <i className="fa-solid fa-right-from-bracket" /> Keluar
            </button>
          </div>
        </div>
      </nav>

      {/* ---- BOTTOM NAV (mobile) ---- */}
      <nav className="bottom-nav" aria-label="Navigasi utama">
        <button className={`bottom-nav-item ${isHome ? 'active' : ''}`} onClick={goHome}>
          <i className="fa-solid fa-house" />
          <span>Beranda</span>
        </button>
        <button className="bottom-nav-item" onClick={() => setShowSig(true)} title="Tanda Tangan">
          <i className="fa-solid fa-pen-nib" />
          <span>TTD</span>
        </button>
        <button className="bottom-nav-fab" onClick={goHome} title="Kategori Audit" aria-label="Kategori Audit">
          <i className="fa-solid fa-table-cells-large" />
        </button>
        <button className="bottom-nav-item" onClick={() => setShowPw(true)} title="Ganti Password">
          <i className="fa-solid fa-lock" />
          <span>Password</span>
        </button>
        <button className="bottom-nav-item" onClick={doLogout} title="Keluar">
          <i className="fa-solid fa-right-from-bracket" />
          <span>Keluar</span>
        </button>
      </nav>

      {showSig && <RegisterSignatureModal onClose={() => setShowSig(false)} />}
      {showPw && <ChangePasswordModal onClose={() => setShowPw(false)} />}
    </>
  )
}
