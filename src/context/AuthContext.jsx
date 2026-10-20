import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { gasApi } from '../api/gasClient'
import { defaultActiveRole, parseRoles } from '../utils/roles'

const AuthContext = createContext(null)
const SESSION_KEY = 'matrika_user'
const ACTIVE_ROLE_KEY = 'matrika_active_role'

/**
 * Sesi login + "topi" aktif (role mode).
 *
 * Satu user boleh punya LEBIH DARI SATU role, mis. "auditor,auditee".
 * Karena itu selain `roles` (daftar milik user), disimpan juga `activeRole`
 * = topi yang sedang dipakai, dan bisa diganti lewat Navbar (role switcher).
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })
  const [activeRoleRaw, setActiveRoleRaw] = useState(() => {
    try {
      return sessionStorage.getItem(ACTIVE_ROLE_KEY) || ''
    } catch {
      return ''
    }
  })
  const [ipAddress, setIpAddress] = useState('Unknown')

  useEffect(() => {
    fetch('https://api.ipify.org?format=json')
      .then((r) => r.json())
      .then((d) => setIpAddress(d.ip))
      .catch(() => {})
  }, [])

  // Daftar role milik user — divalidasi ulang terhadap role aktif di bawah,
  // sehingga "topi" yang tersisa di sessionStorage tidak bisa dipakai sewenang-wenang.
  const roles = useMemo(() => (user ? parseRoles(user.role) : []), [user])

  const isAdmin = roles.includes('admin')
  const isAuditor = isAdmin || roles.includes('auditor')
  const isAuditee = roles.includes('auditee')

  // "Topi" aktif, tervalidasi: harus benar-benar milik user.
  const activeRole = useMemo(() => {
    if (activeRoleRaw && roles.includes(activeRoleRaw)) return activeRoleRaw
    return defaultActiveRole(roles)
  }, [activeRoleRaw, roles])

  // User role ganda (Auditor + Auditee, non-admin) diminta memilih "topi"
  // lewat halaman /pilih-role sebelum masuk aplikasi.
  const hasMultipleRoles = !isAdmin && isAuditor && isAuditee

  // Dianggap sudah memilih jika: role tunggal (otomatis, tak perlu ditanya)
  // atau ada pilihan tersimpan yang benar-benar milik user tsb.
  const hasChosenRole = !hasMultipleRoles || (activeRoleRaw !== '' && roles.includes(activeRoleRaw))

  const hasRole = (r) => roles.includes(String(r || '').toLowerCase())

  const setActiveRole = (r) => {
    const next = String(r || '').toLowerCase()
    if (!roles.includes(next)) return
    setActiveRoleRaw(next)
    try {
      sessionStorage.setItem(ACTIVE_ROLE_KEY, next)
    } catch {}
  }

  const login = async (nik, password) => {
    const res = await gasApi.login(nik, password)
    if (res.success) {
      const next = { nik, nama: res.nama, role: res.role }
      setUser(next)
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(next))
      // Reset "topi" aktif sesuai role user yang baru login.
      const def = defaultActiveRole(parseRoles(res.role))
      setActiveRoleRaw(def)
      try {
        sessionStorage.setItem(ACTIVE_ROLE_KEY, def)
      } catch {}
    }
    return res
  }

  const logout = () => {
    sessionStorage.removeItem(SESSION_KEY)
    sessionStorage.removeItem(ACTIVE_ROLE_KEY)
    sessionStorage.removeItem('matrika_state')
    sessionStorage.removeItem('matrika_autosave')
    setUser(null)
    setActiveRoleRaw('')
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        login,
        logout,
        roles,
        activeRole,
        setActiveRole,
        hasRole,
        hasMultipleRoles,
        hasChosenRole,
        isAdmin,
        isAuditor,
        isAuditee,
        ipAddress,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth harus di dalam <AuthProvider>')
  return ctx
}
