import { useState, useMemo, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePendingUpload } from '../context/UploadContext'

/* ── Mini floating particles (reused from Home) ── */
function AuthParticles() {
  const particles = useMemo(() => (
    Array.from({ length: 14 }, (_, i) => ({
      id: i,
      left:     `${Math.floor(Math.random() * 100)}%`,
      size:     `${2 + Math.random() * 3}px`,
      duration: `${8 + Math.random() * 12}s`,
      delay:    `${Math.random() * -14}s`,
      opacity:  0.25 + Math.random() * 0.35,
    }))
  ), [])
  return (
    <div className="particles-wrap" aria-hidden>
      {particles.map(p => (
        <span key={p.id} className="particle" style={{
          left: p.left, width: p.size, height: p.size,
          animationDuration: p.duration, animationDelay: p.delay, opacity: p.opacity,
        }} />
      ))}
    </div>
  )
}

export default function Auth() {
  const { login, register, user, loading } = useAuth()
  const { pendingFile } = usePendingUpload()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [mode, setMode] = useState(() => searchParams.get('mode') === 'register' ? 'register' : 'login')
  const [animKey, setAnimKey] = useState(0)

  const [username, setUsername] = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [error, setError]       = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) navigate('/storage', { replace: true })
  }, [user, loading, navigate])

  const switchMode = (m) => {
    setMode(m)
    setError('')
    setAnimKey(k => k + 1)
    setUsername('')
    setEmail('')
    setPassword('')
    setConfirm('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (mode === 'register') {
      if (password !== confirm) { setError('Passwords do not match'); return }
      if (password.length < 6)  { setError('Password must be at least 6 characters'); return }
    }

    setSubmitting(true)
    try {
      if (mode === 'login') {
        await login(username, password)
        navigate(pendingFile ? '/storage' : '/storage', { state: pendingFile ? { pendingUpload: true } : undefined })
      } else {
        await register(username, email, password)
        navigate('/storage', { state: pendingFile ? { pendingUpload: true } : undefined })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return null

  return (
    <div className="auth-page">
      <AuthParticles />
      <div className="hero-grid" aria-hidden />
      <div className="hero-scan-line" aria-hidden />

      <div className="auth-card" key={animKey}>
        {/* Logo */}
        <div className="auth-logo">
          <svg className="auth-logo-icon" viewBox="0 0 24 24" fill="none">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <polyline points="17 8 12 3 7 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <Link to="/" className="auth-logo-text">ToFilePath</Link>
        </div>

        {/* Tab switcher */}
        <div className="auth-tabs">
          <button
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => switchMode('login')}
          >Sign In</button>
          <button
            className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => switchMode('register')}
          >Create Account</button>
          <div className="auth-tab-indicator" style={{ transform: `translateX(${mode === 'register' ? '100%' : '0'})` }} />
        </div>

        {/* Heading */}
        <div className="auth-heading">
          {mode === 'login' ? (
            <>
              <h2>Welcome back</h2>
              <p>Sign in to access your personal storage</p>
            </>
          ) : (
            <>
              <h2>Create your account</h2>
              <p>Get 5&nbsp;GB of secure personal storage — free</p>
            </>
          )}
        </div>

        {/* Form */}
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label>Username{mode === 'login' ? ' or email' : ''}</label>
            <div className="auth-input-wrap">
              <svg className="field-icon" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2"/>
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <input
                type="text"
                placeholder={mode === 'login' ? 'username or email' : 'choose a username'}
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoComplete="username"
                autoFocus
              />
            </div>
          </div>

          {mode === 'register' && (
            <div className="auth-field">
              <label>Email</label>
              <div className="auth-input-wrap">
                <svg className="field-icon" viewBox="0 0 24 24" fill="none">
                  <rect x="2" y="4" width="20" height="16" rx="3" stroke="currentColor" strokeWidth="2"/>
                  <path d="M2 8l10 7 10-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>
          )}

          <div className="auth-field">
            <label>Password</label>
            <div className="auth-input-wrap">
              <svg className="field-icon" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2"/>
                <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <input
                type="password"
                placeholder={mode === 'login' ? '••••••••' : 'at least 6 characters'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>
          </div>

          {mode === 'register' && (
            <div className="auth-field">
              <label>Confirm password</label>
              <div className="auth-input-wrap">
                <svg className="field-icon" viewBox="0 0 24 24" fill="none">
                  <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
            </div>
          )}

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="btn btn-primary btn-full auth-submit" disabled={submitting}>
            {submitting ? (
              <><span className="spinner" /> {mode === 'login' ? 'Signing in…' : 'Creating account…'}</>
            ) : (
              mode === 'login' ? 'Sign In' : 'Create Account'
            )}
          </button>
        </form>

        {/* Footer toggle */}
        <p className="auth-switch">
          {mode === 'login' ? (
            <>No account? <button className="auth-switch-btn" onClick={() => switchMode('register')}>Sign up free</button></>
          ) : (
            <>Already registered? <button className="auth-switch-btn" onClick={() => switchMode('login')}>Sign in</button></>
          )}
        </p>
      </div>
    </div>
  )
}
