// Menampilkan halaman HTML saat webapp diakses
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Confidential')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// Konfigurasi ID (PENTING: Sesuaikan dengan ID Google Drive & Sheet Anda)
const FOLDER_ID = "1xjVi1fxtIcZm28BoPKSyFoKJA_8-Elei";
const SHEET_ID = "1Cmccso6hkwHPJNX1jZy5arK5OAOLnhMBCp89JwJBG50";

// Folder sumber file Form CQA-75 — RELATIF terhadap FOLDER_ID.
// Diubah bila semester/tahun berganti, mis. ["CQA-75", "2027", "Semester 1"].
const CQA75_FOLDER_PATH = ["CQA-75", "2026", "Semester 2"];

// Hak akses getList:
//   true  -> Auditor HANYA melihat audit yang ia pegang sendiri (disarankan)
//   false -> Auditor melihat SEMUA audit pada kategorinya
// Auditee selalu hanya melihat audit miliknya; Admin selalu melihat semua.
const SCOPE_AUDITOR_OWN_ONLY = true;

/* ------------------------------------------------------------------------
 * CACHE — percepat respons (ditambahkan 2026-10-24)
 *
 * Masalah: setiap request POST ke /exec membuka Spreadsheet + memanggil
 * getDataRange().getValues(), yang memindai SELURUH sheet. Untuk data yang
 * sering dibaca (list, detail) maupun yang jarang berubah (template
 * checklist, departemen), cold-start GAS terasa lambat tiap klik.
 *
 * Solusi: simpan hasil baca di CacheService selama beberapa detik/menit.
 *
 * Invalidasi: memakai "stempel versi global" (dataVersion) yang ikut
 * menyusun kunci cache. Setiap aksi tulis memanggil bumpDataVersion(),
 * sehingga SELURUH cache list/detail lama otomatis tidak terpakai — tanpa
 * perlu menebak & menghapus satu per satu kuncinya.
 * ---------------------------------------------------------------------- */
const CACHE_TTL = {
  checklist: 600,   // 10 menit — template jarang berubah
  departemen: 600,
  version: 600,
  data: 60,         // 1 menit — list/detail tetap cukup segar
  user: 30,         // 30 detik — hanya nik/nama/roles (tanpa kredensial)
};

// CacheService membatasi payload ~100KB per entri; jangan simpan yang lebih.
const CACHE_MAX_CHARS = 90000;
const DATA_VER_KEY = 'audit_data_version';

function cache_() {
  try { return CacheService.getScriptCache(); } catch (e) { return null; }
}

function dataVersion() {
  const c = cache_();
  if (!c) return '0';
  try {
    let v = c.get(DATA_VER_KEY);
    if (!v) { v = '1'; c.put(DATA_VER_KEY, v, 21600); }
    return String(v);
  } catch (e) { return '0'; }
}

// Panggil SETELAH berhasil menulis, agar cache baca lama tidak terpakai lagi.
function bumpDataVersion() {
  const c = cache_();
  if (!c) return;
  try { c.put(DATA_VER_KEY, String(Date.now()), 21600); } catch (e) {}
}

/**
 * Jalankan fn() dengan hasil cache-nya.
 * @param {string} key       kunci unik
 * @param {number} ttl       detik
 * @param {Function} fn      penghasil nilai (dipanggil hanya saat cache miss)
 * @param {boolean} [skipFalsy] true -> jangan cache hasil bernilai false/null
 */
function cachedGet(key, ttl, fn, skipFalsy) {
  const c = cache_();
  if (!c) return fn(); // CacheService tidak tersedia -> tanpa cache
  try {
    const hit = c.get(key);
    if (hit !== null && hit !== undefined) return JSON.parse(hit);
  } catch (e) { /* miss / korup -> baca ulang */ }
  const value = fn();
  if (skipFalsy && !value) return value;
  try {
    const s = JSON.stringify(value);
    if (s.length < CACHE_MAX_CHARS) c.put(key, s, ttl);
  } catch (e) { /* terlalu besar / gagal -> lewati cache */ }
  return value;
}

// --- Fungsi Utilitas ---
function getSheet(sheetName) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(sheetName);
  
  // Buat sheet jika belum ada (untuk kemudahan setup pertama kali)
  if (!sheet) {
    if (sheetName === 'checklist_template') {
       sheet = ss.insertSheet(sheetName);
       sheet.appendRow(['Kategori', 'No', 'Pertanyaan']);
    } else if (sheetName === 'data_pengamatan') {
       sheet = ss.insertSheet(sheetName);
       sheet.appendRow(['ID', 'Timestamp', 'Auditor', 'Auditee', 'Kategori Menu', 'Data Checklist (JSON)', 'Status', 'Tanda Tangan Auditor', 'Tanda Tangan Auditee', 'Hash_Integritas']);
    } else if (sheetName === 'signatures_db') {
       sheet = ss.insertSheet(sheetName);
       sheet.appendRow(['NIK', 'TandaTanganBase64', 'PIN_Hash', 'Created_At', 'Updated_At']);
    } else if (sheetName === 'audit_trail') {
       sheet = ss.insertSheet(sheetName);
       sheet.appendRow(['Timestamp', 'Action', 'NIK', 'IP_Address', 'Target_ID', 'Data_Hash']);
    } else if (sheetName === 'list_departemen') {
       sheet = ss.insertSheet(sheetName);
       sheet.appendRow(['ID', 'Kategori', 'Departemen']);
    } else if (sheetName === 'cqa75_state') {
       // Status "sudah TTD" per NIK untuk halaman Form CQA-75.
       sheet = ss.insertSheet(sheetName);
       sheet.appendRow(['NIK', 'Nama_TTD', 'Status', 'Updated_At']);
    }
  }
  // Pastikan kolom Lampiran (L) & CAPA (M) ada untuk sheet data_pengamatan
  if (sheetName === 'data_pengamatan') {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (headers.length < 12 || !headers[11] || String(headers[11]).trim() !== 'Lampiran (JSON)') {
      if (headers.length < 12) {
        sheet.getRange(1, 12).setValue('Lampiran (JSON)');
      }
    }
    if (headers.length < 13 || !headers[12] || String(headers[12]).trim() !== 'CAPA (JSON)') {
      sheet.getRange(1, 13).setValue('CAPA (JSON)');
    }
  }
  // Pastikan kolom Updated_At (E) ada untuk sheet signatures_db
  if (sheetName === 'signatures_db') {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (headers.length < 5 || !headers[4] || String(headers[4]).trim() !== 'Updated_At') {
      if (headers.length < 5) {
        sheet.getRange(1, 5).setValue('Updated_At');
      }
    }
  }
  return sheet;
}

