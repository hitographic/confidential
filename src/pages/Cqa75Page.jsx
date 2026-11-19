import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { gasApi } from '../api/gasClient'
import { useAuth } from '../context/AuthContext'
import { parseWorkbook, normKey } from '../cqa75/lib/excelParser'
import { buildSheetModel } from '../cqa75/lib/sheetModel'
import { exportSignedExcel } from '../cqa75/lib/excelExport'
import { exportAllZip } from '../cqa75/lib/zipExport'
import { exportPreviewPdf } from '../cqa75/lib/pdfExport'
import { browserMeasure, geomForSide } from '../cqa75/lib/textGeom'
import ReportPreview from '../cqa75/components/ReportPreview'
import './cqa75.css'

/**
 * Halaman Tanda Tangan Form CQA-75 (port dari ttd-app).
 *
 * - File .xlsx diambil dari Drive: CQA-75/2026/Semester 2 (lihat Code.gs).
 * - Slot TTD diisi oleh user SENDIRI, dicocokkan lewat kolom E sheet `user`
 *   (Nama Tanda Tangan). Klik "Terapkan TTD saya" -> state di sheet
 *   cqa75_state (server), jadi admin melihat progres dari perangkatnya.
 * - Gambar TTD dipakai dari signatures_db (menu Ganti Tanda Tangan) —
 *   tanpa alur menggambar baru.
 * - Export (ZIP/Excel/PDF) hanya untuk role=admin.
 */
let toastSeq = 0

const shortName = (name) =>
  String(name || '')
    .replace(/^Form CQA-75\s*\(.*?\)\s*Smt.*?-\s*/i, '')
    .replace(/\.xlsx?$/i, '')
    .trim() || name

const withGeom = (parsed) => {
  try {
    const measure = browserMeasure()
    parsed.blocks.forEach((b) => {
      b.geom = {
        auditor: geomForSide(b.auditorRaw, b.auditorNames, measure),
        auditee: geomForSide(b.auditeeRaw, b.auditeeNames, measure),
      }
    })
  } catch { /* fallback: tengah slot */ }
  return parsed
}

const b64ToBuffer = (b64) => {
  const bin = atob(b64)
  const u8 = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
  return u8.buffer
}

