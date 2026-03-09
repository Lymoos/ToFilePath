import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'
import FilePreview, { canPreview } from '../components/FilePreview'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024, s = ['B','KB','MB','GB','TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${s[i]}`
}

function fileEmoji(name = '') {
  const ext = name.split('.').pop().toLowerCase()
  const map = {
    zip:'📦', rar:'📦', '7z':'📦', tar:'📦', gz:'📦', bz2:'📦', xz:'📦',
    pdf:'📄', doc:'📝', docx:'📝', xls:'📊', xlsx:'📊', ppt:'📊', pptx:'📊',
    txt:'📃', md:'📃', csv:'📃',
    jpg:'🖼', jpeg:'🖼', png:'🖼', gif:'🖼', svg:'🖼', webp:'🖼', bmp:'🖼',
    mp4:'🎬', mov:'🎬', avi:'🎬', mkv:'🎬', webm:'🎬',
    mp3:'🎵', wav:'🎵', flac:'🎵', ogg:'🎵', m4a:'🎵',
    exe:'⚙️', msi:'⚙️', dmg:'⚙️', deb:'⚙️',
    js:'💻', ts:'💻', jsx:'💻', tsx:'💻', py:'💻', go:'💻', rs:'💻',
    json:'💻', yaml:'💻', yml:'💻', toml:'💻', xml:'💻',
    sql:'🗄', db:'🗄', sqlite:'🗄',
  }
  return map[ext] || '📁'
}

function timeAgo(dateStr, tr) {
  const diff = Date.now() - new Date(dateStr)
  const m = Math.floor(diff/60000), h = Math.floor(diff/3600000), d = Math.floor(diff/86400000)
  if (m < 1) return tr('storage.justNow')
  if (m < 60) return tr('storage.mAgo', { n: m })
  if (h < 24) return tr('storage.hAgo', { n: h })
  return tr('storage.dAgo', { n: d })
}

