import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'
import { gasApi } from '../api/gasClient'
import { swr, swrInvalidate } from '../api/swrCache'
import { useAuth } from '../context/AuthContext'
import { useAudit } from '../context/AuditContext'
import CropPhotoModal from '../components/modals/CropPhotoModal'
import ReportPreviewModal from '../features/preview/ReportPreview'
import { sameName } from '../utils/roles'

const AUTOSAVE_PREFIX = 'matrika_autosave'
const AUTOSAVE_LEGACY_KEY = 'matrika_autosave' // skema lama: sessionStorage tunggal
const AUTOSAVE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // autosave basi dibuang setelah 7 hari

/**
 * Kunci autosave per-form: tidak bocor antar form (beda auditee/dept/editId
 * dapat kunci berbeda), dan bertahan refresh maupun tab baru (localStorage).
 */
function autosaveKey(editId, category, dept, auditee) {
  return `${AUTOSAVE_PREFIX}:${editId || `${category || ''}|${dept || ''}|${auditee || ''}`}`
}

function readAutosave(key) {
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        return { answers: parsed.answers || {}, photos: parsed.photos || {}, savedAt: parsed.savedAt || 0 }
      }
    }
  } catch {}
  // migrasi sekali dari skema lama (masih ada di sessionStorage)
  try {
    const legacy = JSON.parse(sessionStorage.getItem(AUTOSAVE_LEGACY_KEY) || 'null')
    if (legacy && typeof legacy === 'object' && !Array.isArray(legacy)) {
      return { answers: legacy, photos: {}, legacy: true }
    }
  } catch {}
  return null
}

function writeAutosave(key, answers, photos) {
  try {
    localStorage.setItem(key, JSON.stringify({ v: 2, savedAt: Date.now(), answers, photos }))
    return
  } catch {}
  // kuota penuh (terlalu banyak foto) -> tetap simpan jawaban saja
  try { localStorage.setItem(key, JSON.stringify({ v: 2, savedAt: Date.now(), answers, photos: {} })) } catch {}
}

function clearAutosave(key) {
  try { localStorage.removeItem(key) } catch {}
  try { sessionStorage.removeItem(AUTOSAVE_LEGACY_KEY) } catch {}
}

