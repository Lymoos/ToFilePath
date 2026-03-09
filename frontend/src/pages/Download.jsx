import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'

const API = ''

function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function fileEmoji(name = '') {
  const ext = name.split('.').pop().toLowerCase()
  const map = {
    zip: '📦', rar: '📦', '7z': '📦', tar: '📦', gz: '📦', bz2: '📦', xz: '📦',
    pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊', ppt: '📊', pptx: '📊',
    txt: '📃', md: '📃', csv: '📃',
    jpg: '🖼', jpeg: '🖼', png: '🖼', gif: '🖼', svg: '🖼', webp: '🖼', ico: '🖼',
    mp4: '🎬', mov: '🎬', avi: '🎬', mkv: '🎬', webm: '🎬',
    mp3: '🎵', wav: '🎵', flac: '🎵', ogg: '🎵', m4a: '🎵',
    exe: '⚙️', msi: '⚙️', dmg: '⚙️', deb: '⚙️', rpm: '⚙️', appimage: '⚙️',
    js: '💻', ts: '💻', jsx: '💻', tsx: '💻', py: '💻', go: '💻', rs: '💻',
    json: '💻', yaml: '💻', yml: '💻', toml: '💻', xml: '💻',
    sql: '🗄', db: '🗄', sqlite: '🗄',
  }
  return map[ext] || '📁'
}

