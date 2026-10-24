/**
 * Rule-based paraphrase (offline, deterministik, tanpa model AI).
 *
 * Mengubah pertanyaan checklist menjadi kalimat "hasil pengamatan"
 * berima kalimat pasif — seolah auditor telah melakukan observasi:
 *
 *   "Ada kegiatan sosialisasi Kebijakan Halal; sebutkan bentuk sosialisasinya"
 *     -> "Sosialisasi Kebijakan Halal sudah dilaksanakan dengan bentuk
 *         sosialisasi yang diterapkan di perusahaan."
 *
 * Tidak ada jaringan / model neural: aturan tata bahasa + peta frasa.
 * Hasil selalu sama untuk input yang sama (penting untuk dokumen audit).
 */

/* ------------------------------------------------------------------ */
/* util dasar                                                          */
/* ------------------------------------------------------------------ */

const norm = (s) =>
  String(s || '')
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2032]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
const low = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s)
const ensureDot = (s) => (/[.!?]$/.test(s) ? s : `${s}.`)
const tidy = (s) =>
  norm(s)
    .replace(/\s+([,.;:?!])/g, '$1')
    .replace(/([,.;])(?=\S)/g, '$1 ')

/* ------------------------------------------------------------------ */
/* peta verba aktif -> pasif (untuk pola "Apakah ... telah V ...?")     */
/* ------------------------------------------------------------------ */

const VERB_ACTIVE_TO_PASSIVE = {
  membuat: 'dibuat',
  menulis: 'dituliskan',
  menetapkan: 'ditetapkan',
  menyusun: 'disusun',
  mengesahkan: 'disahkan',
  menandatangani: 'ditandatangani',
  menunjuk: 'ditunjuk',
  memberikan: 'diberikan',
  mengeluarkan: 'dikeluarkan',
  melakukan: 'dilaksanakan',
  melaksanakan: 'dilaksanakan',
  memenuhi: 'dipenuhi',
  memeriksa: 'diperiksa',
  memverifikasi: 'diverifikasi',
  menggunakan: 'digunakan',
  menerapkan: 'diterapkan',
  mengumumkan: 'diumumkan',
  menyampaikan: 'disampaikan',
  mengajukan: 'diajukan',
  memilih: 'dipilih',
  mengangkat: 'diangkat',
  membina: 'dibina',
  mendidik: 'dididik',
  melatih: 'dilatih',
  membagikan: 'dibagikan',
  mengadakan: 'diadakan',
  menyediakan: 'disediakan',
  menetapkkan: 'ditetapkan',
}

/* verba pasif per kelas topik, untuk pola "Ada/Terdapat X" */
const TOPIC_VERB = [
  { re: /^(sosialisasi|pelatihan|kegiatan|program|agenda|evaluasi|audit|briefing|training|diklat|peninjauan|pengujian|pembersihan|pengecekan|sosialisasi|tinjauan|simulasi|uji)/i, ok: 'dilaksanakan' },
  { re: /^(dokumen|surat|sertifikat|berita|laporan|daftar|berkas|formulir|rencana|prosedur|sop|kebijakan|ijazah|kartu|peta|manual|bukti|catatan|jurnal|rekap|data|inventaris)/i, ok: 'tersedia' },
  { re: /^(petugas|tenaga|karyawan|trainer|tim|penanggung|pemilik|komite|auditor|pihak)/i, ok: 'ditunjuk' },
]
const topicVerb = (topik) => {
  const hit = TOPIC_VERB.find((r) => r.re.test(topik))
  return hit ? hit.ok : 'dipenuhi'
}

/* ------------------------------------------------------------------ */
/* ekstraksi instruksi / pertanyaan lanjutan dari badan pertanyaan      */
/* ------------------------------------------------------------------ */

/**
 * Potong pertanyaan jadi:
 *   { badan, instr }  — instr = frasa setelah ";" atau ", sebutkan/periksa/buktikan ..."
 *   { yaQ }           — isi dari 'Jika "YA", ...?' (mis. "kapan terakhir dilakukan pelatihan")
 */
