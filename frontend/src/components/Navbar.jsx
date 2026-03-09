import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'

export default function Navbar() {
  const { user, logout } = useAuth()
  const { tr } = useLang()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        <svg className="logo-icon" viewBox="0 0 24 24" fill="none">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <polyline points="17 8 12 3 7 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M7 15h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <span className="logo-text">ToFilePath</span>
      </Link>

      <div className="navbar-tagline">{tr('nav.tagline')}</div>

      <div className="navbar-auth">
        {user ? (
          <>
            <Link to="/storage" className="navbar-storage-btn">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
                <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              {tr('nav.myStorage')}
            </Link>
            <button className="navbar-avatar" onClick={() => navigate('/settings')} title={`${tr('nav.signedInAs')} ${user.username} — ${tr('storage.settings')}`}>
              {user.username[0].toUpperCase()}
            </button>
          </>
        ) : (
          <Link to="/login" className="btn btn-primary navbar-login-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="10 17 15 12 10 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="15" y1="12" x2="3" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {tr('nav.signIn')}
          </Link>
        )}
      </div>
    </nav>
  )
}