function saveImageToDrive(base64Data, filename) {
  if (!base64Data) return "";
  try {
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const data = base64Data.split(',')[1];
    const blob = Utilities.newBlob(Utilities.base64Decode(data), 'image/png', filename);
    const file = folder.createFile(blob);
    
    // Set permission agar image bisa diload di tag HTML <img>
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w1000";
  } catch(e) {
    return "Error Upload: " + e.message;
  }
}

// --- Fungsi Folder Kategori ---
function getCategoryFolder(kategori) {
  const parentFolder = DriveApp.getFolderById(FOLDER_ID);
  const folderName = kategori || 'Lainnya';
  const folders = parentFolder.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parentFolder.createFolder(folderName);
}

// --- Fungsi Upload/Hapus Foto Lampiran ---
function handleUploadPhoto(base64Data, kategori, filename) {
  try {
    if (!base64Data) return { success: false, message: "Data foto kosong." };
    const folder = getCategoryFolder(kategori);
    const data = base64Data.split(',')[1];
    const blob = Utilities.newBlob(Utilities.base64Decode(data), 'image/png', filename || ('lampiran_' + new Date().getTime() + '.png'));
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const url = "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w1000";
    return { success: true, url: url, fileId: file.getId() };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function handleDeletePhoto(fileId) {
  try {
    if (!fileId) return { success: false, message: "File ID kosong." };
    const file = DriveApp.getFileById(fileId);
    file.setTrashed(true);
    return { success: true, message: "Foto berhasil dihapus." };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// --- Fungsi Kriptografi & Audit (UU ITE) ---
function hashSHA256(text) {
  const rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text);
  let txtHash = '';
  for (let i = 0; i < rawHash.length; i++) {
    let hashVal = rawHash[i];
    if (hashVal < 0) {
      hashVal += 256;
    }
    if (hashVal.toString(16).length == 1) {
      txtHash += '0';
    }
    txtHash += hashVal.toString(16);
  }
  return txtHash;
}

function logAuditTrail(action, nik, ipAddress, targetId, dataHash) {
  const sheet = getSheet("audit_trail");
  sheet.appendRow([new Date(), action, nik, ipAddress || "Unknown", targetId, dataHash || ""]);
}

// --- Helper hash password (sheet: user, kolom B) ---
// Format tersimpan: hex SHA-256 lowercase 64 char, mis. hashSHA256("P@ssw0rd!")
function isSHA256Hash(s) {
  return /^[a-f0-9]{64}$/i.test(String(s || '').trim());
}

function hashPassword(pw) {
  return hashSHA256(String(pw || '').trim());
}

// Normalisasi idempoten: terima plaintext ATAU hash dari frontend baru.
// - Jika input sudah 64-char hex -> pakai apa adanya (lowercase).
// - Jika masih plaintext -> hash dulu.
// Dengan ini tidak ada double-hash, dan deployment lama/baru saling kompatibel.
function normalizePasswordHash(pwInput) {
  const s = String(pwInput || '').trim();
  if (isSHA256Hash(s)) return s.toLowerCase();
  return hashPassword(s);
}

function handleRegisterSignature(nik, signatureData, pin) {
  try {
    const sheet = getSheet("signatures_db");
    const data = sheet.getDataRange().getValues();
    const pinHash = hashSHA256(pin);
    
    // Konversi Base64 ke URL Google Drive
    let finalSignatureUrl = signatureData;
    if (signatureData && signatureData.startsWith('data:image')) {
      finalSignatureUrl = saveImageToDrive(signatureData, `TTD_${nik}_${new Date().getTime()}.png`);
    }
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(nik).trim()) {
        sheet.getRange(i + 1, 2).setValue(finalSignatureUrl);
        sheet.getRange(i + 1, 3).setValue(pinHash);
        sheet.getRange(i + 1, 4).setValue(data[i][3] || new Date());
        sheet.getRange(i + 1, 5).setValue(new Date());
        return { success: true, message: "Tanda tangan berhasil diperbarui!" };
      }
    }
    sheet.appendRow([nik, finalSignatureUrl, pinHash, new Date(), new Date()]);
    return { success: true, message: "Tanda tangan berhasil didaftarkan!" };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function handleVerifySignature(nik, pin) {
  try {
    const sheet = getSheet("signatures_db");
    const data = sheet.getDataRange().getValues();
    const pinHash = hashSHA256(pin);
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(nik).trim()) {
        if (String(data[i][2]).trim() === pinHash) {
          return { success: true, signatureData: data[i][1], message: "Verifikasi berhasil!" };
        } else {
          return { success: false, message: "PIN Salah!" };
        }
      }
    }
    return { success: false, message: "Tanda tangan tidak ditemukan." };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// --- Helper Role & Hak Akses ---
// Role disimpan di sheet `user` kolom D, bisa berisi beberapa role dipisah
// koma / semicolon / pipa, mis. "auditor,auditee" (satu orang dua topi).
function parseRoles(raw) {
  return String(raw || '')
    .split(/[,;|]/)
    .map(function (s) { return s.trim().toLowerCase(); })
    .filter(function (s) { return !!s; });
}

// Cocokkan dua nama tanpa peduli huruf besar/kecil & spasi di ujung.
function sameName(a, b) {
  const x = String(a || '').trim().toLowerCase();
  const y = String(b || '').trim().toLowerCase();
  return !!x && x === y;
}

// Ambil data user dari sheet `user` berdasarkan NIK.
// INI sumber kebenaran role — bukan kiriman client (anti-spoofing).
function getUserByNik(nik) {
  if (!nik) return null;
  const sheet = getSheet("user");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(nik).trim()) {
      return {
        nik: String(data[i][0]).trim(),
        nama: String(data[i][2] || '').trim(),
        roles: parseRoles(data[i][3])
      };
    }
  }
  return null;
}

// "Topi" yang sedang dipakai user, tervalidasi terhadap role miliknya.
// Fallback aman: auditee bila itu satu-satunya role, selain itu auditor.
function resolveActiveRole(activeRole, roles) {
  const r = String(activeRole || '').trim().toLowerCase();
  if (r && roles.indexOf(r) > -1) return r;
  if (roles.indexOf('auditee') > -1 && roles.indexOf('auditor') === -1) return 'auditee';
  return 'auditor';
}

function isAdminUser(user) {
  return !!user && user.roles.indexOf('admin') > -1;
}

function toListItem(row) {
  return {
    id: row[0],
    tanggal: row[1],
    auditor: row[2],
    auditee: row[3],
    kategori: row[4],
    status: row[6],
    hasAuditorSign: !!row[7],
    hasAuditeeSign: !!row[8],
    departemen: row[10] || '-'
  };
}

// --- Handler API ---

function handleLogin(nik, password) {
  try {
    const userSheet = getSheet("user");
    if (!userSheet) return { success: false, message: "Sheet 'user' tidak ditemukan." };
    
    const inputNorm = normalizePasswordHash(password);
    const data = userSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(nik).trim()) {
        const stored = String(data[i][1]).trim();
        const storedNorm = normalizePasswordHash(stored);
        const ok = (storedNorm === inputNorm);
        if (ok) {
          // Auto-migrasi: jika masih plaintext, simpan sebagai hash agar
          // sheet user tidak lagi berisi password asli.
          if (!isSHA256Hash(stored)) {
            try { userSheet.getRange(i + 1, 2).setValue(storedNorm); } catch (e) {}
          }
          const role = data[i][3] ? String(data[i][3]).trim() : '';
          return { success: true, nama: String(data[i][2]).trim(), role: role, message: "Login Berhasil!" };
        }
        return { success: false, message: "NIK atau Password salah!" };
      }
    }
    return { success: false, message: "NIK atau Password salah!" };
  } catch (error) {
    return { success: false, message: "Error sistem: " + error.message };
  }
}

