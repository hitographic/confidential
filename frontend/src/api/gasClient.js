import { GAS_URL } from '../config'

/**
 * Thin wrapper ke backend Google Apps Script (Code.gs → doPost).
 * Kontrak action SAMA PERSIS dengan versi single-file Index.html,
 * jadi backend TIDAK perlu diubah.
 *
 * Actions: login, registerSignature, verifySignature, getChecklist,
 * getDepartemen, saveDraft, submitFinal, getList, getDetail, deleteData,
 * updateSignature, uploadPhoto, deletePhoto, getSignatureInfo,
 * fetchImages, changePassword
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
  login: (nik, password) => post('login', { nik, password }),

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

  changePassword: (nik, oldPassword, newPassword) =>
    post('changePassword', { nik, oldPassword, newPassword }),
}

export default gasApi
