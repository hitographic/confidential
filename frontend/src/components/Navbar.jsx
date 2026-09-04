import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import ChangePasswordModal from './modals/ChangePasswordModal'
import RegisterSignatureModal from './modals/RegisterSignatureModal'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [showSig, setShowSig] = useState(false)
  const [showPw, setShowPw] = useState(false)

  const initial = (user?.nama || 'U').charAt(0).toUpperCase()

  const doLogout = () => {
    setOpen(false)
    logout()
    navigate('/login')
  }

  return (
    <>
      <nav className="navbar">
        <Link to="/kategori" className="brand-link">
          <img src="./logo-confidential.png" alt="Confidential" className="brand-logo" />
        </Link>
        <div className="user-dropdown">
          <button className="user-avatar-btn" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}>
            <span>{initial}</span>
          </button>
          <div className={`user-dropdown-menu ${open ? 'show' : ''}`}>
            <div className="dropdown-user-info">
              <div className="user-name">{user?.nama || '-'}</div>
              <div className="user-nik">NIK: {user?.nik || '-'}</div>
            </div>
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
      {showSig && <RegisterSignatureModal onClose={() => setShowSig(false)} />}
      {showPw && <ChangePasswordModal onClose={() => setShowPw(false)} />}
    </>
  )
}
