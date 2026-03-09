import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'

const IMAGE_EXTS  = ['jpg','jpeg','png','gif','webp','svg','bmp','ico']
const VIDEO_EXTS  = ['mp4','webm','mov','avi']
const AUDIO_EXTS  = ['mp3','wav','ogg','flac','m4a']
const TEXT_EXTS   = ['txt','md','json','js','ts','jsx','tsx','go','py','rs','html','css',
                     'xml','yaml','yml','toml','csv','sh','bash','c','cpp','h','java','kt','rb']
const PDF_EXTS    = ['pdf']

export function canPreview(name = '') {
  const ext = name.split('.').pop().toLowerCase()
  return [...IMAGE_EXTS, ...VIDEO_EXTS, ...AUDIO_EXTS, ...TEXT_EXTS, ...PDF_EXTS].includes(ext)
}

function getFileType(name = '') {
  const ext = name.split('.').pop().toLowerCase()
  if (IMAGE_EXTS.includes(ext))  return 'image'
  if (VIDEO_EXTS.includes(ext))  return 'video'
  if (AUDIO_EXTS.includes(ext))  return 'audio'
  if (TEXT_EXTS.includes(ext))   return 'text'
  if (PDF_EXTS.includes(ext))    return 'pdf'
  return null
}

function formatBytes(b) {
  if (!b) return '0 B'
  const k = 1024, s = ['B','KB','MB','GB','TB']
  const i = Math.floor(Math.log(b) / Math.log(k))
  return `${parseFloat((b / Math.pow(k, i)).toFixed(1))} ${s[i]}`
}

export default function FilePreview({ file, onClose }) {
  const { token } = useAuth()
  const { tr } = useLang()
  const [blobUrl, setBlobUrl] = useState(null)
  const [text, setText] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const containerRef = useRef(null)

  const type = getFileType(file.name)

  useEffect(() => {
    // Close on Escape
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    if (!type) { setError('Cannot preview this file type'); setLoading(false); return }

    const url = `/api/storage/download/${file.id}?inline=1`

    if (type === 'text') {
      fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => {
          if (!r.ok) throw new Error('Failed to load')
          return r.text()
        })
        .then(t => { setText(t); setLoading(false) })
        .catch(e => { setError(e.message); setLoading(false) })
      return
    }

    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        if (!r.ok) throw new Error('Failed to load')
        return r.blob()
      })
      .then(blob => {
        const u = URL.createObjectURL(blob)
        setBlobUrl(u)
        setLoading(false)
      })
      .catch(e => { setError(e.message); setLoading(false) })

    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [file.id, token, type])

  const handleDownload = () => {
    const xhr = new XMLHttpRequest()
    xhr.open('GET', `/api/storage/download/${file.id}`)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.responseType = 'blob'
    xhr.onload = () => {
      const url = URL.createObjectURL(xhr.response)
      const a = document.createElement('a')
      a.href = url; a.download = file.name
      document.body.appendChild(a); a.click()
      setTimeout(() => { URL.revokeObjectURL(url); a.remove() }, 1000)
    }
    xhr.send()
  }

  const ext = file.name.split('.').pop().toLowerCase()

  return (
    <div className="preview-backdrop" onClick={onClose}>
      <div className="preview-modal" onClick={e => e.stopPropagation()} ref={containerRef}>
        {/* Header */}
        <div className="preview-header">
          <div className="preview-header-info">
            <span className="preview-filename">{file.name}</span>
            <span className="preview-filemeta">{formatBytes(file.size)} · .{ext}</span>
          </div>
          <div className="preview-header-actions">
            <button className="preview-action-btn" onClick={handleDownload} title={tr('storage.download')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="7 10 12 15 17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
            <button className="preview-close-btn" onClick={onClose} title="Close (Esc)">✕</button>
          </div>
        </div>

        {/* Content */}
        <div className="preview-body">
          {loading && (
            <div className="preview-loading">
              <span className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
              <span>Loading preview…</span>
            </div>
          )}

          {error && (
            <div className="preview-error">
              <span style={{ fontSize: '2.5rem' }}>⚠️</span>
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && (
            <>
              {type === 'image' && (
                <div className="preview-image-wrap">
                  <img src={blobUrl} alt={file.name} className="preview-image" />
                </div>
              )}

              {type === 'video' && (
                <div className="preview-video-wrap">
                  <video controls autoPlay className="preview-video" src={blobUrl}>
                    Your browser does not support the video tag.
                  </video>
                </div>
              )}

              {type === 'audio' && (
                <div className="preview-audio-wrap">
                  <div className="preview-audio-icon">🎵</div>
                  <div className="preview-audio-name">{file.name}</div>
                  <audio controls autoPlay className="preview-audio" src={blobUrl} />
                </div>
              )}

              {type === 'pdf' && (
                <iframe
                  src={blobUrl}
                  className="preview-pdf"
                  title={file.name}
                />
              )}

              {type === 'text' && (
                <div className="preview-text-wrap">
                  <pre className="preview-text">{text}</pre>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
