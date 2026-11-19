/**
 * Generator WI (Work Instruction) — Penggunaan Aplikasi CONFIDENTIAL.
 *
 * Format MENIRU persis contoh:
 *   "Lampiran X (WI Penggunaan Aplikasi AMOR - User).xlsx"
 *   (3 halaman berdampingan dalam 1 sheet landscape A4, Times New Roman,
 *    kop per halaman, judul di merge, langkah bernomor + sub a/b/c,
 *    catatan kaki berwarna biru.)
 *
 * Jalankan: node scripts/_gen-wi.mjs
 */
import ExcelJS from 'exceljs'

const OUT =
  '/Users/wahidalwahdi/Desktop/INDOFOOD/GKM/7. GKM PSS DC 2026/WI Confidential/Lampiran X (WI Penggunaan Aplikasi Confidential - User).xlsx'

const wb = new ExcelJS.Workbook()
const ws = wb.addWorksheet('1 dari 1', {
  pageSetup: {
    orientation: 'landscape',
    paperSize: 9, // A4
    fitToPage: false,
    fitToWidth: 1,
    fitToHeight: 0,
    scale: 69,
    margins: { left: 0.3, right: 0.3, top: 0.61, bottom: 0.37, header: 0.1, footer: 0.1 },
    horizontalCentered: true,
    verticalCentered: false,
  },
  views: [{ state: 'normal', zoom: 94, style: 'pageBreakPreview', activeCell: 'AO29' }],
})

// semua kolom sempit & seragam seperti contoh
for (let i = 1; i <= 51; i++) ws.getColumn(i).width = 5.66
// tinggi baris: baris 1/7/8 = 17, judul 9-11 = 18, sisanya 16
for (let r = 1; r <= 60; r++) {
  ws.getRow(r).height = r === 1 || r === 7 || r === 8 ? 17 : r >= 9 && r <= 11 ? 18 : 16
}

// ---------------------------------------------------------------- gaya font
const TNR = 'Times New Roman'
const F_KOP = { name: TNR, size: 12, bold: true }
const F_TITLE = { name: TNR, size: 14, bold: true }
const F_BODY = { name: TNR, size: 12 }
const F_NOTE = { name: 'Arial', size: 10, color: { argb: 'FF0432FF' } } // biru, seperti contoh

const MID = { vertical: 'middle' }
const MID_CENTER = { horizontal: 'center', vertical: 'middle' }
const LEFT_MID = { horizontal: 'left', vertical: 'middle' }

const put = (r, c, v, font, align) => {
  const cell = ws.getCell(r, c)
  cell.value = v
  if (font) cell.font = font
  if (align) cell.alignment = align
  return cell
}

// ---------------------------------------------------------------- kop halaman
function writeKop(kop, pageNo) {
  put(2, kop.center, 'PT INDOFOOD CBP SUKSES MAKMUR Tbk', F_KOP, MID_CENTER)
  put(3, kop.center, 'DIVISI NOODLE - PABRIK CIBITUNG', F_KOP, MID_CENTER)
  put(2, kop.label, '   Kode WI', F_KOP, MID)
  put(3, kop.label, '   No. Terbitan', F_KOP, MID)
  put(4, kop.label, '   Tgl. Efektif', F_KOP, MID)
  put(5, kop.label, '   Lampiran', F_KOP, MID)
  put(6, kop.label, '   Halaman', F_KOP, MID)
  ;[': ', ': ', ': ', ': ', `:  ${pageNo}/3`].forEach((v, i) => put(2 + i, kop.colon, v, F_KOP, MID))
}

// ---------------------------------------------------------------- judul (hal 1)
function writeJudul(fromCol, toCol) {
  const lines = [
    'WORK INSTRUCTION',
    'PENGGUNAAN APLIKASI CONFIDENTIAL',
    '(SISTEM AUDIT INTERNAL) DARI SISI USER',
  ]
  lines.forEach((t, i) => {
    const r = 9 + i
    ws.mergeCells(r, fromCol, r, toCol)
    put(r, fromCol, t, F_TITLE, MID_CENTER)
  })
}

