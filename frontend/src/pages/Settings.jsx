import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang, ACCENT_COLORS, applyAccent } from '../context/LanguageContext'

function formatBytes(b) {
  if (!b) return '0 B'
  const k = 1024, s = ['B','KB','MB','GB','TB']
  const i = Math.floor(Math.log(b) / Math.log(k))
  return `${parseFloat((b / Math.pow(k, i)).toFixed(1))} ${s[i]}`
}

// ── Reusable Field ────────────────────────────────────────────────────────────
function Field({ label, type = 'text', value, onChange, placeholder, preventAutofill }) {
  const [isReadOnly, setIsReadOnly] = useState(preventAutofill === true)
  return (
    <div className="sfield">
      <label className="sfield-label">{label}</label>
      <div className="auth-input-wrap">
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={preventAutofill ? 'one-time-code' : 'off'}
          readOnly={isReadOnly}
          onFocus={() => preventAutofill && setIsReadOnly(false)}
          className="sfield-input"
        />
      </div>
    </div>
  )
}

// ── Status pill ───────────────────────────────────────────────────────────────
function Status({ state }) {
  if (!state) return null
  const isErr = state.startsWith('!')
  return (
    <span className={`status-pill ${isErr ? 'error' : 'success'}`}>
      {isErr ? state.slice(1) : state}
    </span>
  )
}

// ── Section card ──────────────────────────────────────────────────────────────
function SCard({ title, children }) {
  return (
    <div className="settings-card">
      <h3 className="settings-card-title">{title}</h3>
      {children}
    </div>
  )
}

