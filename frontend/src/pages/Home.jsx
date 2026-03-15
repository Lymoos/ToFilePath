import { useState, useRef, useEffect, useCallback, useMemo, useId } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { useAuth } from '../context/AuthContext'
import { usePendingUpload } from '../context/UploadContext'
import { useLang } from '../context/LanguageContext'

const API = ''

/* ── Helpers ─────────────────────────────────────── */
function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatExpiry(isoDate, locale = 'en-US') {
  return new Date(isoDate).toLocaleDateString(locale, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

/* ── Toast notifications ──────────────────────────── */
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
function RotatingWord() {
  const { tr } = useLang()
  const [idx,     setIdx]     = useState(0)
  const [animKey, setAnimKey] = useState(0)

  const words = [
    tr('home.word0'), tr('home.word1'), tr('home.word2'), tr('home.word3'),
  ]

  useEffect(() => {
    const id = setInterval(() => {
      setIdx(i => (i + 1) % words.length)
      setAnimKey(k => k + 1)
    }, 2600)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tr])

  return (
    <span className="rotating-word" key={animKey}>
      {words[idx]}
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

/* ── Constants (use translation keys for labels) ─── */
const EXPIRY_OPTIONS = [
  { key: 'home.expiry1h',  value: 1   },
  { key: 'home.expiry12h', value: 12  },
  { key: 'home.expiry1d',  value: 24  },
  { key: 'home.expiry3d',  value: 72  },
  { key: 'home.expiry7d',  value: 168 },
  { key: 'home.expiry30d', value: 720 },
]
const DL_OPTIONS = [
  { key: 'home.dlUnlimited', value: 0  },
  { key: 'home.dl1',         value: 1  },
  { key: 'home.dl5',         value: 5  },
  { key: 'home.dl10',        value: 10 },
  { key: 'home.dl25',        value: 25 },
  { key: 'home.dl50',        value: 50 },
]

const ANON_LIMIT = 3 * 1024 * 1024 * 1024 // 3 GB

const FEATURES = [
  {
    titleKey: 'home.feat0.title',
    descKey:  'home.feat0.desc',
    icon: <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>,
  },
  {
    titleKey: 'home.feat1.title',
    descKey:  'home.feat1.desc',
    icon: <><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><polyline points="12 6 12 12 16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></>,
  },
  {
    titleKey: 'home.feat2.title',
    descKey:  'home.feat2.desc',
    icon: <><rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></>,
  },
  {
    titleKey: 'home.feat3.title',
    descKey:  'home.feat3.desc',
    icon: <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><polyline points="7 10 12 15 17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></>,
  },
  {
    titleKey: 'home.feat4.title',
    descKey:  'home.feat4.desc',
    icon: <><rect x="5" y="5" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M5 9h14M9 5v14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></>,
  },
  {
    titleKey: 'home.feat5.title',
    descKey:  'home.feat5.desc',
    icon: <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>,
  },
]

/* ── Custom select dropdown ───────────────────────── */
function CustomSelect({ value, onChange, options }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const selected = options.find(o => o.value === value) ?? options[0]

  return (
    <div ref={ref} className={`custom-select${open ? ' open' : ''}`}>
      <button
        type="button"
        className="custom-select-trigger"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
      >
        <span>{selected?.label}</span>
        <svg
          className="custom-select-arrow"
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div className="custom-select-menu" role="listbox">
          {options.map(o => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              className={`custom-select-option${o.value === value ? ' selected' : ''}`}
              onClick={() => { onChange(o.value); setOpen(false) }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Main component ───────────────────────────────── */
export default function Home() {
  const { user } = useAuth()
  const { setPendingFile } = usePendingUpload()
  const { tr, lang } = useLang()
  const navigate = useNavigate()

  const [file,        setFile]        = useState(null)
  const [dragOver,    setDragOver]    = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const [options,     setOptions]     = useState({ expiryHours: 24, maxDownloads: 0, password: '' })
  const [uploading,   setUploading]   = useState(false)
  const [progress,    setProgress]    = useState(0)
  const [result,      setResult]      = useState(null)
  const [copied,      setCopied]      = useState(false)
  const [stats,       setStats]       = useState(null)
  const [needAccount, setNeedAccount] = useState(false)
  const fileRef = useRef()

  // Upload speed + ETA
  const [uploadSpeed, setUploadSpeed]   = useState(null) // bytes/sec
  const [uploadETA,   setUploadETA]     = useState(null) // seconds remaining
  const speedRef = useRef({ lastLoaded: 0, lastTime: 0 })

  // Toast notifications
  const { toasts, show: showToast } = useToast()

  const [featRef,  featVisible] = useInView(0.08)
  const [filesCount, filesRef]  = useCountUp(stats?.totalFiles    ?? null)
  const [dlCount,    dlRef]     = useCountUp(stats?.totalDownloads ?? null)

  useEffect(() => {
    fetch(`${API}/api/stats`).then(r => r.json()).then(setStats).catch(() => {})
  }, [result])

  const handleFileSelect = useCallback((f) => {
    setFile(f)
    setNeedAccount(!user && f.size > ANON_LIMIT)
  }, [user])

  const onDrop      = useCallback((e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f) }, [handleFileSelect])
  const onDragOver  = useCallback((e) => { e.preventDefault(); setDragOver(true)  }, [])
  const onDragLeave = useCallback(() => setDragOver(false), [])
  const onFileChange = (e) => { if (e.target.files[0]) handleFileSelect(e.target.files[0]) }

  const upload = () => {
    if (!file) return
    if (!user && file.size > ANON_LIMIT) {
      setNeedAccount(true)
      return
    }
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

        const now = performance.now()
        const dt = (now - speedRef.current.lastTime) / 1000
        const dBytes = e.loaded - speedRef.current.lastLoaded
        if (dt > 0.2) {
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
        let msg
        try { msg = JSON.parse(xhr.responseText).error } catch {}
        if (!msg) {
          if (xhr.status === 413) msg = tr('home.fileTooLarge')
          else if (xhr.status === 0 || xhr.responseText === '') msg = tr('home.uploadConnErr')
          else msg = tr('home.uploadFailed')
        }
        showToast(msg)
      }
    })
    xhr.addEventListener('error', () => {
      setUploading(false); setUploadSpeed(null); setUploadETA(null)
      showToast(tr('home.uploadConnErr'))
    })
    xhr.send(form)
  }

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/${result.shortCode}`)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2200)
        showToast(tr('home.copied'), 'success')
      })
  }

  const reset = () => {
    setFile(null); setResult(null); setProgress(0)
    setCopied(false); setShowOptions(false); setNeedAccount(false)
    setOptions({ expiryHours: 24, maxDownloads: 0, password: '' })
  }

  const downloadUrl = result ? `${window.location.origin}/${result.shortCode}` : ''
  const locale      = lang === 'ru' ? 'ru-RU' : 'en-US'

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
          {tr('home.badge')}
        </div>

        <h1 className="hero-title">
          <span className="hero-line-1">{tr('home.heroLine')}</span>
          <br />
          <RotatingWord />
        </h1>

        <p className="hero-sub">
          {tr('home.heroSub1')}&nbsp;<strong>3&nbsp;GB</strong> {tr('home.heroSub2')}{' '}
          <Link to="/login?mode=register" style={{ color:'var(--green)' }}>{tr('home.createFreeAccount')}</Link>{' '}
          {tr('home.heroSub3')}
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
                  <h3>{tr('home.readyToUpload')}</h3>
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
                  <h3>{tr('home.dragDrop')}</h3>
                  <p>{tr('home.orClickBrowse')}</p>
                  <p style={{ fontSize:'0.78rem', color:'var(--text-dim)' }}>
                    {tr('home.fileTypes')}
                  </p>
                </>
              )}
            </div>

            {needAccount && (
              <div className="need-account-prompt">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                  <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="12" cy="16" r="1" fill="currentColor"/>
                </svg>
                <div className="need-account-text">
                  <strong>{tr('home.fileExceeds')}</strong>
                  <p>{tr('home.anonLimitText')}</p>
                </div>
                <div className="need-account-actions">
                  <button className="btn btn-primary btn-sm" onClick={() => { setPendingFile(file); navigate('/login?mode=register') }}>
                    {tr('home.createAccount')}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setPendingFile(file); navigate('/login') }}>
                    {tr('nav.signIn')}
                  </button>
                </div>
              </div>
            )}

            {file && !needAccount && (
              <button
                className={`options-toggle${showOptions ? ' open' : ''}`}
                onClick={() => setShowOptions(v => !v)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                  <path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                {tr('home.advancedOptions')}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <polyline points="6 9 12 15 18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}

            {showOptions && (
              <div className="options-panel">
                <div className="options-grid">
                  <div className="option-group">
                    <label>{tr('home.expiresAfter')}</label>
                    <CustomSelect
                      value={options.expiryHours}
                      onChange={v => setOptions(o => ({ ...o, expiryHours: v }))}
                      options={EXPIRY_OPTIONS.map(o => ({ value: o.value, label: tr(o.key) }))}
                    />
                  </div>
                  <div className="option-group">
                    <label>{tr('home.downloadLimit')}</label>
                    <CustomSelect
                      value={options.maxDownloads}
                      onChange={v => setOptions(o => ({ ...o, maxDownloads: v }))}
                      options={DL_OPTIONS.map(o => ({ value: o.value, label: tr(o.key) }))}
                    />
                  </div>
                </div>
                <div className="option-group">
                  <label>{tr('home.passwordOpt')}</label>
                  <input type="password" placeholder={tr('home.passwordPlaceholder')}
                    value={options.password} autoComplete="new-password"
                    onChange={e => setOptions(o => ({ ...o, password: e.target.value }))} />
                </div>
              </div>
            )}

            {file && !needAccount && (
              <>
                <button className="btn btn-primary btn-full" onClick={upload} disabled={uploading}>
                  {uploading ? (
                    <><span className="spinner" /> {tr('home.uploading')}</>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <polyline points="17 8 12 3 7 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      {tr('home.uploadBtn')}
                    </>
                  )}
                </button>
                {uploading && (
                  <div>
                    <div className="progress-wrap">
                      <div className="progress-bar" style={{ width:`${progress}%` }} />
                    </div>
                    <p className="progress-label">{progress}%</p>

                    {(uploadSpeed != null || etaStr) && (
                      <div className="upload-speed-row">
                        {uploadSpeed != null && (
                          <span>
                            {tr('home.speedLabel')} <span className="upload-speed-val">{formatBytes(uploadSpeed)}/s</span>
                          </span>
                        )}
                        {etaStr && (
                          <span>
                            {tr('home.etaLabel')} <span className="upload-speed-val">{etaStr}</span>
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
            <h2>{tr('home.fileUploaded')}</h2>
            <p className="file-meta">{result.originalName} &nbsp;&bull;&nbsp; {formatBytes(result.size)}</p>

            <div className="link-box">
              <span className="link-text">{downloadUrl}</span>
              <button className={`copy-btn${copied ? ' copied' : ''}`} onClick={copyLink}>
                {copied ? (
                  <><svg width="13" height="13" viewBox="0 0 24 24" fill="none"><polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>{tr('home.copied')}</>
                ) : (
                  <><svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="2"/></svg>{tr('home.copy')}</>
                )}
              </button>
            </div>

            <div className="success-meta-row">
              <span className="meta-chip">
                <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><polyline points="12 6 12 12 16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                {tr('home.expiresChip', { date: formatExpiry(result.expiresAt, locale) })}
              </span>
              {result.maxDownloads > 0 && (
                <span className="meta-chip">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><polyline points="7 10 12 15 17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                  {tr('home.maxDownloadsChip', { n: result.maxDownloads })}
                </span>
              )}
              {result.hasPassword && (
                <span className="meta-chip">
                  <svg viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/><path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                  {tr('home.passwordChip')}
                </span>
              )}
            </div>

            <div className="qr-section">
              <p className="qr-label">{tr('home.scanToDownload')}</p>
              <div className="qr-wrap">
                <QRCodeSVG value={downloadUrl} size={140} bgColor="transparent" fgColor="#00d97e" level="M" />
              </div>
            </div>

            <button className="new-upload-btn" onClick={reset}>{tr('home.uploadAnother')}</button>
          </div>
        )}
      </div>

      {/* ── Features ──────────────────────────────── */}
      <section className="features">
        <p className="section-label">{tr('home.whyLabel')}</p>
        <h2 className="section-title">{tr('home.whyTitle')}</h2>
        <p className="section-sub">{tr('home.whySub')}</p>

        <div className={`features-grid${featVisible ? ' in-view' : ''}`} ref={featRef}>
          {FEATURES.map((f, i) => (
            <div className="feature-card" key={i} style={{ animationDelay:`${i * 0.09}s` }}>
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none">{f.icon}</svg>
              </div>
              <h3>{tr(f.titleKey)}</h3>
              <p>{tr(f.descKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Stats ─────────────────────────────────── */}
      <section className="stats">
        <div className="stats-inner">
          <div ref={filesRef}>
            <div className="stat-value">{stats ? filesCount.toLocaleString() : '—'}</div>
            <div className="stat-label">{tr('home.statsFiles')}</div>
          </div>
          <div>
            <div className="stat-value">{stats ? formatBytes(stats.totalSize) : '—'}</div>
            <div className="stat-label">{tr('home.statsData')}</div>
          </div>
          <div ref={dlRef}>
            <div className="stat-value">{stats ? dlCount.toLocaleString() : '—'}</div>
            <div className="stat-label">{tr('home.statsDownloads')}</div>
          </div>
          <div>
            <div className="stat-value stat-pulse">5 GB</div>
            <div className="stat-label">{tr('home.statsStorage')}</div>
          </div>
        </div>
      </section>
    </>
  )
}