// ---------------------------------------------------------------- konten langkah
/**
 * item: { no?: '1.', sub?: 'a.', note?: '*', text: ['baris1', 'baris2', ...] }
 * - nomor langkah (no)  -> kolom numCol
 * - sub letter          -> kolom textCol, teks sub -> kolom subCol
 * - langkah biasa       -> teks di textCol
 * - catatan kaki (note) -> tanda di numCol, teks (biru) di textCol
 */
function writeContent(page, items, { gapBeforeNotes = true } = {}) {
  let row = page.startRow
  let notesStarted = false
  for (const item of items) {
    if (item.note && !notesStarted && gapBeforeNotes) {
      row += 1 // satu baris kosong sebelum blok catatan kaki
      notesStarted = true
    }
    const isNote = !!item.note
    const font = isNote ? F_NOTE : F_BODY
    if (item.no) put(row, page.numCol, item.no, F_BODY, LEFT_MID)
    if (item.note) put(row, page.numCol, item.note, F_NOTE, LEFT_MID)
    if (item.sub) put(row, page.textCol, item.sub, F_BODY, LEFT_MID)
    const col = item.sub || item.note ? (item.note ? page.textCol : page.subCol) : page.textCol
    for (const line of item.text) {
      put(row, col, line, font, MID)
      row++
    }
  }
  return row
}

// ================================================================ KONTEN WI
// Pecahan baris dibuat manual (teks meluap alami di Excel) agar tidak
// menabrak blok halaman di sebelahnya.

const HAL1 = [
  { no: '1.', text: [
    'Buka aplikasi Confidential melalui browser (Chrome / Edge)',
    'di HP atau komputer.',
    'Ketik alamat https://confidential.my.id dan',
    'pastikan koneksi internet stabil.',
    'Tampilan awal adalah halaman Login dengan logo Confidential.',
  ] },
  { no: '2.', text: ['Login menggunakan NIK dan Password.'] },
  { sub: 'a.', text: ['Isi NIK pada kolom NIK sesuai data Anda.'] },
  { sub: 'b.', text: ['Isi Password pada kolom Password, klik ikon mata untuk tampil / sembunyi.'] },
  { sub: 'c.', text: ['Klik tombol Masuk dan tunggu tulisan Proses... sampai halaman berikutnya muncul.'] },
  { sub: 'd.', text: ['Jika muncul pesan Gagal (NIK atau Password salah), periksa kembali ketikan Anda.'] },
  { sub: 'e.', text: [
    'Jika backend (Google Apps Script) tidak dapat dihubungi,',
    'aplikasi masuk Mode Demo sebagai Guest dan data tidak',
    'tersimpan; hubungi Admin, lalu login ulang.',
  ] },
  { no: '3.', text: ['Saat login, sistem memeriksa tanda tangan digital Anda.'] },
  { sub: 'a.', text: ['Jika sudah terdaftar, muncul kotak dialog Tanda Tangan Terdaftar.'] },
  { sub: 'b.', text: ['Klik Gunakan yang Sudah Ada bila ingin memakai tanda tangan tersimpan.'] },
  { sub: 'c.', text: [
    'Klik Buat TTD Baru bila ingin membuat baru: masukkan PIN,',
    'gambar tanda tangan di layar, lalu klik Daftarkan TTD.',
  ] },
  { no: '4.', text: ['Pilih mode kerja bila akun memiliki dua peran (Auditor & Auditee).'] },
  { sub: 'a.', text: ['Klik kartu Auditor bila akan membuat, mengisi, dan menandatangani laporan.'] },
  { sub: 'b.', text: ['Klik kartu Auditee bila akan melihat audit unit sendiri dan mengisi CAPA.'] },
  { sub: 'c.', text: ['Akun satu peran (termasuk Admin) langsung masuk halaman kategori, tanpa memilih.'] },
]

