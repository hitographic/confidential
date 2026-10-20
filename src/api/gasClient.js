import { GAS_URL } from '../config'
import { toPasswordHash, isSha256Hash } from '../utils/hash'

/**
 * Thin wrapper ke backend Google Apps Script (Code.gs → doPost).
 * Kontrak action SAMA PERSIS dengan versi single-file Index.html.
 *
 * Actions: login, registerSignature, verifySignature, getChecklist,
 * getDepartemen, saveDraft, submitFinal, getList, getDetail, deleteData,
 * updateSignature, uploadPhoto, deletePhoto, getSignatureInfo,
 * fetchImages, changePassword, getVersion
 *
 * CATATAN KEAMANAN (2026-09-07):
 * Password selalu dikirim sebagai hash SHA-256 (lihat src/utils/hash.js),
 * sehingga sheet `user` TIDAK PERNAH menerima plaintext — bahkan jika
 * deployment /exec masih versi lama (yang menyimpan apa adanya),
 * yang tersimpan tetap hash. Backend baru (normalize) menerima
 * hash maupun plaintext. Login/changePassword memakai fallback
 * 2x percobaan agar tidak lockout saat masa transisi plaintext->hash.
 *
 * CATATAN MULTI-ROLE (2026-10-19) — PERLU DEPLOY ULANG BACKEND:
 * getList & deleteData kini membawa `nik` agar server bisa memfilter
 * berdasarkan role (auditor/auditee/admin) dan kepemilikan baris.
 * Backend lama TIDAK memakai `nik` (getList lama abaikan parameter),
 * jadi aman-amban saja selama masa transisi — tapi HAK AKSES SEBENARNYA
 * baru aktif setelah Code.gs di-push & Deploy ulang (clasp push).
 */
/**
 * Cache-buster.
 *
 * GAS membalas POST dengan redirect302 ke script.googleusercontent.com.
 * Redirect itu TERKADANG di-cache browser/proxy TANPA header CORS, sehingga
 * saat di-replay muncul error kedap-kedip:
 *   "No 'Access-Control-Allow-Origin' header is present on the requested resource"
 * Parameter query unik memaksa request + redirect-nya selalu segar dari jaringan.
 * (GAS mengabaikan param query yang tidak dikenal — sudah diverifikasi aman.)
 */
function withCacheBust(url) {
  return `${url}${url.includes('?') ? '&' : '?'}_cb=${Date.now()}`
}

async function post(action, payload = {}) {
  const res = await fetch(withCacheBust(GAS_URL), {
    method: 'POST',
    body: JSON.stringify({ action, ...payload }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  // Jika GAS sedang bermasalah ia bisa membalas halaman HTML error,
  // yang membuat res.json() melempar — beri pesan yang lebih jelas.
  try {
    return await res.json()
  } catch {
    throw new Error('Server tidak merespons dengan benar. Coba muat ulang halaman.')
  }
}

export const gasApi = {
  // Kirim hash dulu (agar plaintext tak transit); jika backend lama dan
  // user masih plaintext di sheet, fallback ke plaintext sekali.
  login: async (nik, password) => {
    const plain = String(password || '').trim()
    const hashed = toPasswordHash(plain)
    const first = await post('login', { nik, password: hashed })
    if (first.success) return first
    if (!isSha256Hash(plain) && /salah|tidak|gagal|invalid/i.test(String(first.message || ''))) {
      try {
        return await post('login', { nik, password: plain })
      } catch {
        return first
      }
    }
    return first
  },

  registerSignature: (nik, signatureData, pin) =>
    post('registerSignature', { nik, signatureData, pin }),

  verifySignature: (nik, pin) => post('verifySignature', { nik, pin }),

  getSignatureInfo: (nik) => post('getSignatureInfo', { nik }),

  getChecklist: (kategori, departemen) =>
    post('getChecklist', { kategori, departemen }),

  getDepartemen: (kategori) => post('getDepartemen', { kategori }),

  saveDraft: (formData) => post('saveDraft', { formData }),
  submitFinal: (formData) => post('submitFinal', { formData }),

  // Daftar audit difilter DI SERVER berdasarkan identitas + "topi" aktif.
  // payload: { nik, activeRole, kategori } — lihat handleGetList di Code.gs.
  // (nik sengaja dikirim agar server bisa memfilter; jangan andalkan
  //  kiriman nama, karena role & kepemilikan divalidasi server dari sheet user.)
  getList: (payload) => post('getList', payload),

  getDetail: (id) => post('getDetail', { id }),

  saveCapa: (id, capaData) => post('saveCapa', { id, capaData }),

  deleteData: (id, nik) => post('deleteData', { id, nik }),

  updateSignature: (id, role, signatureData, nik, ipAddress, auditeeName = null) =>
    post('updateSignature', { id, role, signatureData, nik, ipAddress, auditeeName }),

  uploadPhoto: (base64Data, kategori, filename) =>
    post('uploadPhoto', { base64Data, kategori, filename }),

  deletePhoto: (fileId) => post('deletePhoto', { fileId }),

  fetchImages: (fileIds) => post('fetchImages', { fileIds }),

  // newPassword SELALU dikirim sebagai hash -> sheet pasti berisi hash
  // walau /exec masih versi lama. oldPassword dicoba hash dulu, fallback plaintext.
  changePassword: async (nik, oldPassword, newPassword) => {
    const oldPlain = String(oldPassword || '').trim()
    const newHash = toPasswordHash(newPassword)
    const oldHash = toPasswordHash(oldPlain)
    const first = await post('changePassword', { nik, oldPassword: oldHash, newPassword: newHash })
    if (first.success) return first
    if (!isSha256Hash(oldPlain) && /lama salah/i.test(String(first.message || ''))) {
      try {
        return await post('changePassword', { nik, oldPassword: oldPlain, newPassword: newHash })
      } catch {
        return first
      }
    }
    return first
  },

  getVersion: () => post('getVersion', {}),
}

export default gasApi