export default function Cqa75Page() {
  const { user, isAdmin } = useAuth()
  const [meta, setMeta] = useState(null) // { me, accounts, path }
  const [files, setFiles] = useState([]) // [{id,name,buffer,sheetName,aoa,blocks,persons,sheet}]
  const [sigData, setSigData] = useState({}) // nameKey -> dataURL gambar TTD
  const [activeId, setActiveId] = useState(null)
  const [busy, setBusy] = useState('')
  const [loadError, setLoadError] = useState('')
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('semua') // semua | belum | sudah
  const [view, setView] = useState('laporan') // laporan | ringkas
  const [previewFit, setPreviewFit] = useState(true)
  const [spot, setSpot] = useState(true)
  const [mtab, setMtab] = useState('file') // file | nama | preview
  const [toasts, setToasts] = useState([])
  const [confirmUnfill, setConfirmUnfill] = useState(false)
  const unfillTimer = useRef(null)

  const notify = (msg, kind = 'info') => {
    const id = `${Date.now()}-${toastSeq++}`
    setToasts((t) => [...t.slice(-2), { id, msg, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600)
  }

  useEffect(() => () => clearTimeout(unfillTimer.current), [])

  /** Ambil gambar TTD (data URL) untuk semua akun yang sigFileId-nya ada. */
  const loadSigImages = useCallback(async (accounts) => {
    const withId = (accounts || []).filter((a) => a.sigFileId || (a.sigUrl || '').startsWith('data:'))
    if (!withId.length) {
      setSigData({})
      return
    }
    const ids = [...new Set(withId.map((a) => a.sigFileId).filter(Boolean))]
    let images = {}
    if (ids.length) {
      const res = await gasApi.fetchImages(ids)
      if (!res.success) throw new Error(res.message || 'Gagal memuat gambar TTD')
      images = res.images || {}
    }
    const map = {}
    withId.forEach((a) => {
      if (a.sigFileId && images[a.sigFileId]) map[a.nameKey] = images[a.sigFileId]
      else if ((a.sigUrl || '').startsWith('data:')) map[a.nameKey] = a.sigUrl
    })
    setSigData(map)
  }, [])

  const loadAll = useCallback(async (opts = {}) => {
    const { silent = false } = opts
    if (!user?.nik) return
    if (!silent) setBusy('Membaca file dari Drive…')
    setLoadError('')
    try {
      const [metaRes, filesRes] = await Promise.all([
        gasApi.getCqa75Meta(user.nik),
        gasApi.getCqa75Files(),
      ])
      if (!metaRes.success) throw new Error(metaRes.message || 'Status TTD gagal dimuat.')
      if (!filesRes.success) throw new Error(filesRes.message || 'File gagal dimuat.')

      const next = []
      const failed = []
      for (const f of filesRes.files || []) {
        try {
          const buf = b64ToBuffer(f.base64)
          const parsed = withGeom(parseWorkbook(buf.slice(0)))
          if (!parsed.blocks.length) {
            failed.push(`${f.name} (pola Auditor/Auditee tak ditemukan)`)
            continue
          }
          // Model setia-1:1 untuk preview semirip Excel (style, merge, ukuran)
          let sheet = null
          try {
            sheet = await buildSheetModel(buf.slice(0))
          } catch (e) {
            console.warn('model preview gagal, pakai ringkas:', f.name, e)
          }
          next.push({
            id: f.id,
            name: f.name,
            buffer: buf.slice(0),
            sheetName: parsed.sheetName,
            aoa: parsed.aoa,
            blocks: parsed.blocks,
            persons: parsed.persons,
            sheet,
          })
        } catch (e) {
          console.error(f.name, e)
          failed.push(`${f.name} (${e.message})`)
        }
      }

      setFiles(next)
      setActiveId((cur) => (cur && next.find((f) => f.id === cur) ? cur : next[0]?.id ?? null))
      setMeta(metaRes)
      await loadSigImages(metaRes.accounts)

      failed.forEach((m) => notify(`Gagal membaca ${m}`, 'err'))
      if (!next.length && !failed.length) notify('Tidak ada file .xlsx di folder CQA-75.', 'info')
      else if (next.length) notify(`${next.length} file dimuat dari Drive.`, 'ok')
    } catch (e) {
      console.error(e)
      setLoadError(e.message)
      notify(e.message, 'err')
    } finally {
      if (!silent) setBusy('')
    }
  }, [user, loadSigImages, notify])

  useEffect(() => {
    loadAll() // eslint-disable-line react-hooks/exhaustive-deps
  }, [])

  /** Muat ulang meta + gambar saja (setelah fill/unfill). */
  const refreshMeta = useCallback(async () => {
    const res = await gasApi.getCqa75Meta(user.nik)
    if (!res.success) throw new Error(res.message || 'Status TTD gagal dimuat.')
    setMeta(res)
    await loadSigImages(res.accounts)
  }, [user, loadSigImages])

  // ---- Gabungan nama lintas SEMUA file ----
  const accMap = useMemo(() => {
    const m = new Map()
    ;(meta?.accounts || []).forEach((a) => m.set(a.nameKey, a))
    return m
  }, [meta])

  const persons = useMemo(() => {
    const map = new Map()
    files.forEach((f) => {
      f.persons.forEach((p) => {
        if (!map.has(p.key)) map.set(p.key, { key: p.key, name: p.name, count: 0, files: new Set(), occ: [] })
        const g = map.get(p.key)
        if (g.name.length < p.name.length) g.name = p.name
        g.count += p.count
        g.files.add(f.name)
        p.occ.forEach((o) => g.occ.push({ ...o, file: shortName(f.name), fileId: f.id }))
      })
    })
    return [...map.values()]
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .map((p) => {
        const acc = accMap.get(p.key) || null
        const filled = Boolean(acc?.filled)
        const dataUrl = sigData[p.key] || null
        return {
          ...p,
          acc,
          filled,
          dataUrl,
          signed: filled && Boolean(dataUrl),
          unmatched: !acc,
        }
      })
  }, [files, accMap, sigData])

  const myKey = meta?.me?.namaTtd ? normKey(meta.me.namaTtd) : ''
  const myOcc = myKey ? persons.find((p) => p.key === myKey) || null : null
  const mySigned = Boolean(myOcc?.signed)
  const signedCount = persons.filter((p) => p.signed).length
  const remaining = persons.length - signedCount
  const pct = persons.length ? Math.round((signedCount / persons.length) * 100) : 0
  const totalBlocks = files.reduce((n, f) => n + f.blocks.length, 0)
  const unmatchedNames = useMemo(
    () => persons.filter((p) => p.unmatched).map((p) => p.name),
    [persons]
  )

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    let arr = persons
    if (filter === 'belum') arr = arr.filter((p) => !p.signed)
    else if (filter === 'sudah') arr = arr.filter((p) => p.signed)
    if (s) arr = arr.filter((p) => p.name.toLowerCase().includes(s))
    return arr
  }, [persons, q, filter])

  const activeFile = useMemo(
    () => files.find((f) => f.id === activeId) ?? files[0] ?? null,
    [files, activeId]
  )

  const fileSignedInfo = (f) => {
    const signedKeys = new Set(persons.filter((p) => p.signed).map((p) => p.key))
    const keys = new Set()
    f.blocks.forEach((b) => {
      ;[...b.auditorNames, ...b.auditeeNames].forEach((nm) => keys.add(normKey(nm)))
    })
    let hit = 0
    keys.forEach((k) => { if (signedKeys.has(k)) hit += 1 })
    return { hit, need: keys.size, done: keys.size > 0 && hit === keys.size }
  }

  // ---- Aksi TTD sendiri (divalidasi server) ----
  const doFill = async () => {
    if (!meta?.me) return
    setBusy('Menerapkan TTD…')
    try {
      const res = await gasApi.fillCqa75(user.nik)
      if (res.success) {
        notify(res.message, 'ok')
        await refreshMeta()
      } else {
        notify(res.message, 'err')
      }
    } catch (e) {
      notify('Gagal menerapkan TTD: ' + e.message, 'err')
    } finally {
      setBusy('')
    }
  }

  const doUnfill = async () => {
    if (!confirmUnfill) {
      setConfirmUnfill(true)
      clearTimeout(unfillTimer.current)
      unfillTimer.current = setTimeout(() => setConfirmUnfill(false), 2600)
      return
    }
    clearTimeout(unfillTimer.current)
    setConfirmUnfill(false)
    setBusy('Mencabut TTD…')
    try {
      const res = await gasApi.unfillCqa75(user.nik)
      if (res.success) {
        notify(res.message, 'ok')
        await refreshMeta()
      } else {
        notify(res.message, 'err')
      }
    } catch (e) {
      notify('Gagal mencabut TTD: ' + e.message, 'err')
    } finally {
      setBusy('')
    }
  }

  // ---- Export (khusus admin) ----
  const signaturesForExport = useMemo(() => {
    const m = {}
    persons.forEach((p) => {
      if (p.signed) m[p.key] = { dataUrl: p.dataUrl, enabled: true }
    })
    return m
  }, [persons])

  const guardExport = () => {
    if (!isAdmin) {
      notify('Hanya akun admin yang boleh export.', 'err')
      return false
    }
    if (!signedCount) {
      notify('Belum ada TTD yang diterapkan.', 'err')
      return false
    }
    return true
  }

  const doExportOne = async (f) => {
    if (!f || !guardExport()) return
    setBusy('Menyiapkan Excel…')
    try {
      await exportSignedExcel({
        originalBuffer: f.buffer,
        blocks: f.blocks,
        signatures: signaturesForExport,
        outName: f.name.replace(/\.xlsx?$/i, '') + '-signed.xlsx',
      })
      notify(`${shortName(f.name)} terdownload.`, 'ok')
    } catch (e) {
      console.error(e)
      notify('Gagal export: ' + e.message, 'err')
    } finally {
      setBusy('')
    }
  }

  const doExportZip = async () => {
    if (!files.length) return notify('Belum ada file.', 'err')
    if (!guardExport()) return
    setBusy('Menyiapkan ZIP…')
    try {
      await exportAllZip({
        files,
        signatures: signaturesForExport,
        outName: `CQA-75-signed-${files.length}-file.zip`,
        onProgress: (a, b, name) => {
          if (b === 100) setBusy(`Mengompres ZIP… ${Math.round(a)}%`)
          else setBusy(`Menyiapkan ${a}/${b}… ${shortName(name)}`)
        },
      })
      notify(
        remaining === 0
          ? `ZIP ${files.length} file terdownload. Selesai 🎉`
          : `ZIP terdownload. Catatan: ${remaining} nama belum TTD.`,
        remaining === 0 ? 'ok' : 'info'
      )
    } catch (e) {
      console.error(e)
      notify('Gagal membuat ZIP: ' + e.message, 'err')
    } finally {
      setBusy('')
    }
  }

  const doExportPdf = async () => {
    if (!activeFile || !guardExport()) return
    setBusy('Menyiapkan PDF…')
    try {
      await exportPreviewPdf('c75Preview', activeFile.name.replace(/\.xlsx?$/i, '') + '-signed.pdf')
      notify('PDF preview terdownload.', 'ok')
    } catch (e) {
      console.error(e)
      notify('Gagal export PDF: ' + e.message, 'err')
    } finally {
      setBusy('')
    }
  }

  const jumpToPage = (v) => {
    if (!v || !activeFile) return
    document.getElementById(`${activeFile.id}-pg${v}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const canApply = Boolean(
    meta?.me && !meta.me.filled && meta.me.hasSig && myOcc && !mySigned
  )

  const headerAction = () => {
    if (canApply) return doFill()
    if (isAdmin) return doExportZip()
    return null
  }

  const me = meta?.me || null
  const myImg = (myKey && sigData[myKey]) || me?.sigUrl || ''

  const statusLabel = (p) => {
    if (p.unmatched) return 'tanpa akun'
    if (p.signed) return p.key === myKey ? 'sudah (saya)' : 'sudah'
    if (p.filled) return 'gagal muat'
    return 'belum'
  }

  return (
    <div className="c75-page">
      <header className="top">
        <div className="brand">
          <h1>✍️ TTD CQA-75</h1>
          <p>{meta?.path || 'CQA-75/2026/Semester 2'}</p>
        </div>
        <div className="prog" role="status" aria-label={`Progres ${signedCount} dari ${persons.length}`}>
          <div className="progbar"><span style={{ width: `${pct}%` }} /></div>
          <span className="progtext">{persons.length ? `${signedCount}/${persons.length}` : '—'}</span>
        </div>
        {(canApply || isAdmin) && (
          <button
            className={`hcta ${canApply ? 'primary' : 'ok'}`}
            onClick={headerAction}
            disabled={Boolean(busy)}
          >
            {canApply ? 'Terapkan TTD' : '⬇ ZIP'}
          </button>
        )}
      </header>

      {busy && <div className="busybar" role="status">{busy}</div>}

      {/* Tab navigasi HP */}
      <nav className="mtab" aria-label="Navigasi">
        {[
          ['file', 'File', files.length || ''],
          ['nama', 'TTD', persons.length ? `${signedCount}/${persons.length}` : ''],
          ['preview', 'Preview', ''],
        ].map(([k, label, n]) => (
          <button key={k} className={mtab === k ? 'on' : ''} onClick={() => setMtab(k)}>
            {label}{n !== '' && <span className="n">{n}</span>}
          </button>
        ))}
      </nav>

      <div className="layout" data-mtab={mtab}>
        {/* KOLOM 1 — FILE DARI DRIVE */}
        <div className="pane pane-file">
          <div className="card">
            <h2>
              File <span className="mut">{files.length ? `• ${files.length} file, ${totalBlocks} hlm` : ''}</span>
            </h2>
            <button className="linkbtn dim" onClick={() => loadAll()} disabled={Boolean(busy)}>
              ↻ Muat ulang dari Drive
            </button>

            {loadError && (
              <div className="c75-err">
                <b>Gagal memuat data</b>
                <p>{loadError}</p>
                <button className="linkbtn" onClick={() => loadAll()}>Coba lagi</button>
              </div>
            )}

            {!files.length && !loadError && !busy && (
              <div className="empty">
                <div className="emptyart">📄</div>
                <p className="mut">Tidak ada file .xlsx di folder.</p>
              </div>
            )}

            {files.map((f) => {
              const st = fileSignedInfo(f)
              const active = activeFile?.id === f.id
              const p = st.need ? Math.round((st.hit / st.need) * 100) : 0
              return (
                <div
                  key={f.id}
                  className={`frow ${active ? 'active' : ''}`}
                  onClick={() => { setActiveId(f.id); setMtab('preview') }}
                  title={`${f.name} — ${st.hit}/${st.need} slot TTD`}
                >
                  <span className={`dot${st.done ? ' ok' : st.hit ? ' half' : ''}`} />
                  <span className="fname">{shortName(f.name)}</span>
                  {isAdmin && (
                    <button
                      className="iconbtn"
                      onClick={(e) => { e.stopPropagation(); doExportOne(f) }}
                      title="Download XLSX bertanda tangan"
                      aria-label={`Download ${shortName(f.name)}`}
                      disabled={Boolean(busy)}
                    >⬇</button>
                  )}
                  <span className="fbar"><span style={{ width: `${p}%` }} /></span>
                </div>
              )
            })}
          </div>
        </div>

        {/* KOLOM 2 — SLOT SAYA + DAFTAR NAMA */}
        <div className="pane pane-nama">
          <div className="card c75-myslot">
            <h2>Slot TTD saya</h2>
            {!meta && <p className="mut">Memuat status…</p>}
            {meta && !me?.namaTtd && (
              <div className="c75-hint">
                Nama Tanda Tangan belum diatur di akun Anda. Hubungi admin untuk mengisi
                kolom <b>Nama Tanda Tangan</b> (kolom E sheet <i>user</i>).
              </div>
            )}
            {meta && me?.namaTtd && (
              <div className="c75-myrow">
                <div className={`c75-mythumb${mySigned ? ' on' : ''}`}>
                  {myImg ? <img src={myImg} alt="TTD saya" /> : '✍️'}
                </div>
                <div className="c75-mytext">
                  <b>{me.namaTtd}</b>
                  <small>
                    {myOcc
                      ? `${myOcc.count} slot di ${myOcc.files.size} file`
                      : 'Nama tidak ditemukan di file mana pun'}
                  </small>
                  <small className={`c75-status${mySigned ? ' on' : ''}`}>
                    {!me.hasSig
                      ? 'Belum daftar TTD'
                      : me.filled
                        ? (mySigned ? 'Sudah diterapkan ✓' : 'Memuat gambar TTD…')
                        : 'TTD terdaftar — siap diterapkan'}
                  </small>
                </div>
                <div className="c75-myacts">
                  {!me.hasSig && (
                    <span className="c75-hint">Daftar dulu di menu <b>Ganti Tanda Tangan</b></span>
                  )}
                  {me.hasSig && me.filled && (
                    <button
                      className={`c75-btn c75-btn-ghost${confirmUnfill ? ' danger' : ''}`}
                      onClick={doUnfill}
                      disabled={Boolean(busy)}
                    >
                      {confirmUnfill ? 'Klik lagi untuk cabut' : 'Cabut TTD'}
                    </button>
                  )}
                  {me.hasSig && !me.filled && (
                    <button
                      className="c75-btn c75-btn-primary"
                      onClick={doFill}
                      disabled={Boolean(busy) || !myOcc}
                      title={myOcc ? '' : 'Nama Anda tidak ada di file'}
                    >
                      Terapkan TTD saya
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {unmatchedNames.length > 0 && (
            <div className="card c75-warn-card">
              <b>Nama di file tanpa akun ({unmatchedNames.length})</b>
              <p className="mut">
                Slot ini tidak bisa diisi sampai ejaan kolom <b>Nama Tanda Tangan</b> (sheet
                <i> user</i>) disamakan dengan nama di file:
              </p>
              <div className="c75-tags">
                {unmatchedNames.map((n) => <span key={n}>{n}</span>)}
              </div>
            </div>
          )}

          <div className="card">
            <h2>Tanda tangan <span className="mut">• {signedCount}/{persons.length || '–'}</span></h2>
            {!persons.length && (
              <div className="empty">
                <div className="emptyart">📁</div>
                <p className="mut">Belum ada nama terbaca dari file.</p>
              </div>
            )}
            {!!persons.length && (
              <div className="chips" role="tablist" aria-label="Filter nama">
                {[['semua', 'Semua'], ['belum', `Belum ${remaining}`], ['sudah', `Sudah ${signedCount}`]].map(([k, l]) => (
                  <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>
                ))}
                <input
                  type="search" enterKeyHint="search" autoComplete="off"
                  placeholder="Cari…" value={q} onChange={(e) => setQ(e.target.value)}
                  aria-label="Cari nama"
                />
              </div>
            )}
            {filtered.map((p) => (
              <div key={p.key} className={`prow${p.signed ? ' done' : ''}`}>
                <div className={`person${p.signed ? ' done' : ''}`}>
                  <span className="pthumb">
                    {p.dataUrl ? <img src={p.dataUrl} alt="" /> : p.unmatched ? '?' : '＋'}
                  </span>
                  <span className="ptext">
                    <b>{p.name}</b>
                    <small>{p.count}× • {p.files.size} file • {statusLabel(p)}</small>
                  </span>
                  <span className={`pgo${p.signed ? ' ok' : ''}`}>{statusLabel(p)}</span>
                </div>
              </div>
            ))}
            {!!persons.length && !filtered.length && (
              <div className="mut">
                Tidak ketemu.{' '}
                <button className="linkbtn" onClick={() => { setQ(''); setFilter('semua') }}>Reset</button>
              </div>
            )}
          </div>
        </div>

        {/* KOLOM 3 — EXPORT (admin) + PREVIEW */}
        <div className="pane pane-preview">
          {isAdmin ? (
            <div className="card export">
              <div className="expgrid">
                <div className="expinfo">
                  <b>Export</b>
                  <span className="mut">
                    {files.length} file • {signedCount}/{persons.length} TTD
                    {remaining > 0 && persons.length > 0 ? ` • ${remaining} belum` : ''}
                  </span>
                </div>
                <button className="ok" onClick={doExportZip} disabled={!files.length || !signedCount || Boolean(busy)}>
                  ⬇ ZIP{files.length ? ` (${files.length})` : ''}
                </button>
              </div>
              <div className="explinks">
                <button className="linkbtn" onClick={() => activeFile && doExportOne(activeFile)} disabled={!activeFile || !signedCount || Boolean(busy)}>
                  Excel file ini
                </button>
                <span aria-hidden>·</span>
                <button className="linkbtn" onClick={doExportPdf} disabled={!activeFile || !signedCount || Boolean(busy)}>
                  PDF file ini
                </button>
              </div>
              {remaining > 0 && persons.length > 0 && (
                <div className="warn">Catatan: {remaining} nama belum TTD — export tetap bisa jalan.</div>
              )}
            </div>
          ) : (
            <div className="card">
              <b>Export</b>
              <p className="mut" style={{ margin: '4px 0 0' }}>
                Download ZIP/Excel/PDF tersedia untuk akun admin setelah semua TTD lengkap.
              </p>
            </div>
          )}

          <div className="card previewbar" style={{ marginTop: 12 }}>
            <div className="pvrow">
              <b className="pvtitle">{activeFile ? shortName(activeFile.name) : 'Preview'}</b>
              <div className="seg" role="tablist" aria-label="Mode preview">
                <button className={view === 'laporan' ? 'on' : ''} onClick={() => setView('laporan')}>Laporan</button>
                <button className={view === 'ringkas' ? 'on' : ''} onClick={() => setView('ringkas')}>Ringkas</button>
              </div>
            </div>
            {files.length > 1 && (
              <div className="filetabs">
                {files.map((f) => {
                  const st = fileSignedInfo(f)
                  return (
                    <button
                      key={f.id}
                      className={activeFile?.id === f.id ? 'on' : ''}
                      onClick={() => { setActiveId(f.id); setMtab('preview') }}
                      title={`${f.name} — ${st.hit}/${st.need}`}
                    >
                      {st.done ? '✓ ' : ''}{shortName(f.name)}
                    </button>
                  )
                })}
              </div>
            )}
            {activeFile && view === 'laporan' && (
              <div className="pvrow tools">
                <select
                  key={activeFile.id}
                  defaultValue=""
                  onChange={(e) => jumpToPage(e.target.value)}
                  aria-label="Lompat ke halaman"
                >
                  <option value="">Halaman…</option>
                  {activeFile.blocks.map((b) => <option key={b.id} value={b.page}>{b.page}</option>)}
                </select>
                <div className="seg small" role="tablist" aria-label="Ukuran preview">
                  <button className={previewFit ? 'on' : ''} onClick={() => setPreviewFit(true)} title="Sesuaikan lebar layar">Pas</button>
                  <button className={!previewFit ? 'on' : ''} onClick={() => setPreviewFit(false)} title="Ukuran asli Excel">1:1</button>
                </div>
                <label className="switch mini" title="Tandai slot yang belum ada TTD-nya">
                  <input type="checkbox" checked={spot} onChange={(e) => setSpot(e.target.checked)} />
                  <span>Sorot</span>
                </label>
              </div>
            )}
          </div>

          <div id="c75Preview" style={{ marginTop: 12 }}>
            {!activeFile && (
              <div className="card empty">
                <div className="emptyart">📄</div>
                <p className="mut">Belum ada preview.</p>
              </div>
            )}
            {activeFile && view === 'laporan' && (
              <ReportPreview
                sheet={activeFile.sheet}
                aoa={activeFile.aoa}
                blocks={activeFile.blocks}
                signatures={signaturesForExport}
                fileUid={activeFile.id}
                spotMissing={spot}
                fit={previewFit}
                onEditSig={() => {}}
              />
            )}
            {activeFile && view === 'ringkas' && (
              activeFile.blocks.map((b) => (
                <div key={b.id} className="c75-rblock" id={`${activeFile.id}-pg${b.page}`}>
                  <div className="c75-rbh"><span>Hlm {b.page}</span></div>
                  <div className="c75-rcols">
                    {[
                      { side: 'Auditor,', names: b.auditorNames },
                      { side: 'Auditee,', names: b.auditeeNames },
                    ].map(({ side, names }) => (
                      <div key={side} className="c75-rcol">
                        <div className="c75-rlab">{side}</div>
                        <div className="c75-rnames">
                          {names.map((nm) => {
                            const key = normKey(nm)
                            const sig = signaturesForExport[key]
                            const on = Boolean(sig?.dataUrl)
                            const mine = key === myKey
                            return (
                              <div
                                key={nm}
                                className={`c75-rchip${on ? ' signed' : ' miss'}${mine ? ' mine' : ''}`}
                                title={on ? nm : `${nm} — belum TTD`}
                              >
                                {on && <img src={sig.dataUrl} alt="" />}
                                <span>{nm}{on ? '' : ' • belum'}{mine ? ' (saya)' : ''}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.msg}</div>)}
      </div>
    </div>
  )
}