function apiClient(token) {
  const h = { Authorization: `Bearer ${token}` }
  return {
    get:    url        => fetch(url, { headers: h }),
    post:   (url, b)   => fetch(url, { method:'POST',   headers:{...h,'Content-Type':'application/json'}, body:JSON.stringify(b) }),
    put:    (url, b)   => fetch(url, { method:'PUT',    headers:{...h,'Content-Type':'application/json'}, body:JSON.stringify(b) }),
    del:    url        => fetch(url, { method:'DELETE', headers: h }),
    upload: (url, fd)  => fetch(url, { method:'POST',   headers: h, body: fd }),
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StorageBar({ used, limit, tr }) {
  const pct = Math.min(100, limit > 0 ? (used/limit)*100 : 0)
  const color = pct > 90 ? 'var(--red)' : pct > 70 ? 'var(--yellow)' : 'var(--green)'
  return (
    <div className="storage-bar-wrap">
      <div className="storage-bar-labels">
        <span>{formatBytes(used)} {tr('storage.used')}</span>
        <span>{formatBytes(limit)}</span>
      </div>
      <div className="storage-bar-track">
        <div className="storage-bar-fill" style={{ width:`${pct}%`, background:color }} />
      </div>
    </div>
  )
}

function FolderTreeItem({ dir, currentDir, onNavigate, allDirs }) {
  const children = allDirs.filter(d => d.parentId === dir.id)
  const isActive = currentDir === dir.id
  return (
    <div className="folder-tree-item">
      <button className={`folder-tree-btn ${isActive ? 'active' : ''}`} onClick={() => onNavigate(dir.id)}>
        <span className="folder-tree-icon">{isActive ? '📂' : '📁'}</span>
        <span className="folder-tree-name">{dir.name}</span>
      </button>
      {children.length > 0 && (
        <div className="folder-tree-children">
          {children.map(c => <FolderTreeItem key={c.id} dir={c} currentDir={currentDir} onNavigate={onNavigate} allDirs={allDirs} />)}
        </div>
      )}
    </div>
  )
}

function Breadcrumb({ currentDir, allDirs, onNavigate, tr }) {
  const path = []
  let id = currentDir
  while (id) {
    const d = allDirs.find(x => x.id === id)
    if (!d) break
    path.unshift(d); id = d.parentId
  }
  return (
    <nav className="breadcrumb">
      <button className="breadcrumb-btn" onClick={() => onNavigate('')}>
        <span className="breadcrumb-home-emoji">🏠</span>
        <span className="breadcrumb-text">{tr('storage.root')}</span>
      </button>
      {path.map(d => (
        <span key={d.id} className="breadcrumb-sep">
          <span className="breadcrumb-arrow">›</span>
          <button className="breadcrumb-btn" onClick={() => onNavigate(d.id)}>
            <span className="breadcrumb-text">{d.name}</span>
          </button>
        </span>
      ))}
    </nav>
  )
}

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function FolderCard({ dir, onOpen, onDelete, onDownloadZip, onRename, tr }) {
  const [confirm, setConfirm] = useState(false)
  return (
    <div className="storage-card folder-card">
      <button className="storage-card-main" onClick={onOpen}>
        <div className="storage-card-icon folder-icon">📁</div>
        <div className="storage-card-info">
          <div className="storage-card-name">{dir.name}</div>
          <div className="storage-card-meta">{tr('storage.folder')} · {timeAgo(dir.createdAt, tr)}</div>
        </div>
      </button>
      <div className="storage-card-actions">
        <button className="card-action-btn" onClick={onRename} title={tr('storage.rename')}>
          <PencilIcon />
        </button>
        <button className="card-action-btn" onClick={onDownloadZip} title={tr('storage.downloadZip')}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <polyline points="7 10 12 15 17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span className="btn-label">ZIP</span>
        </button>
        {confirm ? (
          <>
            <button className="card-action-btn danger" onClick={onDelete}>{tr('storage.delete')}</button>
            <button className="card-action-btn" onClick={() => setConfirm(false)}>{tr('storage.cancel')}</button>
          </>
        ) : (
          <button className="card-action-btn" onClick={() => setConfirm(true)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M9 6V4h6v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

function FileCard({ file, token, onDelete, onPreview, onRename, tr }) {
  const [confirm, setConfirm] = useState(false)
  const previewable = canPreview(file.name)

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

  return (
    <div className="storage-card file-card">
      <div className="storage-card-main" style={{ cursor: previewable ? 'pointer' : 'default' }}
           onClick={previewable ? onPreview : undefined}>
        <div className="storage-card-icon">{fileEmoji(file.name)}</div>
        <div className="storage-card-info">
          <div className="storage-card-name" title={file.name}>{file.name}</div>
          <div className="storage-card-meta">
            {formatBytes(file.size)} · {timeAgo(file.uploadedAt, tr)}
            {previewable && <span className="preview-hint"> · {tr('storage.clickToPreview')}</span>}
          </div>
        </div>
      </div>
      <div className="storage-card-actions">
        <button className="card-action-btn" onClick={onRename} title={tr('storage.rename')}>
          <PencilIcon />
        </button>
        {previewable && (
          <button className="card-action-btn" onClick={onPreview} title={tr('storage.preview')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2"/>
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </button>
        )}
        <button className="card-action-btn" onClick={handleDownload} title={tr('storage.download')}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <polyline points="7 10 12 15 17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
        {confirm ? (
          <>
            <button className="card-action-btn danger" onClick={onDelete}>{tr('storage.delete')}</button>
            <button className="card-action-btn" onClick={() => setConfirm(false)}>{tr('storage.cancel')}</button>
          </>
        ) : (
          <button className="card-action-btn" onClick={() => setConfirm(true)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M9 6V4h6v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

function NewFolderModal({ onClose, onCreated, parentId, tr }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { token } = useAuth()
  const inputRef = useRef(null)
  useEffect(() => { inputRef.current?.focus() }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) { setError('Enter a folder name'); return }
    setLoading(true)
    const res = await fetch('/api/storage/dirs', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed, parentId }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed'); setLoading(false); return }
    onCreated(data); onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{tr('storage.newFolder')}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="auth-input-wrap">
              <input ref={inputRef} type="text" placeholder="Folder name"
                value={name} onChange={e => { setName(e.target.value); setError('') }} maxLength={64} />
            </div>
            {error && <div className="auth-error" style={{ marginTop:'0.75rem' }}>{error}</div>}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>{tr('storage.cancel')}</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
              {loading ? <><span className="spinner" /> Creating…</> : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function RenameModal({ onClose, onRenamed, target, type, tr }) {
  const displayName = target.name || target.originalName || ''
  const [name, setName] = useState(displayName)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { token } = useAuth()
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) { setError('Enter a name'); return }
    if (trimmed === displayName) { onClose(); return }
    setLoading(true)
    const url = type === 'dir'
      ? `/api/storage/dirs/${target.id}`
      : `/api/storage/files/${target.id}`
    const res = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed'); setLoading(false); return }
    onRenamed(data); onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{type === 'dir' ? tr('storage.renameFolder') : tr('storage.renameFile')}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="auth-input-wrap">
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={e => { setName(e.target.value); setError('') }}
                maxLength={type === 'dir' ? 64 : 256}
                autoComplete="off"
              />
            </div>
            {error && <div className="auth-error" style={{ marginTop:'0.75rem' }}>{error}</div>}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>{tr('storage.cancel')}</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
              {loading ? <><span className="spinner" /> {tr('storage.rename')}…</> : tr('storage.rename')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function UploadToast({ files, tr }) {
  return (
    <div className="upload-toast">
      <div className="upload-toast-header">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <polyline points="17 8 12 3 7 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        {tr('storage.uploading', { n: files.length, word: files.length === 1 ? tr('storage.file') : tr('storage.files') })}
      </div>
      {files.map(f => (
        <div key={f.name} className="upload-toast-file">
          <span className="upload-toast-name">{f.name}</span>
          <div className="progress-bar-wrap" style={{ height:4, marginTop:4 }}>
            <div className="progress-bar" style={{ width:`${f.progress}%`, height:'100%', transition:'width 0.3s ease' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── FAB Component ─────────────────────────────────────────────────────────────

function FAB({ onUploadFiles, onUploadFolder, onNewFolder, tr }) {
  const [open, setOpen] = useState(false)
  const fileRef = useRef()
  const folderRef = useRef()

  return (
    <>
      {open && (
        <>
          <div style={{ position:'fixed', inset:0, zIndex:89 }} onClick={() => setOpen(false)} />
          <div className="fab-menu">
            <button className="fab-menu-item" onClick={() => { setOpen(false); onNewFolder() }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" stroke="currentColor" strokeWidth="2"/>
                <line x1="12" y1="11" x2="12" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <line x1="9" y1="14" x2="15" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              {tr('storage.newFolder')}
            </button>
            <button className="fab-menu-item" onClick={() => { setOpen(false); folderRef.current?.click() }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" stroke="currentColor" strokeWidth="2"/>
                <line x1="12" y1="11" x2="12" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <line x1="9" y1="14" x2="15" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Upload folder
            </button>
            <button className="fab-menu-item" onClick={() => { setOpen(false); fileRef.current?.click() }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="17 8 12 3 7 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              {tr('storage.upload')}
            </button>
          </div>
        </>
      )}
      <button className="storage-fab" onClick={() => setOpen(v => !v)} aria-label="Quick actions">
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        )}
      </button>
      <input ref={fileRef} type="file" multiple hidden onChange={e => { if (e.target.files?.length) onUploadFiles(e.target.files); e.target.value = '' }} />
      <input ref={folderRef} type="file" webkitdirectory="" mozdirectory="" hidden onChange={e => { if (e.target.files?.length) onUploadFolder(e.target.files); e.target.value = '' }} />
    </>
  )
}

// ── Main Storage Page ─────────────────────────────────────────────────────────

const SIDEBAR_MIN = 180
const SIDEBAR_MAX = 420
const SIDEBAR_DEFAULT = 260

export default function Storage() {
  const { user, token, logout } = useAuth()
  const { tr } = useLang()
  const navigate = useNavigate()

  const [allDirs, setAllDirs]     = useState([])
  const [files, setFiles]         = useState([])
  const [currentDir, setCurrentDir] = useState('')
  const [stats, setStats]         = useState({ storageUsed:0, storageLimit:32212254720, fileCount:0, dirCount:0 })
  const [loadingContent, setLoadingContent] = useState(true)
  const [showNewFolder, setShowNewFolder]   = useState(false)
  const [renameTarget, setRenameTarget]     = useState(null)
  const [uploadingFiles, setUploadingFiles] = useState([])
  const [dragOver, setDragOver]   = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT)
  const [previewFile, setPreviewFile] = useState(null)

  // ── Idea 1: File search ───────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('')

  // ── Idea 3: Grid / List view toggle ──────────────────────────
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('tfp_view') || 'list')

  const fileInputRef = useRef(null)
  const folderInputRef = useRef(null)
  const dragHandleRef = useRef(null)
  const isResizing = useRef(false)

  const http = apiClient(token)

  // Persist view mode
  useEffect(() => { localStorage.setItem('tfp_view', viewMode) }, [viewMode])

  // ── Resizable sidebar ─────────────────────────────────────────
  useEffect(() => {
    const onMouseMove = (e) => {
      if (!isResizing.current) return
      const newWidth = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, e.clientX))
      setSidebarWidth(newWidth)
    }
    const onMouseUp = () => { isResizing.current = false; document.body.style.cursor = '' }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  const startResize = (e) => {
    e.preventDefault()
    isResizing.current = true
    document.body.style.cursor = 'col-resize'
  }

  // ── Data loading ──────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoadingContent(true)
    try {
      const [dirsRes, filesRes, statsRes] = await Promise.all([
        http.get('/api/storage/dirs'),
        http.get(`/api/storage/files?dir=${currentDir}`),
        http.get('/api/storage/stats'),
      ])
      if (dirsRes.ok)  setAllDirs(await dirsRes.json())
      if (filesRes.ok) setFiles(await filesRes.json())
      if (statsRes.ok) setStats(await statsRes.json())
    } catch {}
    setLoadingContent(false)
  }, [token, currentDir])

  useEffect(() => { loadAll() }, [loadAll])

  const navigate2Dir = (id) => { setCurrentDir(id); setFiles([]); setSearchQuery('') }

  // ── Actions ───────────────────────────────────────────────────
  const handleDeleteDir = async (dirId) => {
    await http.del(`/api/storage/dirs/${dirId}`)
    setAllDirs(prev => prev.filter(d => d.id !== dirId))
    const statsRes = await http.get('/api/storage/stats')
    if (statsRes.ok) setStats(await statsRes.json())
  }

  const handleDeleteFile = async (fileId) => {
    await http.del(`/api/storage/files/${fileId}`)
    setFiles(prev => prev.filter(f => f.id !== fileId))
    const statsRes = await http.get('/api/storage/stats')
    if (statsRes.ok) setStats(await statsRes.json())
  }

  const handleRenameDir = (updated) => {
    setAllDirs(prev => prev.map(d => d.id === updated.id ? updated : d))
  }

  const handleRenameFile = (updated) => {
    setFiles(prev => prev.map(f => f.id === updated.id ? { ...f, name: updated.name || f.name } : f))
  }

  const handleDownloadZip = (dir) => {
    const xhr = new XMLHttpRequest()
    xhr.open('GET', `/api/storage/dirs/${dir.id}/zip`)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.responseType = 'blob'
    xhr.onload = () => {
      const url = URL.createObjectURL(xhr.response)
      const a = document.createElement('a')
      a.href = url; a.download = `${dir.name}.zip`
      document.body.appendChild(a); a.click()
      setTimeout(() => { URL.revokeObjectURL(url); a.remove() }, 1000)
    }
    xhr.send()
  }

  // ── Regular file upload ───────────────────────────────────────
  const uploadFiles = async (fileList) => {
    const items = Array.from(fileList).map(f => ({ name:f.name, progress:0, file:f }))
    setUploadingFiles(items)
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      await new Promise(resolve => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', '/api/storage/files')
        xhr.setRequestHeader('Authorization', `Bearer ${token}`)
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded/e.total)*100)
            setUploadingFiles(prev => prev.map((f,idx) => idx===i ? {...f, progress:pct} : f))
          }
        }
        xhr.onload = () => {
          if (xhr.status === 200) {
            const nf = JSON.parse(xhr.responseText)
            if (nf.dirId === currentDir) setFiles(prev => [...prev, nf])
          }
          setUploadingFiles(prev => prev.map((f,idx) => idx===i ? {...f, progress:100} : f))
          resolve()
        }
        xhr.onerror = resolve
        const fd = new FormData()
        fd.append('file', item.file)
        fd.append('dirId', currentDir)
        xhr.send(fd)
      })
    }
    setTimeout(() => { setUploadingFiles([]); loadAll() }, 800)
  }

  // ── Folder upload (Idea: folder upload) ──────────────────────
  // Parses webkitRelativePath to reconstruct folder structure, creates dirs, then uploads files
  const uploadFolder = async (fileList) => {
    const allFiles = Array.from(fileList)
    if (!allFiles.length) return

    // Build path → dirId map, seeded with current directory
    const pathToId = { '': currentDir }

    // Collect all unique directory paths (BFS order, shallowest first)
    const dirPaths = new Set()
    allFiles.forEach(f => {
      const parts = f.webkitRelativePath.split('/')
      // Collect every ancestor path
      for (let depth = 1; depth < parts.length; depth++) {
        dirPaths.add(parts.slice(0, depth).join('/'))
      }
    })

    // Sort by depth so parents are created before children
    const sortedDirPaths = [...dirPaths].sort((a, b) => {
      const da = a.split('/').length, db = b.split('/').length
      return da - db
    })

    // Create all directories
    for (const dirPath of sortedDirPaths) {
      const parts = dirPath.split('/')
      const name = parts[parts.length - 1]
      const parentPath = parts.slice(0, -1).join('/')
      const parentId = pathToId[parentPath] ?? currentDir

      try {
        const res = await fetch('/api/storage/dirs', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, parentId }),
        })
        if (res.ok) {
          const dir = await res.json()
          pathToId[dirPath] = dir.id
          setAllDirs(prev => [...prev, dir])
        }
      } catch {}
    }

    // Now upload files
    const uploadItems = allFiles.map(f => {
      const parts = f.webkitRelativePath.split('/')
      const dirPath = parts.slice(0, -1).join('/')
      const dirId = pathToId[dirPath] ?? currentDir
      return { name: f.name, progress: 0, file: f, dirId }
    })

    setUploadingFiles(uploadItems.map(i => ({ name: i.name, progress: 0 })))

    for (let i = 0; i < uploadItems.length; i++) {
      const item = uploadItems[i]
      await new Promise(resolve => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', '/api/storage/files')
        xhr.setRequestHeader('Authorization', `Bearer ${token}`)
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100)
            setUploadingFiles(prev => prev.map((f, idx) => idx === i ? { ...f, progress: pct } : f))
          }
        }
        xhr.onload = () => {
          setUploadingFiles(prev => prev.map((f, idx) => idx === i ? { ...f, progress: 100 } : f))
          resolve()
        }
        xhr.onerror = resolve
        const fd = new FormData()
        fd.append('file', item.file)
        fd.append('dirId', item.dirId)
        xhr.send(fd)
      })
    }

    setTimeout(() => { setUploadingFiles([]); loadAll() }, 800)
  }

  const handleFilePick = (e) => {
    if (e.target.files?.length) uploadFiles(e.target.files)
    e.target.value = ''
  }

  const handleFolderPick = (e) => {
    if (e.target.files?.length) uploadFolder(e.target.files)
    e.target.value = ''
  }

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files)
  }

  const handleLogout = async () => { await logout(); navigate('/') }

  // ── Filtered items (search) ───────────────────────────────────
  const q = searchQuery.trim().toLowerCase()
  const currentSubDirs = allDirs.filter(d => {
    if (d.parentId !== currentDir) return false
    if (q) return d.name.toLowerCase().includes(q)
    return true
  })
  const filteredFiles = q
    ? files.filter(f => f.name.toLowerCase().includes(q))
    : files

  const isEmpty = currentSubDirs.length === 0 && filteredFiles.length === 0 && !loadingContent

  return (
    <div className="storage-layout">
      {/* ── Sidebar backdrop on mobile ── */}
      {sidebarOpen && (
        <div
          className="mobile-sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`storage-sidebar ${sidebarOpen ? 'open' : 'closed'}`}
        style={sidebarOpen ? { width: sidebarWidth } : undefined}
      >
        <div className="sidebar-section">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{user?.username?.[0]?.toUpperCase()}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-username">{user?.username}</div>
              <div className="sidebar-email">{user?.email || '—'}</div>
            </div>
            <Link to="/settings" className="sidebar-gear-btn" title={tr('storage.settings')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </Link>
          </div>
        </div>

        <div className="sidebar-section sidebar-nav">
          <div className="sidebar-label">{tr('storage.navigation')}</div>
          <button className={`sidebar-nav-btn ${currentDir==='' ? 'active':''}`} onClick={() => navigate2Dir('')}>
            <span>🏠</span> {tr('storage.root')}
          </button>
          {allDirs.filter(d => d.parentId === '').map(dir => (
            <FolderTreeItem key={dir.id} dir={dir} currentDir={currentDir}
              onNavigate={navigate2Dir} allDirs={allDirs} />
          ))}
        </div>

        <div className="sidebar-section sidebar-stats">
          <div className="sidebar-label">{tr('storage.storageLabel')}</div>
          <StorageBar used={stats.storageUsed} limit={stats.storageLimit} tr={tr} />
          <div className="sidebar-stat-row">
            <span>{stats.fileCount} {tr('storage.files')}</span>
            <span>{stats.dirCount} {tr('storage.foldersLabel')}</span>
          </div>
        </div>

        <div className="sidebar-section sidebar-bottom">
          <button className="btn btn-ghost sidebar-logout" onClick={handleLogout}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {tr('storage.signOut')}
          </button>
        </div>
      </aside>

      {/* ── Drag handle ── */}
      {sidebarOpen && (
        <div className="sidebar-drag-handle" ref={dragHandleRef} onMouseDown={startResize} />
      )}

      {/* ── Main ── */}
      <div className="storage-main">
        {/* Header */}
        <div className="storage-header">
          <div className="storage-header-left">
            <button className="sidebar-toggle" onClick={() => setSidebarOpen(v => !v)}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <line x1="3" y1="18" x2="21" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
            <Breadcrumb currentDir={currentDir} allDirs={allDirs} onNavigate={navigate2Dir} tr={tr} />
          </div>
          <div className="storage-header-actions">
            {/* Idea 3: View toggle */}
            <div className="view-toggle-group">
              <button
                className={`view-toggle-btn${viewMode === 'list' ? ' active' : ''}`}
                onClick={() => setViewMode('list')}
                title="List view"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <line x1="8" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="8" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="8" y1="18" x2="21" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="3" cy="6" r="1.5" fill="currentColor"/>
                  <circle cx="3" cy="12" r="1.5" fill="currentColor"/>
                  <circle cx="3" cy="18" r="1.5" fill="currentColor"/>
                </svg>
              </button>
              <button
                className={`view-toggle-btn${viewMode === 'grid' ? ' active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Grid view"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
                  <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
                  <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
                  <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
                </svg>
              </button>
            </div>

            <button className="btn btn-ghost btn-sm" onClick={() => setShowNewFolder(true)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" stroke="currentColor" strokeWidth="2"/>
                <line x1="12" y1="11" x2="12" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <line x1="9" y1="14" x2="15" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <span className="btn-label">{tr('storage.newFolder')}</span>
            </button>

            {/* Folder upload button */}
            <button className="btn btn-ghost btn-sm" onClick={() => folderInputRef.current?.click()}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" stroke="currentColor" strokeWidth="2"/>
                <polyline points="12 12 12 8 15 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="12" y1="8" x2="9" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <span className="btn-label">Folder</span>
            </button>

            <button className="btn btn-primary btn-sm" onClick={() => fileInputRef.current?.click()}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="17 8 12 3 7 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <span className="btn-label">{tr('storage.upload')}</span>
            </button>
            <input ref={fileInputRef} type="file" multiple hidden onChange={handleFilePick} />
            <input ref={folderInputRef} type="file" webkitdirectory="" mozdirectory="" hidden onChange={handleFolderPick} />
          </div>
        </div>

        {/* Idea 1: Search bar */}
        <div className="storage-search-wrap">
          <div className="storage-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
              <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              placeholder="Search files and folders…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="storage-search-clear" onClick={() => setSearchQuery('')}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div
          className={`storage-content ${dragOver ? 'drag-active' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {dragOver && (
            <div className="drag-overlay">
              <div className="drag-overlay-inner">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <polyline points="17 8 12 3 7 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <p>{tr('storage.dropToUpload')}</p>
              </div>
            </div>
          )}

          {loadingContent ? (
            <div className="storage-loading">
              <span className="spinner" style={{ width:32, height:32, borderWidth:3 }} />
              <span>Loading…</span>
            </div>
          ) : isEmpty ? (
            <div className="storage-empty">
              <div className="storage-empty-icon">{searchQuery ? '🔍' : '📂'}</div>
              <h3>{searchQuery ? 'No results found' : tr('storage.empty')}</h3>
              <p>{searchQuery ? `No files or folders matching "${searchQuery}"` : tr('storage.emptySub')}</p>
              {!searchQuery && (
                <div style={{ display:'flex', gap:'0.75rem', marginTop:'1.25rem', justifyContent:'center', flexWrap:'wrap' }}>
                  <button className="btn btn-ghost" onClick={() => setShowNewFolder(true)}>{tr('storage.newFolder')}</button>
                  <button className="btn btn-ghost" onClick={() => folderInputRef.current?.click()}>Upload folder</button>
                  <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()}>{tr('storage.upload')}</button>
                </div>
              )}
            </div>
          ) : (
            <div className={`storage-grid${viewMode === 'grid' ? ' grid-view' : ' list-view'}`}>
              {currentSubDirs.map((dir, i) => (
                <FolderCard key={dir.id} dir={dir} tr={tr}
                  style={{ animationDelay: `${i * 0.05}s` }}
                  onOpen={() => navigate2Dir(dir.id)}
                  onDelete={() => handleDeleteDir(dir.id)}
                  onDownloadZip={() => handleDownloadZip(dir)}
                  onRename={() => setRenameTarget({ item: dir, type: 'dir' })}
                />
              ))}
              {filteredFiles.map((file, i) => (
                <FileCard key={file.id} file={file} token={token} tr={tr}
                  onDelete={() => handleDeleteFile(file.id)}
                  onPreview={() => setPreviewFile(file)}
                  onRename={() => setRenameTarget({ item: file, type: 'file' })}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── FAB (mobile) — Idea 5 ── */}
      <FAB
        onUploadFiles={uploadFiles}
        onUploadFolder={uploadFolder}
        onNewFolder={() => setShowNewFolder(true)}
        tr={tr}
      />

      {showNewFolder && (
        <NewFolderModal parentId={currentDir} tr={tr}
          onClose={() => setShowNewFolder(false)}
          onCreated={dir => {
            setAllDirs(prev => [...prev, dir])
            setStats(prev => ({ ...prev, dirCount: prev.dirCount + 1 }))
          }}
        />
      )}

      {renameTarget && (
        <RenameModal
          target={renameTarget.item}
          type={renameTarget.type}
          tr={tr}
          onClose={() => setRenameTarget(null)}
          onRenamed={renameTarget.type === 'dir' ? handleRenameDir : handleRenameFile}
        />
      )}

      {uploadingFiles.length > 0 && <UploadToast files={uploadingFiles} tr={tr} />}

      {previewFile && <FilePreview file={previewFile} onClose={() => setPreviewFile(null)} />}
    </div>
  )
}
