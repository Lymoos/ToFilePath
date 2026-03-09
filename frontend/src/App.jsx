import { Routes, Route, Outlet } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { LangProvider } from './context/LanguageContext'
import { UploadProvider } from './context/UploadContext'
import Navbar from './components/Navbar'
import AuthGuard from './components/AuthGuard'
import Home from './pages/Home'
import Download from './pages/Download'
import Auth from './pages/Auth'
import Storage from './pages/Storage'
import Settings from './pages/Settings'

// Layout for public pages (home, download)
function MainLayout() {
  return (
    <div className="app">
      <Navbar />
      <main className="main-content">
        <Outlet />
      </main>
      <footer className="footer">
        <p>ToFilePath &copy; {new Date().getFullYear()} &mdash; Files are automatically deleted after expiry</p>
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <UploadProvider>
      <LangProvider>
        <Routes>
          {/* Auth page — full screen, no navbar */}
          <Route path="/login" element={<Auth />} />

          {/* Storage dashboard — full screen, own layout */}
          <Route
            path="/storage"
            element={<AuthGuard><Storage /></AuthGuard>}
          />

          {/* Settings — full screen, own layout */}
          <Route
            path="/settings"
            element={<AuthGuard><Settings /></AuthGuard>}
          />

          {/* Public pages with Navbar + footer */}
          <Route element={<MainLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/:code" element={<Download />} />
          </Route>
        </Routes>
      </LangProvider>
      </UploadProvider>
    </AuthProvider>
  )
}
