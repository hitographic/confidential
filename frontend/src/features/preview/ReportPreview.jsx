import { useEffect, useState } from 'react'
import Swal from 'sweetalert2'
import { gasApi } from '../../api/gasClient'
import { useAuth } from '../../context/AuthContext'

const doExportPdf = (id, filename) =>
  import('../../utils/exportPdf').then((m) => m.exportPreviewPdf(id, filename))
const doExportExcel = (detail) =>
  import('../../utils/exportExcel').then((m) => m.exportItemExcel(detail))

function CheckCell({ active, label }) {
  return (
    <td style={{ border: 'none', padding: 2 }}>
      <div className="check-box">{active ? 'V' : ' '}</div> {label}
    </td>
  )
}

function CheckboxGrid({ kategori }) {
  return (
    <table style={{ width: '100%', border: 'none', fontWeight: 'bold', fontSize: 14 }}>
      <tbody>
        <tr>
          <CheckCell active={kategori === 'Halal'} label="Halal" />
          <CheckCell active={kategori === 'SMK3'} label="SMK3" />
          <td style={{ border: 'none', padding: 2 }}><div className="check-box" style={{ width: 40 }}> </div> .........</td>
        </tr>
        <tr>
          <CheckCell active={kategori === 'ISO'} label="ISO" />
          <CheckCell active={kategori === 'SML'} label="SML" />
          <td style={{ border: 'none', padding: 2 }} />
        </tr>
        <tr>
          <CheckCell active={kategori === 'FSSC'} label="FSSC" />
          <CheckCell active={kategori === 'SME'} label="SME" />
          <td style={{ border: 'none', padding: 2 }} />
        </tr>
      </tbody>
    </table>
  )
}

function extractFileId(url) {
  const m = String(url || '').match(/id=([^&]+)/)
  return m ? m[1] : null
}

/**
 * Preview MGT-003.
 * - source=list: fetch getDetail(auditId)
 * - source=form: pakai draft langsung (belum tersimpan)
 */
