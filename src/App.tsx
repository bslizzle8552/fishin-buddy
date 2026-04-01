import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import BottomNav from './components/BottomNav'
import LoginPage from './pages/LoginPage'
import MapPage from './pages/MapPage'
import LogCatchPage from './pages/LogCatchPage'
import TimelinePage from './pages/TimelinePage'
import LuresPage from './pages/LuresPage'
import SpotDetailPage from './pages/SpotDetailPage'

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[var(--color-bg)]">
        <div className="flex flex-col items-center gap-3">
          <div className="text-4xl">🎣</div>
          <div className="w-8 h-8 border-3 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/map" element={<MapPage />} />
          <Route path="/log" element={<LogCatchPage />} />
          <Route path="/timeline" element={<TimelinePage />} />
          <Route path="/lures" element={<LuresPage />} />
          <Route path="/spot/:spotId" element={<SpotDetailPage />} />
          <Route path="*" element={<Navigate to="/map" replace />} />
        </Routes>
      </div>
      <BottomNav />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