function handleGetChecklist(kategori, departemen) {
  // Template jarang berubah -> cache 10 menit per (kategori, departemen).
  const key = 'chk|' + String(kategori || '').toUpperCase() + '|' + String(departemen || '').toUpperCase();
  return cachedGet(key, CACHE_TTL.checklist, function () {
    return handleGetChecklistRaw(kategori, departemen);
  });
}

function handleGetChecklistRaw(kategori, departemen) {
  try {
    const sheet = getSheet("checklist_template");
    const data = sheet.getDataRange().getValues();
    let questions = [];
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim().toUpperCase() === kategori.toUpperCase()) {
        if (departemen && String(data[i][1]).trim().toUpperCase() !== departemen.toUpperCase()) {
            continue;
        }
        questions.push({
          no: data[i][2],
          type: data[i][3],
          kriteria: data[i][4],
          pertanyaan: data[i][5]
        });
      }
    }
    return { success: true, data: questions };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

function handleGetDepartemen(kategori) {
  // Daftar departemen jarang berubah -> cache 10 menit per kategori.
  const key = 'dept|' + String(kategori || '').toUpperCase();
  return cachedGet(key, CACHE_TTL.departemen, function () {
    return handleGetDepartemenRaw(kategori);
  });
}

function handleGetDepartemenRaw(kategori) {
  try {
    const sheet = getSheet("list_departemen");
    const data = sheet.getDataRange().getValues();
    let depts = [];
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1]).trim().toUpperCase() === kategori.toUpperCase()) {
        depts.push({
          id: data[i][0],
          nama: data[i][2]
        });
      }
    }
    
    return { success: true, data: depts };
  } catch(e) {
    return { success: false, message: e.message };
  }
}


