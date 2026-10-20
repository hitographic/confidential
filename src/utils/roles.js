/**
 * Helper role / hak akses.
 *
 * Role disimpan di sheet `user` kolom D sebagai string yang bisa berisi
 * LEBIH DARI SATU role dipisah koma / semicolon / pipa, mis. "auditor,auditee".
 * Jadi satu orang boleh memakai dua "topi": Auditor dan Auditee.
 *
 * Sumber kebenaran role = server (sheet `user`), bukan kiriman client.
 * Lihat getUserByNik() di backend/Code.gs.
 */

/** "auditor,auditee" -> ['auditor', 'auditee'] */
export function parseRoles(raw) {
  return String(raw || '')
    .split(/[,;|]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

/** Cocokkan dua nama tanpa peduli huruf besar/kecil & spasi di ujung. */
export function sameName(a, b) {
  const x = String(a || '').trim().toLowerCase()
  const y = String(b || '').trim().toLowerCase()
  return !!x && x === y
}

/**
 * "Topi" yang dipakai saat login.
 * Auditee murni -> auditee; selain itu (termasuk dual-role & admin) -> auditor.
 */
export function defaultActiveRole(roles) {
  const rs = Array.isArray(roles) ? roles : parseRoles(roles)
  if (rs.includes('auditee') && !rs.includes('auditor')) return 'auditee'
  return 'auditor'
}
