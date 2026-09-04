import { useEffect, useState } from 'react'
import Swal from 'sweetalert2'
import { gasApi } from '../../api/gasClient'
import { useAuth } from '../../context/AuthContext'
import SignaturePad from '../SignaturePad'

/**
 * Modal daftar TTD digital + PIN 6 digit (port modalRegisterSignature).
 * Menyimpan via action registerSignature (SHA-256 di sisi GAS).
 */
export default function RegisterSignatureModal({ onClose, onSaved }) {
  const { user } = useAuth()
  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [info, setInfo] = useState(null)
  const [padApi, setPadApi] = useState(null)

  useEffect(() => {
    if (!user?.nik || user.nik === 'guest') return
    gasApi.getSignatureInfo(user.nik).then((res) => {
      if (res.success && res.exists) {
        setInfo({ createdAt: res.createdAt, updatedAt: res.updatedAt })
      }
    }).catch(() => {})
  }, [user])

  const save = async () => {
    if (!padApi || padApi.isEmpty()) {
      Swal.fire('Peringatan', 'Gambar tanda tangan masih kosong', 'warning')
      return
    }
    if (!pin || pin.length !== 6) { Swal.fire('Error', 'PIN harus 6 digit angka!', 'error'); return }
    if (pin !== pinConfirm) { Swal.fire('Error', 'Konfirmasi PIN tidak cocok!', 'error'); return }
    const dataUrl = padApi.getCroppedDataURL()
    Swal.fire({ title: 'Menyimpan TTE...', allowOutsideClick: false, didOpen: () => Swal.showLoading() })
    try {
      const res = await gasApi.registerSignature(user.nik, dataUrl, pin)
      if (res.success) {
        try { localStorage.setItem('signature_' + user.nik, dataUrl) } catch {}
        onClose?.()
        Swal.fire('Berhasil', res.message, 'success')
        onSaved?.()
      } else {
        Swal.fire('Gagal', res.message, 'error')
      }
    } catch {
      try { localStorage.setItem('signature_' + user.nik, dataUrl) } catch {}
      onClose?.()
      Swal.fire('Info', 'Backend belum connect, tersimpan lokal (demo).', 'info')
    }
  }

  const pinInputStyle = {
    width: 120, textAlign: 'center', fontSize: 22, letterSpacing: 8, padding: 12,
    border: '2px solid #e2e8f0', borderRadius: 10, background: 'white',
    outline: 'none', transition: 'border-color 0.2s', fontWeight: 600,
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <i className="fa-solid fa-pen-nib" style={{ color: 'white', fontSize: 24 }} />
          </div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: 18 }}>Daftarkan Tanda Tangan Digital</h3>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-light)' }}>Buat tanda tangan Anda dan lindungi dengan PIN</p>
        </div>

        {/* Status TTE (filled from DB) */}
        {info && (
          <div style={{ background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', border: '1px solid #bbf7d0', borderRadius: 10, padding: '14px 16px', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <i className="fa-solid fa-circle-check" style={{ color: '#16a34a', fontSize: 18 }} />
              <span style={{ fontWeight: 600, color: '#166534', fontSize: 14 }}>TTE Anda Sudah Terdaftar</span>
            </div>
            <div style={{ fontSize: 12, color: '#166534', lineHeight: 1.6 }}>
              <div><i className="fa-regular fa-calendar" style={{ width: 16 }} /> Didaftarkan: {info.createdAt || '-'}</div>
              <div><i className="fa-solid fa-rotate" style={{ width: 16 }} /> Diperbarui: {info.updatedAt || '-'}</div>
            </div>
          </div>
        )}

        {/* UU ITE Info */}
        <details style={{ marginBottom: 18, border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
          <summary style={{ padding: '12px 16px', background: '#f8fafc', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: 'var(--text-dark)', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fa-solid fa-scale-balanced" style={{ color: 'var(--secondary)' }} />
            <span>Ketentuan Hukum TTE (UU ITE Pasal 11)</span>
            <i className="fa-solid fa-chevron-down" style={{ marginLeft: 'auto', fontSize: 10, color: '#94a3b8' }} />
          </summary>
          <div style={{ padding: '14px 16px', fontSize: 12, lineHeight: 1.7, color: '#475569', borderTop: '1px solid #e2e8f0' }}>
            <p style={{ margin: '0 0 8px 0' }}>Tanda Tangan Elektronik (TTE) memiliki <b>kekuatan hukum sah</b> menurut Pasal 11 UU No. 11/2008 tentang Informasi dan Transaksi Elektronik jika memenuhi:</p>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>Data pembuatan hanya diketahui <b>penandatangan</b></li>
              <li>Sistem berada di bawah <b>kendali penuh</b> penandatangan</li>
              <li>Perubahan TTE dapat <b>terdeteksi</b></li>
              <li>Perubahan informasi terkait dapat <b>terdeteksi</b></li>
              <li>Dapat mengidentifikasi <b>keaslian &amp; identitas</b> penandatangan</li>
              <li>Dapat membuktikan <b>keutuhan data</b></li>
            </ul>
            <p style={{ margin: '10px 0 0 0', padding: '8px 10px', background: '#eff6ff', borderRadius: 6, fontSize: 11, color: '#1e40af' }}>
              <i className="fa-solid fa-shield-halved" /> PIN Anda di-hash dengan <b>SHA-256</b> — tidak ada yang mengetahui PIN asli Anda, termasuk sistem.
            </p>
          </div>
        </details>

        {/* Canvas */}
        <div style={{ marginBottom: 20 }}>
          <SignaturePad canvasId="canvasRegisterSign" height={150} onReady={setPadApi} />
        </div>

        {/* PIN Section */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <i className="fa-solid fa-lock" style={{ color: 'var(--secondary)', fontSize: 14 }} />
            <span style={{ fontWeight: 600, fontSize: 13 }}>PIN Keamanan 6 Digit</span>
          </div>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 14px 0' }}>PIN digunakan untuk memverifikasi identitas Anda saat menandatangani dokumen.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 6, fontWeight: 500 }}>PIN</label>
              <input type="password" value={pin} maxLength={6} placeholder="······" onChange={(e) => setPin(e.target.value)}
                style={pinInputStyle}
                onFocus={(e) => { e.target.style.borderColor = 'var(--secondary)' }}
                onBlur={(e) => { e.target.style.borderColor = '#e2e8f0' }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 6, fontWeight: 500 }}>ULANGI PIN</label>
              <input type="password" value={pinConfirm} maxLength={6} placeholder="······" onChange={(e) => setPinConfirm(e.target.value)}
                style={pinInputStyle}
                onFocus={(e) => { e.target.style.borderColor = 'var(--secondary)' }}
                onBlur={(e) => { e.target.style.borderColor = '#e2e8f0' }} />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn btn-outline" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" onClick={save}><i className="fa-solid fa-floppy-disk" /> Simpan &amp; Buat PIN</button>
        </div>
      </div>
    </div>
  )
}
