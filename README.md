# Confidential — Audit Internal (React + Vite)

Migrasi dari single-file `Matrika/Index.html` (±4500 baris) ke **React + Vite yang modular**,
agar mudah dikembangkan. Backend **TETAP**: Google Apps Script (`Code.gs`) + Google Sheet + Google Drive.

## Struktur

```
Confidential/
├── backend/
│   ├── Code.gs          # COPY PERSIS dari Matrika/Code.gs (tidak diubah)
│   └── appsscript.json  # config Apps Script
├── src/                 # Vite + React (yang kamu kembangkan ke depan)
│   ├── config.js                # GAS_URL + daftar kategori
│   ├── api/gasClient.js         # 1 tempat untuk semua action ke GAS
│   ├── context/
│   │   ├── AuthContext.jsx      # login/logout/session + IP
│   │   └── AuditContext.jsx     # kategori/auditee/dept/editId/questions
│   ├── components/
│   │   ├── Navbar.jsx, ProtectedRoute.jsx, SignaturePad.jsx
│   │   ├── Sparkles.jsx             # latar bintang berkelip ala hero antigravity.google (login)
│   │   └── modals/ (NewAudit, ListSign, RegisterSignature, ChangePassword, CropPhoto)
│   ├── pages/
│   │   ├── LoginPage.jsx        # port stateLogin
│   │   ├── CategoryPage.jsx     # port stateMenu (Halal/FSSC/PRP/PMR/SMK3)
│   │   ├── ListPage.jsx         # port stateList + search + CAPA button
│   │   └── FormPage.jsx         # port stateForm + foto wajib + autosave
│   ├── features/preview/
│   │   ├── ReportPreview.jsx    # MGT-003 (port modalPreview)
│   │   ├── CapaPreview.jsx      # MGT-004 landscape (port modalCapaPreview)
│   │   └── capaUtils.js         # aturan nomor CAPA IHA-1/IHA-2
│   └── utils/ (exportExcel.js, exportPdf.js, password.js)
├── public/ (logo-confidential.png, login.png, favicon.png)
├── .env.example                 # isi VITE_GAS_URL
└── .github/workflows/deploy.yml # auto-deploy ke GitHub Pages
```

## Kenapa tetap kompatibel?

- `src/api/gasClient.js` memanggil **action yang sama persis**: `login`, `getChecklist`,
  `getDepartemen`, `saveDraft`, `getList`, `getDetail`, `deleteData`, `updateSignature`,
  `registerSignature`, `verifySignature`, `getSignatureInfo`, `changePassword`, dll.
- Jadi `backend/Code.gs` **tidak perlu diubah** dan Sheet/Drive tetap sama
  (`FOLDER_ID`, `SHEET_ID` di dalam Code.gs).
- `fetch` dipakai tanpa `Content-Type: application/json` (body string biasa),
  sama seperti versi lama → tidak kena preflight CORS GAS.

## Cara jalan lokal

```bash
cp .env.example .env   # isi VITE_GAS_URL dengan URL /exec Apps Script
npm install
npm run dev            # http://localhost:5173
```

## Deploy

1. **Backend (sekali saja, jika belum):** di folder `backend/`, `clasp push` lalu Deploy → Web App
   (`Execute as: Me`, `Who has access: Anyone`). Salin URL `/exec`.
2. **Frontend — GitHub Pages (otomatis):** setiap push ke `main`, workflow
   `.github/workflows/deploy.yml` otomatis build + deploy ke
   https://hitographic.github.io/confidential/ . Pastikan `VITE_GAS_URL`
   di `.env.example` sudah benar (workflow menyalinnya jadi `.env` saat build).
3. Jika deploy ulang GAS → cukup perbarui `VITE_GAS_URL` di `.env.example`, commit, push.

## Kembangkan fitur baru (contoh)

- Tambah kategori: edit `src/config.js` → `CATEGORIES` + tambah template di Sheet `checklist_template`.
- Tambah kolom laporan: edit `src/features/preview/ReportPreview.jsx`.
- Tambah halaman: buat file di `src/pages/`, daftarkan route di `src/App.jsx`.
- Ganti Excel/PDF: edit `src/utils/exportExcel.js` / `exportPdf.js`.

## Perbedaan vs versi single-file

| Single `Index.html` | React + Vite ini |
|---|---|
| 1 file 4500 baris, fungsi global `onclick=""` | Komponen kecil per file, state React |
| CSS+JS tercampur | `styles/global.css` + modul JS |
| Tambah fitur = scroll ribuan baris | Tambah file/route baru |
| Hash routing manual | React Router (`/login`, `/kategori`, `/list/:kategori`, `/form`) |
| `GAS_URL` hardcode di JS | `VITE_GAS_URL` di `.env` |
