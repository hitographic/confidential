import { paraphraseHasil, paraphraseRow } from '../src/utils/paraphrase.js'

const cases = [
  // ---- 2 contoh persis dari user ----
  {
    nama: 'Contoh 1 (Ya)',
    input: { pertanyaan: 'Ada kegiatan sosialisasi Kebijakan Halal; sebutkan bentuk sosialisasinya', kesesuaian: 'Ya' },
    expect: 'Sosialisasi Kebijakan Halal sudah dilaksanakan dengan bentuk sosialisasi yang diterapkan di perusahaan.',
  },
  {
    nama: 'Contoh 2 (Ya)',
    input: { pertanyaan: 'Terdapat kegiatan pelatihan ( internal & eksternal ) SJPH untuk karyawan . Jika "YA", kapan terakhir dilakukan pelatihan ?', kesesuaian: 'Ya' },
    expect: 'Pelatihan SJPH bagi karyawan, baik secara internal maupun eksternal, sudah dilaksanakan dengan waktu pelatihan terakhir sesuai catatan perusahaan.',
  },

  // ---- pola lain dari checklist Halal ----
  { nama: 'Pernyataan + periksa bukti', input: { pertanyaan: 'Pelatihan Halal dilakukan secara rutin / terjadwal minimal 1 kali dalam 1 tahun Jika "YA", periksa bukti tertulis', kesesuaian: 'Ya' } },
  { nama: 'Pernyataan + periksa sertifikat', input: { pertanyaan: 'Trainer telah lulus pelatihan SJPH ( eksternal / internal ), periksa sertifikat', kesesuaian: 'Ya' } },
  { nama: 'Diawali verba pasif', input: { pertanyaan: 'Dilakukan evaluasi terhadap hasil training SJPH', kesesuaian: 'Ya' } },
  { nama: 'Pasif + subjek', input: { pertanyaan: 'Pelatihan diikuti oleh semua karyawan yang terlibat dalam aktivitas kritis dan karyawan baru', kesesuaian: 'Ya' } },
  { nama: 'Perusahaan... buktikan dengan', input: { pertanyaan: 'Perusahaan ( diwakili oleh Tim IHA ) telah mengikuti pelatihan SJPH oleh IHATEC / Lembaga Training terakreditasi minimal 1 kali dalam 2 tahun . Jika "YA", buktikan dengan Sertifikat Pelatihan', kesesuaian: 'Ya' } },
  { nama: 'Apakah + aktif', input: { pertanyaan: 'Apakah manajemen puncak telah membuat Kebijakan tertulis?', kesesuaian: 'Ya' } },
  { nama: 'Apakah + ada', input: { pertanyaan: 'Apakah ada kegiatan sosialisasi Kebijakan?', kesesuaian: 'Ya' } },

  // ---- kasus Tidak (temuan) ----
  { nama: 'Tidak + keterangan', input: { pertanyaan: 'Ada kegiatan sosialisasi Kebijakan Halal; sebutkan bentuk sosialisasinya', kesesuaian: 'Tidak', keterangan: 'Tidak ditemukan bukti sosialisasi tertulis di papan informasi' } },
  { nama: 'Tidak pernyataan', input: { pertanyaan: 'Pelatihan Halal dilakukan secara rutin / terjadwal minimal 1 kali dalam 1 tahun Jika "YA", periksa bukti tertulis', kesesuaian: 'Tidak', keterangan: 'Pelatihan terakhir dilakukan 18 bulan lalu' } },

  // ---- Ya + keterangan ----
  { nama: 'Ya + keterangan frasa', input: { pertanyaan: 'Ada kegiatan sosialisasi Kebijakan Halal; sebutkan bentuk sosialisasinya', kesesuaian: 'Ya', keterangan: 'Briefing pagi & papan informasi' } },
]

console.log('=== paraphraseHasil ===')
let pass = 0
for (const c of cases) {
  const out = paraphraseHasil(c.input)
  const ok = !c.expect || out === c.expect
  if (ok) pass++
  console.log(`\n[${ok ? 'OK' : 'CEK'}] ${c.nama}`)
  console.log(`  Q: ${c.input.pertanyaan}`)
  console.log(`  A: ${out}`)
  if (c.expect && !ok) console.log(`  EXPECTED: ${c.expect}`)
}

console.log('\n=== paraphraseRow (data tersimpan) ===')
const rows = [
  { nama: 'Ya tanpa keterangan', row: { pertanyaan: 'Ada kegiatan sosialisasi Kebijakan Halal; sebutkan bentuk sosialisasinya', hasilPengamatan: 'Ada kegiatan sosialisasi Kebijakan Halal; sebutkan bentuk sosialisasinya', kategoriVal: 'C' } },
  { nama: 'Tidak dgn keterangan', row: { pertanyaan: 'Apakah ada kegiatan sosialisasi Kebijakan?', hasilPengamatan: 'Belum ada bukti tertulis', kategoriVal: 'Minor' } },
  { nama: 'Tidak Sesuai (lama)', row: { pertanyaan: 'Dilakukan evaluasi terhadap hasil training SJPH', hasilPengamatan: 'Tidak Sesuai', kategoriVal: 'Major' } },
  { nama: 'Baris section', row: { type: 1, pertanyaan: 'KEBIJAKAN HALAL', hasilPengamatan: '', kategoriVal: '' } },
]
for (const r of rows) {
  console.log(`\n[${r.nama}]`)
  console.log('  ->', paraphraseRow(r.row) || '(kosong)')
}

console.log(`\n${pass}/${cases.length} kasus expect cocok`)
