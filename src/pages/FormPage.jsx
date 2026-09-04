import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'
import { gasApi } from '../api/gasClient'
import { useAuth } from '../context/AuthContext'
import { useAudit } from '../context/AuditContext'
import CropPhotoModal from '../components/modals/CropPhotoModal'
import ReportPreviewModal from '../features/preview/ReportPreview'

const AUTOSAVE_KEY = 'matrika_autosave'

function loadAutosave() {
  try { return JSON.parse(sessionStorage.getItem(AUTOSAVE_KEY) || '{}') } catch { return {} }
}

/**
 * Form checklist — port renderChecklist/collectFormData/editData/saveData
 * + foto lampiran wajib untuk temuan "Tidak".
 */
export default function FormPage() {
  const navigate = useNavigate()
  const { user, ipAddress } = useAuth()
  const { category, auditee, dept, editId, setAudit } = useAudit()

  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({}) // {idx: {kesesuaian, kategori, keterangan}}
  const [photos, setPhotos] = useState({}) // {idx: [{id,url,fileId,caption}]}
  const [loading, setLoading] = useState(true)
  const [crop, setCrop] = useState(null) // {img, index}
  const [showPreview, setShowPreview] = useState(false)
  const [draftPayload, setDraftPayload] = useState(null)

  // --- load questions / edit ---
  useEffect(() => {
    if (!category) { navigate('/kategori'); return }
    if (editId) {
      loadEdit(editId)
    } else if (!auditee) {
      navigate(`/list/${encodeURIComponent(category)}`)
    } else {
      loadQuestions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadQuestions = async () => {
    setLoading(true)
    try {
      const res = await gasApi.getChecklist(category, dept)
      if (res.success) {
        setQuestions(res.data || [])
        setAudit({ questions: res.data || [] })
        const saved = loadAutosave()
        if (saved && Object.keys(saved).length) setAnswers(saved)
      }
    } catch {
      setQuestions([
        { no: 1, pertanyaan: 'Apakah manajemen puncak telah membuat Kebijakan tertulis?' },
        { no: 2, pertanyaan: 'Apakah ada kegiatan sosialisasi Kebijakan?' },
      ])
    } finally {
      setLoading(false)
    }
  }

  const loadEdit = async (id) => {
    setLoading(true)
    Swal.fire({ title: 'Memuat data...', allowOutsideClick: false, didOpen: () => Swal.showLoading() })
    try {
      const res = await gasApi.getDetail(id)
      Swal.close()
      if (!res.success) { Swal.fire('Gagal', res.message, 'error'); return }
      const d = res.data
      setAudit({ category: d.kategori, auditee: d.auditeeName, dept: d.departemen })
      const qs = (d.checklistData || []).map((q) => ({ no: q.no, type: q.type, kriteria: q.kriteria, pertanyaan: q.pertanyaan }))
      setQuestions(qs)
      setAudit({ questions: qs })
      const restored = {}
      const photoMap = {}
      ;(d.lampiran || []).forEach((p) => {
        const idx = p.itemIndex ?? 0
        if (!photoMap[idx]) photoMap[idx] = []
        photoMap[idx].push({ id: p.fileId || `p-${Date.now()}`, url: p.url, fileId: p.fileId || '', caption: p.caption || '' })
      })
      setPhotos(photoMap)
      ;(d.checklistData || []).forEach((q, index) => {
        if (q.type == 1 || q.type == 2 || q.type == 3) return
        const unchecked = q.hasilPengamatan === ''
        const isYa = !unchecked && (q.kategoriVal === 'C' || q.kategoriVal === '' || q.kategoriVal == null) && q.hasilPengamatan !== 'Tidak Sesuai'
        restored[index] = {
          kesesuaian: unchecked ? '' : (isYa ? 'Ya' : 'Tidak'),
          kategori: q.kategoriVal || (isYa ? 'C' : ''),
          keterangan: (q.hasilPengamatan === q.pertanyaan || q.hasilPengamatan === 'Sesuai') ? '' : (q.hasilPengamatan || ''),
        }
      })
      const saved = loadAutosave()
      setAnswers({ ...restored, ...saved })
    } catch {
      Swal.close()
      Swal.fire('Error', 'Belum tersambung ke backend secara sempurna', 'error')
    } finally {
      setLoading(false)
    }
  }

  // autosave
  useEffect(() => {
    if (!questions.length) return
    try { sessionStorage.setItem(AUTOSAVE_KEY, JSON.stringify(answers)) } catch {}
  }, [answers, questions.length])

  const setAnswer = (idx, patch) => {
    setAnswers((prev) => {
      const cur = prev[idx] || { kesesuaian: '', kategori: '', keterangan: '' }
      let next = { ...cur, ...patch }
      // Aturan Ya→C otomatis, Tidak→buang C (port checkKeterangan)
      if (patch.kesesuaian === 'Ya') next = { ...next, kesesuaian: 'Ya', kategori: 'C' }
      if (patch.kesesuaian === '' ) next = { ...next, kesesuaian: '' }
      if (cur.kesesuaian === 'Ya' && patch.kesesuaian === 'Ya') next = { ...next, kesesuaian: '' } // toggle off
      return { ...prev, [idx]: next }
    })
  }

  // --- foto ---
  const onFile = (e, index) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => setCrop({ img, index })
      img.src = ev.target.result
    }
    reader.readAsDataURL(file)
  }

  const saveCrop = (dataUrl, caption) => {
    const index = crop.index
    setPhotos((prev) => ({
      ...prev,
      [index]: [...(prev[index] || []), { id: `photo_${Date.now()}`, url: dataUrl, fileId: '', caption, local: true }],
    }))
    setCrop(null)
  }

  const editCaption = (itemIndex, photoIndex) => {
    const photo = photos[itemIndex]?.[photoIndex]
    if (!photo) return
    Swal.fire({ title: 'Edit Keterangan Foto', input: 'text', inputValue: photo.caption || '', showCancelButton: true, confirmButtonText: 'Simpan', cancelButtonText: 'Batal' })
      .then((r) => {
        if (r.isConfirmed) {
          setPhotos((prev) => {
            const next = { ...prev }
            next[itemIndex] = [...next[itemIndex]]
            next[itemIndex][photoIndex] = { ...next[itemIndex][photoIndex], caption: r.value }
            return next
          })
        }
      })
  }

  const delPhoto = (itemIndex, photoIndex) => {
    Swal.fire({ title: 'Hapus foto ini?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Ya, hapus!' })
      .then((r) => {
        if (!r.isConfirmed) return
        setPhotos((prev) => {
          const next = { ...prev }
          next[itemIndex] = next[itemIndex].filter((_, i) => i !== photoIndex)
          return next
        })
      })
  }

  // --- collect + save ---
  const collect = useCallback(() => {
    const data = []
    const missingPhotos = []
    let isValid = true
    questions.forEach((q, index) => {
      if (q.type == 1 || q.type == 2 || q.type == 3) {
        data.push({ no: q.no, type: q.type, pertanyaan: q.pertanyaan, kriteria: q.kriteria || '', hasilPengamatan: '', kategoriVal: '', photos: [] })
        return
      }
      const a = answers[index] || {}
      const kesesuaian = a.kesesuaian || '-'
      const kategoriV = a.kategori || ''
      const keterangan = a.keterangan || ''
      const ph = photos[index] || []
      if (kesesuaian === 'Tidak' && (keterangan.trim() === '' || kategoriV === '')) isValid = false
      if (kesesuaian === 'Tidak' && ph.length === 0) missingPhotos.push(q.no ?? (index + 1))
      let hasil = ''
      if (keterangan) hasil = keterangan
      else if (kesesuaian === 'Ya') hasil = q.pertanyaan
      else if (kesesuaian === 'Tidak') hasil = 'Tidak Sesuai'
      data.push({
        no: q.no, type: q.type, pertanyaan: q.pertanyaan, kriteria: q.kriteria || '',
        hasilPengamatan: hasil, kategoriVal: kategoriV,
        photos: ph.map((p) => ({ url: p.url, fileId: p.fileId || '', caption: p.caption || '' })),
      })
    })
    if (!isValid) {
      Swal.fire('Gagal', 'Pilihan "Tidak" mewajibkan Anda untuk memilih Kategori (Minor/Major/Kritis) dan mengisi Keterangan.', 'warning')
      return null
    }
    if (missingPhotos.length > 0) {
      Swal.fire('Foto Wajib', `Item berikut wajib dilampirkan foto: No. ${missingPhotos.join(', ')}`, 'warning')
      return null
    }
    return data
  }, [questions, answers, photos])

  const buildPayload = (cData) => {
    const allPhotos = []
    Object.keys(photos).forEach((idx) => {
      ;(photos[idx] || []).forEach((p) => {
        allPhotos.push({ url: p.url, fileId: p.fileId || '', caption: p.caption || '', itemIndex: parseInt(idx, 10) })
      })
    })
    return {
      id: editId, nik: user?.nik, ipAddress,
      auditorName: user?.nama, auditeeName: auditee,
      kategori: category, departemen: dept,
      checklistData: cData || [], lampiran: allPhotos,
    }
  }

  const saveData = async (status) => {
    const cData = collect()
    if (!cData) return
    const payload = buildPayload(cData)
    Swal.fire({ title: 'Menyimpan...', allowOutsideClick: false, didOpen: () => Swal.showLoading() })
    try {
      const res = await gasApi.saveDraft(payload) // backend menentukan Draft/Submitted dari action; saveDraft dipakai untuk simpan sementara
      if (res.success) {
        Swal.fire('Berhasil!', res.message, 'success').then(() => {
          sessionStorage.removeItem(AUTOSAVE_KEY)
          navigate(`/list/${encodeURIComponent(category)}`)
        })
      } else Swal.fire('Gagal', res.message, 'error')
    } catch {
      Swal.fire('Error', 'Gagal menyimpan ke server', 'error')
    }
  }

  const openPreview = () => {
    const cData = collect()
    if (!cData) return
    setDraftPayload(buildPayload(cData))
    setShowPreview(true)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><i className="fa-solid fa-spinner fa-spin fa-2x" /><br />Memuat pertanyaan...</div>

  return (
    <div>
      <div className="header-action">
        <button className="btn btn-outline" onClick={() => navigate(`/list/${encodeURIComponent(category)}`)}>
          <i className="fa-solid fa-arrow-left" /> Batal
        </button>
        <h2 style={{ fontWeight: 700, letterSpacing: '-0.02em' }}>Form Checklist: <span style={{ color: 'var(--secondary)' }}>{category}{dept ? ` - ${dept}` : ''}</span></h2>
        <div style={{ fontWeight: 600, color: 'var(--text-light)', fontSize: 13 }}>Auditee: <span style={{ color: 'var(--text-dark)' }}>{auditee}</span></div>
      </div>

      <div className="table-responsive">
        <table className="checklist-table">
          <thead>
            <tr>
              <th width="5%">No</th>
              <th width="35%">Parameter / dokumen</th>
              <th width="8%">Kriteria SJPH no.</th>
              <th width="12%">Kesesuaian</th>
              <th width="12%">Kategori</th>
              <th width="15%">Keterangan</th>
              <th width="13%">Foto</th>
            </tr>
          </thead>
          <tbody>
            {questions.map((q, index) => {
              if (q.type == 1 || q.type == 2 || q.type == 3) {
                return <tr key={index} style={{ backgroundColor: '#f1f5f9', fontWeight: 'bold' }}><td>{q.no}</td><td colSpan={6}>{q.pertanyaan}</td></tr>
              }
              const a = answers[index] || { kesesuaian: '', kategori: '', keterangan: '' }
              const needPhoto = a.kesesuaian === 'Tidak'
              return (
                <tr key={index}>
                  <td>{q.no}</td>
                  <td>{q.pertanyaan}</td>
                  <td style={{ textAlign: 'center', fontWeight: 500 }}>{q.kriteria || ''}</td>
                  <td>
                    <div className="radio-group">
                      {['Ya', 'Tidak'].map((v) => (
                        <label key={v}>
                          <input type="radio" name={`kesesuaian_${index}`} value={v} checked={a.kesesuaian === v}
                            onClick={() => setAnswer(index, { kesesuaian: a.kesesuaian === v ? '' : v })}
                            onChange={() => {}} /> {v}
                        </label>
                      ))}
                    </div>
                  </td>
                  <td>
                    <select value={a.kategori} onChange={(e) => setAnswer(index, { kategori: e.target.value })} style={{ margin: 0, padding: 6, width: '100%' }}>
                      <option value="">- Pilih -</option>
                      <option value="C" disabled={a.kesesuaian === 'Tidak'}>C (Conformance)</option>
                      <option value="Minor" disabled={a.kesesuaian === 'Ya'}>Minor</option>
                      <option value="Major" disabled={a.kesesuaian === 'Ya'}>Major</option>
                      <option value="Kritis" disabled={a.kesesuaian === 'Ya'}>Kritis</option>
                    </select>
                  </td>
                  <td>
                    <textarea value={a.keterangan} onChange={(e) => setAnswer(index, { keterangan: e.target.value })}
                      style={{ margin: 0, padding: 6, minHeight: 40, width: '100%', borderColor: needPhoto && !a.keterangan ? 'var(--accent)' : undefined }}
                      placeholder={needPhoto ? 'Wajib diisi (Temuan)!' : 'Isi jika diperlukan...'} />
                  </td>
                  <td>
                    <div className="photo-upload-area">
                      {(photos[index] || []).map((p, pi) => (
                        <div key={p.id || pi} className="photo-thumb">
                          <img src={p.url} alt="Foto" />
                          <div className="photo-overlay">
                            <i className="fa-solid fa-pen" onClick={(e) => { e.stopPropagation(); editCaption(index, pi) }} title="Edit Keterangan" />
                            <i className="fa-solid fa-trash" onClick={(e) => { e.stopPropagation(); delPhoto(index, pi) }} title="Hapus Foto" />
                          </div>
                        </div>
                      ))}
                      <div className="photo-add-btn" onClick={() => document.getElementById(`photoInput_${index}`)?.click()} title="Upload/Take Foto">
                        <i className="fa-solid fa-camera" />
                      </div>
                    </div>
                    {needPhoto && <span className="photo-required-badge">Wajib foto</span>}
                    <input type="file" id={`photoInput_${index}`} accept="image/*" style={{ display: 'none' }} onChange={(e) => onFile(e, index)} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="form-footer">
        <button className="btn btn-outline" onClick={() => saveData('Draft')}><i className="fa-solid fa-floppy-disk" /> Simpan Sementara</button>
        <button className="btn btn-primary" onClick={openPreview}><i className="fa-solid fa-file-signature" /> Review &amp; Submit</button>
      </div>

      {crop && <CropPhotoModal image={crop.img} onCancel={() => setCrop(null)} onSave={saveCrop} />}
      {showPreview && draftPayload && (
        <ReportPreviewModal
          draft={draftPayload}
          source="form"
          onClose={() => setShowPreview(false)}
          onSaved={() => { sessionStorage.removeItem(AUTOSAVE_KEY); navigate(`/list/${encodeURIComponent(category)}`) }}
        />
      )}
    </div>
  )
}