const HAL2 = [
  { no: '5.', text: ['Pilih kategori audit pada halaman Pilih Kategori Audit.*'] },
  { sub: 'a.', text: ['Tersedia kartu: Halal, FSSC, PRP, PMR, dan SMK3.'] },
  { sub: 'b.', text: ['Klik kartu kategori yang akan dikerjakan, contoh: klik Halal.'] },
  { no: '6.', text: ['Halaman Data Pengamatan menampilkan daftar audit sesuai kategori.'] },
  { sub: 'a.', text: ['Klik tombol Kembali untuk kembali ke halaman kategori.'] },
  { sub: 'b.', text: [
    'Gunakan kolom Cari Auditee, Cari Auditor, Cari Departemen, dan',
    'filter Semua Status (Draft / Submitted) untuk mempersempit daftar.',
  ] },
  { sub: 'c.', text: [
    'Kartu data menampilkan nama auditee, tanggal, badge status',
    '(DRAFT / SUBMITTED), nama auditor, dan departemen.',
  ] },
  { sub: 'd.', text: ['Klik Muat Ulang untuk memuat data dari server tanpa buka ulang halaman.'] },
  { sub: 'e.', text: ['Klik Tambah Data untuk membuat audit baru.**'] },
  { no: '7.', text: ['Pada pop-up Mulai Audit Baru, pilih Departemen, lalu klik Mulai Checklist.'] },
  { sub: 'a.', text: ['Departemen wajib dipilih; bila kosong muncul peringatan Departemen wajib dipilih!'] },
  { sub: 'b.', text: ['Halaman Form Checklist kemudian terbuka untuk diisi.'] },
  { no: '8.', text: ['Isi Form Checklist pada kolom Kesesuaian, Kategori, Keterangan, dan Foto.'] },
  { sub: 'a.', text: ['Klik radio Ya bila sesuai; kolom Kategori otomatis terisi C (Conformance).'] },
  { sub: 'b.', text: ['Klik radio Tidak bila tidak sesuai, lalu pilih Kategori: Minor, Major, atau Kritis.'] },
  { sub: 'c.', text: ['Isi kolom Keterangan untuk temuan Tidak (wajib diisi).'] },
  { sub: 'd.', text: [
    'Temuan Tidak wajib melampirkan foto: klik ikon kamera pada',
    'kolom Foto, pilih / ambil foto, atur potongan 1:1, isi keterangan',
    'foto, lalu klik Simpan Foto.',
  ] },
  { sub: 'e.', text: [
    'Jawaban tersimpan otomatis (autosave) di perangkat, sehingga',
    'dapat dilanjutkan bila aplikasi tertutup tidak sengaja.',
  ] },
  { sub: 'f.', text: [
    'Klik Simpan Sementara untuk menyimpan sebagai Draft, atau',
    'Review & Submit untuk melanjutkan ke preview laporan.***',
  ] },
]

