import { useEffect, useState } from 'react'
import Swal from 'sweetalert2'
import { gasApi } from '../../api/gasClient'
import { useAuth } from '../../context/AuthContext'
import SignaturePad from '../SignaturePad'
import { sameName } from '../../utils/roles'

/**
 * TTD dari halaman list — auditor pakai PIN, auditee gambar langsung.
 * Port openListSign/processListSign/submitListSign.
 */
export default function ListSignModal({ auditId, role, onClose, onSaved }) {
  const { user, ipAddress } = useAuth()
  const [pin, setPin] = useState('')
  const [auditeeName, setAuditeeName] = useState('')
  const [auditorName, setAuditorName] = useState('')
  const [padApi, setPadApi] = useState(null)

  // Ambil nama auditor audit ini, untuk menolak self-audit di sisi UI
  // (pemeriksaan otoritatif tetap ada di backend: handleUpdateSignature).
  useEffect(() => {
    if (role !== 'auditee') return
    gasApi.getDetail(auditId)
      .then((res) => { if (res.success) setAuditorName(res.data?.auditorName || '') })
      .catch(() => {})
  }, [auditId, role])

  const submit = async () => {
    let signatureData = ''
    if (role === 'auditor') {
      if (!pin || pin.length !== 6) return Swal.fire('Peringatan', 'Masukkan 6 digit PIN', 'warning')
      Swal.fire({ title: 'Verifikasi PIN...', allowOutsideClick: false, didOpen: () => Swal.showLoading() })
      try {
        const v = await gasApi.verifySignature(user.nik, pin)
        if (!v.success) { Swal.fire('Gagal', v.message, 'error'); return }
        signatureData = v.signatureData
      } catch {
        Swal.fire('Error', 'Gagal verifikasi PIN', 'error')
        return
      }
    } else {
      if (!auditeeName.trim()) return Swal.fire('Peringatan', 'Nama auditee wajib diisi', 'warning')
      if (sameName(auditeeName, auditorName)) {
        return Swal.fire('Self-audit tidak diizinkan', 'Nama Auditee sama dengan Auditor. Silakan pilih Auditee lain.', 'warning')
      }
      if (!padApi || padApi.isEmpty()) return Swal.fire('Peringatan', 'Tanda tangan masih kosong', 'warning')
      signatureData = padApi.getCroppedDataURL()
    }
    Swal.fire({ title: 'Menyimpan TTD...', allowOutsideClick: false, didOpen: () => Swal.showLoading() })
    try {
      const res = await gasApi.updateSignature(auditId, role, signatureData, user.nik, ipAddress, role === 'auditee' ? auditeeName.trim() : null)
      if (res.success) {
        Swal.fire('Berhasil', res.message, 'success')
        onSaved?.(res)
      } else Swal.fire('Gagal', res.message, 'error')
    } catch {
      Swal.fire('Error', 'Gagal menyimpan TTD', 'error')
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 400, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
        <h3>Tanda Tangan {role === 'auditor' ? 'Auditor' : 'Auditee'}</h3>
        {role === 'auditor' ? (
          <div style={{ marginTop: 12 }}>
            <p>Silakan masukkan PIN Anda untuk menandatangani dokumen ini.</p>
            <input type="password" value={pin} maxLength={6} onChange={(e) => setPin(e.target.value)}
              placeholder="6 Digit PIN" style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: 5, width: '100%', padding: '10px 12px', border: '1.5px solid rgba(0,0,0,0.08)', borderRadius: 10, marginTop: 10 }} />
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>
            <input value={auditeeName} onChange={(e) => setAuditeeName(e.target.value)} placeholder="Nama Auditee..."
              style={{ width: '100%', marginBottom: 10, textAlign: 'center', padding: '10px 12px', border: '1.5px solid rgba(0,0,0,0.08)', borderRadius: 10 }} />
            <p>Silakan tanda tangan di bawah ini:</p>
            <div style={{ marginTop: 8 }}>
              <SignaturePad canvasId="canvasListAuditee" height={150} onReady={setPadApi} />
            </div>
          </div>
        )}
        <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button className="btn btn-outline" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" onClick={submit}>Simpan TTD</button>
        </div>
      </div>
    </div>
  )
}
