import { createContext, useCallback, useContext, useMemo, useState } from 'react'

/**
 * State audit aktif (kategori / auditee / dept / editId / questions).
 * Pengganti variabel global currentCategory/currentAuditee/... di Index.html,
 * + persist ke sessionStorage agar refresh tidak hilang (saveSessionState).
 */
const AuditContext = createContext(null)
const STATE_KEY = 'matrika_state'

function loadInitial() {
  try {
    const raw = sessionStorage.getItem(STATE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { category: '', auditee: '', dept: '', editId: null, questions: [] }
}

function persist(s) {
  try {
    sessionStorage.setItem(
      STATE_KEY,
      JSON.stringify({
        currentCategory: s.category,
        currentAuditee: s.auditee,
        currentDept: s.dept,
        currentEditId: s.editId,
        currentQuestions: s.questions,
      })
    )
  } catch {}
}

export function AuditProvider({ children }) {
  const [state, setState] = useState(() => {
    const raw = loadInitial()
    // dukung format lama (currentCategory) maupun baru (category)
    return {
      category: raw.category ?? raw.currentCategory ?? '',
      auditee: raw.auditee ?? raw.currentAuditee ?? '',
      dept: raw.dept ?? raw.currentDept ?? '',
      editId: raw.editId ?? raw.currentEditId ?? null,
      questions: raw.questions ?? raw.currentQuestions ?? [],
    }
  })

  // Stabil (useCallback) + bail-out jika tidak ada perubahan,
  // agar aman dipakai di dependency useEffect tanpa infinite loop.
  const patch = useCallback((p) => {
    setState((prev) => {
      const next = { ...prev, ...p }
      const changed = Object.keys(p).some((k) => prev[k] !== next[k])
      if (!changed) return prev
      persist(next)
      return next
    })
  }, [])

  const resetForm = useCallback(() => {
    try { sessionStorage.removeItem('matrika_autosave') } catch {}
    setState((prev) => {
      const next = { ...prev, auditee: '(Menunggu TTD)', editId: null, questions: [] }
      persist(next)
      return next
    })
  }, [])

  const value = useMemo(
    () => ({ ...state, setAudit: patch, resetForm }),
    [state, patch, resetForm]
  )

  return (
    <AuditContext.Provider value={value}>
      {children}
    </AuditContext.Provider>
  )
}

export function useAudit() {
  const ctx = useContext(AuditContext)
  if (!ctx) throw new Error('useAudit harus di dalam <AuditProvider>')
  return ctx
}
