import { useEffect, useState } from 'react'
import Swal from 'sweetalert2'
import { gasApi } from '../../api/gasClient'
import { useAuth } from '../../context/AuthContext'
import { capaSuggestedNo, formatIdDate, getCapaFindings } from './capaUtils'
import CropPhotoModal from '../../components/modals/CropPhotoModal'

const doCapaPdf = (id, filename) =>
  import('../../utils/exportPdf').then((m) => m.exportCapaPdf(id, filename))
const doCapaExcel = (payload) =>
  import('../../utils/exportExcel').then((m) => m.exportCapaExcel(payload))

function CapaCheck({ active, label }) {
  return <td style={{ border: 'none', padding: 2 }}><div className="check-box">{active ? 'V' : ' '}</div> {label}</td>
}

/**
 * Preview CAPA MGT-004 landscape.
 * - Auditor/Admin: baca saja (preview), menampilkan CAPA yang sudah diisi Auditee jika ada.
 * - Auditee: dapat mengisi Correction, Indikasi Penyebab, Corrective Action, Target Selesai
 *   serta upload foto perbaikan per temuan, lalu menyimpannya ke backend.
 */
export default function CapaPreviewModal({ auditId, onClose }) {
  const { user, isAdmin } = useAuth()
  const [detail, setDetail] = useState(null)
  const [findings, setFindings] = useState([])
  const [no, setNo] = useState('..../CAPA/..../....')
  const [capa, setCapa] = useState([]) // {nc, klausul, correction, indikasiPenyebab, correctiveAction, targetSelesai, photos:[{id,url,fileId,caption}]}
  const [saving, setSaving] = useState(false)
  const [crop, setCrop] = useState(null) // {img, findingIdx}

  const isAuditee = user?.nama && detail?.auditeeName === user?.nama && !isAdmin

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

      // Inisialisasi data CAPA dari yang sudah disimpan (jika ada), kosong jika belum.
      const saved = d.capa || []
      const init = f.map((find, i) => {
        const s = saved[i] || {}
        return {
          nc: find.nc,
          klausul: find.klausul,
          correction: s.correction || '',
          indikasiPenyebab: s.indikasiPenyebab || '',
          correctiveAction: s.correctiveAction || '',
          targetSelesai: s.targetSelesai || '',
          photos: (s.photos || []).map((p, pi) => ({ id: `p-${i}-${pi}`, url: p.url, fileId: p.fileId || '', caption: p.caption || '' }))
        }
      })
      setCapa(init)
    }).catch(() => Swal.fire('Error', 'Gagal memuat data CAPA.', 'error'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditId])

  if (!detail) return null

  const cat = detail.kategori || ''
  const dateStr = formatIdDate(detail.tanggal)
  const padded = [...findings]
  while (padded.length < 3) padded.push(null)

  const padCapa = [...capa]
  while (padCapa.length < 3) padCapa.push({ nc: '', klausul: '', correction: '', indikasiPenyebab: '', correctiveAction: '', targetSelesai: '', photos: [] })

  // --- foto perbaikan ---
  const onFile = (e, findingIdx) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => setCrop({ img, findingIdx })
      img.src = ev.target.result
    }
    reader.readAsDataURL(file)
  }

  const saveCrop = (dataUrl, caption) => {
    setCapa((prev) => prev.map((f, i) => {
      if (i !== crop.findingIdx) return f
      return { ...f, photos: [...f.photos, { id: `photo_${Date.now()}`, url: dataUrl, fileId: '', caption, local: true }] }
    }))
    setCrop(null)
  }

  const editCaption = (findingIdx, photoIdx) => {
    const photo = capa[findingIdx]?.photos?.[photoIdx]
    if (!photo) return
    Swal.fire({ title: 'Edit Keterangan Foto', input: 'text', inputValue: photo.caption || '', showCancelButton: true, confirmButtonText: 'Simpan', cancelButtonText: 'Batal' })
      .then((r) => {
        if (r.isConfirmed) {
          setCapa((prev) => prev.map((f, i) => {
            if (i !== findingIdx) return f
            const next = { ...f, photos: [...f.photos] }
            next.photos[photoIdx] = { ...next.photos[photoIdx], caption: r.value }
            return next
          }))
        }
      })
  }

  const delPhoto = (findingIdx, photoIdx) => {
    Swal.fire({ title: 'Hapus foto ini?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Ya, hapus!' })
      .then((r) => {
        if (!r.isConfirmed) return
        setCapa((prev) => prev.map((f, i) => {
          if (i !== findingIdx) return f
          return { ...f, photos: f.photos.filter((_, i2) => i2 !== photoIdx) }
        }))
      })
  }

  const setField = (findingIdx, field, value) => {
    setCapa((prev) => prev.map((f, i) => i === findingIdx ? { ...f, [field]: value } : f))
  }

  const doSave = async () => {
    setSaving(true)
    Swal.fire({ title: 'Menyimpan CAPA...', allowOutsideClick: false, didOpen: () => Swal.showLoading() })
    try {
      const res = await gasApi.saveCapa(detail.id, capa)
      await Swal.close() // tutup dialog loading dulu
      if (res.success) {
        await Swal.fire('Berhasil!', res.message, 'success')
      } else {
        await Swal.fire('Gagal', res.message, 'error')
      }
    } catch (err) {
      console.error('[CAPA] Gagal menyimpan:', err)
      await Swal.close()
      await Swal.fire('Error', 'Gagal menyimpan CAPA: ' + (err?.message || ''), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 1180 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
          <h3>Preview CAPA Internal Audit <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>(MGT-004 • Landscape)</span></h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-outline" onClick={() => doCapaExcel({ detail, findings, no, capa })} style={{ fontSize: 12 }}>
              <i className="fa-solid fa-file-excel" style={{ color: '#10b981' }} /> Export Excel
            </button>
            <button className="btn btn-outline" onClick={() => doCapaPdf('capaPreviewArea', `CAPA-${cat}.pdf`)} style={{ fontSize: 12 }}>
              <i className="fa-solid fa-file-pdf" style={{ color: '#f43f5e' }} /> Export PDF
            </button>
            {isAuditee && (
              <button className="btn btn-primary" onClick={doSave} disabled={saving} style={{ fontSize: 12 }}>
                {saving ? (
                  <><i className="fa-solid fa-spinner fa-spin" /> Simpan...</>
                ) : (
                  <><i className="fa-solid fa-save" />{' Simpan CAPA'}</>
                )}
              </button>
            )}
            <button className="btn btn-outline" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
          </div>
        </div>

        {isAuditee && (
          <div style={{ marginBottom: 8, fontSize: 11.5, color: '#0f766e', background: '#ecfdf5', border: '1px solid #10b981', borderRadius: 8, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <i className="fa-solid fa-circle-info" style={{ fontSize: 12 }} />
            <span>Mode Auditee — isi <b>Correction</b>, <b>Indikasi Penyebab</b>, <b>Corrective Action</b>, <b>Target Selesai</b> dan upload foto perbaikan per temuan, kemudian klik <b>Simpan CAPA</b>.</span>
          </div>
        )}

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
                    {padded.map((f, idx) => {
                      const c = padCapa[idx]
                      const isRowAuditee = isAuditee && f
                      return (
                        <>
                          <tr key={`row-${idx}`}>
                            <td style={{ border: '1px solid black', padding: 4, fontSize: 11, verticalAlign: 'top' }}>
                              {f ? `${idx + 1}. ${f.nc}` : ' '}
                            </td>
                            <td style={{ border: '1px solid black', padding: 4, fontSize: 11, textAlign: 'center', verticalAlign: 'top' }}>
                              {f ? f.klausul : ''}
                            </td>
                            <td style={{ border: '1px solid black', padding: 4, verticalAlign: 'top', minHeight: 60 }}>
                              {isRowAuditee ? (
                                <textarea
                                  value={c.correction}
                                  onChange={(e) => setField(idx, 'correction', e.target.value)}
                                  style={{ width: '100%', height: 60, fontSize: 11, padding: 4, boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: 4, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                                />
                              ) : (c?.correction || ' ')}
                            </td>
                            <td style={{ border: '1px solid black', padding: 4, verticalAlign: 'top', minHeight: 60 }}>
                              {isRowAuditee ? (
                                <textarea
                                  value={c.indikasiPenyebab}
                                  onChange={(e) => setField(idx, 'indikasiPenyebab', e.target.value)}
                                  style={{ width: '100%', height: 60, fontSize: 11, padding: 4, boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: 4, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                                />
                              ) : (c?.indikasiPenyebab || ' ')}
                            </td>
                            <td style={{ border: '1px solid black', padding: 4, verticalAlign: 'top', minHeight: 60 }}>
                              {isRowAuditee ? (
                                <textarea
                                  value={c.correctiveAction}
                                  onChange={(e) => setField(idx, 'correctiveAction', e.target.value)}
                                  style={{ width: '100%', height: 60, fontSize: 11, padding: 4, boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: 4, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                                />
                              ) : (c?.correctiveAction || ' ')}
                            </td>
                            <td style={{ border: '1px solid black', padding: 4, verticalAlign: 'top', minHeight: 60 }}>
                              {isRowAuditee ? (
                                <input
                                  type="date"
                                  value={c.targetSelesai}
                                  onChange={(e) => setField(idx, 'targetSelesai', e.target.value)}
                                  style={{ width: '100%', fontSize: 11, padding: 4, boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: 4, outline: 'none', fontFamily: 'inherit' }}
                                />
                              ) : (c?.targetSelesai || ' ')}
                            </td>
                          </tr>
                          {isRowAuditee && (
                            <tr key={`photo-${idx}`}>
                              <td colSpan={6} style={{ border: '1px solid black', padding: 6, background: '#f1f5f9' }}>
                                <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 5, color: '#475569' }}>Foto Perbaikan / Bukti Perbaikan (temuan {idx + 1})</div>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                  {(c.photos || []).map((p, pi) => (
                                    <div key={p.id} style={{ position: 'relative', width: 72, height: 72, border: '1px solid #cbd5e1', borderRadius: 6, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      <img src={p.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Foto perbaikan" />
                                      <div style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(211,47,47,0.9)', color: '#fff', fontSize: 10, padding: '1px 4px', borderRadius: 3, cursor: 'pointer', zIndex: 10, onClick: (ev) => { ev.stopPropagation(); delPhoto(idx, pi) } }}>&times;</div>
                                      <div style={{ position: 'absolute', top: 2, left: 2, background: 'rgba(59,130,246,0.9)', color: '#fff', fontSize: 10, padding: '1px 4px', borderRadius: 3, cursor: 'pointer', zIndex: 10, onClick: (ev) => { ev.stopPropagation(); editCaption(idx, pi) } }}>✎</div>
                                    </div>
                                  ))}
                                  <div
                                    style={{ width: 72, height: 72, border: '2px dashed #cbd5e1', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', fontSize: 11 }}
                                    onClick={() => document.getElementById(`capaPhotoInput_${idx}`)?.click()}
                                    title="Upload foto perbaikan"
                                  >
                                    <i className="fa-solid fa-camera" />
                                  </div>
                                  <input type="file" id={`capaPhotoInput_${idx}`} accept="image/*" style={{ display: 'none' }} onChange={(e) => onFile(e, idx)} />
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      )
                    })}
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

        {crop && <CropPhotoModal image={crop.img} onCancel={() => setCrop(null)} onSave={saveCrop} />}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
          {isAuditee && (
            <span style={{ fontSize: 11, color: '#64748b', marginRight: 8 }}>Role: Auditee — data CAPA disimpan per audit ini.</span>
          )}
          <button className="btn btn-outline" onClick={onClose}>Tutup</button>
        </div>
      </div>
    </div>
  )
}
