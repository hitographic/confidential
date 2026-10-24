import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Swal from 'sweetalert2'
import { gasApi } from '../api/gasClient'
import { swr, swrKey, swrRead } from '../api/swrCache'
import { useAuth } from '../context/AuthContext'
import { useAudit } from '../context/AuditContext'
import NewAuditModal from '../components/modals/NewAuditModal'
import ListSignModal from '../components/modals/ListSignModal'
import ReportPreviewModal from '../features/preview/ReportPreview'
import CapaPreviewModal from '../features/preview/CapaPreview'
import { sameName } from '../utils/roles'

const LIST_TTL = 3 * 60 * 1000

const onExportList = async (rowsToExport, cat) => {
  const { exportListExcel } = await import('../utils/exportExcel')
  return exportListExcel(rowsToExport, cat)
}

export default function ListPage() {
  const { kategori } = useParams()
  const category = decodeURIComponent(kategori || '')
  const { user, isAdmin, activeRole } = useAuth()
  // "Topi" aktif: mode Auditee hanya untuk user non-admin yang sedang
  // memakai topi Auditee. Mode Auditor dipakai untuk sisanya (termasuk Admin).
  const isAuditeeMode = !isAdmin && activeRole === 'auditee'
  const { category: ctxCategory, setAudit } = useAudit()
  const navigate = useNavigate()

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [qAuditee, setQAuditee] = useState('')
  const [qAuditor, setQAuditor] = useState('')
  const [qDept, setQDept] = useState('')
  const [qStatus, setQStatus] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [signReq, setSignReq] = useState(null) // {id, role}
  const [previewId, setPreviewId] = useState(null)
  const [capaId, setCapaId] = useState(null)
  const reqIdRef = useRef(0)

  // Kunci cache per (user + role + kategori) agar tidak bocor antar sesi
  const cacheKey = swrKey('list', { nik: user?.nik, activeRole, kategori: category })

  /**
   * Muat daftar audit.
   *
   * Perubahan penting vs versi lama:
   *  - Hasil sukses di-cache, lalu saat kembali dari halaman lain list
   *    tampil SEGERA dari cache (stale-while-revalidate), disusul refresh
   *    diam-diam di background. Ini yang membuat list tidak "kosong".
   *  - Kegagalan TIDAK menghapus data yang sudah tampil; hanya menampilkan
   *    toast peringatan. (Versi lama: `catch { setRows([]) }` menghapus
   *    semua baris -> tampak "Tidak ada data ditemukan".)
   *  - `res.success === false` kini ditangani dengan pesan dari server,
   *    bukan dibiarkan diam-diam kosong.
   *  - `reqIdRef` menjamin hanya respons terakhir yang diterapkan, sehingga
   *    dua permintaan bersamaan tidak saling menimpa dengan data basi.
   */
  const load = useCallback(async ({ silent = false, force = false } = {}) => {
    const myId = ++reqIdRef.current
    if (silent) setRefreshing(true)
    else setLoading(true)
    try {
      // Server yang memfilter (auditor -> auditnya sendiri, auditee -> miliknya,
      // admin -> semua). Lihat handleGetList di Code.gs.
      const res = await swr('list', { nik: user?.nik, activeRole, kategori: category }, () =>
        gasApi.getList({ nik: user?.nik, activeRole, kategori: category }),
        { force },
      )
      if (myId !== reqIdRef.current) return // sudah ada permintaan lebih baru
      if (!res?.success) {
        Swal.fire('Gagal', res?.message || 'Server tidak dapat mengembalikan data.', 'error')
        return
      }
      setRows((res.data || []).filter((d) => d.kategori === category))
    } catch (err) {
      if (myId !== reqIdRef.current) return
      // Pertahankan baris yang sedang tampil; jangan setRows([]).
      Swal.fire('Gagal memuat data', err?.message || 'Periksa koneksi, lalu coba muat ulang.', 'error')
    } finally {
      if (myId === reqIdRef.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [user, activeRole, category])

  useEffect(() => {
    if (ctxCategory !== category) setAudit({ category })
  }, [category, ctxCategory, setAudit])

  // Render cache lebih dulu (jika ada), baru revalidate di background.
  useEffect(() => {
    const cached = swrRead(cacheKey, LIST_TTL)
    if (cached?.success && Array.isArray(cached.data)) {
      setRows(cached.data.filter((d) => d.kategori === category))
      setLoading(false)
      load({ silent: true }) // refresh diam-diam tanpa mengosongkan layar
    } else {
      load()
    }
  }, [load, cacheKey, category])

  const filtered = useMemo(() => rows.filter((item) => {
    if (qAuditee && !String(item.auditee).toLowerCase().includes(qAuditee.toLowerCase())) return false
    if (qAuditor && !String(item.auditor).toLowerCase().includes(qAuditor.toLowerCase())) return false
    if (qDept && !String(item.departemen || '').toLowerCase().includes(qDept.toLowerCase())) return false
    if (qStatus && item.status !== qStatus) return false
    // Mode Auditee: hanya tampilkan audit miliknya sendiri.
    // (Server sudah memfilter; ini lapis pengaman tambahan di browser.)
    if (isAuditeeMode && !sameName(item.auditee, user?.nama)) return false
    return true
  }), [rows, qAuditee, qAuditor, qDept, qStatus, isAuditeeMode, user])

  const onDelete = (id) => {
    Swal.fire({
      title: 'Hapus data ini?', text: 'Data yang dihapus tidak bisa dikembalikan!', icon: 'warning',
      showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Ya, hapus!',
    }).then(async (r) => {
      if (!r.isConfirmed) return
      Swal.fire({ title: 'Menghapus...', didOpen: () => Swal.showLoading() })
      try {
        const res = await gasApi.deleteData(id, user?.nik)
        if (res.success) { Swal.fire('Terhapus!', res.message, 'success'); load({ silent: true, force: true }) }
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
          <button className="btn btn-outline" onClick={() => load({ silent: true })} disabled={refreshing} title="Muat ulang data dari server">
            <i className={`fa-solid fa-rotate ${refreshing ? 'fa-spin' : ''}`} /> Muat Ulang
          </button>
          {!isAuditeeMode && (
            <button className="btn btn-primary" onClick={() => setShowNew(true)}>
              <i className="fa-solid fa-plus" /> Tambah Data
            </button>
          )}
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
        <div className="loading-state">
          <div className="icon3d peri round"><i className="fa-solid fa-spinner" /></div>
          <span>Memuat data...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="icon3d round"><i className="fa-solid fa-inbox" /></div>
          <span>Tidak ada data ditemukan</span>
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
              ) : isAuditeeMode && sameName(item.auditee, user?.nama) && item.status === 'Submitted' ? (
                <>
                  <button className="btn btn-outline btn-sm" onClick={() => setPreviewId(item.id)}><i className="fa-solid fa-eye" /> Preview</button>
                  <button className="btn btn-outline btn-sm" style={{ color: '#ea580c', borderColor: 'rgba(234,88,12,0.35)' }} onClick={() => setCapaId(item.id)} title="CAPA Internal Audit (MGT-004)">
                    <i className="fa-solid fa-clipboard-check" /> CAPA
                  </button>
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
        <ListSignModal auditId={signReq.id} role={signReq.role} onClose={() => setSignReq(null)} onSaved={() => { setSignReq(null); load({ silent: true, force: true }) }} />
      )}
      {previewId && (
        <ReportPreviewModal auditId={previewId} source="list" onClose={() => { setPreviewId(null); load({ silent: true, force: true }) }} />
      )}
      {capaId && <CapaPreviewModal auditId={capaId} onClose={() => setCapaId(null)} />}
    </div>
  )
}
