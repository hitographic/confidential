import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { AuditProvider } from './context/AuditContext'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import CategoryPage from './pages/CategoryPage'
import ListPage from './pages/ListPage'
import FormPage from './pages/FormPage'

function Shell() {
  const loc = useLocation()
  const isLogin = loc.pathname === '/login'
  return (
    <>
      {!isLogin && <Navbar />}
      <div className="container">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/kategori" element={<ProtectedRoute><CategoryPage /></ProtectedRoute>} />
          <Route path="/list/:kategori" element={<ProtectedRoute><ListPage /></ProtectedRoute>} />
          <Route path="/form" element={<ProtectedRoute><FormPage /></ProtectedRoute>} />
          <Route path="/" element={<Navigate to="/kategori" replace />} />
          <Route path="*" element={<Navigate to="/kategori" replace />} />
        </Routes>
      </div>
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AuditProvider>
        <HashRouter>
          <Shell />
        </HashRouter>
      </AuditProvider>
    </AuthProvider>
  )
}
