import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'
import { gasApi } from '../api/gasClient'
import { useAuth } from '../context/AuthContext'
import RegisterSignatureModal from '../components/modals/RegisterSignatureModal'
import Sparkles from '../components/Sparkles'

export default function LoginPage() {
  const { login, setUser } = useAuth()
  const navigate = useNavigate()
  const [nik, setNik] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [askSignature, setAskSignature] = useState(false)

  const checkSignatureOnLogin = async (nikVal) => {
    if (!nikVal || nikVal === 'guest') return
    try {
      const res = await gasApi.getSignatureInfo(nikVal)
      if (res.success && res.exists) {
        const r = await Swal.fire({
          title: 'Tanda Tangan Terdaftar',
          html: `<p style="font-size:14px; margin-bottom:8px;">Anda sudah memiliki tanda tangan digital.</p>
                 <div style="text-align:left; font-size:12px; color:#64748b; background:#f8fafc; padding:10px 14px; border-radius:8px; border:1px solid #e2e8f0;">
                   <div>Dibuat: <b>${res.createdAt || '-'}</b></div>
                   <div>Diperbarui: <b>${res.updatedAt || '-'}</b></div>
                 </div>`,
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Gunakan yang Sudah Ada',
          cancelButtonText: 'Buat TTD Baru',
          confirmButtonColor: '#10b981',
          cancelButtonColor: '#6366f1',
          reverseButtons: true,
        })
        if (!r.isConfirmed) setAskSignature(true)
      } else {
        setAskSignature(true)
      }
    } catch {
      setAskSignature(true)
    }
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await login(nik, password)
      if (res.success) {
        // /pilih-role akan melewatkan user role tunggal / Admin
        // langsung ke /kategori (lihat RolePage.jsx).
        navigate('/pilih-role')
        checkSignatureOnLogin(nik)
      } else {
        Swal.fire('Gagal', res.message, 'error')
      }
    } catch (err) {
      console.error(err)
      Swal.fire('Info', 'Mode Demo (Backend belum diperbarui). Login sebagai Guest.', 'info')
      const demo = { nik: 'guest', nama: 'Auditor Demo', role: 'auditor' }
      setUser(demo)
      sessionStorage.setItem('matrika_user', JSON.stringify(demo))
      navigate('/pilih-role')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-wrapper login-hero">
      <Sparkles />
      <div className="login-card">
        <div className="login-logo-glow">
          <img src="./login.png" alt="Confidential" className="login-logo-full" />
        </div>
        <h2>Selamat Datang</h2>
        <p className="login-subtitle">Masuk untuk mulai Audit Internal</p>
        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label><span className="icon3d sky round" style={{ width: 22, height: 22, fontSize: 10, verticalAlign: 'middle', marginRight: 6, display: 'inline-flex' }}><i className="fa-solid fa-fingerprint" /></span>NIK</label>
            <input value={nik} onChange={(e) => setNik(e.target.value)} placeholder="Masukkan NIK Anda" inputMode="numeric" autoComplete="username" required />
          </div>
          <div className="form-group">
            <label><span className="icon3d peri round" style={{ width: 22, height: 22, fontSize: 10, verticalAlign: 'middle', marginRight: 6, display: 'inline-flex' }}><i className="fa-solid fa-lock" /></span>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Masukkan password" autoComplete="current-password" required />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <><i className="fa-solid fa-spinner fa-spin" /> Proses...</> : <><i className="fa-solid fa-arrow-right-to-bracket" /> Masuk</>}
          </button>
        </form>
      </div>
      {askSignature && <RegisterSignatureModal onClose={() => setAskSignature(false)} />}
    </div>
  )
}