function handleSaveData(formData, status) {
  try {
    // Self-audit dilarang: auditor tidak boleh mengaudit dirinya sendiri.
    if (sameName(formData.auditorName, formData.auditeeName)) {
      return {
        success: false,
        message: "Auditor dan Auditee tidak boleh orang yang sama (self-audit dilarang). Silakan pilih Auditee lain."
      };
    }
    const sheet = getSheet("data_pengamatan");
    let id = formData.id;
    let isUpdate = false;
    let rowIndex = -1;
    let existingData = [];
    if (id) {
      isUpdate = true;
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === id) {
          rowIndex = i + 1;
          existingData = data[i];
          break;
        }
      }
    } else {
      id = Utilities.getUuid();
    }
    
    let urlAuditor = formData.auditorSignature || (existingData[7] || "");
    let urlAuditee = formData.auditeeSignature || (existingData[8] || "");
    let hashIntegritas = existingData[9] || "";
    let savedDepartemen = formData.departemen || (existingData[10] || "-");
    let savedLampiran = formData.lampiran || (existingData[11] || "[]");

    // Proses lampiran: upload foto base64 ke Google Drive
    let lampiranArr = typeof savedLampiran === 'string' ? JSON.parse(savedLampiran || '[]') : (savedLampiran || []);
    const kategori = formData.kategori || 'Lainnya';
    lampiranArr = lampiranArr.map((item, idx) => {
      if (item.url && item.url.startsWith('data:image')) {
        const fileName = id + '_lampiran_' + (idx + 1) + '_' + new Date().getTime() + '.png';
        const uploaded = handleUploadPhoto(item.url, kategori, fileName);
        if (uploaded.success) {
          return { url: uploaded.url, fileId: uploaded.fileId, caption: item.caption || '', itemIndex: item.itemIndex !== undefined ? item.itemIndex : 0 };
        }
      }
      // Sudah berupa URL Drive, pertahankan
      return { url: item.url || '', fileId: item.fileId || '', caption: item.caption || '', itemIndex: item.itemIndex !== undefined ? item.itemIndex : 0 };
    });

    if (status === 'Submitted') {
       if (urlAuditor.startsWith('data:image')) {
         urlAuditor = saveImageToDrive(urlAuditor, id + "_auditor.png");
       }
       if (urlAuditee.startsWith('data:image')) {
         urlAuditee = saveImageToDrive(urlAuditee, id + "_auditee.png");
       }
       
       // Generate Hash Integritas Dokumen (Pasal 11 UU ITE)
       const documentDataString = JSON.stringify({
         id: id,
         auditor: formData.auditorName,
         auditee: formData.auditeeName,
         kategori: formData.kategori,
         checklist: formData.checklistData
       });
       hashIntegritas = hashSHA256(documentDataString);
       
       // Record Audit Trail
       logAuditTrail("SUBMIT_REPORT_SIGNED", formData.nik || "Unknown", formData.ipAddress, id, hashIntegritas);
    } else {
       logAuditTrail("SAVE_DRAFT", formData.nik || "Unknown", formData.ipAddress, id, "");
    }

    const rowData = [
      id,
      new Date(),
      formData.auditorName,
      formData.auditeeName,
      formData.kategori,
      JSON.stringify(formData.checklistData),
      status,
      urlAuditor,
      urlAuditee,
      hashIntegritas,
      savedDepartemen,
      JSON.stringify(lampiranArr)
    ];

    if (isUpdate && rowIndex > -1) {
      sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }

    // Data berubah -> buang cache baca (list/detail) agar tidak basi.
    bumpDataVersion();

    return { success: true, hash: hashIntegritas, message: `Data berhasil disimpan sebagai ${status}!` };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

// Daftar audit yang BOLEH dilihat user — difilter DI SERVER, bukan di browser:
//   admin    -> semua baris pada kategori tsb
//   auditor  -> hanya audit yang ia pegang (lihat SCOPE_AUDITOR_OWN_ONLY)
//   auditee  -> hanya audit di mana ia menjadi auditee
// Terima object: { nik, activeRole, kategori }.
function handleGetList(params) {
  params = params || {};
  // Cache 60 detik per (nik, role, kategori). Kunci memuat dataVersion()
  // sehingga setiap aksi tulis (bumpDataVersion) otomatis membuang cache lama.
  const key = 'list|' + dataVersion() + '|' +
    String(params.nik || '') + '|' +
    String(params.activeRole || '') + '|' +
    String(params.kategori || '');
  return cachedGet(key, CACHE_TTL.data, function () {
    return handleGetListRaw(params);
  });
}

