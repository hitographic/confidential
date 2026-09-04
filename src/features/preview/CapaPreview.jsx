import { useEffect, useState } from 'react'
import Swal from 'sweetalert2'
import { gasApi } from '../../api/gasClient'
import { useAuth } from '../../context/AuthContext'
import { capaSuggestedNo, formatIdDate, getCapaFindings } from './capaUtils'

const doCapaPdf = (id, filename) =>
  import('../../utils/exportPdf').then((m) => m.exportCapaPdf(id, filename))
const doCapaExcel = (payload) =>
  import('../../utils/exportExcel').then((m) => m.exportCapaExcel(payload))

function CapaCheck({ active, label }) {
  return <td style={{ border: 'none', padding: 2 }}><div className="check-box">{active ? 'V' : ' '}</div> {label}</td>
}

/** Preview CAPA MGT-004 landscape — port openCapaPreview + export. */
export default function CapaPreviewModal({ auditId, onClose }) {
  const { user } = useAuth()
  const [detail, setDetail] = useState(null)
  const [findings, setFindings] = useState([])
  const [no, setNo] = useState('..../CAPA/..../....')

  useEffect(() => {
    Swal.fire({ title: 'Memuat CAPA...', allowOutsideClick: false, didOpen: () => Swal.showLoading() })
    gasApi.getDetail(auditId).then((res) => {
      if (!res.success) { Swal.fire('Gagal', res.message, 'error'); return }
      const d = res.data
      const f = getCapaFindings(d.checklistData)
      if (!f.length) {
        Swal.fire('Tidak ada temuan', 'Data ini tidak memiliki temuan Minor/Major/Kritis sehingga CAPA (MGT-004) tidak dapat dibuat.', 'info')
        onClose?.()
        return
      }
      Swal.close()
      setDetail(d)
      setFindings(f)
      setNo(capaSuggestedNo(f.length, new Date(d.tanggal || new Date()), d.kategori))
    }).catch(() => Swal.fire('Error', 'Gagal memuat data CAPA.', 'error'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditId])

  if (!detail) return null
  const cat = detail.kategori || ''
  const dateStr = formatIdDate(detail.tanggal)
  const padded = [...findings]
  while (padded.length < 3) padded.push(null)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 1180 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
          <h3>Preview CAPA Internal Audit <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>(MGT-004 • Landscape)</span></h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-outline" onClick={() => doCapaExcel({ detail, findings, no })} style={{ fontSize: 12 }}>
              <i className="fa-solid fa-file-excel" style={{ color: '#10b981' }} /> Export Excel
            </button>
            <button className="btn btn-outline" onClick={() => doCapaPdf('capaPreviewArea', `CAPA-${cat}.pdf`)} style={{ fontSize: 12 }}>
              <i className="fa-solid fa-file-pdf" style={{ color: '#f43f5e' }} /> Export PDF
            </button>
            <button className="btn btn-outline" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px' }}>
          <label style={{ fontSize: 13, fontWeight: 700 }}>No :</label>
          <input id="capaNoInput" value={no} onChange={(e) => setNo(e.target.value)}
            style={{ fontFamily: "'Times New Roman', Times, serif", fontWeight: 'bold', border: '1px dashed #94a3b8', borderRadius: 6, padding: '4px 10px', fontSize: 13, minWidth: 220, textAlign: 'center' }} />
          <span style={{ fontSize: 11, color: '#92400e' }}>Otomatis dari urutan temuan + kode semester + tahun audit. Bisa diedit manual sebelum export.</span>
        </div>

        <div className="preview-wrapper" style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, background: '#f8fafc' }}>
          <div id="capaPreviewArea">
            <div style={{ border: '2px solid black', display: 'flex', flexDirection: 'column', flexGrow: 1, boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', borderBottom: '2px solid black' }}>
                <div style={{ width: '62%', borderRight: '1px solid black', padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontWeight: 'bold', fontSize: 13 }}>
                  PT INDOFOOD CBP SUKSES MAKMUR Tbk<br />DIVISI NOODLE - PABRIK CIBITUNG
                </div>
                <div style={{ width: '38%', padding: 8, fontWeight: 'bold', fontSize: 12 }}>
                  <table style={{ width: '100%', border: 'none', fontWeight: 'bold' }}>
                    <tbody>
                      <tr><td style={{ border: 'none', padding: '1px 0', width: 110 }}>Kode Form</td><td style={{ border: 'none', padding: '1px 0' }}>: MGT - 004</td></tr>
                      <tr><td style={{ border: 'none', padding: '1px 0' }}>No. Terbitan</td><td style={{ border: 'none', padding: '1px 0' }}>: 2.7</td></tr>
                      <tr><td style={{ border: 'none', padding: '1px 0' }}>Tgl. Efektif</td><td style={{ border: 'none', padding: '1px 0' }}>: 22 Juni 2026</td></tr>
                      <tr><td style={{ border: 'none', padding: '1px 0' }}>Halaman</td><td style={{ border: 'none', padding: '1px 0' }}>: 1 / 1</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ display: 'flex', borderBottom: '2px solid black' }}>
                <div style={{ width: '58%', padding: 10, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontWeight: 'bold', fontSize: 17, textAlign: 'center', letterSpacing: '0.02em' }}>CAPA INTERNAL AUDIT</div>
                  <div style={{ fontWeight: 'bold', fontSize: 13, textAlign: 'center', marginTop: 6, fontStyle: 'italic' }}>No : {no}</div>
                </div>
                <div style={{ width: '42%', padding: 8 }}>
                  <table style={{ width: '100%', border: 'none', fontWeight: 'bold', fontSize: 12 }}>
                    <tbody>
                      <tr><CapaCheck active={cat === 'Halal'} label="Halal" /><CapaCheck active={cat === 'SMK3'} label="SMK3" /><td style={{ border: 'none', padding: 2 }}><div className="check-box" style={{ width: 40 }}> </div> .........</td></tr>
                      <tr><CapaCheck active={cat === 'ISO'} label="ISO" /><CapaCheck active={cat === 'SML'} label="SML" /><td style={{ border: 'none' }} /></tr>
                      <tr><CapaCheck active={cat === 'FSSC'} label="FSSC" /><CapaCheck active={cat === 'SME'} label="SME" /><td style={{ border: 'none' }} /></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ padding: '8px 14px', borderBottom: '2px solid black', fontWeight: 'bold', fontSize: 13, display: 'flex', gap: 40 }}>
                <div>Departemen : {detail.departemen || '-'}</div>
                <div>Tgl. Audit : {dateStr}</div>
              </div>

              <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', flexGrow: 1 }}>
                  <colgroup>
                    <col style={{ width: '24%' }} /><col style={{ width: '9%' }} /><col style={{ width: '22%' }} />
                    <col style={{ width: '13%' }} /><col style={{ width: '24%' }} /><col style={{ width: '8%' }} />
                  </colgroup>
                  <thead>
                    <tr className="capa-header-yellow">
                      <th style={{ border: '1px solid black', padding: 6, fontSize: 11 }}>KETIDAKSESUAIAN<br />( NC )</th>
                      <th style={{ border: '1px solid black', padding: 6, fontSize: 11 }}>ELEMEN /<br />KLAUSUL *</th>
                      <th style={{ border: '1px solid black', padding: 6, fontSize: 11 }}>CORRECTION<br /><span style={{ fontWeight: 'normal' }}>( Tindakan Segera Terhadap NC )</span></th>
                      <th style={{ border: '1px solid black', padding: 6, fontSize: 11 }}>INDIKASI PENYEBAB<br /><span style={{ fontWeight: 'normal' }}>( Penyebab Terjadinya NC )</span></th>
                      <th style={{ border: '1px solid black', padding: 6, fontSize: 11 }}>CORRECTIVE ACTION<br /><span style={{ fontWeight: 'normal' }}>( Tindakan Menjawab Penyebab NC )</span></th>
                      <th style={{ border: '1px solid black', padding: 6, fontSize: 11 }}>Target<br />Selesai</th>
                    </tr>
                  </thead>
                  <tbody id="capaPreviewTableBody">
                    {padded.map((f, idx) => (
                      <tr key={idx}>
                        <td>{f ? `${idx + 1}. ${f.nc}` : ' '}</td>
                        <td style={{ textAlign: 'center' }}>{f ? f.klausul : ''}</td>
                        <td style={{ minHeight: 54 }} />
                        <td /><td /><td />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', borderTop: '2px solid black', padding: '12px 10px 16px' }}>
                <div style={{ flex: 1, fontSize: 11, color: 'red', fontStyle: 'italic' }}>* Elemen / klausul mengacu ke standard :<br />........................................</div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 12 }}>Auditor</div>
                  <div style={{ height: 46 }} />
                  <div style={{ fontWeight: 'bold', fontSize: 12, textDecoration: 'underline' }}>{detail.auditorName || user?.nama || '-'}</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 12 }}>Auditee</div>
                  <div style={{ height: 46 }} />
                  <div style={{ fontSize: 12 }}>____________________</div>
                  <div style={{ fontSize: 12 }}>Spv.</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 12 }}>Diketahui Oleh</div>
                  <div style={{ height: 46 }} />
                  <div style={{ fontSize: 12 }}>____________________</div>
                  <div style={{ fontSize: 12 }}>Dept. Head</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
          <button className="btn btn-outline" onClick={onClose}>Tutup</button>
        </div>
      </div>
    </div>
  )
}
