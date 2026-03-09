import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { QRCodeSVG } from 'qrcode.react'

const API = ''

/* ── Helpers ─────────────────────────────────────── */
function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatExpiry(isoDate) {
  return new Date(isoDate).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

/* ── Idea 4: Toast notifications ──────────────────── */
function useToast() {
  const [toasts, setToasts] = useState([])
  const show = useCallback((msg, type = 'error') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])
  return { toasts, show }
}

function ToastContainer({ toasts }) {
  if (!toasts.length) return null
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          {t.type === 'error' && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
              <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          )}
          {t.type === 'success' && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
          {t.msg}
        </div>
      ))}
    </div>
  )
}

/* ── Rotating hero words ──────────────────────────── */
const HERO_WORDS = ['Securely.', 'Privately.', 'Instantly.', 'Ephemerally.']

function RotatingWord() {
  const [idx,     setIdx]     = useState(0)
  const [animKey, setAnimKey] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setIdx(i => (i + 1) % HERO_WORDS.length)
      setAnimKey(k => k + 1)
    }, 2600)
    return () => clearInterval(id)
  }, [])

  return (
    <span className="rotating-word" key={animKey}>
      {HERO_WORDS[idx]}
    </span>
  )
}

/* ── Floating background particles ───────────────── */
function Particles() {
  const items = useMemo(() =>
    Array.from({ length: 22 }, (_, i) => ({
      id:       i,
      left:     `${5 + Math.random() * 90}%`,
      size:     `${1.5 + Math.random() * 2.5}px`,
      duration: `${10 + Math.random() * 14}s`,
      delay:    `${-Math.random() * 20}s`,
      opacity:  0.18 + Math.random() * 0.45,
    }))
  , [])

  return (
    <div className="particles-wrap" aria-hidden="true">
      {items.map(p => (
        <span
          key={p.id}
          className="particle"
          style={{
            left: p.left,
            width: p.size, height: p.size,
            animationDuration: p.duration,
            animationDelay:    p.delay,
            opacity:           p.opacity,
          }}
        />
      ))}
    </div>
  )
}

/* ── Count-up (triggers once on scroll-into-view) ── */
function useCountUp(target, duration = 1400) {
  const [val,   setVal]   = useState(0)
  const [ready, setReady] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setReady(true); obs.disconnect() }
    }, { threshold: 0.3 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!ready || target == null) return
    const t0 = performance.now()
    const tick = (now) => {
      const p     = Math.min((now - t0) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(eased * target))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [ready, target, duration])

  return [val, ref]
}

/* ── Scroll-reveal ───────────────────────────────── */
function useInView(threshold = 0.1) {
  const [visible, setVisible] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect() }
    }, { threshold })
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return [ref, visible]
}

/* ── Constants ───────────────────────────────────── */
const EXPIRY_OPTIONS = [
  { label: '1 hour',   value: 1   },
  { label: '12 hours', value: 12  },
  { label: '1 day',    value: 24  },
  { label: '3 days',   value: 72  },
  { label: '7 days',   value: 168 },
  { label: '30 days',  value: 720 },
]
const DL_OPTIONS = [
  { label: 'Unlimited',    value: 0  },
  { label: '1 download',   value: 1  },
  { label: '5 downloads',  value: 5  },
  { label: '10 downloads', value: 10 },
  { label: '25 downloads', value: 25 },
  { label: '50 downloads', value: 50 },
]

const FEATURES = [
  {
    title: 'Instant uploads',
    desc:  'Upload any file up to 30 GB and get a shareable link in seconds. No sign-up.',
    icon:  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>,
  },
  {
    title: 'Self-destructing links',
    desc:  'Set expiry from 1 hour to 30 days. Files vanish automatically.',
    icon:  <><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><polyline points="12 6 12 12 16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></>,
  },
  {
    title: 'Password protection',
    desc:  'Lock your file so only the recipient with the password can download it.',
    icon:  <><rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></>,
  },
  {
    title: 'Download limits',
    desc:  'Cap at 1, 5, 10, 25 or 50 downloads. Link goes dark after the limit.',
    icon:  <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><polyline points="7 10 12 15 17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></>,
  },
  {
    title: 'QR code sharing',
    desc:  'Every upload generates a QR code — instantly share from desktop to phone.',
    icon:  <><rect x="5" y="5" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M5 9h14M9 5v14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></>,
  },
  {
    title: 'Zero tracking',
    desc:  'No cookies, no analytics, no accounts. Your files, your business.',
    icon:  <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>,
  },
]