function handleGetListRaw(params) {
  try {
    params = params || {};
    const kategori = params.kategori;

    // Kompatibilitas mundut: frontend lama masih mengirim { auditorName, kategori }
    // tanpa nik. Jangan sampai memutus akses saat masa transisi deploy.
    if (!params.nik) {
      return { success: true, data: legacyGetList(params.auditorName, kategori) };
    }

    const user = getUserByNik(params.nik);
    if (!user) {
      return { success: false, message: "User tidak ditemukan. Silakan login ulang." };
    }

    const admin = isAdminUser(user);
    const activeRole = resolveActiveRole(params.activeRole, user.roles);

    const sheet = getSheet("data_pengamatan");
    const data = sheet.getDataRange().getValues();
    let list = [];

    for (let i = 1; i < data.length; i++) {
      if (kategori && data[i][4] !== kategori) continue;

      if (!admin) {
        if (activeRole === 'auditee') {
          if (!sameName(data[i][3], user.nama)) continue;
        } else if (SCOPE_AUDITOR_OWN_ONLY) {
          if (!sameName(data[i][2], user.nama)) continue;
        }
      }

      list.push(toListItem(data[i]));
    }

    list.reverse();
    // activeRole dikembalikan agar frontend tahu "topi" yang benar-benar dipakai server.
    return { success: true, data: list, activeRole: activeRole, roles: user.roles };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

// Versi lama tanpa auth — hanya dipakai sebagai fallback kompatibilitas mundut.
function legacyGetList(auditorName, kategori) {
  const sheet = getSheet("data_pengamatan");
  const data = sheet.getDataRange().getValues();
  let list = [];
  for (let i = 1; i < data.length; i++) {
    if (kategori && data[i][4] !== kategori) continue;
    list.push(toListItem(data[i]));
  }
  list.reverse();
  return list;
}

// Hapus data: hanya auditor PEMILIK baris tsb atau Admin yang boleh.
function handleDeleteData(id, nik) {
  try {
    const sheet = getSheet("data_pengamatan");
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        // Cek kewenangan dulu sebelum menghapus (berlaku untuk frontend baru
        // yang mengirim nik; frontend lama tanpa nik tetap diperbolehkan).
        if (nik) {
          const user = getUserByNik(nik);
          if (!user) return { success: false, message: "User tidak ditemukan. Silakan login ulang." };
          if (!isAdminUser(user) && !sameName(data[i][2], user.nama)) {
            return { success: false, message: "Anda tidak berwenang menghapus audit ini." };
          }
        }
        const targetId = data[i][0];
        sheet.deleteRow(i + 1);
        logAuditTrail("DELETE_DATA", nik || "Unknown", "", targetId, "");
        bumpDataVersion(); // data berubah -> buang cache baca lama
        return { success: true, message: "Data berhasil dihapus!" };
      }
    }
    return { success: false, message: "Data tidak ditemukan." };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

function handleUpdateSignature(id, role, signatureData, nik, ipAddress, auditeeName = null) {
  try {
    const sheet = getSheet("data_pengamatan");
    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;
    let rowData = null;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        rowIndex = i + 1;
        rowData = data[i];
        break;
      }
    }
    
    if (rowIndex === -1) return { success: false, message: "Data tidak ditemukan." };

    // Self-audit dilarang: auditee yang akan ditandatangani tidak boleh
    // sama dengan auditor pada baris yang sama (segregation of duties).
    if (role === 'auditee' && auditeeName && sameName(auditeeName, rowData[2])) {
      return {
        success: false,
        message: "Tanda tangan Auditee ditolak: nama Auditee sama dengan Auditor. Self-audit tidak diizinkan."
      };
    }
    
    let url = signatureData;
    if (url.startsWith('data:image')) {
      url = saveImageToDrive(url, id + "_" + role + ".png");
    }
    
    if (role === 'auditor') {
      sheet.getRange(rowIndex, 8).setValue(url);
      rowData[7] = url;
    } else if (role === 'auditee') {
      sheet.getRange(rowIndex, 9).setValue(url);
      rowData[8] = url;
      if (auditeeName) {
         sheet.getRange(rowIndex, 4).setValue(auditeeName);
         rowData[3] = auditeeName;
      }
    }
    
    let status = rowData[6];
    let hashIntegritas = rowData[9];
    
    if (rowData[7] && rowData[8]) {
      status = 'Submitted';
      sheet.getRange(rowIndex, 7).setValue(status);
      
      const documentDataString = JSON.stringify({
        id: id,
        auditor: rowData[2],
        auditee: rowData[3],
        kategori: rowData[4],
        checklist: JSON.parse(rowData[5])
      });
      hashIntegritas = hashSHA256(documentDataString);
      sheet.getRange(rowIndex, 10).setValue(hashIntegritas);
      
      logAuditTrail("SUBMIT_REPORT_SIGNED", nik || "Unknown", ipAddress, id, hashIntegritas);
    }

    bumpDataVersion(); // data berubah -> buang cache baca lama
    return { success: true, status: status, hash: hashIntegritas, message: "Tanda tangan berhasil disimpan!" };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

function handleGetDetail(id) {
  // Cache 60 detik per id; ikut dataVersion agar segar setelah ada tulisan.
  const key = 'detail|' + dataVersion() + '|' + String(id || '');
  return cachedGet(key, CACHE_TTL.data, function () {
    return handleGetDetailRaw(id);
  });
}

function handleGetDetailRaw(id) {
  try {
    const sheet = getSheet("data_pengamatan");
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        return { 
          success: true, 
          data: {
            id: data[i][0],
            tanggal: data[i][1],
            auditorName: data[i][2],
            auditeeName: data[i][3],
            kategori: data[i][4],
            checklistData: JSON.parse(data[i][5]),
            status: data[i][6],
            auditorSignature: data[i][7],
            auditeeSignature: data[i][8],
            hashIntegritas: data[i][9],
            departemen: data[i][10] || '-',
            lampiran: (() => { try { return JSON.parse(data[i][11] || '[]'); } catch(e) { return []; } })(),
            capa: (() => { try { return JSON.parse(data[i][12] || '[]'); } catch(e) { return []; } })()
          }
        };
      }
    }
    return { success: false, message: "Data tidak ditemukan." };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

function handleSaveCapa(id, capaData) {
  try {
    const sheet = getSheet("data_pengamatan");
    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;
    let rowData = null;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        rowIndex = i + 1;
        rowData = data[i];
        break;
      }
    }
    if (rowIndex === -1) return { success: false, message: "Data tidak ditemukan." };

    const kategori = rowData[4] || 'Lainnya';
    const capaArr = (capaData || []).map((f) => {
      const photos = (f.photos || []).map((p) => {
        if (p.url && p.url.startsWith('data:image')) {
          const safeNC = String(f.nc || 'capa').replace(/\s+/g, '_').slice(0, 20);
          const fileName = id + '_capa_' + safeNC + '_' + new Date().getTime() + '.png';
          const uploaded = handleUploadPhoto(p.url, kategori, fileName);
          if (uploaded.success) {
            return { url: uploaded.url, fileId: uploaded.fileId, caption: p.caption || '' };
          }
        }
        return { url: p.url || '', fileId: p.fileId || '', caption: p.caption || '' };
      });
      return {
        nc: f.nc || '',
        klausul: f.klausul || '',
        correction: f.correction || '',
        indikasiPenyebab: f.indikasiPenyebab || '',
        correctiveAction: f.correctiveAction || '',
        targetSelesai: f.targetSelesai || '',
        photos: photos
      };
    });

    sheet.getRange(rowIndex, 13).setValue(JSON.stringify(capaArr));
    logAuditTrail("SAVE_CAPA", "Unknown", "", id, "");
    bumpDataVersion(); // data berubah -> buang cache baca lama
    return { success: true, message: "CAPA berhasil disimpan!" };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

function handleGetSignatureInfo(nik) {
  try {
    const sheet = getSheet("signatures_db");
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(nik).trim()) {
        return {
          success: true,
          exists: true,
          signatureUrl: data[i][1] || '',
          createdAt: data[i][3] ? new Date(data[i][3]).toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '-',
          updatedAt: data[i][4] ? new Date(data[i][4]).toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '-'
        };
      }
    }
    return { success: true, exists: false };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

function handleChangePassword(nik, oldPassword, newPassword) {
  try {
    const userSheet = getSheet("user");
    if (!userSheet) return { success: false, message: "Sheet 'user' tidak ditemukan." };
    
    const oldNorm = normalizePasswordHash(oldPassword);
    // Simpan SELALU sebagai hash SHA-256 ke sheet user kolom B.
    // normalize = idempoten: hash dari frontend disimpan apa adanya,
    // plaintext dari client lama di-hash dulu (tidak ada double-hash).
    const newNorm = normalizePasswordHash(newPassword);
    const data = userSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(nik).trim()) {
        const stored = String(data[i][1]).trim();
        const storedNorm = normalizePasswordHash(stored);
        const ok = (storedNorm === oldNorm);
        if (!ok) {
          return { success: false, message: "Password lama salah!" };
        }
        userSheet.getRange(i + 1, 2).setValue(newNorm);
        return { success: true, message: "Password berhasil diubah!" };
      }
    }
    return { success: false, message: "User tidak ditemukan." };
  } catch (error) {
    return { success: false, message: "Error sistem: " + error.message };
  }
}