function useCountdown(expiresAt) {
  const [remaining, setRemaining] = useState('')

  useEffect(() => {
    if (!expiresAt) return
    const tick = () => {
      const diff = new Date(expiresAt) - Date.now()
      if (diff <= 0) { setRemaining('Expired'); return }
      const d = Math.floor(diff / 86400000)
      const h = Math.floor((diff % 86400000) / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      if (d > 0) setRemaining(`${d}d ${h}h ${m}m`)
      else if (h > 0) setRemaining(`${h}h ${m}m ${s}s`)
      else setRemaining(`${m}m ${s}s`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiresAt])

  return remaining
}

export default function Download() {
  const { code } = useParams()
  const [fileInfo, setFileInfo] = useState(null)
  const [status, setStatus] = useState('loading') // loading | ready | expired | notfound | error
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [downloading, setDownloading] = useState(false)
  const countdown = useCountdown(fileInfo?.expiresAt)

  const fetchInfo = useCallback(() => {
    setStatus('loading')
    fetch(`${API}/api/file/${code}`)
      .then(async r => {
        if (r.status === 404) { setStatus('notfound'); return }
        if (r.status === 410) { setStatus('expired'); return }
        if (!r.ok) { setStatus('error'); return }
        const data = await r.json()
        setFileInfo(data)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [code])

  useEffect(() => { fetchInfo() }, [fetchInfo])

  const handleDownload = async () => {
    if (fileInfo.hasPassword && !password) {
      setPasswordError('Please enter the password')
      return
    }
    setDownloading(true)
    setPasswordError('')

    const qs = fileInfo.hasPassword ? `?password=${encodeURIComponent(password)}` : ''
    const resp = await fetch(`${API}/api/download/${code}${qs}`)

    if (resp.status === 401) {
      setPasswordError('Wrong password — try again')
      setDownloading(false)
      return
    }
    if (resp.status === 403) {
      setPasswordError('Download limit has been reached')
      setDownloading(false)
      return
    }
    if (!resp.ok) {
      setPasswordError('Download failed — file may have expired')
      setDownloading(false)
      return
    }

    // Stream to blob and trigger download
    const blob = await resp.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileInfo.originalName
    document.body.appendChild(a)
    a.click()
    setTimeout(() => { URL.revokeObjectURL(url); a.remove() }, 1000)

    // Refresh info to update download count
    setDownloading(false)
    fetchInfo()
  }

  const dlsLeft = fileInfo?.maxDownloads > 0
    ? fileInfo.maxDownloads - fileInfo.downloads
    : null

  const dlsExhausted = fileInfo?.maxDownloads > 0 && fileInfo.downloads >= fileInfo.maxDownloads

  if (status === 'loading') {
    return (
      <div className="loading-page">
        <span className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
        <span>Loading file info…</span>
      </div>
    )
  }

  if (status === 'notfound') {
    return (
      <div className="download-page">
        <div className="download-card">
          <div className="expired-banner">
            <div className="big-icon">🔍</div>
            <h2 style={{ color: 'var(--text)' }}>File not found</h2>
            <p>This link doesn't exist or has already been deleted.</p>
            <Link to="/" style={{ display: 'inline-block', marginTop: '1.5rem' }}>
              <button className="btn btn-primary">Upload a file</button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'expired') {
    return (
      <div className="download-page">
        <div className="download-card">
          <div className="expired-banner">
            <div className="big-icon">⏰</div>
            <h2>Link expired</h2>
            <p>This file has passed its expiry date and has been automatically deleted.</p>
            <Link to="/" style={{ display: 'inline-block', marginTop: '1.5rem' }}>
              <button className="btn btn-primary">Share a new file</button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="download-page">
        <div className="download-card">
          <div className="expired-banner">
            <div className="big-icon">⚠️</div>
            <h2 style={{ color: 'var(--yellow)' }}>Something went wrong</h2>
            <p>Couldn't load file info. The server might be down.</p>
            <button className="btn btn-ghost" style={{ marginTop: '1.5rem' }} onClick={fetchInfo}>
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="download-page">
      <div className="download-card">
        {/* File type icon */}
        <div className="file-type-icon">
          {fileEmoji(fileInfo.originalName)}
        </div>

        {/* File name */}
        <div className="file-name">{fileInfo.originalName}</div>

        {/* Stats grid */}
        <div className="file-stats">
          <div className="file-stat">
            <div className="file-stat-label">Size</div>
            <div className="file-stat-value">{formatBytes(fileInfo.size)}</div>
          </div>
          <div className="file-stat">
            <div className="file-stat-label">Downloads</div>
            <div className="file-stat-value">
              {fileInfo.maxDownloads > 0
                ? `${fileInfo.downloads} / ${fileInfo.maxDownloads}`
                : fileInfo.downloads}
            </div>
          </div>
          <div className="file-stat">
            <div className="file-stat-label">Expires in</div>
            <div
              className={`file-stat-value countdown ${
                countdown === 'Expired' ? 'red'
                : countdown.includes('m') && !countdown.includes('h') ? 'yellow'
                : 'green'
              }`}
            >
              {countdown}
            </div>
          </div>
          <div className="file-stat">
            <div className="file-stat-label">
              {fileInfo.hasPassword ? 'Protected' : 'Security'}
            </div>
            <div className={`file-stat-value ${fileInfo.hasPassword ? 'yellow' : 'green'}`}>
              {fileInfo.hasPassword ? '🔒 Password' : '✓ Open'}
            </div>
          </div>
        </div>

        {/* Downloads remaining warning */}
        {dlsLeft !== null && dlsLeft <= 2 && !dlsExhausted && (
          <p style={{ textAlign: 'center', color: 'var(--yellow)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            ⚠️ Only {dlsLeft} download{dlsLeft !== 1 ? 's' : ''} remaining
          </p>
        )}

        {/* Password input */}
        {fileInfo.hasPassword && !dlsExhausted && (
          <div className="password-section">
            <label>Password required</label>
            <div className="password-input-row">
              <input
                type="password"
                placeholder="Enter password…"
                value={password}
                onChange={e => { setPassword(e.target.value); setPasswordError('') }}
                onKeyDown={e => e.key === 'Enter' && handleDownload()}
                autoComplete="current-password"
              />
            </div>
          </div>
        )}

        {passwordError && <p className="error-msg">{passwordError}</p>}

        {/* Download button */}
        {dlsExhausted ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <p style={{ color: 'var(--red)', fontWeight: 600, marginBottom: '0.5rem' }}>
              Download limit reached
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              This file has reached its maximum number of downloads.
            </p>
          </div>
        ) : (
          <button
            className="btn btn-primary btn-full"
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? (
              <><span className="spinner" /> Preparing download…</>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <polyline points="7 10 12 15 17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Download {fileInfo.originalName}
              </>
            )}
          </button>
        )}

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.78rem', color: 'var(--text-dim)' }}>
          Uploaded {new Date(fileInfo.uploadedAt).toLocaleDateString('en-US', {
            month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
          })}
        </p>

        <div style={{ textAlign: 'center', marginTop: '1.25rem', borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
          <Link to="/" style={{ fontSize: '0.83rem', color: 'var(--text-muted)' }}>
            ↑ Share your own file on ToFilePath
          </Link>
        </div>
      </div>
    </div>
  )
}
