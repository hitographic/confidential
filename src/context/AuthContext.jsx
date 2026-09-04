import { createContext, useContext, useEffect, useState } from 'react'
import { gasApi } from '../api/gasClient'

const AuthContext = createContext(null)
const SESSION_KEY = 'matrika_user'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })
  const [ipAddress, setIpAddress] = useState('Unknown')

  useEffect(() => {
    fetch('https://api.ipify.org?format=json')
      .then((r) => r.json())
      .then((d) => setIpAddress(d.ip))
      .catch(() => {})
  }, [])

  const login = async (nik, password) => {
    const res = await gasApi.login(nik, password)
    if (res.success) {
      const next = { nik, nama: res.nama, role: res.role }
      setUser(next)
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(next))
    }
    return res
  }

  const logout = () => {
    sessionStorage.removeItem(SESSION_KEY)
    sessionStorage.removeItem('matrika_state')
    sessionStorage.removeItem('matrika_autosave')
    setUser(null)
  }

  const isAdmin = !!user?.role && String(user.role).toLowerCase() === 'admin'

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, isAdmin, ipAddress }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth harus di dalam <AuthProvider>')
  return ctx
}