// Migrasi satu-kali: ubah semua password plaintext di sheet user menjadi hash.
// Cara pakai: buka Apps Script > jalankan fungsi ini sekali (Run), lalu cek sheet user.
function migratePasswordsToHash() {
  const userSheet = getSheet("user");
  const data = userSheet.getDataRange().getValues();
  let migrated = 0;
  for (let i = 1; i < data.length; i++) {
    const stored = String(data[i][1] || '').trim();
    if (!stored || isSHA256Hash(stored)) continue;
    userSheet.getRange(i + 1, 2).setValue(hashPassword(stored));
    migrated++;
  }
  Logger.log('Migrasi selesai: ' + migrated + ' password diubah ke hash.');
  return migrated;
}

// Penanda versi backend — untuk memastikan deployment /exec sudah versi terbaru.
// Naikkan string ini setiap kali deploy. Cek via action "getVersion".
function handleGetVersion() {
  return cachedGet('version', CACHE_TTL.version, function () {
    return { success: true, version: "2026-11-19-cqa75-v1" };
  });
}

function handleFetchImages(fileIds) {
  try {
    var results = {};
    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return { success: true, images: results };
    }
    fileIds.forEach(function(id) {
      try {
        if (!id) return;
        var file = DriveApp.getFileById(String(id).trim());
        var blob = file.getBlob();
        var base64 = Utilities.base64Encode(blob.getBytes());
        var ct = blob.getContentType() || 'image/png';
        results[id] = 'data:' + ct + ';base64,' + base64;
      } catch(e) {
        Logger.log('[fetchImages] Gagal fetch id=' + id + ': ' + e.message);
        results[id] = '';
      }
    });
    return { success: true, images: results };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

/* ------------------------------------------------------------------------
 * CQA-75 — halaman tanda tangan Form CQA-75 (Confidential → /CQA-75)
 *
 * Alur:
 *   1. File .xlsx diambil dari Drive: FOLDER_ID/CQA-75/2026/Semester 2
 *      (lihat CQA75_FOLDER_PATH) — bukan upload user.
 *   2. Slot TADI diisi oleh user SENDIRI, dicocokkan lewat kolom E sheet
 *      "user" (Nama Tanda Tangan) — lihat handleFillCqa75.
 *   3. Gambar TTD diambil dari signatures_db (hasil menu Ganti Tanda Tangan);
 *      tidak ada alur menggambar baru di halaman ini.
 *   4. Export (ZIP/Excel/PDF) hanya ditampilkan untuk role=admin di frontend.
 *
 * State disimpan di sheet `cqa75_state` (1 baris per NIK) agar admin melihat
 * progres semua orang dari perangkatnya sendiri.
 * ---------------------------------------------------------------------- */

// Kunci nama versi frontend (normKey): lower-case + rapikan spasi.
function normNameKey(s) {
  return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

// Nama Tanda Tangan (kolom E) milik sebuah NIK. '' bila belum diatur.
function getUserNamaTtd(nik) {
  if (!nik) return '';
  const sheet = getSheet("user");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(nik).trim()) {
      return String(data[i][4] || '').trim();
    }
  }
  return '';
}

