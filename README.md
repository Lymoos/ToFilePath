# DropVault — Secure File Sharing

A self-hosted file sharing service with self-destructing links, password protection, and download limits.

**Stack:** Go (backend) + React + Vite (frontend)

---

## Features

- Drag & drop upload up to **500 MB**
- **Short links** (6-character codes)
- **Self-destructing links** — set expiry from 1 hour to 30 days
- **Download limits** — cap at 1, 5, 10, 25, or 50 downloads
- **Password protection** — lock files with a password
- **QR code** generation for every upload
- **Download counter** — see how many times a file was downloaded
- **Auto-cleanup** — expired files deleted automatically from disk
- No accounts, no tracking, no cookies

---

## Project Structure

```
ToFilePath/
├── backend/
│   ├── main.go       # Go HTTP server
│   ├── go.mod
│   └── uploads/      # created automatically at runtime
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── Home.jsx      # Upload page
    │   │   └── Download.jsx  # Download page
    │   ├── components/
    │   │   └── Navbar.jsx
    │   ├── App.jsx
    │   ├── index.css
    │   └── main.jsx
    ├── index.html
    ├── package.json
    └── vite.config.js
```

---

## Quick Start

### 1. Install frontend dependencies

```bash
cd frontend
npm install
```

### 2. Development mode (frontend + backend separately)

**Terminal 1 — Go backend:**
```bash
cd backend
go run main.go
```
Server starts on `http://localhost:8080`

**Terminal 2 — React dev server:**
```bash
cd frontend
npm run dev
```
Frontend starts on `http://localhost:5173` (proxies `/api` to `:8080`)

Open `http://localhost:5173` in your browser.

---

### 3. Production build (single binary serves everything)

```bash
# Build the frontend into backend/dist
cd frontend
npm run build

# Run the Go server (serves API + static files)
cd ../backend
go run main.go
```

Open `http://localhost:8080`.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/upload` | Upload a file (multipart form) |
| `GET` | `/api/file/:code` | Get file metadata |
| `GET` | `/api/download/:code` | Download a file |
| `GET` | `/api/stats` | Server-wide stats |

### Upload form fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `file` | File | required | The file to upload |
| `expiryHours` | int | `24` | Hours until link expires (1–720) |
| `maxDownloads` | int | `0` | Max downloads (`0` = unlimited) |
| `password` | string | `""` | Optional password |

---

## Configuration

Edit constants in `backend/main.go`:

```go
const (
    maxUploadSize = 500 << 20  // 500 MB limit
    uploadDir     = "uploads"  // Storage directory
    listenAddr    = ":8080"    // HTTP port
)
```

---

## Notes

- File metadata is stored **in-memory** — restarting the server loses all records (files on disk remain). For persistence, add a database (SQLite/PostgreSQL).
- For production, put the server behind a reverse proxy (nginx/Caddy) with TLS.
