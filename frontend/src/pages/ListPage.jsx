import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Swal from 'sweetalert2'
import { gasApi } from '../api/gasClient'
import { useAuth } from '../context/AuthContext'
import { useAudit } from '../context/AuditContext'
import NewAuditModal from '../components/modals/NewAuditModal'
import ListSignModal from '../components/modals/ListSignModal'
import ReportPreviewModal from '../features/preview/ReportPreview'
import CapaPreviewModal from '../features/preview/CapaPreview'

const onExportList = async (rowsToExport, cat) => {
  const { exportListExcel } = await import('../utils/exportExcel')
  return exportListExcel(rowsToExport, cat)
}

export default function ListPage() {
  const { kategori } = useParams()
  const category = decodeURIComponent(kategori || '')
  const { user, isAdmin } = useAuth()
  const { category: ctxCategory, setAudit } = useAudit()
  const navigate = useNavigate()

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [qAuditee, setQAuditee] = useState('')
  const [qAuditor, setQAuditor] = useState('')
  const [qDept, setQDept] = useState('')
  const [qStatus, setQStatus] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [signReq, setSignReq] = useState(null) // {id, role}
  const [previewId, setPreviewId] = useState(null)
  const [capaId, setCapaId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await gasApi.getList(user?.nama, category)
      if (res.success) setRows((res.data || []).filter((d) => d.kategori === category))
    } catch {
      setRows([])
      Swal.fire('Error', 'Gagal memuat data dari server', 'error')
    } finally {
      setLoading(false)
    }
  }, [user, category])

  useEffect(() => {
    if (ctxCategory !== category) setAudit({ category })
  }, [category, ctxCategory, setAudit])
  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => rows.filter((item) => {
    if (qAuditee && !String(item.auditee).toLowerCase().includes(qAuditee.toLowerCase())) return false
    if (qAuditor && !String(item.auditor).toLowerCase().includes(qAuditor.toLowerCase())) return false
    if (qDept && !String(item.departemen || '').toLowerCase().includes(qDept.toLowerCase())) return false
    if (qStatus && item.status !== qStatus) return false
    return true
  }), [rows, qAuditee, qAuditor, qDept, qStatus])

  const onDelete = (id) => {
    Swal.fire({
      title: 'Hapus data ini?', text: 'Data yang dihapus tidak bisa dikembalikan!', icon: 'warning',
      showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Ya, hapus!',
    }).then(async (r) => {
      if (!r.isConfirmed) return
      Swal.fire({ title: 'Menghapus...', didOpen: () => Swal.showLoading() })
      try {
        const res = await gasApi.deleteData(id)
        if (res.success) { Swal.fire('Terhapus!', res.message, 'success'); load() }
        else Swal.fire('Gagal', res.message, 'error')
      } catch { Swal.fire('Error', 'Gagal menghapus', 'error') }
    })
  }

  const onEdit = (id) => {
    sessionStorage.removeItem('matrika_autosave')
    setAudit({ editId: id })
    navigate('/form')
  }

  return (
    <div>
      <div className="header-action list-header">
        <div className="list-title-row">
          <button className="btn btn-outline list-back-btn" onClick={() => navigate('/kategori')}>
            <i className="fa-solid fa-arrow-left" /> Kembali
          </button>
          <h2 className="list-title">Data Pengamatan - {category}</h2>
        </div>
        <div className="list-header-actions">
          {isAdmin && (
            <button className="btn btn-outline" onClick={() => onExportList(filtered, category)}>
              <i className="fa-solid fa-file-excel" style={{ color: '#10b981' }} /> Export Excel
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>
            <i className="fa-solid fa-plus" /> Tambah Data
          </button>
        </div>
      </div>

      <div className="glass-card search-bar">
        <div className="search-field">
          <i className="fa-solid fa-user search-ico" />
          <input className="search-input" value={qAuditee} onChange={(e) => setQAuditee(e.target.value)} placeholder="Cari Auditee..." />
        </div>
        <div className="search-field">
          <i className="fa-solid fa-user-tie search-ico" />
          <input className="search-input" value={qAuditor} onChange={(e) => setQAuditor(e.target.value)} placeholder="Cari Auditor..." />
        </div>
        <div className="search-field">
          <i className="fa-solid fa-building search-ico" />
          <input className="search-input" value={qDept} onChange={(e) => setQDept(e.target.value)} placeholder="Cari Departemen..." />
        </div>
        <div className="search-field">
          <i className="fa-solid fa-filter search-ico" />
          <select className="search-input" value={qStatus} onChange={(e) => setQStatus(e.target.value)} style={{ appearance: 'none' }}>
            <option value="">Semua Status</option>
            <option value="Draft">Draft</option>
            <option value="Submitted">Submitted</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 20 }}><i className="fa-solid fa-spinner fa-spin fa-2x" /><br />Memuat data...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
          <i className="fa-solid fa-inbox" style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }} /><br />
          <span style={{ fontSize: 14, fontWeight: 500 }}>Tidak ada data ditemukan</span>
        </div>
      ) : filtered.map((item) => {
        const dateStr = item.tanggal ? new Date(item.tanggal).toLocaleDateString('id-ID') : '-'
        const isOwnerOrAdmin = item.auditor === user?.nama || isAdmin
        return (
          <div key={item.id} className="glass-card data-card">
            <div className="data-info">
              <h4>{item.auditee}</h4>
              <p><i className="fa-regular fa-calendar-days" /> {dateStr} &nbsp; <span className={`badge ${item.status === 'Draft' ? 'draft' : 'submitted'}`}>{item.status}</span></p>
              <p className="data-meta">
                <i className="fa-solid fa-user-tie" /> {item.auditor} &nbsp;·&nbsp; <i className="fa-solid fa-building" /> {item.departemen || '-'}
              </p>
            </div>
            <div className="action-group">
              {isOwnerOrAdmin ? (
                <>
                  {item.status === 'Draft' ? (
                    <>
                      <button className="btn btn-outline btn-sm" onClick={() => onEdit(item.id)}><i className="fa-solid fa-pen-to-square" /> Edit</button>
                      {item.hasAuditorSign && (
                        <button className="btn btn-outline btn-sm" onClick={() => setPreviewId(item.id)}><i className="fa-solid fa-eye" /> Preview</button>
                      )}
                    </>
                  ) : (
                    <button className="btn btn-outline btn-sm" onClick={() => setPreviewId(item.id)}><i className="fa-solid fa-eye" /> Preview</button>
                  )}
                  <button className="btn btn-outline btn-sm" style={{ color: '#ea580c', borderColor: 'rgba(234,88,12,0.35)' }} onClick={() => setCapaId(item.id)} title="CAPA Internal Audit (MGT-004)">
                    <i className="fa-solid fa-clipboard-check" /> CAPA
                  </button>
                  {item.status === 'Draft' && (
                    <>
                      <button className="btn btn-outline btn-sm" style={{ color: item.hasAuditorSign ? 'var(--success)' : 'var(--warning)' }}
                        onClick={() => item.hasAuditorSign ? null : setSignReq({ id: item.id, role: 'auditor' })}>
                        <i className="fa-solid fa-circle-check" /> {item.hasAuditorSign ? 'Auditor ✓' : 'TTD Auditor'}
                      </button>
                      <button className="btn btn-outline btn-sm"
                        style={{ color: item.hasAuditeeSign ? 'var(--success)' : (item.hasAuditorSign ? 'var(--warning)' : '#94a3b8') }}
                        onClick={() => {
                          if (item.hasAuditeeSign) return
                          if (!item.hasAuditorSign) return Swal.fire('Peringatan', 'Auditor harus menandatangani laporan terlebih dahulu sebelum Auditee dapat tanda tangan.', 'warning')
                          setSignReq({ id: item.id, role: 'auditee' })
                        }}>
                        <i className="fa-solid fa-pen-fancy" /> {item.hasAuditeeSign ? 'Auditee ✓' : 'TTD Auditee'}
                      </button>
                    </>
                  )}
                  <button className="btn btn-danger btn-sm" onClick={() => onDelete(item.id)}><i className="fa-solid fa-trash-can" /></button>
                </>
              ) : (
                <span style={{ color: 'var(--text-light)', fontSize: 14, fontStyle: 'italic' }}>Akses hanya untuk pembuat laporan atau Admin</span>
              )}
            </div>
          </div>
        )
      })}

      {showNew && (
        <NewAuditModal kategori={category} onClose={() => setShowNew(false)} onStart={(dept) => {
          setShowNew(false)
          sessionStorage.removeItem('matrika_autosave')
          setAudit({ auditee: '(Menunggu TTD)', dept, editId: null, questions: [] })
          navigate('/form')
        }} />
      )}
      {signReq && (
        <ListSignModal auditId={signReq.id} role={signReq.role} onClose={() => setSignReq(null)} onSaved={() => { setSignReq(null); load() }} />
      )}
      {previewId && (
        <ReportPreviewModal auditId={previewId} source="list" onClose={() => { setPreviewId(null); load() }} />
      )}
      {capaId && <CapaPreviewModal auditId={capaId} onClose={() => setCapaId(null)} />}
    </div>
  )
}