// nik -> url TTD terdaftar (hanya yang valid & bukan pesan error upload).
function loadCqa75Signatures() {
  const sheet = getSheet("signatures_db");
  const data = sheet.getDataRange().getValues();
  const map = {};
  for (let i = 1; i < data.length; i++) {
    const nik = String(data[i][0] || '').trim();
    const url = String(data[i][1] || '').trim();
    if (nik && url && !/^error/i.test(url)) map[nik] = url;
  }
  return map;
}

// Ekstrak ID file Drive dari URL thumbnail/link; '' bila bukan URL Drive.
function driveFileIdFromUrl(url) {
  const s = String(url || '');
  const m = /[?&]id=([a-zA-Z0-9_-]+)/.exec(s);
  return m ? m[1] : '';
}

// nik -> { filledAt } untuk yang sudah mengklik "Terapkan TTD".
function loadCqa75State() {
  const sheet = getSheet("cqa75_state");
  const data = sheet.getDataRange().getValues();
  const map = {};
  for (let i = 1; i < data.length; i++) {
    const nik = String(data[i][0] || '').trim();
    if (nik && String(data[i][2] || '').trim().toLowerCase() === 'filled') {
      map[nik] = { filledAt: data[i][3] || '' };
    }
  }
  return map;
}

// Upsert status filled per NIK (filled=false -> hapus barisnya).
function setCqa75Filled(nik, namaTtd, filled) {
  const sheet = getSheet("cqa75_state");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(nik).trim()) {
      if (filled) {
        sheet.getRange(i + 1, 1, 1, 4).setValues([[nik, namaTtd, 'filled', new Date()]]);
      } else {
        sheet.deleteRow(i + 1);
      }
      return;
    }
  }
  if (filled) sheet.appendRow([nik, namaTtd, 'filled', new Date()]);
}

// Folder sumber file CQA-75; null bila path belum ada di Drive.
function getCqa75Folder() {
  let folder = DriveApp.getFolderById(FOLDER_ID);
  for (let i = 0; i < CQA75_FOLDER_PATH.length; i++) {
    const it = folder.getFoldersByName(CQA75_FOLDER_PATH[i]);
    if (!it.hasNext()) return null;
    folder = it.next();
  }
  return folder;
}

/**
 * Meta halaman CQA-75 untuk satu user:
 *   me       — identitas + Nama Tanda Tangan + status TTD sendiri
 *   accounts — semua akun ber-kolom-E, untuk dicocokkan dengan nama di file.
 * Gambar TTD (sigUrl/sigFileId) HANYA dibocorkan untuk slot yang sudah
 * diisi + milik sendiri; sisanya hanya boolean hasSig.
 */
