import { useState } from 'react'
import Swal from 'sweetalert2'
import { gasApi } from '../../api/gasClient'
import { useAuth } from '../../context/AuthContext'
import { validatePasswordStrength } from '../../utils/password'

const inputStyle = {
  width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8,
  fontSize: 14, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s',
}

function Rule({ ok, children }) {
  return (
    <div style={{ color: ok ? '#10b981' : '#94a3b8' }}>
      {ok
        ? <i className="fa-solid fa-circle-check" style={{ color: '#10b981' }} />
        : <i className="fa-regular fa-circle" />}{' '}{children}
    </div>
  )
}

export default function ChangePasswordModal({ onClose }) {
  const { user } = useAuth()
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showStrength, setShowStrength] = useState(false)

  const v = validatePasswordStrength(newPw)
  const match = confirmPw.length === 0 ? null : confirmPw === newPw

  const submit = async () => {
    if (!oldPw.trim()) return Swal.fire('Peringatan', 'Masukkan password lama', 'warning')
    if (!newPw.trim()) return Swal.fire('Peringatan', 'Masukkan password baru', 'warning')
    if (!v.valid) return Swal.fire('Password Lemah', 'Password harus 8-20 karakter, huruf besar, huruf kecil, dan karakter unik (!@#$%^&*)', 'warning')
    if (newPw !== confirmPw) return Swal.fire('Peringatan', 'Konfirmasi password tidak cocok', 'warning')
    if (newPw === oldPw) return Swal.fire('Peringatan', 'Password baru harus berbeda dari password lama', 'warning')
    Swal.fire({ title: 'Mengubah password...', allowOutsideClick: false, didOpen: () => Swal.showLoading() })
    try {
      const res = await gasApi.changePassword(user.nik, oldPw.trim(), newPw.trim())
      if (res.success) {
        onClose?.()
        Swal.fire({ icon: 'success', title: 'Password berhasil diubah!', timer: 1500, showConfirmButton: false })
      } else Swal.fire('Gagal', res.message, 'error')
    } catch {
      Swal.fire('Error', 'Gagal terhubung ke server', 'error')
    }
  }

  const barColors = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981']
  const labels = ['Lemah', 'Sedang', 'Kuat', 'Sangat Kuat']

  const focus = (e) => { e.target.style.borderColor = 'var(--secondary)' }
  const blur = (e) => { e.target.style.borderColor = '#e2e8f0' }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #f43f5e, #e11d48)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <i className="fa-solid fa-lock" style={{ color: 'white', fontSize: 24 }} />
          </div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: 18 }}>Ganti Password</h3>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-light)' }}>Masukkan password lama dan password baru</p>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dark)', display: 'block', marginBottom: 6 }}>Password Lama</label>
          <input type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} placeholder="Masukkan password lama"
            style={inputStyle} onFocus={focus} onBlur={blur} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dark)', display: 'block', marginBottom: 6 }}>Password Baru</label>
          <input type="password" value={newPw} placeholder="Masukkan password baru"
            style={inputStyle} onFocus={focus} onBlur={blur}
            onChange={(e) => { setNewPw(e.target.value); setShowStrength(true) }} />
          {showStrength && (
            <div style={{ marginTop: 6, fontSize: 11 }}>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < v.score ? barColors[v.score - 1] : '#e2e8f0', transition: 'background 0.2s' }} />
                ))}
              </div>
              <span style={{ color: barColors[v.score - 1] || '#94a3b8' }}>{newPw.length > 0 ? (labels[v.score - 1] || '') : ''}</span>
              <div style={{ marginTop: 8, fontSize: 11, color: '#94a3b8', lineHeight: 1.8 }}>
                <Rule ok={v.len}>8-20 karakter</Rule>
                <Rule ok={v.upper}>minimal 1 huruf besar (A-Z)</Rule>
                <Rule ok={v.lower}>minimal 1 huruf kecil (a-z)</Rule>
                <Rule ok={v.special}>minimal 1 karakter unik (!@#$%^&amp;*)</Rule>
              </div>
            </div>
          )}
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dark)', display: 'block', marginBottom: 6 }}>Ulangi Password Baru</label>
          <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="Ulangi password baru"
            style={inputStyle} onFocus={focus} onBlur={blur} />
          {match !== null && (
            <div style={{ marginTop: 4, fontSize: 11, color: match ? '#10b981' : '#ef4444' }}>
              {match
                ? <><i className="fa-solid fa-circle-check" style={{ color: '#10b981' }} /> Cocok</>
                : <><i className="fa-solid fa-circle-xmark" style={{ color: '#ef4444' }} /> Tidak cocok</>}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn btn-outline" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" onClick={submit}><i className="fa-solid fa-check" /> Simpan Password</button>
        </div>
      </div>
    </div>
  )
}