// ── Toggle ────────────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, label, desc }) {
  return (
    <label className="toggle-row">
      <div className="toggle-info">
        <span className="toggle-label">{label}</span>
        {desc && <span className="toggle-desc">{desc}</span>}
      </div>
      <div className={`toggle-switch ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
        <div className="toggle-knob" />
      </div>
    </label>
  )
}

// ── TABS ──────────────────────────────────────────────────────────────────────
const TABS = ['account', 'appearance', 'security', 'admin']

export default function Settings() {
  const { user, token, logout, refreshUser } = useAuth()
  const { lang, changeLang, tr } = useLang()
  const navigate = useNavigate()

  const [tab, setTab] = useState('account')
  const [stats, setStats] = useState(null)
  const [adminData, setAdminData] = useState(null)
  const [anonFiles, setAnonFiles] = useState(null)
  const [deletingCode, setDeletingCode] = useState(null)

  // Account fields
  const [newEmail, setNewEmail]         = useState('')
  const [emailPass, setEmailPass]       = useState('')
  const [emailStatus, setEmailStatus]   = useState(null)

  // Security fields
  const [oldPass, setOldPass]           = useState('')
  const [newPass, setNewPass]           = useState('')
  const [confirmPass, setConfirmPass]   = useState('')
  const [passStatus, setPassStatus]     = useState(null)
  const [deletePass, setDeletePass]     = useState('')
  const [deleteStatus, setDeleteStatus] = useState(null)
  const [showDelete, setShowDelete]     = useState(false)

  // Appearance
  const [accent, setAccent]     = useState(() => localStorage.getItem('tfp_accent') || 'green')
  const [compact, setCompact]   = useState(() => localStorage.getItem('tfp_compact') === '1')
  const [noAnim, setNoAnim]     = useState(() => localStorage.getItem('tfp_noanim') === '1')

  useEffect(() => {
    if (!token) return
    fetch('/api/storage/stats', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setStats).catch(() => {})
  }, [token])

  useEffect(() => {
    if (tab === 'admin' && user?.isAdmin && !adminData) {
      fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(setAdminData).catch(() => {})
    }
    if (tab === 'admin' && user?.isAdmin && !anonFiles) {
      fetch('/api/admin/files', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(setAnonFiles).catch(() => {})
    }
  }, [tab, user, token, adminData, anonFiles])

  const deleteAnonFile = async (code) => {
    setDeletingCode(code)
    await fetch(`/api/admin/files/${code}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    setAnonFiles(prev => prev ? prev.filter(f => f.shortCode !== code) : prev)
    setAdminData(prev => prev ? { ...prev, anonFiles: (prev.anonFiles || 1) - 1 } : prev)
    setDeletingCode(null)
  }

  // Apply compact / no-anim globally
  useEffect(() => {
    document.documentElement.classList.toggle('compact', compact)
    localStorage.setItem('tfp_compact', compact ? '1' : '0')
  }, [compact])

  useEffect(() => {
    document.documentElement.classList.toggle('no-anim', noAnim)
    localStorage.setItem('tfp_noanim', noAnim ? '1' : '0')
  }, [noAnim])

  const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const changeEmail = async (e) => {
    e.preventDefault()
    setEmailStatus(null)
    const res = await fetch('/api/auth/change-email', {
      method: 'PUT', headers: authHeaders,
      body: JSON.stringify({ email: newEmail, password: emailPass }),
    })
    const d = await res.json()
    if (!res.ok) { setEmailStatus('!' + (d.error || 'Failed')); return }
    setEmailStatus(tr('misc.saved'))
    setNewEmail(''); setEmailPass('')
    refreshUser()
  }

  const changePassword = async (e) => {
    e.preventDefault()
    setPassStatus(null)
    if (newPass !== confirmPass) { setPassStatus('!' + 'Passwords do not match'); return }
    const res = await fetch('/api/auth/change-password', {
      method: 'PUT', headers: authHeaders,
      body: JSON.stringify({ oldPassword: oldPass, newPassword: newPass }),
    })
    const d = await res.json()
    if (!res.ok) { setPassStatus('!' + (d.error || 'Failed')); return }
    setPassStatus(tr('misc.saved'))
    setOldPass(''); setNewPass(''); setConfirmPass('')
  }

  const deleteAccount = async (e) => {
    e.preventDefault()
    setDeleteStatus(null)
    const res = await fetch('/api/auth/account', {
      method: 'DELETE', headers: authHeaders,
      body: JSON.stringify({ password: deletePass }),
    })
    const d = await res.json()
    if (!res.ok) { setDeleteStatus('!' + (d.error || 'Failed')); return }
    await logout()
    navigate('/')
  }

  const handleAccent = (name) => {
    setAccent(name)
    applyAccent(name)
  }

  const visibleTabs = TABS.filter(t => t !== 'admin' || user?.isAdmin)

  return (
    <div className="settings-layout">
      {/* Sidebar */}
      <aside className="settings-sidebar">
        <Link to="/storage" className="settings-back">{tr('settings.backToStorage')}</Link>

        {/* Profile card */}
        <div className="settings-profile">
          <div className="sidebar-avatar settings-avatar">
            {user?.username?.[0]?.toUpperCase()}
          </div>
          <div>
            <div className="sidebar-username">{user?.username}</div>
            <div className="sidebar-email">{user?.email || '—'}</div>
            {user?.isAdmin && <span className="admin-badge">Admin</span>}
          </div>
        </div>

        {/* Tabs */}
        <nav className="settings-tabs">
          {visibleTabs.map(t => (
            <button
              key={t}
              className={`settings-tab-btn ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'account'    && <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>}
              {t === 'appearance' && <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>}
              {t === 'security'   && <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              {t === 'admin'      && <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/><rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/><rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/><rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/></svg>}
              {tr(`settings.${t}`)}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <div className="settings-main">
        <div className="settings-header">
          <h1 className="settings-title">{tr('settings.title')}</h1>
        </div>

        <div className="settings-content">

          {/* ── ACCOUNT TAB ── */}
          {tab === 'account' && (
            <div className="settings-tab-content">
              <SCard title={tr('settings.storageUsage')}>
                {stats ? (
                  <>
                    <div className="stat-grid-2">
                      <div className="mini-stat">
                        <div className="mini-stat-val">{formatBytes(stats.storageUsed)}</div>
                        <div className="mini-stat-label">{tr('settings.storageUsage')}</div>
                      </div>
                      <div className="mini-stat">
                        <div className="mini-stat-val">{stats.fileCount}</div>
                        <div className="mini-stat-label">{tr('settings.fileCount')}</div>
                      </div>
                      <div className="mini-stat">
                        <div className="mini-stat-val">{stats.dirCount}</div>
                        <div className="mini-stat-label">{tr('settings.folderCount')}</div>
                      </div>
                      <div className="mini-stat">
                        <div className="mini-stat-val">{formatBytes(stats.storageLimit)}</div>
                        <div className="mini-stat-label">Limit</div>
                      </div>
                    </div>
                    <div className="storage-bar-wrap" style={{ marginTop: '1rem' }}>
                      <div className="storage-bar-track">
                        <div className="storage-bar-fill" style={{
                          width: `${Math.min(100, stats.storageLimit > 0 ? (stats.storageUsed / stats.storageLimit) * 100 : 0)}%`,
                          background: 'var(--green)'
                        }} />
                      </div>
                    </div>
                  </>
                ) : <div className="settings-loading" />}
              </SCard>

              <SCard title={tr('settings.changeEmail')}>
                <form onSubmit={changeEmail} className="sform">
                  <Field
                    label={tr('settings.newEmail')}
                    type="email"
                    value={newEmail}
                    onChange={setNewEmail}
                    placeholder="new@email.com"
                    preventAutofill
                  />
                  <Field
                    label={tr('settings.passwordForConfirm')}
                    type="password"
                    value={emailPass}
                    onChange={setEmailPass}
                    placeholder="••••••••"
                    preventAutofill
                  />
                  <div className="sform-footer">
                    <button type="submit" className="btn btn-primary btn-sm">{tr('settings.saveEmail')}</button>
                    <Status state={emailStatus} />
                  </div>
                </form>
              </SCard>
            </div>
          )}

          {/* ── APPEARANCE TAB ── */}
          {tab === 'appearance' && (
            <div className="settings-tab-content">
              <SCard title={tr('settings.language')}>
                <div className="lang-options">
                  {['en', 'ru'].map(l => (
                    <button
                      key={l}
                      className={`lang-btn ${lang === l ? 'active' : ''}`}
                      onClick={() => changeLang(l)}
                    >
                      <span className="lang-flag">{l === 'en' ? '🇬🇧' : '🇷🇺'}</span>
                      {tr(`settings.lang${l === 'en' ? 'En' : 'Ru'}`)}
                    </button>
                  ))}
                </div>
              </SCard>

              <SCard title={tr('settings.accentColor')}>
                <div className="accent-options">
                  {ACCENT_COLORS.map(c => (
                    <button
                      key={c.name}
                      className={`accent-dot ${accent === c.name ? 'active' : ''}`}
                      style={{ '--dot-color': c.value }}
                      onClick={() => handleAccent(c.name)}
                      title={c.name}
                    />
                  ))}
                </div>
              </SCard>

              <SCard title="Interface">
                <div className="toggles-list">
                  <Toggle
                    checked={compact}
                    onChange={setCompact}
                    label={tr('settings.compactMode')}
                    desc={tr('settings.compactDesc')}
                  />
                  <Toggle
                    checked={noAnim}
                    onChange={setNoAnim}
                    label={tr('settings.animationsOff')}
                    desc={tr('settings.animationsDesc')}
                  />
                </div>
              </SCard>
            </div>
          )}

          {/* ── SECURITY TAB ── */}
          {tab === 'security' && (
            <div className="settings-tab-content">
              <SCard title={tr('settings.changePassword')}>
                <form onSubmit={changePassword} className="sform">
                  <Field
                    label={tr('settings.oldPassword')}
                    type="password"
                    value={oldPass}
                    onChange={setOldPass}
                    placeholder="••••••••"
                    preventAutofill
                  />
                  <Field
                    label={tr('settings.newPassword')}
                    type="password"
                    value={newPass}
                    onChange={setNewPass}
                    placeholder="at least 6 chars"
                    preventAutofill
                  />
                  <Field
                    label={tr('settings.confirmNewPassword')}
                    type="password"
                    value={confirmPass}
                    onChange={setConfirmPass}
                    placeholder="••••••••"
                    preventAutofill
                  />
                  <div className="sform-footer">
                    <button type="submit" className="btn btn-primary btn-sm">{tr('settings.savePassword')}</button>
                    <Status state={passStatus} />
                  </div>
                </form>
              </SCard>

              <SCard title={tr('settings.deleteAccount')}>
                <p className="danger-warn">{tr('settings.deleteAccountWarn')}</p>
                {!showDelete ? (
                  <button className="btn btn-ghost btn-sm danger-btn" onClick={() => setShowDelete(true)}>
                    {tr('settings.deleteAccount')}
                  </button>
                ) : (
                  <form onSubmit={deleteAccount} className="sform">
                    <Field
                      label={tr('settings.typePasswordToDelete')}
                      type="password"
                      value={deletePass}
                      onChange={setDeletePass}
                      placeholder="••••••••"
                      preventAutofill
                    />
                    <div className="sform-footer">
                      <button type="submit" className="btn btn-sm" style={{ background: 'var(--red)', color: '#fff' }}>
                        {tr('settings.deleteAccountBtn')}
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowDelete(false)}>
                        Cancel
                      </button>
                      <Status state={deleteStatus} />
                    </div>
                  </form>
                )}
              </SCard>
            </div>
          )}

          {/* ── ADMIN TAB ── */}
          {tab === 'admin' && user?.isAdmin && (
            <div className="settings-tab-content">
              {adminData ? (
                <>
                  <SCard title="Server Overview">
                    <div className="stat-grid-2">
                      <div className="mini-stat">
                        <div className="mini-stat-val">{adminData.totalUsers}</div>
                        <div className="mini-stat-label">{tr('settings.adminUsers')}</div>
                      </div>
                      <div className="mini-stat">
                        <div className="mini-stat-val">{adminData.totalFiles}</div>
                        <div className="mini-stat-label">{tr('settings.adminTotalFiles')}</div>
                      </div>
                      <div className="mini-stat">
                        <div className="mini-stat-val">{formatBytes(adminData.totalStorage)}</div>
                        <div className="mini-stat-label">{tr('settings.adminStorage')}</div>
                      </div>
                      <div className="mini-stat">
                        <div className="mini-stat-val">{adminData.anonFiles}</div>
                        <div className="mini-stat-label">{tr('settings.adminAnonFiles')}</div>
                      </div>
                    </div>
                  </SCard>

                  <SCard title={tr('settings.adminUsers')}>
                    <div className="admin-user-list">
                      {adminData.users.map(u => (
                        <div key={u.id} className="admin-user-row">
                          <div className="sidebar-avatar admin-user-avatar" style={{ width: 28, height: 28, fontSize: '0.75rem' }}>
                            {u.username[0].toUpperCase()}
                          </div>
                          <div className="admin-user-info">
                            <span className="admin-user-name">
                              {u.username}
                              {u.isAdmin && <span className="admin-badge" style={{ marginLeft: 6 }}>admin</span>}
                            </span>
                            <span className="admin-user-meta">
                              {u.email || '—'} · {formatBytes(u.storageUsed)}
                            </span>
                          </div>
                          <span className="admin-user-date">
                            {new Date(u.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </SCard>

                  <SCard title="Anonymous Files">
                    {anonFiles === null ? (
                      <div className="settings-loading" />
                    ) : anonFiles.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center', padding: '1rem 0' }}>
                        No anonymous files uploaded yet.
                      </p>
                    ) : (
                      <div className="admin-files-table-wrap">
                        <table className="admin-files-table">
                          <thead>
                            <tr>
                              <th>File</th>
                              <th>Size</th>
                              <th>Uploaded</th>
                              <th>Downloads</th>
                              <th>Expires in</th>
                              <th>Link</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {anonFiles.map(f => {
                              const daysLeft = Math.ceil((new Date(f.expiresAt) - Date.now()) / 86400000)
                              const isExpiringSoon = daysLeft <= 1
                              const dlStr = f.maxDownloads > 0
                                ? `${f.downloads} / ${f.maxDownloads}`
                                : String(f.downloads)
                              const link = `${window.location.origin}/d/${f.shortCode}`
                              return (
                                <tr key={f.shortCode}>
                                  <td className="admin-files-name">
                                    <span className="admin-files-fname">{f.originalName}</span>
                                    {f.hasPassword && <span className="admin-files-lock" title="Password protected">🔒</span>}
                                  </td>
                                  <td className="admin-files-size">{formatBytes(f.size)}</td>
                                  <td className="admin-files-date">
                                    {new Date(f.uploadedAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                  </td>
                                  <td className="admin-files-dl">{dlStr}</td>
                                  <td className={`admin-files-exp ${isExpiringSoon ? 'red' : daysLeft <= 3 ? 'yellow' : 'green'}`}>
                                    {daysLeft <= 0 ? 'Expired' : `${daysLeft}d`}
                                  </td>
                                  <td className="admin-files-link">
                                    <a href={link} target="_blank" rel="noreferrer" className="admin-files-link-btn">
                                      /{f.shortCode}
                                    </a>
                                  </td>
                                  <td className="admin-files-actions">
                                    <button
                                      className="admin-files-del-btn"
                                      onClick={() => deleteAnonFile(f.shortCode)}
                                      disabled={deletingCode === f.shortCode}
                                      title="Delete file"
                                    >
                                      {deletingCode === f.shortCode ? <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> : '✕'}
                                    </button>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </SCard>
                </>
              ) : (
                <div className="settings-loading" />
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