function handleGetCqa75Meta(nik) {
  try {
    const user = getUserByNik(nik);
    if (!user) return { success: false, message: "User tidak ditemukan. Silakan login ulang." };

    const sigMap = loadCqa75Signatures();
    const state = loadCqa75State();
    const namaTtd = getUserNamaTtd(nik);
    const myUrl = sigMap[nik] || '';
    const myState = state[nik];

    const me = {
      nik: user.nik,
      nama: user.nama,
      roles: user.roles,
      isAdmin: isAdminUser(user),
      namaTtd: namaTtd,
      hasSig: !!myUrl,
      sigUrl: myUrl,
      sigFileId: driveFileIdFromUrl(myUrl),
      filled: !!myState,
      filledAt: myState ? myState.filledAt : ''
    };

    // Daftar akun yang punya Nama Tanda Tangan (kolom E).
    const us = getSheet("user").getDataRange().getValues();
    const byKey = {};
    const accounts = [];
    for (let i = 1; i < us.length; i++) {
      const aNik = String(us[i][0] || '').trim();
      const aNama = String(us[i][2] || '').trim();
      const aTtd = String(us[i][4] || '').trim();
      if (!aNik || !aTtd) continue;
      const key = normNameKey(aTtd);
      const aUrl = sigMap[aNik] || '';
      const st = state[aNik];
      const isMe = aNik === user.nik;
      const entry = {
        nameKey: key,
        namaTtd: aTtd,
        nama: aNama,
        nik: aNik,
        hasSig: !!aUrl,
        filled: !!st,
        filledAt: st ? st.filledAt : '',
        sigUrl: (st || isMe) ? aUrl : '',
        sigFileId: (st || isMe) ? driveFileIdFromUrl(aUrl) : ''
      };
      // Nama_TTD kembar: yang punya TTD terdaftar lebih dulu diprioritaskan.
      if (byKey[key]) {
        if (entry.hasSig && !byKey[key].hasSig) {
          const idx = accounts.indexOf(byKey[key]);
          accounts[idx] = entry;
          byKey[key] = entry;
        }
        continue;
      }
      byKey[key] = entry;
      accounts.push(entry);
    }

    return {
      success: true,
      path: CQA75_FOLDER_PATH.join('/'),
      me: me,
      accounts: accounts
    };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// Semua file .xlsx di folder CQA-75, lengkap dengan isi base64-nya.
function handleGetCqa75Files() {
  try {
    const folder = getCqa75Folder();
    if (!folder) {
      return {
        success: false,
        message: "Folder tidak ditemukan: " + CQA75_FOLDER_PATH.join('/') +
          ". Buat folder tersebut di Drive (folder induk: Confidential)."
      };
    }
    const files = [];
    const it = folder.getFiles();
    while (it.hasNext()) {
      const f = it.next();
      const name = f.getName();
      if (!/\.xlsx?$/i.test(name)) continue;
      try {
        files.push({
          id: f.getId(),
          name: name,
          base64: Utilities.base64Encode(f.getBlob().getBytes())
        });
      } catch (e) {
        Logger.log('[cqa75] gagal membaca "' + name + '": ' + e.message);
      }
    }
    files.sort(function (a, b) { return a.name.localeCompare(b.name); });
    return { success: true, path: CQA75_FOLDER_PATH.join('/'), files: files };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// User mengklik "Terapkan TTD saya" — hanya untuk slot namanya sendiri.
function handleFillCqa75(nik) {
  try {
    const user = getUserByNik(nik);
    if (!user) return { success: false, message: "User tidak ditemukan. Silakan login ulang." };

    const namaTtd = getUserNamaTtd(nik);
    if (!namaTtd) {
      return {
        success: false,
        message: "Nama Tanda Tangan belum diatur di akun Anda. Hubungi admin untuk mengisi kolom \"Nama Tanda Tangan\"."
      };
    }
    const sigMap = loadCqa75Signatures();
    if (!sigMap[nik]) {
      return {
        success: false,
        message: "TTD Anda belum terdaftar. Daftarkan dulu lewat menu \"Ganti Tanda Tangan\"."
      };
    }

    setCqa75Filled(nik, namaTtd, true);
    logAuditTrail("CQA75_FILL", nik, "", namaTtd, "");
    bumpDataVersion();
    return { success: true, filled: true, namaTtd: namaTtd, message: "TTD diterapkan ke semua slot Anda." };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// Cabut TTD sendiri; admin juga boleh mencabut milik orang lain (koreksi).
function handleUnfillCqa75(nik, targetNik) {
  try {
    const user = getUserByNik(nik);
    if (!user) return { success: false, message: "User tidak ditemukan. Silakan login ulang." };
    const target = String(targetNik || nik).trim();
    if (target !== String(nik).trim() && !isAdminUser(user)) {
      return { success: false, message: "Hanya admin yang boleh mencabut TTD orang lain." };
    }
    if (!getUserByNik(target)) return { success: false, message: "User tidak ditemukan." };

    setCqa75Filled(target, '', false);
    logAuditTrail("CQA75_UNFILL", nik, "", target, "");
    bumpDataVersion();
    return { success: true, filled: false, message: "TTD dicabut." };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// --- POST Entry Point ---
function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    let result = {};
    
    switch (postData.action) {
      case "login":
        result = handleLogin(postData.nik, postData.password);
        break;
      case "registerSignature":
        result = handleRegisterSignature(postData.nik, postData.signatureData, postData.pin);
        break;
      case "verifySignature":
        result = handleVerifySignature(postData.nik, postData.pin);
        break;
      case "getChecklist":
        result = handleGetChecklist(postData.kategori, postData.departemen);
        break;
      case "getDepartemen":
        result = handleGetDepartemen(postData.kategori);
        break;
      case "saveDraft":
        result = handleSaveData(postData.formData, "Draft");
        break;
      case "submitFinal":
        result = handleSaveData(postData.formData, "Submitted");
        break;
      case "getList":
        result = handleGetList(postData);
        break;
      case "getDetail":
        result = handleGetDetail(postData.id);
        break;
      case "saveCapa":
        result = handleSaveCapa(postData.id, postData.capaData);
        break;
      case "deleteData":
        result = handleDeleteData(postData.id, postData.nik);
        break;
      case "updateSignature":
        result = handleUpdateSignature(postData.id, postData.role, postData.signatureData, postData.nik, postData.ipAddress, postData.auditeeName);
        break;
      case "uploadPhoto":
        result = handleUploadPhoto(postData.base64Data, postData.kategori, postData.filename);
        break;
      case "deletePhoto":
        result = handleDeletePhoto(postData.fileId);
        break;
      case "getSignatureInfo":
        result = handleGetSignatureInfo(postData.nik);
        break;
      case "fetchImages":
        result = handleFetchImages(postData.fileIds);
        break;
      case "changePassword":
        result = handleChangePassword(postData.nik, postData.oldPassword, postData.newPassword);
        break;
      case "getVersion":
        result = handleGetVersion();
        break;
      case "getCqa75Meta":
        result = handleGetCqa75Meta(postData.nik);
        break;
      case "getCqa75Files":
        result = handleGetCqa75Files();
        break;
      case "fillCqa75":
        result = handleFillCqa75(postData.nik);
        break;
      case "unfillCqa75":
        result = handleUnfillCqa75(postData.nik, postData.targetNik);
        break;
      default:
        result = { success: false, message: "Action tidak dikenal." };
    }
    
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: error.message })).setMimeType(ContentService.MimeType.JSON);
  }
}