const HAL3 = [
  { no: '9.', text: ['Periksa Preview Laporan (MGT-003) sebelum disimpan.'] },
  { sub: 'a.', text: ['Pastikan departemen, tanggal, dan daftar hasil pengamatan sudah benar.'] },
  { sub: 'b.', text: ['Klik Export to PDF untuk mengunduh laporan bila diperlukan (opsional).'] },
  { sub: 'c.', text: ['Klik ikon X untuk membatalkan dan kembali mengisi form.'] },
  { sub: 'd.', text: [
    'Klik Simpan Draft untuk menyimpan sebagai Draft, atau Submit',
    'Final untuk laporan lengkap dengan tanda tangan (status SUBMITTED).****',
  ] },
  { no: '10.', text: ['Tanda tangan laporan pada halaman Data Pengamatan.'] },
  { sub: 'a.', text: ['Peran Auditor: klik tombol TTD Auditor, masukkan PIN, klik Verifikasi.'] },
  { sub: 'b.', text: [
    'Setelah Auditor ✓, peran Auditee: klik tombol TTD Auditee,',
    'masukkan PIN, klik Verifikasi. Urutan wajib: Auditor lebih dulu.',
  ] },
  { sub: 'c.', text: ['Klik tombol Preview untuk melihat laporan final bertanda tangan kedua pihak.'] },
  { no: '11.', text: ['Isi CAPA (MGT-004) sebagai peran Auditee.*****'] },
  { sub: 'a.', text: ['Klik tombol CAPA oranye pada kartu data milik sendiri berstatus SUBMITTED.'] },
  { sub: 'b.', text: ['Nomor CAPA terisi otomatis (urutan temuan / kode semester / tahun audit).'] },
  { sub: 'c.', text: ['Isi Correction, Indikasi Penyebab, Corrective Action, Target Selesai per temuan.'] },
  { sub: 'd.', text: [
    'Opsional: unggah foto perbaikan pada tiap temuan (ikuti langkah',
    'potong foto, poin 8d).',
  ] },
  { sub: 'e.', text: ['Klik Simpan CAPA, lalu tunggu pesan berhasil tersimpan.'] },
  { no: '12.', text: [
    'Unduh laporan bila diperlukan (peran Admin): klik Export Excel pada',
    'halaman Data Pengamatan, atau Export Excel pada preview laporan.',
  ] },
  { no: '13.', text: ['Logout setelah selesai menggunakan aplikasi.'] },
  { sub: 'a.', text: ['Klik ikon avatar di kanan atas; pada HP, buka menu bawah (Keluar).'] },
  { sub: 'b.', text: ['Menu pengguna menampilkan nama, NIK, peran, Ganti TTD, Ganti Password.'] },
  { sub: 'c.', text: ['Klik Keluar; sesi berakhir dan data login dihapus dari perangkat.'] },
  { sub: 'd.', text: ['Jangan bagikan NIK / Password dan selalu logout pada perangkat bersama.'] },
  { note: '*', text: ['Kategori mengikuti konfigurasi aplikasi; hubungi Admin bila ingin menambah.'] },
  { note: '**', text: [
    'Diperlukan peran Auditor atau Admin untuk menambah data; peran',
    'Auditee hanya melihat audit milik unitnya sendiri.',
  ] },
  { note: '***', text: [
    'Pilihan Tidak tanpa foto atau keterangan tidak dapat dilanjutkan;',
    'sistem menampilkan peringatan Foto Wajib / keterangan wajib.',
  ] },
  { note: '****', text: [
    'Submit Final menyimpan laporan final + tanda tangan; setelah itu',
    'data berstatus SUBMITTED dan hanya dapat dipreview.',
  ] },
  { note: '*****', text: [
    'CAPA hanya dapat diisi pemilik audit (Auditee) pada data berstatus',
    'SUBMITTED; Auditor / Admin bersifat baca-saja.',
  ] },
  { note: '******', text: ['Self-audit dilarang: auditor tidak boleh mengisi audit atas namanya sendiri.'] },
]

// ================================================================ SUSUN 3 HALAMAN
// Posisi kolom MENIRU contoh AMOR:
//   Hal 1: kop E/J/M  — nomor langkah C, teks D, sub D/E  (judul merge B:P)
//   Hal 2: kop V/AA/AD — nomor langkah T, teks U, sub U/V
//   Hal 3: kop AM/AR/AU — nomor langkah AK, teks AL, sub AL/AM
const PAGES = [
  { kop: { center: 5, label: 10, colon: 13 }, startRow: 15, numCol: 3, textCol: 4, subCol: 5, no: 1, items: HAL1 },
  { kop: { center: 22, label: 27, colon: 30 }, startRow: 10, numCol: 20, textCol: 21, subCol: 22, no: 2, items: HAL2 },
  { kop: { center: 39, label: 44, colon: 47 }, startRow: 9, numCol: 37, textCol: 38, subCol: 39, no: 3, items: HAL3 },
]

for (const page of PAGES) {
  writeKop(page.kop, page.no)
  writeContent(page, page.items)
}
writeJudul(2, 16) // B9:P11

// ---------------------------------------------------------------- simpan
await wb.xlsx.writeFile(OUT)
console.log('WI dibuat:', OUT)