/* ── Main component ───────────────────────────────── */
export default function Home() {
  const [file,        setFile]        = useState(null)
  const [dragOver,    setDragOver]    = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const [options,     setOptions]     = useState({ expiryHours: 24, maxDownloads: 0, password: '' })
  const [uploading,   setUploading]   = useState(false)
  const [progress,    setProgress]    = useState(0)
  const [result,      setResult]      = useState(null)
  const [copied,      setCopied]      = useState(false)
  const [stats,       setStats]       = useState(null)
  const fileRef = useRef()

  // Idea 2: Upload speed + ETA
  const [uploadSpeed, setUploadSpeed]   = useState(null) // bytes/sec
  const [uploadETA,   setUploadETA]     = useState(null) // seconds remaining
  const speedRef = useRef({ lastLoaded: 0, lastTime: 0 })

  // Idea 4: Toast notifications
  const { toasts, show: showToast } = useToast()

  const [featRef,  featVisible] = useInView(0.08)
  const [filesCount, filesRef]  = useCountUp(stats?.totalFiles    ?? null)
  const [dlCount,    dlRef]     = useCountUp(stats?.totalDownloads ?? null)

  useEffect(() => {
    fetch(`${API}/api/stats`).then(r => r.json()).then(setStats).catch(() => {})
  }, [result])

  const onDrop      = useCallback((e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) setFile(f) }, [])
  const onDragOver  = useCallback((e) => { e.preventDefault(); setDragOver(true)  }, [])
  const onDragLeave = useCallback(() => setDragOver(false), [])
  const onFileChange = (e) => { if (e.target.files[0]) setFile(e.target.files[0]) }

  const upload = () => {
    if (!file) return
    const form = new FormData()
    form.append('file', file)
    form.append('expiryHours',  String(options.expiryHours))
    form.append('maxDownloads', String(options.maxDownloads))
    if (options.password) form.append('password', options.password)
    setUploading(true); setProgress(0); setUploadSpeed(null); setUploadETA(null)
    speedRef.current = { lastLoaded: 0, lastTime: performance.now() }

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API}/api/upload`)
    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable) {
        const pct = Math.round(e.loaded / e.total * 100)
        setProgress(pct)

        // Idea 2: compute speed + ETA
        const now = performance.now()
        const dt = (now - speedRef.current.lastTime) / 1000 // seconds
        const dBytes = e.loaded - speedRef.current.lastLoaded
        if (dt > 0.2) { // update every 200ms
          const speed = dBytes / dt
          setUploadSpeed(speed)
          const remaining = e.total - e.loaded
          setUploadETA(speed > 0 ? Math.ceil(remaining / speed) : null)
          speedRef.current = { lastLoaded: e.loaded, lastTime: now }
        }
      }
    })
    xhr.addEventListener('load', () => {
      setUploading(false); setUploadSpeed(null); setUploadETA(null)
      if (xhr.status === 200) { setResult(JSON.parse(xhr.responseText)); setProgress(100) }
      else {
        try { showToast(JSON.parse(xhr.responseText).error || 'Upload failed') }
        catch { showToast('Upload failed') }
      }
    })
    xhr.addEventListener('error', () => {
      setUploading(false); setUploadSpeed(null); setUploadETA(null)
      showToast('Network error — is the server running?')
    })
    xhr.send(form)
  }

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/${result.shortCode}`)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2200)
        showToast('Link copied to clipboard!', 'success')
      })
  }

  const reset = () => {
    setFile(null); setResult(null); setProgress(0)
    setCopied(false); setShowOptions(false)
    setOptions({ expiryHours: 24, maxDownloads: 0, password: '' })
  }

  const downloadUrl = result ? `${window.location.origin}/${result.shortCode}` : ''

  // Format ETA as human-readable
  const etaStr = uploadETA != null
    ? uploadETA > 60 ? `${Math.floor(uploadETA / 60)}m ${uploadETA % 60}s` : `${uploadETA}s`
    : null

  return (
    <>
      <ToastContainer toasts={toasts} />

      {/* ── Hero ──────────────────────────────────── */}
      <section className="hero">
        <div className="hero-grid"      aria-hidden="true" />
        <Particles />
        <div className="hero-scan-line" aria-hidden="true" />

        <div className="hero-badge">
          <span className="hero-badge-dot" />
          Up to 30 GB &middot; No account needed
        </div>

        <h1 className="hero-title">
          <span className="hero-line-1">Drop it. Share it.</span>
          <br />
          <RotatingWord />
        </h1>

        <p className="hero-sub">
          Upload any file up to&nbsp;<strong>30&nbsp;GB</strong> and get a short link
          instantly. Set an expiry, limit downloads, or lock with a password.
        </p>
      </section>

      {/* ── Upload area ───────────────────────────── */}
      <div className="upload-container">
        {!result ? (
          <>
            <div
              className={`drop-zone${dragOver ? ' drag-over' : ''}`}
              onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
              onClick={() => !file && fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" style={{ display:'none' }} onChange={onFileChange} />

              <svg className="drop-icon" viewBox="0 0 24 24" fill="none">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="17 8 12 3 7 8"  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>

              {file ? (
                <>
                  <h3>Ready to upload</h3>
                  <p>{formatBytes(file.size)}</p>
                  <div className="file-selected-name">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {file.name}
                  </div>
                </>
              ) : (
                <>
                  <h3>Drag &amp; drop your file here</h3>
                  <p>or click to browse &mdash; up to 30 GB</p>
                  <p style={{ fontSize:'0.78rem', color:'var(--text-dim)' }}>
                    Archives, videos, images, documents &mdash; anything goes
                  </p>
                </>
              )}
            </div>

            {file && (
              <button
                className={`options-toggle${showOptions ? ' open' : ''}`}
                onClick={() => setShowOptions(v => !v)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                  <path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Advanced options
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <polyline points="6 9 12 15 18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}

            {showOptions && (
              <div className="options-panel">
                <div className="options-grid">
                  <div className="option-group">
                    <label>Expires after</label>
                    <select value={options.expiryHours}
                      onChange={e => setOptions(o => ({ ...o, expiryHours: Number(e.target.value) }))}>
                      {EXPIRY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div className="option-group">
                    <label>Download limit</label>
                    <select value={options.maxDownloads}
                      onChange={e => setOptions(o => ({ ...o, maxDownloads: Number(e.target.value) }))}>
                      {DL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="option-group">
                  <label>Password protection (optional)</label>
                  <input type="password" placeholder="Leave blank for no password"
                    value={options.password} autoComplete="new-password"
                    onChange={e => setOptions(o => ({ ...o, password: e.target.value }))} />
                </div>
              </div>
            )}

            {file && (
              <>
                <button className="btn btn-primary btn-full" onClick={upload} disabled={uploading}>
                  {uploading ? (
                    <><span className="spinner" /> Uploading…</>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <polyline points="17 8 12 3 7 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      Upload &amp; Generate Link
                    </>
                  )}
                </button>
                {uploading && (
                  <div>
                    <div className="progress-wrap">
                      <div className="progress-bar" style={{ width:`${progress}%` }} />
                    </div>
                    <p className="progress-label">{progress}%</p>

                    {/* Idea 2: Speed indicator */}
                    {(uploadSpeed != null || etaStr) && (
                      <div className="upload-speed-row">
                        {uploadSpeed != null && (
                          <span>
                            Speed: <span className="upload-speed-val">{formatBytes(uploadSpeed)}/s</span>
                          </span>
                        )}
                        {etaStr && (
                          <span>
                            ETA: <span className="upload-speed-val">{etaStr}</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          /* ── Success card ─────────────────────── */
          <div className="success-card">
            <div className="success-icon-wrap">
              <svg className="success-icon" viewBox="0 0 24 24" fill="none">
                <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2>File uploaded!</h2>
            <p className="file-meta">{result.originalName} &nbsp;&bull;&nbsp; {formatBytes(result.size)}</p>

            <div className="link-box">
              <span className="link-text">{downloadUrl}</span>
              <button className={`copy-btn${copied ? ' copied' : ''}`} onClick={copyLink}>
                {copied ? (
                  <><svg width="13" height="13" viewBox="0 0 24 24" fill="none"><polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>Copied!</>
                ) : (
                  <><svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="2"/></svg>Copy</>
                )}
              </button>
            </div>

            <div className="success-meta-row">
              <span className="meta-chip">
                <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><polyline points="12 6 12 12 16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                Expires {formatExpiry(result.expiresAt)}
              </span>
              {result.maxDownloads > 0 && (
                <span className="meta-chip">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><polyline points="7 10 12 15 17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                  Max {result.maxDownloads} downloads
                </span>
              )}
              {result.hasPassword && (
                <span className="meta-chip">
                  <svg viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/><path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                  Password protected
                </span>
              )}
            </div>

            <div className="qr-section">
              <p className="qr-label">Scan to download</p>
              <div className="qr-wrap">
                <QRCodeSVG value={downloadUrl} size={140} bgColor="transparent" fgColor="#00d97e" level="M" />
              </div>
            </div>

            <button className="new-upload-btn" onClick={reset}>↑ Upload another file</button>
          </div>
        )}
      </div>

      {/* ── Features ──────────────────────────────── */}
      <section className="features">
        <p className="section-label">Why ToFilePath</p>
        <h2 className="section-title">Everything you need, nothing you don't</h2>
        <p className="section-sub">No accounts, no tracking, no nonsense.</p>

        <div className={`features-grid${featVisible ? ' in-view' : ''}`} ref={featRef}>
          {FEATURES.map((f, i) => (
            <div className="feature-card" key={i} style={{ animationDelay:`${i * 0.09}s` }}>
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none">{f.icon}</svg>
              </div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Stats ─────────────────────────────────── */}
      <section className="stats">
        <div className="stats-inner">
          <div ref={filesRef}>
            <div className="stat-value">{stats ? filesCount.toLocaleString() : '—'}</div>
            <div className="stat-label">Files shared</div>
          </div>
          <div>
            <div className="stat-value">{stats ? formatBytes(stats.totalSize) : '—'}</div>
            <div className="stat-label">Data transferred</div>
          </div>
          <div ref={dlRef}>
            <div className="stat-value">{stats ? dlCount.toLocaleString() : '—'}</div>
            <div className="stat-label">Downloads served</div>
          </div>
          <div>
            <div className="stat-value stat-pulse">30 GB</div>
            <div className="stat-label">Max file size</div>
          </div>
        </div>
      </section>
    </>
  )
}