export default function ReportPreviewModal({ auditId, draft, source = 'list', onClose, onSaved }) {
  const { user } = useAuth()
  const [detail, setDetail] = useState(draft ? {
    kategori: draft.kategori,
    departemen: draft.departemen,
    tanggal: new Date().toISOString(),
    auditorName: draft.auditorName,
    auditeeName: draft.auditeeName,
    checklistData: draft.checklistData,
    lampiran: draft.lampiran,
    hashIntegritas: '',
    auditorSignature: '',
    auditeeSignature: '',
  } : null)
  const [auditorImg, setAuditorImg] = useState('')
  const [auditeeImg, setAuditeeImg] = useState('')

  useEffect(() => {
    if (draft) return
    if (!auditId) return
    Swal.fire({ title: 'Memuat Preview...', didOpen: () => Swal.showLoading() })
    gasApi.getDetail(auditId).then(async (res) => {
      if (!res.success) { Swal.fire('Gagal', res.message, 'error'); return }
      Swal.close()
      setDetail(res.data)
      const ids = [extractFileId(res.data.auditorSignature), extractFileId(res.data.auditeeSignature)].filter(Boolean)
      if (ids.length) {
        try {
          const sig = await gasApi.fetchImages(ids)
          setAuditorImg((sig.images?.[ids[0]]) || res.data.auditorSignature || '')
          if (ids[1]) setAuditeeImg((sig.images?.[ids[1]]) || res.data.auditeeSignature || '')
          else setAuditeeImg(res.data.auditeeSignature || '')
        } catch {
          setAuditorImg(res.data.auditorSignature || '')
          setAuditeeImg(res.data.auditeeSignature || '')
        }
      } else {
        setAuditorImg(res.data.auditorSignature || '')
        setAuditeeImg(res.data.auditeeSignature || '')
      }
    }).catch(() => Swal.fire('Error', 'Belum tersambung ke backend.', 'error'))
  }, [auditId, draft])

  if (!detail) return null

  const rows = (detail.checklistData || []).filter((r) => {
    if (r.type == 1 || r.type == 2 || r.type == 3) return false
    return r.hasilPengamatan && String(r.hasilPengamatan).trim() !== ''
  })

  const dateStr = detail.tanggal ? new Date(detail.tanggal).toLocaleDateString('id-ID') : new Date().toLocaleDateString('id-ID')
  const lampiran = detail.lampiran || []

  const saveDraft = async () => {
    if (!draft) return
    Swal.fire({ title: 'Menyimpan...', allowOutsideClick: false, didOpen: () => Swal.showLoading() })
    try {
      const res = await gasApi.saveDraft(draft)
      if (res.success) {
        Swal.fire('Berhasil!', res.message, 'success').then(() => { onSaved?.(); onClose?.() })
      } else Swal.fire('Gagal', res.message, 'error')
    } catch {
      Swal.fire('Error', 'Gagal menyimpan', 'error')
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 15 }}>
          <h3>Preview Laporan</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline" onClick={() => doExportPdf('previewArea', `MGT-003-${detail.kategori}.pdf`)} style={{ fontSize: 12 }}>
              <i className="fa-solid fa-file-pdf" style={{ color: '#f43f5e' }} /> Export to PDF
            </button>
            {source === 'list' && (
              <button className="btn btn-outline" onClick={() => doExportExcel(detail)} style={{ fontSize: 12 }}>
                <i className="fa-solid fa-file-excel" style={{ color: '#10b981' }} /> Excel
              </button>
            )}
            <button className="btn btn-outline" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
          </div>
        </div>

        <div className="preview-wrapper">
          <div id="previewArea">
            <div style={{ border: '2px solid black', display: 'flex', flexDirection: 'column', flexGrow: 1, boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', borderBottom: '2px solid black' }}>
                <div style={{ width: '58%', borderRight: '2px solid black', padding: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontWeight: 'bold', fontSize: 14 }}>
                  PT INDOFOOD CBP SUKSES MAKMUR Tbk<br />DIVISI NOODLE - PABRIK CIBITUNG
                </div>
                <div style={{ width: '42%', padding: 10, fontWeight: 'bold', fontSize: 13 }}>
                  <table style={{ width: '100%', border: 'none', fontWeight: 'bold' }}>
                    <tbody>
                      <tr><td style={{ border: 'none', padding: '2px 0', width: 120 }}>Kode Form</td><td style={{ border: 'none', padding: '2px 0' }}>: MGT - 003</td></tr>
                      <tr><td style={{ border: 'none', padding: '2px 0' }}>No. Terbitan</td><td style={{ border: 'none', padding: '2px 0' }}>: 2.0</td></tr>
                      <tr><td style={{ border: 'none', padding: '2px 0' }}>Tgl. Efektif</td><td style={{ border: 'none', padding: '2px 0' }}>: 02 Oktober 2023</td></tr>
                      <tr><td style={{ border: 'none', padding: '2px 0' }}>Halaman</td><td style={{ border: 'none', padding: '2px 0' }}>: 1 / 1</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ display: 'flex', borderBottom: '2px solid black' }}>
                <div style={{ width: '45%', padding: 15, fontWeight: 'bold', fontSize: 16, display: 'flex', alignItems: 'center' }}>
                  PENGAMATAN INTERNAL AUDIT
                </div>
                <div style={{ width: '55%', padding: 10 }}><CheckboxGrid kategori={detail.kategori} /></div>
              </div>

              <div style={{ padding: '10px 15px', borderBottom: '2px solid black', fontWeight: 'bold' }}>
                <table style={{ width: '100%', border: 'none', fontWeight: 'bold', fontSize: 14 }}>
                  <tbody>
                    <tr><td style={{ border: 'none', width: 120, padding: '2px 0' }}>Departemen</td><td style={{ border: 'none', padding: '2px 0' }}>: {detail.departemen || '-'}</td></tr>
                    <tr><td style={{ border: 'none', padding: '2px 0' }}>Tanggal</td><td style={{ border: 'none', padding: '2px 0' }}>: {dateStr}</td></tr>
                  </tbody>
                </table>
              </div>

              <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', height: '100%', flexGrow: 1 }}>
                  <colgroup>
                    <col style={{ width: '5%', borderRight: '2px solid black' }} />
                    <col style={{ width: '65%', borderRight: '2px solid black' }} />
                    <col style={{ width: '15%', borderRight: '2px solid black' }} />
                    <col style={{ width: '15%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={{ borderBottom: '2px solid black', padding: 10 }}>NO.</th>
                      <th style={{ borderBottom: '2px solid black', padding: 10 }}>HASIL PENGAMATAN</th>
                      <th style={{ borderBottom: '2px solid black', padding: 10 }}>ELEMEN /<br />KLAUSUL</th>
                      <th style={{ borderBottom: '2px solid black', padding: 10 }}>KATEGORI</th>
                    </tr>
                  </thead>
                  <tbody id="previewTableBody">
                    {rows.map((r, i) => (
                      <tr key={i} style={{ height: 1 }}>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{i + 1}</td>
                        <td style={{ paddingLeft: 10 }}>{r.hasilPengamatan}</td>
                        <td style={{ textAlign: 'center' }}>{r.kriteria || '-'}</td>
                        <td style={{ textAlign: 'center' }}>{r.kategoriVal || '-'}</td>
                      </tr>
                    ))}
                    <tr style={{ height: '100%' }}><td /><td /><td /><td /></tr>
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', borderTop: '2px solid black', padding: 15 }}>
                <div style={{ flex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 10 }}>Auditor</div>
                  <div style={{ width: 150, height: 80, margin: '10px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {auditorImg ? <img src={auditorImg} style={{ width: '100%', height: '100%', objectFit: 'contain', transform: 'scale(1.2)' }} alt="TTD Auditor" /> : null}
                  </div>
                  <div style={{ borderTop: '1px solid black', marginTop: 5, width: 150, fontWeight: 'bold', paddingTop: 5 }}>{detail.auditorName || user?.nama}</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 10 }}>Auditee</div>
                  <div style={{ width: 150, height: 80, margin: '10px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {auditeeImg ? <img src={auditeeImg} style={{ width: '100%', height: '100%', objectFit: 'contain', transform: 'scale(1.2)' }} alt="TTD Auditee" /> : null}
                  </div>
                  <div style={{ borderTop: '1px solid black', marginTop: 5, width: 150, fontWeight: 'bold', paddingTop: 5 }}>{detail.auditeeName}</div>
                </div>
                <div style={{ flex: 1, fontSize: 12, fontWeight: 'bold', paddingLeft: 20 }}>
                  <div style={{ marginBottom: 5 }}>Kategori :</div>
                  <table style={{ border: 'none', fontStyle: 'italic' }}>
                    <tbody>
                      <tr><td style={{ border: 'none', padding: 2 }}>C</td><td style={{ border: 'none', padding: 2 }}>= Conformance</td></tr>
                      <tr><td style={{ border: 'none', padding: 2 }}>Minor</td><td style={{ border: 'none', padding: 2 }}>= Temuan Minor</td></tr>
                      <tr><td style={{ border: 'none', padding: 2 }}>Major</td><td style={{ border: 'none', padding: 2 }}>= Temuan Major</td></tr>
                      <tr><td style={{ border: 'none', padding: 2 }}>Kritis</td><td style={{ border: 'none', padding: 2 }}>= Temuan Kritis</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ fontSize: 8, color: '#888', textAlign: 'left', padding: '5px 15px', borderTop: '1px dashed #ccc', background: '#fff' }}>
                Hash Integritas (SHA-256): <span style={{ fontFamily: 'monospace' }}>{detail.hashIntegritas || (source === 'form' ? 'Menunggu Submit...' : 'Belum disubmit')}</span>
              </div>
            </div>
          </div>

          {lampiran.length > 0 && (
            <div id="lampiranArea">
              <div id="lampiranPage" style={{ background: 'white', padding: 20, color: 'black', fontFamily: "'Times New Roman', Times, serif", fontSize: 13, width: 794, minHeight: 1123, boxSizing: 'border-box', margin: '20px auto 0', border: '2px solid black' }}>
                <h3 style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: 15, fontSize: 16, textDecoration: 'underline', paddingTop: 10 }}>LAMPIRAN</h3>
                <div className="lampiran-grid">
                  {lampiran.map((item, idx) => (
                    <div key={idx} className="lampiran-item">
                      <img src={item.url} alt={item.caption || `Lampiran ${idx + 1}`} loading="lazy" />
                      <div className="lampiran-caption">{item.caption || `Lampiran ke-${idx + 1}`}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button className="btn btn-outline" onClick={onClose}>Tutup</button>
          {source === 'form' && <button className="btn btn-primary" onClick={saveDraft}><i className="fa-solid fa-save" /> Simpan Data</button>}
        </div>
      </div>
    </div>
  )
}