/** Buang autosave basi agar kuota localStorage tidak cepat penuh. */
function pruneAutosave() {
  try {
    Object.keys(localStorage).forEach((k) => {
      if (!k.startsWith(`${AUTOSAVE_PREFIX}:`)) return
      try {
        const parsed = JSON.parse(localStorage.getItem(k) || '{}')
        if (!parsed.savedAt || Date.now() - parsed.savedAt > AUTOSAVE_TTL_MS) localStorage.removeItem(k)
      } catch { localStorage.removeItem(k) }
    })
  } catch {}
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

  const saveKey = autosaveKey(editId, category, dept, auditee)

  // Autosave terbaru untuk di-flush saat komponen dilepas (navigasi keluar form)
  const latestRef = useRef(null)
  latestRef.current = { saveKey, answers, photos, ready: questions.length > 0 }

  // buang autosave basi saat form dibuka
  useEffect(() => { pruneAutosave() }, [])

  // flush terakhir saat komponen unmount (tombol Batal/kembali)
  useEffect(() => () => {
    const s = latestRef.current
    if (s?.ready) writeAutosave(s.saveKey, s.answers, s.photos)
  }, [])

  /**
   * Pulihkan isian form dari autosave (refresh/tab baru tidak menghilangkan
   * data). Kunci sudah di-scope per-form, jadi tidak mungkin nyasar.
   * `base*` (opsional) = data dasar (mis. hasil loadEdit) yang ditimpa oleh
   * isian tersimpan, karena autosave hanya memuat baris yang disentuh user.
   */
  const applyAutosave = (baseAnswers = null, basePhotos = null) => {
    const saved = readAutosave(saveKey)
    if (!saved) return false
    const hasAnswers = Object.keys(saved.answers || {}).length > 0
    const hasPhotos = Object.keys(saved.photos || {}).length > 0
    if (!hasAnswers && !hasPhotos) return false
    if (hasAnswers) setAnswers(baseAnswers ? { ...baseAnswers, ...saved.answers } : saved.answers)
    if (hasPhotos) setPhotos(basePhotos ? { ...basePhotos, ...saved.photos } : saved.photos)
    if (saved.legacy) { try { sessionStorage.removeItem(AUTOSAVE_LEGACY_KEY) } catch {} }
    Swal.fire({ toast: true, position: 'top', icon: 'info', title: 'Isian sebelumnya dipulihkan', showConfirmButton: false, timer: 2200 })
    return true
  }

  /**
   * Kembali ke daftar audit.
   * Kategori yang kosong/undefined diblok agar tidak menghasilkan
   * URL "/list/undefined" (yang membuat daftar tampak kosong).
   */
  const goList = () => {
    if (!category) { navigate('/kategori'); return }
    navigate(`/list/${encodeURIComponent(category)}`)
  }

  // --- load questions / edit ---
  useEffect(() => {
    if (!category) { navigate('/kategori'); return }
    if (editId) {
      loadEdit(editId)
    } else if (!auditee) {
      goList()
    } else {
      loadQuestions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadQuestions = async () => {
    setLoading(true)
    try {
      // Template checklist jarang berubah -> cache 10 menit agar buka form
      // berikutnya tidak perlu menunggu cold-start GAS lagi.
      const res = await swr(
        'checklist',
        { kategori: category, departemen: dept },
        () => gasApi.getChecklist(category, dept),
        { ttlMs: 10 * 60 * 1000 },
      )
      if (res.success) {
        setQuestions(res.data || [])
        setAudit({ questions: res.data || [] })
        applyAutosave()
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
      // Jangan biarkan category menjadi undefined/null akibat respons yang
      // tidak lengkap — itu membuat link "Batal" menuju /list/undefined dan
      // daftar jadi kosong (mencari kategori yang salah). Pertahankan nilai lama.
      setAudit({
        category: d.kategori || category,
        auditee: d.auditeeName,
        dept: d.departemen,
      })
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
      setAnswers(restored)
      applyAutosave(restored, photoMap) // isian tersimpan (jika ada) menimpa data server
    } catch {
      Swal.close()
      Swal.fire('Error', 'Belum tersambung ke backend secara sempurna', 'error')
    } finally {
      setLoading(false)
    }
  }

  // autosave — debounced ke localStorage (tahan refresh & tab baru), ikut foto
  useEffect(() => {
    if (!questions.length) return
    const t = setTimeout(() => writeAutosave(saveKey, answers, photos), 400)
    return () => clearTimeout(t)
  }, [answers, photos, questions.length, saveKey])

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
  /**
   * Sumber foto: "Ambil Foto" membuka kamera perangkat langsung
   * (input capture), "Dari Galeri" memakai pemilih file biasa.
   */
  const pickPhoto = (index) => {
    Swal.fire({
      title: 'Tambah Foto',
      text: 'Ambil foto langsung dengan kamera, atau pilih foto yang sudah ada dari galeri.',
      showCancelButton: true,
      cancelButtonText: 'Batal',
      showDenyButton: true,
      denyButtonText: '<i class="fa-regular fa-image"></i> Dari Galeri',
      confirmButtonText: '<i class="fa-solid fa-camera"></i> Ambil Foto',
      reverseButtons: true,
    }).then((r) => {
      if (r.isConfirmed) document.getElementById(`photoCam_${index}`)?.click()
      else if (r.isDenied) document.getElementById(`photoInput_${index}`)?.click()
    })
  }

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
    // Self-audit dilarang: auditor tidak boleh mengaudit dirinya sendiri.
    if (sameName(payload.auditorName, payload.auditeeName)) {
      Swal.fire('Self-audit tidak diizinkan', 'Auditor dan Auditee tidak boleh orang yang sama. Silakan pilih Auditee lain.', 'warning')
      return
    }
    Swal.fire({ title: 'Menyimpan...', allowOutsideClick: false, didOpen: () => Swal.showLoading() })
    try {
      const res = await gasApi.saveDraft(payload) // backend menentukan Draft/Submitted dari action; saveDraft dipakai untuk simpan sementara
      if (res.success) {
        Swal.fire('Berhasil!', res.message, 'success').then(() => {
          clearAutosave(saveKey)
          // Data baru saja berubah -> buang cache list agar halaman daftar
          // mengambil data segar (bukan menampilkan cache yang sudah basi).
          swrInvalidate('list')
          goList()
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

  if (loading) return (
    <div className="loading-state">
      <div className="icon3d peri round"><i className="fa-solid fa-spinner" /></div>
      <span>Memuat pertanyaan...</span>
    </div>
  )

  return (
    <div>
      <div className="header-action list-header">
        <div className="list-title-row">
          <button className="btn btn-outline list-back-btn" onClick={goList}>
            <i className="fa-solid fa-arrow-left" /> Batal
          </button>
          <h2 className="list-title">Form Checklist: <span style={{ color: 'var(--secondary)' }}>{category}{dept ? ` - ${dept}` : ''}</span></h2>
        </div>
        <div className="list-header-actions" style={{ fontWeight: 600, color: 'var(--text-light)', fontSize: 13 }}>
          Auditee: <span style={{ color: 'var(--text-dark)' }}>{auditee}</span>
        </div>
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
                      <div className="photo-add-btn" onClick={() => pickPhoto(index)} title="Ambil Foto / Galeri">
                        <i className="fa-solid fa-camera" />
                      </div>
                    </div>
                    {needPhoto && <span className="photo-required-badge">Wajib foto</span>}
                    <input type="file" id={`photoInput_${index}`} accept="image/*" style={{ display: 'none' }} onChange={(e) => onFile(e, index)} />
                    <input type="file" id={`photoCam_${index}`} accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => onFile(e, index)} />
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
          onSaved={() => {
            clearAutosave(saveKey)
            swrInvalidate('list')
            goList()
          }}
        />
      )}
    </div>
  )
}
