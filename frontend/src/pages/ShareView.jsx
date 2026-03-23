import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024, s = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${s[i]}`
}

function fileEmoji(name = '') {
  const ext = name.split('.').pop().toLowerCase()
  const map = {
    zip: '📦', rar: '📦', '7z': '📦', tar: '📦', gz: '📦',
    pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊', ppt: '📊', pptx: '📊',
    txt: '📃', md: '📃', csv: '📃',
    jpg: '🖼', jpeg: '🖼', png: '🖼', gif: '🖼', svg: '🖼', webp: '🖼', bmp: '🖼',
    mp4: '🎬', mov: '🎬', avi: '🎬', mkv: '🎬', webm: '🎬',
    mp3: '🎵', wav: '🎵', flac: '🎵', ogg: '🎵', m4a: '🎵',
    exe: '⚙️', msi: '⚙️', dmg: '⚙️', deb: '⚙️',
    js: '💻', ts: '💻', jsx: '💻', tsx: '💻', py: '💻', go: '💻', rs: '💻',
  }
  return map[ext] || '📄'
}

function timeUntil(dateStr) {
  const diff = new Date(dateStr) - Date.now()
  if (diff <= 0) return 'expired'
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  if (d > 0) return `${d} day${d !== 1 ? 's' : ''}`
  return `${h} hour${h !== 1 ? 's' : ''}`
}

export default function ShareView() {
  const { shareId } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [downloading, setDownloading] = useState(new Set())
  const [downloadingAll, setDownloadingAll] = useState(false)

  useEffect(() => {
    fetch(`/api/p/${shareId}`)
      .then(async res => {
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error || (res.status === 410 ? 'This share link has expired' : 'Share not found'))
        }
        return res.json()
      })
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [shareId])

  const downloadFile = async (file) => {
    setDownloading(prev => new Set(prev).add(file.id))
    const a = document.createElement('a')
    a.href = `/api/p/${shareId}/download/${file.id}`
    a.download = file.name
    document.body.appendChild(a)
    a.click()
    setTimeout(() => {
      a.remove()
      setDownloading(prev => { const n = new Set(prev); n.delete(file.id); return n })
    }, 1000)
  }

  const downloadAll = () => {
    setDownloadingAll(true)
    const a = document.createElement('a')
    a.href = `/api/p/${shareId}/zip`
    a.download = (data?.title || 'shared') + '.zip'
    document.body.appendChild(a)
    a.click()
    setTimeout(() => { a.remove(); setDownloadingAll(false) }, 2000)
  }

  if (loading) return (
    <div className="share-view-page">
      <div className="share-loading">
        <span className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
        <span>Loading share…</span>
      </div>
    </div>
  )

  if (error) return (
    <div className="share-view-page">
      <div className="share-error-card">
        <div className="share-error-icon">🔒</div>
        <h2>{error}</h2>
        <p>The link may have expired or been deleted.</p>
        <Link to="/" className="btn btn-primary" style={{ marginTop: '1.5rem', display: 'inline-block' }}>
          Go to ToFilePath
        </Link>
      </div>
    </div>
  )

  const totalItems = (data.files?.length || 0) + (data.dirs?.length || 0)

  return (
    <div className="share-view-page">
      <div className="share-view-container">
        {/* Header */}
        <div className="share-view-header">
          <div className="share-view-brand">
            <Link to="/" className="share-brand-link">ToFilePath</Link>
          </div>
          <div className="share-view-meta">
            <span className="share-expires-badge">
              ⏳ Expires in {timeUntil(data.expiresAt)}
            </span>
          </div>
        </div>

        {/* Title + stats */}
        <div className="share-view-title-row">
          <div>
            <h1 className="share-view-title">
              {data.title || 'Shared Files'}
            </h1>
            <div className="share-view-subtitle">
              {totalItems} item{totalItems !== 1 ? 's' : ''} · {formatBytes(data.totalSize)}
            </div>
          </div>

          {/* Download All button */}
          {totalItems > 0 && (
            <button
              className="btn btn-primary share-download-all-btn"
              onClick={downloadAll}
              disabled={downloadingAll}
            >
              {downloadingAll ? (
                <><span className="spinner" style={{ width: 14, height: 14 }} /> Preparing ZIP…</>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <polyline points="7 10 12 15 17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  Download All ({formatBytes(data.totalSize)})
                </>
              )}
            </button>
          )}
        </div>

        <div className="share-divider" />

        {/* Files list */}
        {data.files?.length > 0 && (
          <div className="share-file-list">
            {data.files.map(file => (
              <div key={file.id} className="share-file-row">
                <div className="share-file-icon">{fileEmoji(file.name)}</div>
                <div className="share-file-info">
                  <div className="share-file-name">{file.name}</div>
                  <div className="share-file-size">{formatBytes(file.size)}</div>
                </div>
                <button
                  className="btn btn-ghost btn-sm share-file-download-btn"
                  onClick={() => downloadFile(file)}
                  disabled={downloading.has(file.id)}
                >
                  {downloading.has(file.id) ? (
                    <span className="spinner" style={{ width: 12, height: 12 }} />
                  ) : (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <polyline points="7 10 12 15 17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      Download
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Folders */}
        {data.dirs?.length > 0 && (
          <>
            {data.files?.length > 0 && <div className="share-divider" style={{ margin: '1rem 0' }} />}
            <div className="share-file-list">
              {data.dirs.map(dir => (
                <div key={dir.id} className="share-file-row">
                  <div className="share-file-icon">📁</div>
                  <div className="share-file-info">
                    <div className="share-file-name">{dir.name}</div>
                    <div className="share-file-size">Folder</div>
                  </div>
                  <span className="share-folder-note">included in ZIP</span>
                </div>
              ))}
            </div>
          </>
        )}

        {totalItems === 0 && (
          <div className="share-empty">
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
            <p>This share contains no files.</p>
          </div>
        )}

        <div className="share-view-footer">
          <Link to="/" className="share-footer-link">
            Powered by ToFilePath
          </Link>
        </div>
      </div>
    </div>
  )
}