function dissect(raw) {
  let t = norm(raw)
  let instr = ''
  let yaQ = ''

  // Jika "YA", <pertanyaan>?  /  Jika "YA", periksa bukti tertulis
  // Catatan: anchor (?|$/) wajib agar lazy-nya tidak berhenti di 1 karakter.
  const m = t.match(/\s*Jika\s*["']?\s*(YA|TIDAK)\s*["']?\s*,\s*([^?]+?)(\?|$)/i)
  if (m) {
    if (m[1].toUpperCase() === 'YA') yaQ = norm(m[2])
    t = t.replace(m[0], ' ')
  }

  // bagian setelah koma+kata kerja instruksi di ekor: ", sebutkan ... / , periksa ..."
  const tail = t.match(/\s*,\s*((?:dan\s+)?(?:sebutkan|periksa|periksalah|buktikan|mohon\s+periksa)\b[^?;]*)$/i)
  if (tail) {
    instr = norm(tail[1])
    t = t.slice(0, tail.index)
  }

  // bagian setelah ";"
  if (t.includes(';')) {
    const [head, ...rest] = t.split(';')
    t = head
    instr = instr || norm(rest.join(';'))
  }

  return { badan: norm(t).replace(/[?.]+$/, ''), instr, yaQ }
}

/**
 * Petakan instruksi/pertanyaan-lanjutan menjadi frasa penutup.
 * mode = 'topik'  -> frasa menyatu dgn pola "X sudah VERB ..."
 * mode = 'kalimat'-> frasa dg koma, menyatu dgn kalimat pernyataan
 */
function closingPhrase(instr, yaQ, mode, positive) {
  const src = `${instr || ''} ${yaQ || ''}`.toLowerCase()
  if (!src.trim()) return ''
  if (!positive) return '' // instruksi "periksa/sebutkan" tidak relevan utk temuan

  // pola "topik sudah/belum VERB" -> frasa tanpa koma
  if (mode === 'topik') {
    if (/bentuk sosialisasi/.test(src)) return ' dengan bentuk sosialisasi yang diterapkan di perusahaan'
    if (/kapan terakhir dilakukan pelatihan/.test(src)) return ' dengan waktu pelatihan terakhir sesuai catatan perusahaan'
    if (/\bkapan\b/.test(src)) return ' sesuai catatan waktu terakhir perusahaan'
    return ''
  }

  // pola kalimat pernyataan -> sambung dg koma
  if (/bentuk sosialisasi/.test(src)) return ', dengan bentuk sosialisasi yang diterapkan di perusahaan'
  if (/kapan terakhir dilakukan pelatihan/.test(src)) return ', dengan waktu pelatihan terakhir sesuai catatan perusahaan'
  if (/buktikan dengan\s+(.+)/.test(src)) {
    const obj = norm(src.match(/buktikan dengan\s+(.+)/i)[1]).replace(/\.$/, '')
    return `, dibuktikan dengan ${obj}`
  }
  if (/bukti tertulis/.test(src)) return ', dibuktikan dengan bukti tertulis'
  if (/sertifikat/.test(src)) return ', dibuktikan dengan sertifikat'
  if (/bukti/.test(src)) return ', dibuktikan dengan bukti pendukung'
  if (/\bkapan\b/.test(src)) return ', sesuai catatan waktu terakhir perusahaan'
  return ''
}

/* ------------------------------------------------------------------ */
/* normalisasi topik: "( internal & eksternal )" -> adjunct, untuk->bagi */
/* ------------------------------------------------------------------ */

function normalizeTopic(raw) {
  let t = norm(raw).replace(/\s+/g, ' ')
  let adjunct = ''

  // parenthetical internal/eksternal -> ", baik secara internal maupun eksternal"
  t = t.replace(/\s*\(([^)]*)\)\s*/g, (full, inner) => {
    if (/internal|ekstern/i.test(inner)) {
      adjunct = 'baik secara internal maupun eksternal'
      return ' '
    }
    return ` ${inner} `
  })

  t = norm(t).replace(/\buntuk\b/gi, 'bagi')
  return { topik: t, adjunct }
}

/* ------------------------------------------------------------------ */
/* pembentuk kalimat per mode                                          */
/* ------------------------------------------------------------------ */

/** "Ada/Terdapat [kegiatan] X" -> "X sudah/belum VERB" */
function buildFromExist(badan, positive) {
  let t = badan
  t = t.replace(/^(ada|terdapat|adanya|terdapatlah)\s+/i, '')
  t = t.replace(/^(kegiatan|program|agenda|kegiatan)\s+/i, '')

  const { topik, adjunct } = normalizeTopic(t)
  if (!topik) return ''

  const verb = topicVerb(topik)
  const subj = cap(topik) + (adjunct ? `, ${adjunct},` : '')
  return `${subj} ${positive ? 'sudah' : 'belum'} ${verb}`
}

/** "Apakah {subj} {telah|sudah} {verbaAktif} {obj}?" -> pasif. */
function buildFromQuestion(badan, positive) {
  let t = badan.replace(/^apakah\s+/i, '')

  // "Apakah ada/terdapat X" -> mode exist
  if (/^(ada|terdapat)\s+/i.test(t)) return buildFromExist(t, positive)

  const words = t.split(' ')
  let aux = ''
  let verbIdx = -1
  let passive = ''
  for (let i = 0; i < words.length; i++) {
    const w = words[i].toLowerCase().replace(/[^a-z]/g, '')
    if (/^(telah|sudah)$/.test(w)) { aux = words[i]; continue }
    if (VERB_ACTIVE_TO_PASSIVE[w]) { verbIdx = i; passive = VERB_ACTIVE_TO_PASSIVE[w]; break }
  }

  if (verbIdx > 0) {
    const subj = norm(words.slice(0, verbIdx).filter((_, i) => !(aux && words[i] === aux)).join(' '))
    const obj = norm(words.slice(verbIdx + 1).join(' '))
    const auxFinal = positive ? (aux || 'telah') : 'belum'
    return `${cap(obj)} ${auxFinal} ${passive} oleh ${low(subj)}`
  }

  // sudah berupa klausa pasif / pernyataan -> pakai apa adanya
  if (/^di[a-z]{3,}\b/i.test(t)) {
    // "Dilakukan evaluasi terhadap X" -> "Evaluasi terhadap X telah dilakukan"
    const m = t.match(/^(di[a-z]+)\s+(.+)$/i)
    if (m && positive) return `${cap(m[2])} telah ${m[1].toLowerCase()}`
    if (m && !positive) return `${cap(m[2])} belum ${m[1].toLowerCase()}`
    return cap(t)
  }
  if (!positive) return `Tidak ditemukan bukti bahwa ${low(t)}`
  return cap(t)
}

/** Kalimat pernyataan ("Pelatihan dilakukan rutin...") -> kuatkan / negasikan. */
function buildFromStatement(badan, positive) {
  let t = badan
  if (positive) {
    // diawali verba pasif: "Dilakukan evaluasi terhadap X" -> inversi
    const lead = t.match(/^(di[a-z]+)\s+(.+)$/i)
    if (lead) return `${cap(lead[2])} telah ${lead[1].toLowerCase()}`
    // pernyataan pasif tanpa penegas: sisipkan "telah"
    if (!/\b(telah|sudah|akan)\b/i.test(t)) {
      const pas = t.match(/^(\S+(?:\s+\S+){0,5}?)\s+(di[a-z]{3,}\b.*)$/i)
      if (pas) return `${cap(pas[1])} telah ${pas[2]}`
    }
    return cap(t)
  }
  // negasi: "telah/sudah" -> "belum"; verba pasif -> "belum <verba>"
  if (/\b(telah|sudah)\s+/i.test(t)) return cap(t.replace(/\b(telah|sudah)\s+/i, 'belum '))
  const lead = t.match(/^(di[a-z]+)\s+(.+)$/i)
  if (lead) return `Belum ${lead[1].toLowerCase()} ${lead[2]}`
  const m = t.match(/^(\S+(?:\s+\S+){0,5}?)\s+(di[a-z]{3,}\b.*)$/i)
  if (m) return `${cap(m[1])} belum ${m[2]}`
  return `Tidak ditemukan bukti bahwa ${low(t)}`
}

/* ------------------------------------------------------------------ */
/* API publik                                                          */
/* ------------------------------------------------------------------ */

/**
 * Parafrasa satu jawaban checklist.
 * @param {object} p
 * @param {string} p.pertanyaan   teks parameter/dokumen dari checklist
 * @param {'Ya'|'Tidak'} p.kesesuaian
 * @param {string} [p.keterangan] keterangan auditor (opsional utk Ya, wajib utk Tidak)
 * @returns {string} kalimat hasil pengamatan
 */
export function paraphraseHasil({ pertanyaan, kesesuaian, keterangan }) {
  const q = norm(pertanyaan)
  if (!q) return ''
  const positive = String(kesesuaian || '').toLowerCase() !== 'tidak'
  const ket = norm(keterangan)

  const { badan, instr, yaQ } = dissect(q)
  if (!badan) return cap(q)

  const isApakah = /^apakah\b/i.test(badan)
  const isExist = /^(ada|terdapat|adanya)\b/i.test(badan)

  let mode
  let base
  if (isExist) {
    mode = 'topik'
    base = buildFromExist(badan, positive)
  } else if (isApakah) {
    mode = 'kalimat'
    base = buildFromQuestion(badan, positive)
  } else if (/^di[a-z]{3,}\b/i.test(badan)) {
    mode = 'kalimat'
    base = buildFromStatement(badan, positive)
  } else {
    // pernyataan biasa: "Trainer telah lulus ...", "Pelatihan diikuti ..."
    mode = 'kalimat'
    base = /^telah\s+/i.test(badan) && positive
      ? cap(badan)
      : buildFromStatement(badan, positive)
  }
  if (!base) base = cap(badan)

  const close = closingPhrase(instr, yaQ, mode, positive)
  if (close) base = `${base}${close}`

  let out = ensureDot(tidy(base))

  // keterangan auditor
  if (ket) {
    if (!positive) out = `${out} ${ensureDot(tidy(ket))}`      // temuan: kalimat terpisah
    else if (/[.!?]$/.test(ket)) out = `${out} ${ensureDot(tidy(ket))}`
    else out = out.replace(/\.$/, ` (${tidy(ket)}).`)          // frasa pendek: parenthetical
  }

  return ensureDot(tidy(out))
}

/**
 * Parafrasa baris checklist tersimpan (untuk preview/export/CAPA).
 * Rekonstruksi jawaban dari penyimpanan lama:
 *   hasilPengamatan === pertanyaan      -> Ya tanpa keterangan
 *   hasilPengamatan === 'Tidak Sesuai'  -> Tidak tanpa keterangan
 *   kategoriVal Minor/Major/Kritis      -> Tidak (+ keterangan = hasilPengamatan)
 *   selain itu                          -> Ya (+ keterangan = hasilPengamatan)
 */
export function paraphraseRow(row) {
  if (!row) return ''
  if (row.type == 1 || row.type == 2 || row.type == 3) return ''
  const raw = norm(row.hasilPengamatan)
  if (!raw) return ''
  const q = norm(row.pertanyaan)
  if (!q) return raw

  const kat = norm(row.kategoriVal).toUpperCase()
  const isFinding = kat === 'MINOR' || kat === 'MAJOR' || kat === 'KRITIS'

  let kesesuaian
  let keterangan = ''
  if (raw === q) {
    kesesuaian = 'Ya'
  } else if (raw.toLowerCase() === 'tidak sesuai') {
    kesesuaian = 'Tidak'
  } else if (isFinding) {
    kesesuaian = 'Tidak'
    keterangan = raw
  } else {
    kesesuaian = 'Ya'
    keterangan = raw
  }

  return paraphraseHasil({ pertanyaan: q, kesesuaian, keterangan })
}

export default { paraphraseHasil, paraphraseRow }
