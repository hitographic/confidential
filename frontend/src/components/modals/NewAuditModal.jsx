import { useEffect, useState } from 'react'
import Swal from 'sweetalert2'
import { gasApi } from '../../api/gasClient'

export default function NewAuditModal({ kategori, onClose, onStart }) {
  const [depts, setDepts] = useState([])
  const [dept, setDept] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    gasApi.getDepartemen(kategori)
      .then((res) => {
        if (res.success) setDepts(res.data || [])
      })
      .catch(() => setDepts([{ nama: 'Produksi (Demo)' }]))
      .finally(() => setLoading(false))
  }, [kategori])

  const start = () => {
    if (!dept) { Swal.fire('Peringatan', 'Departemen wajib dipilih!', 'warning'); return }
    onStart?.(dept)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Mulai Audit Baru — {kategori}</h3>
        <div className="form-group" style={{ marginTop: 16 }}>
          <label>Departemen</label>
          <select value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">{loading ? '- Memuat... -' : '- Pilih Departemen -'}</option>
            {depts.map((d, i) => (
              <option key={i} value={d.nama}>{d.nama}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button className="btn btn-outline" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" onClick={start}>Mulai Checklist</button>
        </div>
      </div>
    </div>
  )
}
