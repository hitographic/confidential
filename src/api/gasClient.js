import { GAS_URL } from '../config'
import { toPasswordHash, isSha256Hash } from '../utils/hash'

/**
 * Thin wrapper ke backend Google Apps Script (Code.gs → doPost).
 * Kontrak action SAMA PERSIS dengan versi single-file Index.html,
 * jadi backend TIDAK perlu diubah.
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
 */
async function post(action, payload = {}) {
  const res = await fetch(GAS_URL, {
    method: 'POST',
    body: JSON.stringify({ action, ...payload }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
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

  getList: (auditorName, kategori) =>
    post('getList', { auditorName, kategori }),

  getDetail: (id) => post('getDetail', { id }),

  deleteData: (id) => post('deleteData', { id }),

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
