import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Gerbang route.
 * - Selalu butuh login.
 * - Kecuali requireRole=false, juga butuh "topi" (role mode) sudah dipilih.
 *   User role ganda yang belum memilih akan diarahkan ke /pilih-role.
 */
export default function ProtectedRoute({ children, requireRole = true }) {
  const { user, hasChosenRole } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (requireRole && !hasChosenRole) return <Navigate to="/pilih-role" replace />
  return children
}
