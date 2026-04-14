package main

import (
	"archive/zip"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
)

const (
	maxAnonUploadSize    = 3 << 30         // 3 GB — anonymous uploads
	maxAccountUploadSize = 10 << 30        // 10 GB — max body for account uploads (admin ceiling)
	userStorageLimit     = int64(5) << 30  // 5 GB per regular account
	adminStorageLimit    = int64(10) << 30 // 10 GB for admin account
	uploadDir            = "uploads"
	accountsDir          = "uploads/accounts"
	dataFile             = "data/state.json"
	listenAddr           = ":8085"
	codeChars            = "abcdefghijkmnpqrstuvwxyz23456789"
	tokenExpiry          = 30 * 24 * time.Hour
)

// ─── Models ───────────────────────────────────────────────────────────────────

type FileRecord struct {
	ShortCode    string    `json:"shortCode"`
	OriginalName string    `json:"originalName"`
	Size         int64     `json:"size"`
	UploadedAt   time.Time `json:"uploadedAt"`
	ExpiresAt    time.Time `json:"expiresAt"`
	Downloads    int       `json:"downloads"`
	MaxDownloads int       `json:"maxDownloads"`
	HasPassword  bool      `json:"hasPassword"`
	password     string
}

type User struct {
	ID           string    `json:"id"`
	Username     string    `json:"username"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	Salt         string    `json:"-"`
	CreatedAt    time.Time `json:"createdAt"`
	StorageUsed  int64     `json:"storageUsed"`
	IsAdmin      bool      `json:"isAdmin"`
	Language     string    `json:"language"`
}

type Session struct {
	Token     string
	UserID    string
	ExpiresAt time.Time
}

type Directory struct {
	ID        string    `json:"id"`
	UserID    string    `json:"userId"`
	Name      string    `json:"name"`
	ParentID  string    `json:"parentId"`
	CreatedAt time.Time `json:"createdAt"`
}

type AccountFile struct {
	ID           string    `json:"id"`
	UserID       string    `json:"userId"`
	DirID        string    `json:"dirId"`
	OriginalName string    `json:"name"`
	Size         int64     `json:"size"`
	UploadedAt   time.Time `json:"uploadedAt"`
	MimeType     string    `json:"mimeType"`
}

type SharedLink struct {
	ID        string    `json:"id"`
	UserID    string    `json:"userId"`
	FileIDs   []string  `json:"fileIds"`
	DirIDs    []string  `json:"dirIds"`
	Title     string    `json:"title"`
	ExpiresAt time.Time `json:"expiresAt"`
	CreatedAt time.Time `json:"createdAt"`
	Downloads int       `json:"downloads"`
}

// ─── State ────────────────────────────────────────────────────────────────────

var (
	mu      sync.RWMutex
	records = make(map[string]*FileRecord)

	authMu       sync.RWMutex
	users        = make(map[string]*User)
	usersByName  = make(map[string]string)
	usersByEmail = make(map[string]string)
	sessions     = make(map[string]*Session)

	storageMu sync.RWMutex
	dirs      = make(map[string]*Directory)
	accFiles  = make(map[string]*AccountFile)

	shareMu    sync.RWMutex
	shareLinks = make(map[string]*SharedLink)
)

// ─── Helpers ──────────────────────────────────────────────────────────────────

func randHex(n int) string {
	b := make([]byte, n)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func genCode() string {
	b := make([]byte, 6)
	rand.Read(b)
	for i := range b {
		b[i] = codeChars[int(b[i])%len(codeChars)]
	}
	return string(b)
}

func uniqueCode() string {
	mu.Lock()
	defer mu.Unlock()
	for {
		c := genCode()
		if _, ok := records[c]; !ok {
			return c
		}
	}
}

func hashPassword(password, salt string) string {
	h := sha256.New()
	h.Write([]byte(salt + ":" + password))
	return hex.EncodeToString(h.Sum(nil))
}

func cors(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next(w, r)
	}
}

func jsonErr(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

func jsonOK(w http.ResponseWriter, data any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

func authFromRequest(r *http.Request) *User {
	auth := r.Header.Get("Authorization")
	if !strings.HasPrefix(auth, "Bearer ") {
		return nil
	}
	token := strings.TrimPrefix(auth, "Bearer ")
	authMu.RLock()
	sess, ok := sessions[token]
	authMu.RUnlock()
	if !ok || time.Now().After(sess.ExpiresAt) {
		return nil
	}
	authMu.RLock()
	user := users[sess.UserID]
	authMu.RUnlock()
	return user
}

func storageQuota(u *User) int64 {
	if u.IsAdmin {
		return adminStorageLimit
	}
	return userStorageLimit
}

func userJSON(u *User) map[string]any {
	return map[string]any{
		"id":           u.ID,
		"username":     u.Username,
		"email":        u.Email,
		"createdAt":    u.CreatedAt,
		"storageUsed":  u.StorageUsed,
		"storageLimit": storageQuota(u),
		"isAdmin":      u.IsAdmin,
		"language":     u.Language,
	}
}

// seedAdmin creates the lymoos admin account at startup if it doesn't exist.
func seedAdmin() {
	authMu.Lock()
	defer authMu.Unlock()
	if _, exists := usersByName["lymoos"]; exists {
		return
	}
	salt := randHex(16)
	hash := hashPassword("Maxim1027q", salt)
	user := &User{
		ID:           randHex(8),
		Username:     "lymoos",
		Email:        "",
		PasswordHash: hash,
		Salt:         salt,
		CreatedAt:    time.Now(),
		IsAdmin:      true,
		Language:     "en",
	}
	users[user.ID] = user
	usersByName["lymoos"] = user.ID
	os.MkdirAll(filepath.Join(accountsDir, user.ID), 0o755)
	log.Printf("admin account ready: lymoos")
}

// ─── Anonymous file sharing ───────────────────────────────────────────────────

func uploadHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	// Use a plain LimitedReader instead of MaxBytesReader to avoid Go's
	// automatic plain-text 413 response, which breaks JSON error parsing in
	// the frontend.  The inner per-part LimitedReader enforces the actual
	// size limit and returns a proper JSON error.
	r.Body = io.NopCloser(io.LimitReader(r.Body, maxAnonUploadSize+(8<<20)))
	mr, err := r.MultipartReader()
	if err != nil {
		jsonErr(w, http.StatusBadRequest, "invalid multipart form")
		return
	}

	expiryHours := 24
	maxDL := 0
	password := ""

	var (
		code         string
		originalName string
		size         int64
		haveFile     bool
	)

	for {
		part, partErr := mr.NextPart()
		if partErr == io.EOF {
			break
		}
		if partErr != nil {
			jsonErr(w, http.StatusBadRequest, "failed to parse upload stream")
			return
		}

		switch part.FormName() {
		case "file":
			if haveFile {
				part.Close()
				jsonErr(w, http.StatusBadRequest, "only one file is allowed")
				return
			}
			if part.FileName() == "" {
				part.Close()
				jsonErr(w, http.StatusBadRequest, "no file provided")
				return
			}

			code = uniqueCode()
			originalName = part.FileName()

			os.MkdirAll(uploadDir, 0o755)
			dst, createErr := os.Create(filepath.Join(uploadDir, code))
			if createErr != nil {
				part.Close()
				jsonErr(w, http.StatusInternalServerError, "failed to create file")
				return
			}

			limitReader := &io.LimitedReader{R: part, N: maxAnonUploadSize + 1}
			size, err = io.Copy(dst, limitReader)
			dst.Close()
			part.Close()
			if err != nil {
				os.Remove(filepath.Join(uploadDir, code))
				jsonErr(w, http.StatusInternalServerError, "failed to write file")
				return
			}
			if limitReader.N == 0 {
				os.Remove(filepath.Join(uploadDir, code))
				jsonErr(w, http.StatusRequestEntityTooLarge, "file too large — anonymous uploads are limited to 1 GB; create an account to upload up to 5 GB")
				return
			}
			haveFile = true

		case "expiryHours", "maxDownloads", "password":
			raw, readErr := io.ReadAll(io.LimitReader(part, 1<<20))
			part.Close()
			if readErr != nil {
				jsonErr(w, http.StatusBadRequest, "invalid form field")
				return
			}
			val := strings.TrimSpace(string(raw))
			switch part.FormName() {
			case "expiryHours":
				if n, convErr := strconv.Atoi(val); convErr == nil && n >= 1 && n <= 720 {
					expiryHours = n
				}
			case "maxDownloads":
				if n, convErr := strconv.Atoi(val); convErr == nil && n >= 0 {
					maxDL = n
				}
			case "password":
				password = val
			}

		default:
			io.Copy(io.Discard, io.LimitReader(part, 1<<20))
			part.Close()
		}
	}

	if !haveFile {
		jsonErr(w, http.StatusBadRequest, "no file provided")
		return
	}
	password = strings.TrimSpace(password)

	now := time.Now()
	rec := &FileRecord{
		ShortCode:    code,
		OriginalName: originalName,
		Size:         size,
		UploadedAt:   now,
		ExpiresAt:    now.Add(time.Duration(expiryHours) * time.Hour),
		MaxDownloads: maxDL,
		HasPassword:  password != "",
		password:     password,
	}
	mu.Lock()
	records[code] = rec
	mu.Unlock()

	log.Printf("upload code=%s name=%q size=%d", code, originalName, size)
	jsonOK(w, map[string]any{
		"shortCode":    code,
		"originalName": originalName,
		"size":         size,
		"expiresAt":    rec.ExpiresAt,
		"hasPassword":  rec.HasPassword,
		"maxDownloads": maxDL,
	})
}

func infoHandler(w http.ResponseWriter, r *http.Request) {
	code := strings.TrimPrefix(r.URL.Path, "/api/file/")
	mu.RLock()
	rec, ok := records[code]
	mu.RUnlock()
	if !ok {
		jsonErr(w, http.StatusNotFound, "file not found")
		return
	}
	if time.Now().After(rec.ExpiresAt) {
		jsonErr(w, http.StatusGone, "file has expired")
		return
	}
	jsonOK(w, map[string]any{
		"shortCode":    rec.ShortCode,
		"originalName": rec.OriginalName,
		"size":         rec.Size,
		"uploadedAt":   rec.UploadedAt,
		"expiresAt":    rec.ExpiresAt,
		"downloads":    rec.Downloads,
		"maxDownloads": rec.MaxDownloads,
		"hasPassword":  rec.HasPassword,
	})
}

func downloadHandler(w http.ResponseWriter, r *http.Request) {
	code := strings.TrimPrefix(r.URL.Path, "/api/download/")
	mu.Lock()
	rec, ok := records[code]
	if !ok {
		mu.Unlock()
		http.Error(w, "file not found", http.StatusNotFound)
		return
	}
	if time.Now().After(rec.ExpiresAt) {
		mu.Unlock()
		http.Error(w, "file has expired", http.StatusGone)
		return
	}
	if rec.MaxDownloads > 0 && rec.Downloads >= rec.MaxDownloads {
		mu.Unlock()
		http.Error(w, "download limit reached", http.StatusForbidden)
		return
	}
	if rec.HasPassword && r.URL.Query().Get("password") != rec.password {
		mu.Unlock()
		http.Error(w, "invalid password", http.StatusUnauthorized)
		return
	}
	rec.Downloads++
	mu.Unlock()

	f, err := os.Open(filepath.Join(uploadDir, code))
	if err != nil {
		http.Error(w, "file not found on disk", http.StatusNotFound)
		return
	}
	defer f.Close()

	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, rec.OriginalName))
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Length", strconv.FormatInt(rec.Size, 10))
	io.Copy(w, f)
}

func statsHandler(w http.ResponseWriter, r *http.Request) {
	mu.RLock()
	defer mu.RUnlock()
	var totalSize int64
	totalDL, active := 0, 0
	now := time.Now()
	for _, rec := range records {
		if !now.After(rec.ExpiresAt) {
			active++
		}
		totalSize += rec.Size
		totalDL += rec.Downloads
	}
	jsonOK(w, map[string]any{
		"totalFiles": len(records), "activeFiles": active,
		"totalSize": totalSize, "totalDownloads": totalDL,
	})
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

func registerHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	var body struct {
		Username string `json:"username"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonErr(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	body.Username = strings.TrimSpace(body.Username)
	body.Email = strings.ToLower(strings.TrimSpace(body.Email))
	body.Password = strings.TrimSpace(body.Password)

	if len(body.Username) < 3 || len(body.Username) > 32 {
		jsonErr(w, http.StatusBadRequest, "username must be 3–32 characters")
		return
	}
	if body.Email != "" && (!strings.Contains(body.Email, "@") || !strings.Contains(body.Email, ".")) {
		jsonErr(w, http.StatusBadRequest, "invalid email address")
		return
	}
	if len(body.Password) < 6 {
		jsonErr(w, http.StatusBadRequest, "password must be at least 6 characters")
		return
	}

	usernameLower := strings.ToLower(body.Username)
	authMu.Lock()
	defer authMu.Unlock()

	if _, exists := usersByName[usernameLower]; exists {
		jsonErr(w, http.StatusConflict, "username already taken")
		return
	}
	if body.Email != "" {
		if _, exists := usersByEmail[body.Email]; exists {
			jsonErr(w, http.StatusConflict, "email already registered")
			return
		}
	}

	salt := randHex(16)
	user := &User{
		ID:           randHex(8),
		Username:     body.Username,
		Email:        body.Email,
		PasswordHash: hashPassword(body.Password, salt),
		Salt:         salt,
		CreatedAt:    time.Now(),
		Language:     "en",
	}
	users[user.ID] = user
	usersByName[usernameLower] = user.ID
	if body.Email != "" {
		usersByEmail[body.Email] = user.ID
	}

	token := randHex(32)
	sessions[token] = &Session{Token: token, UserID: user.ID, ExpiresAt: time.Now().Add(tokenExpiry)}
	os.MkdirAll(filepath.Join(accountsDir, user.ID), 0o755)
	log.Printf("register user=%s", body.Username)
	jsonOK(w, map[string]any{"token": token, "user": userJSON(user)})
}

func loginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonErr(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	identifier := strings.ToLower(strings.TrimSpace(body.Username))

	authMu.Lock()
	defer authMu.Unlock()

	var user *User
	if strings.Contains(identifier, "@") {
		if uid, ok := usersByEmail[identifier]; ok {
			user = users[uid]
		}
	} else {
		if uid, ok := usersByName[identifier]; ok {
			user = users[uid]
		}
	}
	if user == nil || hashPassword(body.Password, user.Salt) != user.PasswordHash {
		jsonErr(w, http.StatusUnauthorized, "invalid username or password")
		return
	}
	token := randHex(32)
	sessions[token] = &Session{Token: token, UserID: user.ID, ExpiresAt: time.Now().Add(tokenExpiry)}
	log.Printf("login user=%s", user.Username)
	jsonOK(w, map[string]any{"token": token, "user": userJSON(user)})
}

func logoutHandler(w http.ResponseWriter, r *http.Request) {
	auth := r.Header.Get("Authorization")
	if strings.HasPrefix(auth, "Bearer ") {
		authMu.Lock()
		delete(sessions, strings.TrimPrefix(auth, "Bearer "))
		authMu.Unlock()
	}
	jsonOK(w, map[string]string{"status": "ok"})
}

func meHandler(w http.ResponseWriter, r *http.Request) {
	user := authFromRequest(r)
	if user == nil {
		jsonErr(w, http.StatusUnauthorized, "not authenticated")
		return
	}
	jsonOK(w, userJSON(user))
}

// PUT /api/auth/change-password
func changePasswordHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		jsonErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	user := authFromRequest(r)
	if user == nil {
		jsonErr(w, http.StatusUnauthorized, "not authenticated")
		return
	}
	var body struct {
		OldPassword string `json:"oldPassword"`
		NewPassword string `json:"newPassword"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonErr(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	authMu.Lock()
	defer authMu.Unlock()
	if hashPassword(body.OldPassword, user.Salt) != user.PasswordHash {
		jsonErr(w, http.StatusUnauthorized, "current password is incorrect")
		return
	}
	if len(body.NewPassword) < 6 {
		jsonErr(w, http.StatusBadRequest, "new password must be at least 6 characters")
		return
	}
	newSalt := randHex(16)
	user.Salt = newSalt
	user.PasswordHash = hashPassword(body.NewPassword, newSalt)
	jsonOK(w, map[string]string{"status": "ok"})
}

// PUT /api/auth/change-email
func changeEmailHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		jsonErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	user := authFromRequest(r)
	if user == nil {
		jsonErr(w, http.StatusUnauthorized, "not authenticated")
		return
	}
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonErr(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	email := strings.ToLower(strings.TrimSpace(body.Email))
	if !strings.Contains(email, "@") || !strings.Contains(email, ".") {
		jsonErr(w, http.StatusBadRequest, "invalid email address")
		return
	}
	authMu.Lock()
	defer authMu.Unlock()
	if hashPassword(body.Password, user.Salt) != user.PasswordHash {
		jsonErr(w, http.StatusUnauthorized, "password is incorrect")
		return
	}
	if _, exists := usersByEmail[email]; exists {
		jsonErr(w, http.StatusConflict, "email already in use")
		return
	}
	if user.Email != "" {
		delete(usersByEmail, user.Email)
	}
	user.Email = email
	usersByEmail[email] = user.ID
	jsonOK(w, userJSON(user))
}

// PUT /api/auth/settings
func userSettingsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		jsonErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	user := authFromRequest(r)
	if user == nil {
		jsonErr(w, http.StatusUnauthorized, "not authenticated")
		return
	}
	var body struct {
		Language string `json:"language"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonErr(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	authMu.Lock()
	if body.Language != "" {
		user.Language = body.Language
	}
	authMu.Unlock()
	jsonOK(w, userJSON(user))
}

// DELETE /api/auth/account
func deleteAccountHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		jsonErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	user := authFromRequest(r)
	if user == nil {
		jsonErr(w, http.StatusUnauthorized, "not authenticated")
		return
	}
	var body struct {
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonErr(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	authMu.RLock()
	if hashPassword(body.Password, user.Salt) != user.PasswordHash {
		authMu.RUnlock()
		jsonErr(w, http.StatusUnauthorized, "password is incorrect")
		return
	}
	authMu.RUnlock()

	storageMu.Lock()
	for id, f := range accFiles {
		if f.UserID == user.ID {
			os.Remove(filepath.Join(accountsDir, user.ID, id))
			delete(accFiles, id)
		}
	}
	for id, d := range dirs {
		if d.UserID == user.ID {
			delete(dirs, id)
		}
	}
	storageMu.Unlock()
	os.RemoveAll(filepath.Join(accountsDir, user.ID))

	authMu.Lock()
	delete(users, user.ID)
	delete(usersByName, strings.ToLower(user.Username))
	if user.Email != "" {
		delete(usersByEmail, user.Email)
	}
	for token, sess := range sessions {
		if sess.UserID == user.ID {
			delete(sessions, token)
		}
	}
	authMu.Unlock()
	jsonOK(w, map[string]string{"status": "deleted"})
}

// GET /api/admin/stats
func adminStatsHandler(w http.ResponseWriter, r *http.Request) {
	user := authFromRequest(r)
	if user == nil || !user.IsAdmin {
		jsonErr(w, http.StatusForbidden, "admin access required")
		return
	}
	authMu.RLock()
	userList := make([]map[string]any, 0, len(users))
	for _, u := range users {
		userList = append(userList, map[string]any{
			"id": u.ID, "username": u.Username, "email": u.Email,
			"createdAt": u.CreatedAt, "storageUsed": u.StorageUsed, "isAdmin": u.IsAdmin,
		})
	}
	authMu.RUnlock()

	storageMu.RLock()
	var totalStorage int64
	for _, f := range accFiles {
		totalStorage += f.Size
	}
	fileCount := len(accFiles)
	dirCount := len(dirs)
	storageMu.RUnlock()

	mu.RLock()
	anonFiles := len(records)
	mu.RUnlock()

	jsonOK(w, map[string]any{
		"users":        userList,
		"totalUsers":   len(userList),
		"totalFiles":   fileCount,
		"totalDirs":    dirCount,
		"anonFiles":    anonFiles,
		"totalStorage": totalStorage,
	})
}

// GET /api/admin/files  — list all anonymous uploads
// DELETE /api/admin/files/{code}  — delete an anonymous upload
func adminFilesHandler(w http.ResponseWriter, r *http.Request) {
	user := authFromRequest(r)
	if user == nil || !user.IsAdmin {
		jsonErr(w, http.StatusForbidden, "admin access required")
		return
	}

	code := strings.TrimPrefix(r.URL.Path, "/api/admin/files/")
	code = strings.TrimPrefix(code, "/api/admin/files")
	code = strings.Trim(code, "/")

	switch r.Method {
	case http.MethodGet:
		mu.RLock()
		list := make([]*FileRecord, 0, len(records))
		for _, rec := range records {
			list = append(list, rec)
		}
		mu.RUnlock()
		// Sort by upload date descending (newest first)
		for i := 1; i < len(list); i++ {
			for j := i; j > 0 && list[j].UploadedAt.After(list[j-1].UploadedAt); j-- {
				list[j], list[j-1] = list[j-1], list[j]
			}
		}
		jsonOK(w, list)

	case http.MethodDelete:
		if code == "" {
			jsonErr(w, http.StatusBadRequest, "missing file code")
			return
		}
		mu.Lock()
		rec, ok := records[code]
		if ok {
			delete(records, code)
		}
		mu.Unlock()
		if !ok {
			jsonErr(w, http.StatusNotFound, "file not found")
			return
		}
		_ = rec
		os.Remove(filepath.Join(uploadDir, code))
		saveState()
		jsonOK(w, map[string]string{"status": "deleted"})

	default:
		jsonErr(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

// DELETE /api/admin/users/{id}/storage — wipe all files & dirs for a user
func adminClearStorageHandler(w http.ResponseWriter, r *http.Request) {
	admin := authFromRequest(r)
	if admin == nil || !admin.IsAdmin {
		jsonErr(w, http.StatusForbidden, "admin access required")
		return
	}
	if r.Method != http.MethodDelete {
		jsonErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	targetID := strings.TrimPrefix(r.URL.Path, "/api/admin/users/")
	targetID = strings.TrimSuffix(targetID, "/storage")
	targetID = strings.TrimSpace(targetID)
	if targetID == "" {
		jsonErr(w, http.StatusBadRequest, "missing user id")
		return
	}

	authMu.RLock()
	target, ok := users[targetID]
	authMu.RUnlock()
	if !ok {
		jsonErr(w, http.StatusNotFound, "user not found")
		return
	}

	// Delete all files and dirs belonging to this user
	storageMu.Lock()
	for id, f := range accFiles {
		if f.UserID == targetID {
			os.Remove(filepath.Join(accountsDir, targetID, id))
			delete(accFiles, id)
		}
	}
	for id, d := range dirs {
		if d.UserID == targetID {
			delete(dirs, id)
		}
	}
	storageMu.Unlock()

	// Remove and recreate the user's directory (clean slate)
	os.RemoveAll(filepath.Join(accountsDir, targetID))
	os.MkdirAll(filepath.Join(accountsDir, targetID), 0o755)

	// Reset storage counter
	authMu.Lock()
	target.StorageUsed = 0
	users[targetID] = target
	authMu.Unlock()

	saveState()
	jsonOK(w, map[string]string{"status": "cleared", "userId": targetID})
}

// ─── Storage: Directories ─────────────────────────────────────────────────────

func storageDirsHandler(w http.ResponseWriter, r *http.Request) {
	user := authFromRequest(r)
	if user == nil {
		jsonErr(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	suffix := strings.TrimPrefix(r.URL.Path, "/api/storage/dirs")
	suffix = strings.TrimPrefix(suffix, "/")

	// Handle /api/storage/dirs/{id}/zip
	if strings.HasSuffix(suffix, "/zip") {
		if r.Method != http.MethodGet {
			jsonErr(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		dirID := strings.TrimSuffix(suffix, "/zip")
		storageDirZipHandler(w, r, user, dirID)
		return
	}

	dirID := suffix

	switch r.Method {
	case http.MethodGet:
		if r.URL.Query().Get("all") == "1" {
			storageMu.RLock()
			result := make([]*Directory, 0)
			for _, d := range dirs {
				if d.UserID == user.ID {
					result = append(result, d)
				}
			}
			storageMu.RUnlock()
			jsonOK(w, result)
			return
		}
		parentID := r.URL.Query().Get("parent")
		storageMu.RLock()
		result := make([]*Directory, 0)
		for _, d := range dirs {
			if d.UserID == user.ID && d.ParentID == parentID {
				result = append(result, d)
			}
		}
		storageMu.RUnlock()
		jsonOK(w, result)

	case http.MethodPost:
		var body struct {
			Name     string `json:"name"`
			ParentID string `json:"parentId"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			jsonErr(w, http.StatusBadRequest, "invalid JSON")
			return
		}
		body.Name = strings.TrimSpace(body.Name)
		if body.Name == "" || len(body.Name) > 64 {
			jsonErr(w, http.StatusBadRequest, "invalid folder name (1–64 chars)")
			return
		}
		if body.ParentID != "" {
			storageMu.RLock()
			parent, ok := dirs[body.ParentID]
			storageMu.RUnlock()
			if !ok || parent.UserID != user.ID {
				jsonErr(w, http.StatusBadRequest, "parent folder not found")
				return
			}
		}
		dir := &Directory{
			ID:        randHex(8),
			UserID:    user.ID,
			Name:      body.Name,
			ParentID:  body.ParentID,
			CreatedAt: time.Now(),
		}
		storageMu.Lock()
		dirs[dir.ID] = dir
		storageMu.Unlock()
		jsonOK(w, dir)

	case http.MethodPut:
		if dirID == "" {
			jsonErr(w, http.StatusBadRequest, "missing folder id")
			return
		}
		var body struct {
			Name     string  `json:"name"`
			ParentID *string `json:"parentId"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			jsonErr(w, http.StatusBadRequest, "invalid JSON")
			return
		}
		body.Name = strings.TrimSpace(body.Name)
		if body.Name != "" && len(body.Name) > 64 {
			jsonErr(w, http.StatusBadRequest, "invalid folder name (1–64 chars)")
			return
		}
		if body.ParentID != nil && *body.ParentID != "" {
			if *body.ParentID == dirID {
				jsonErr(w, http.StatusBadRequest, "cannot move folder into itself")
				return
			}
			storageMu.RLock()
			targetParent, pOk := dirs[*body.ParentID]
			storageMu.RUnlock()
			if !pOk || targetParent.UserID != user.ID {
				jsonErr(w, http.StatusBadRequest, "target folder not found")
				return
			}
		}
		storageMu.Lock()
		dir, ok := dirs[dirID]
		if !ok || dir.UserID != user.ID {
			storageMu.Unlock()
			jsonErr(w, http.StatusNotFound, "folder not found")
			return
		}
		if body.Name != "" {
			dir.Name = body.Name
		}
		if body.ParentID != nil {
			dir.ParentID = *body.ParentID
		}
		storageMu.Unlock()
		jsonOK(w, dir)

	case http.MethodDelete:
		if dirID == "" {
			jsonErr(w, http.StatusBadRequest, "missing folder id")
			return
		}
		storageMu.Lock()
		dir, ok := dirs[dirID]
		if !ok || dir.UserID != user.ID {
			storageMu.Unlock()
			jsonErr(w, http.StatusNotFound, "folder not found")
			return
		}
		var freed int64
		for id, f := range accFiles {
			if f.DirID == dirID && f.UserID == user.ID {
				os.Remove(filepath.Join(accountsDir, user.ID, id))
				freed += f.Size
				delete(accFiles, id)
			}
		}
		delete(dirs, dirID)
		storageMu.Unlock()
		if freed > 0 {
			authMu.Lock()
			user.StorageUsed -= freed
			authMu.Unlock()
		}
		jsonOK(w, map[string]string{"status": "deleted"})

	default:
		jsonErr(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

// storageDirZipHandler streams a ZIP of the directory to the client.
func storageDirZipHandler(w http.ResponseWriter, r *http.Request, user *User, dirID string) {
	storageMu.RLock()
	dir, ok := dirs[dirID]
	storageMu.RUnlock()
	if !ok || dir.UserID != user.ID {
		http.Error(w, "directory not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s.zip"`, dir.Name))

	zw := zip.NewWriter(w)
	defer zw.Close()

	var addDir func(dID, prefix string)
	addDir = func(dID, prefix string) {
		storageMu.RLock()
		var filesToAdd []*AccountFile
		var subDirs []*Directory
		for _, f := range accFiles {
			if f.UserID == user.ID && f.DirID == dID {
				filesToAdd = append(filesToAdd, f)
			}
		}
		for _, d := range dirs {
			if d.UserID == user.ID && d.ParentID == dID {
				subDirs = append(subDirs, d)
			}
		}
		storageMu.RUnlock()

		for _, f := range filesToAdd {
			entryPath := f.OriginalName
			if prefix != "" {
				entryPath = prefix + "/" + f.OriginalName
			}
			fw, err := zw.Create(entryPath)
			if err != nil {
				continue
			}
			fh, err := os.Open(filepath.Join(accountsDir, user.ID, f.ID))
			if err != nil {
				continue
			}
			io.Copy(fw, fh)
			fh.Close()
		}
		for _, d := range subDirs {
			childPrefix := d.Name
			if prefix != "" {
				childPrefix = prefix + "/" + d.Name
			}
			addDir(d.ID, childPrefix)
		}
	}

	addDir(dirID, "")
}

// ─── Storage: Files ───────────────────────────────────────────────────────────

func storageFilesHandler(w http.ResponseWriter, r *http.Request) {
	user := authFromRequest(r)
	if user == nil {
		jsonErr(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	fileID := strings.TrimPrefix(r.URL.Path, "/api/storage/files")
	fileID = strings.TrimPrefix(fileID, "/")

	switch r.Method {
	case http.MethodGet:
		dirID := r.URL.Query().Get("dir")
		storageMu.RLock()
		result := make([]*AccountFile, 0)
		for _, f := range accFiles {
			if f.UserID == user.ID && f.DirID == dirID {
				result = append(result, f)
			}
		}
		storageMu.RUnlock()
		jsonOK(w, result)

	case http.MethodPost:
		quota := storageQuota(user)
		authMu.RLock()
		used := user.StorageUsed
		authMu.RUnlock()
		remaining := quota - used
		if remaining <= 0 {
			jsonErr(w, http.StatusForbidden, fmt.Sprintf("storage quota exceeded — limit is %d GB", quota>>30))
			return
		}

		// Same rationale as uploadHandler: avoid auto plain-text 413.
		r.Body = io.NopCloser(io.LimitReader(r.Body, remaining+(8<<20)))
		mr, err := r.MultipartReader()
		if err != nil {
			jsonErr(w, http.StatusBadRequest, "invalid multipart form")
			return
		}

		var (
			dirID        string
			fid          string
			originalName string
			mimeType     string
			size         int64
			haveFile     bool
		)

		userDir := filepath.Join(accountsDir, user.ID)
		os.MkdirAll(userDir, 0o755)

		for {
			part, partErr := mr.NextPart()
			if partErr == io.EOF {
				break
			}
			if partErr != nil {
				if fid != "" {
					os.Remove(filepath.Join(userDir, fid))
				}
				jsonErr(w, http.StatusBadRequest, "failed to parse upload stream")
				return
			}

			switch part.FormName() {
			case "dirId":
				raw, readErr := io.ReadAll(io.LimitReader(part, 1<<20))
				part.Close()
				if readErr != nil {
					if fid != "" {
						os.Remove(filepath.Join(userDir, fid))
					}
					jsonErr(w, http.StatusBadRequest, "invalid form field")
					return
				}
				dirID = strings.TrimSpace(string(raw))

			case "file":
				if haveFile {
					part.Close()
					if fid != "" {
						os.Remove(filepath.Join(userDir, fid))
					}
					jsonErr(w, http.StatusBadRequest, "only one file is allowed")
					return
				}
				if part.FileName() == "" {
					part.Close()
					jsonErr(w, http.StatusBadRequest, "no file provided")
					return
				}

				fid = randHex(12)
				originalName = part.FileName()
				mimeType = part.Header.Get("Content-Type")

				dst, createErr := os.Create(filepath.Join(userDir, fid))
				if createErr != nil {
					part.Close()
					jsonErr(w, http.StatusInternalServerError, "failed to create file")
					return
				}

				limitReader := &io.LimitedReader{R: part, N: remaining + 1}
				size, err = io.Copy(dst, limitReader)
				dst.Close()
				part.Close()
				if err != nil {
					os.Remove(filepath.Join(userDir, fid))
					jsonErr(w, http.StatusInternalServerError, "failed to write file")
					return
				}
				if limitReader.N == 0 {
					os.Remove(filepath.Join(userDir, fid))
					jsonErr(w, http.StatusRequestEntityTooLarge, fmt.Sprintf("file too large — you have %.1f GB remaining", float64(remaining)/(1<<30)))
					return
				}
				haveFile = true

			default:
				io.Copy(io.Discard, io.LimitReader(part, 1<<20))
				part.Close()
			}
		}

		if !haveFile {
			jsonErr(w, http.StatusBadRequest, "no file provided")
			return
		}

		if dirID != "" {
			storageMu.RLock()
			d, ok := dirs[dirID]
			storageMu.RUnlock()
			if !ok || d.UserID != user.ID {
				os.Remove(filepath.Join(userDir, fid))
				jsonErr(w, http.StatusBadRequest, "folder not found")
				return
			}
		}

		if used+size > quota {
			os.Remove(filepath.Join(userDir, fid))
			jsonErr(w, http.StatusForbidden, fmt.Sprintf("storage quota exceeded — limit is %d GB", quota>>30))
			return
		}

		af := &AccountFile{
			ID:           fid,
			UserID:       user.ID,
			DirID:        dirID,
			OriginalName: originalName,
			Size:         size,
			UploadedAt:   time.Now(),
			MimeType:     mimeType,
		}
		storageMu.Lock()
		accFiles[fid] = af
		storageMu.Unlock()
		authMu.Lock()
		user.StorageUsed += size
		authMu.Unlock()

		log.Printf("account-upload user=%s file=%q size=%d", user.Username, originalName, size)
		jsonOK(w, af)

	case http.MethodPut:
		if fileID == "" {
			jsonErr(w, http.StatusBadRequest, "missing file id")
			return
		}
		var body struct {
			Name  string  `json:"name"`
			DirID *string `json:"dirId"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			jsonErr(w, http.StatusBadRequest, "invalid JSON")
			return
		}
		body.Name = strings.TrimSpace(body.Name)
		if body.Name != "" && len(body.Name) > 256 {
			jsonErr(w, http.StatusBadRequest, "invalid file name")
			return
		}
		if body.DirID != nil && *body.DirID != "" {
			storageMu.RLock()
			targetDir, dOk := dirs[*body.DirID]
			storageMu.RUnlock()
			if !dOk || targetDir.UserID != user.ID {
				jsonErr(w, http.StatusBadRequest, "target folder not found")
				return
			}
		}
		storageMu.Lock()
		af, ok := accFiles[fileID]
		if !ok || af.UserID != user.ID {
			storageMu.Unlock()
			jsonErr(w, http.StatusNotFound, "file not found")
			return
		}
		if body.Name != "" {
			af.OriginalName = body.Name
		}
		if body.DirID != nil {
			af.DirID = *body.DirID
		}
		storageMu.Unlock()
		jsonOK(w, af)

	case http.MethodDelete:
		if fileID == "" {
			jsonErr(w, http.StatusBadRequest, "missing file id")
			return
		}
		storageMu.Lock()
		af, ok := accFiles[fileID]
		if !ok || af.UserID != user.ID {
			storageMu.Unlock()
			jsonErr(w, http.StatusNotFound, "file not found")
			return
		}
		os.Remove(filepath.Join(accountsDir, user.ID, fileID))
		freed := af.Size
		delete(accFiles, fileID)
		storageMu.Unlock()
		authMu.Lock()
		user.StorageUsed -= freed
		authMu.Unlock()
		jsonOK(w, map[string]string{"status": "deleted"})

	default:
		jsonErr(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func storageDownloadHandler(w http.ResponseWriter, r *http.Request) {
	user := authFromRequest(r)
	if user == nil {
		jsonErr(w, http.StatusUnauthorized, "not authenticated")
		return
	}
	fid := strings.TrimPrefix(r.URL.Path, "/api/storage/download/")
	storageMu.RLock()
	af, ok := accFiles[fid]
	storageMu.RUnlock()
	if !ok || af.UserID != user.ID {
		http.Error(w, "file not found", http.StatusNotFound)
		return
	}
	f, err := os.Open(filepath.Join(accountsDir, user.ID, fid))
	if err != nil {
		http.Error(w, "file not found on disk", http.StatusNotFound)
		return
	}
	defer f.Close()

	// For inline preview (images, pdf, video, text) use inline disposition
	inline := r.URL.Query().Get("inline") == "1"
	if inline {
		w.Header().Set("Content-Disposition", fmt.Sprintf(`inline; filename="%s"`, af.OriginalName))
	} else {
		w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, af.OriginalName))
	}
	w.Header().Set("Content-Length", strconv.FormatInt(af.Size, 10))
	// Detect mime type from extension for inline serving
	ext := strings.ToLower(filepath.Ext(af.OriginalName))
	mimeMap := map[string]string{
		".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
		".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
		".bmp": "image/bmp", ".pdf": "application/pdf",
		".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime",
		".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg", ".flac": "audio/flac",
		".txt": "text/plain", ".md": "text/plain", ".json": "application/json",
		".js": "text/javascript", ".ts": "text/plain", ".go": "text/plain",
		".py": "text/plain", ".rs": "text/plain", ".html": "text/html",
		".css": "text/css", ".xml": "text/xml", ".yaml": "text/plain", ".yml": "text/plain",
		".csv": "text/csv", ".toml": "text/plain",
	}
	if mime, ok := mimeMap[ext]; ok {
		w.Header().Set("Content-Type", mime)
	} else {
		w.Header().Set("Content-Type", "application/octet-stream")
	}
	io.Copy(w, f)
}

func storageStatsHandler(w http.ResponseWriter, r *http.Request) {
	user := authFromRequest(r)
	if user == nil {
		jsonErr(w, http.StatusUnauthorized, "not authenticated")
		return
	}
	storageMu.RLock()
	fileCount, dirCount := 0, 0
	for _, f := range accFiles {
		if f.UserID == user.ID {
			fileCount++
		}
	}
	for _, d := range dirs {
		if d.UserID == user.ID {
			dirCount++
		}
	}
	storageMu.RUnlock()
	authMu.RLock()
	storageUsed := user.StorageUsed
	authMu.RUnlock()
	jsonOK(w, map[string]any{
		"storageUsed":  storageUsed,
		"storageLimit": storageQuota(user),
		"fileCount":    fileCount,
		"dirCount":     dirCount,
	})
}

// ─── Share Links ──────────────────────────────────────────────────────────────

// POST /api/shares  — create a share link
// GET  /api/shares  — list user's share links
// DELETE /api/shares/{id} — delete a share link
func shareLinksHandler(w http.ResponseWriter, r *http.Request) {
	user := authFromRequest(r)
	if user == nil {
		jsonErr(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	shareID := strings.TrimPrefix(r.URL.Path, "/api/shares/")
	shareID = strings.TrimPrefix(shareID, "/api/shares")
	shareID = strings.Trim(shareID, "/")

	switch r.Method {
	case http.MethodGet:
		shareMu.RLock()
		result := make([]*SharedLink, 0)
		for _, sl := range shareLinks {
			if sl.UserID == user.ID {
				result = append(result, sl)
			}
		}
		shareMu.RUnlock()
		jsonOK(w, result)

	case http.MethodPost:
		var body struct {
			FileIDs []string `json:"fileIds"`
			DirIDs  []string `json:"dirIds"`
			Title   string   `json:"title"`
			Days    int      `json:"days"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			jsonErr(w, http.StatusBadRequest, "invalid JSON")
			return
		}
		if len(body.FileIDs) == 0 && len(body.DirIDs) == 0 {
			jsonErr(w, http.StatusBadRequest, "select at least one file or folder")
			return
		}
		if body.Days < 1 || body.Days > 365 {
			body.Days = 7
		}
		// Validate all fileIDs belong to user
		storageMu.RLock()
		for _, fid := range body.FileIDs {
			af, ok := accFiles[fid]
			if !ok || af.UserID != user.ID {
				storageMu.RUnlock()
				jsonErr(w, http.StatusBadRequest, "file not found: "+fid)
				return
			}
		}
		for _, did := range body.DirIDs {
			d, ok := dirs[did]
			if !ok || d.UserID != user.ID {
				storageMu.RUnlock()
				jsonErr(w, http.StatusBadRequest, "folder not found: "+did)
				return
			}
		}
		storageMu.RUnlock()

		sl := &SharedLink{
			ID:        randHex(8),
			UserID:    user.ID,
			FileIDs:   body.FileIDs,
			DirIDs:    body.DirIDs,
			Title:     strings.TrimSpace(body.Title),
			ExpiresAt: time.Now().Add(time.Duration(body.Days) * 24 * time.Hour),
			CreatedAt: time.Now(),
		}
		shareMu.Lock()
		shareLinks[sl.ID] = sl
		shareMu.Unlock()
		saveState()
		jsonOK(w, sl)

	case http.MethodDelete:
		if shareID == "" {
			jsonErr(w, http.StatusBadRequest, "missing share id")
			return
		}
		shareMu.Lock()
		sl, ok := shareLinks[shareID]
		if !ok || sl.UserID != user.ID {
			shareMu.Unlock()
			jsonErr(w, http.StatusNotFound, "share not found")
			return
		}
		delete(shareLinks, shareID)
		shareMu.Unlock()
		saveState()
		jsonOK(w, map[string]string{"status": "deleted"})

	default:
		jsonErr(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

// publicShareInfo returns share metadata + file list without auth.
// GET /api/p/{id}
func publicShareHandler(w http.ResponseWriter, r *http.Request) {
	shareID := strings.TrimPrefix(r.URL.Path, "/api/p/")
	shareID = strings.Split(shareID, "/")[0]

	shareMu.RLock()
	sl, ok := shareLinks[shareID]
	shareMu.RUnlock()
	if !ok {
		jsonErr(w, http.StatusNotFound, "share not found")
		return
	}
	if time.Now().After(sl.ExpiresAt) {
		jsonErr(w, http.StatusGone, "share has expired")
		return
	}

	type fileInfo struct {
		ID   string `json:"id"`
		Name string `json:"name"`
		Size int64  `json:"size"`
		Mime string `json:"mimeType"`
	}
	type dirInfo struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}

	storageMu.RLock()
	sharedFiles := make([]fileInfo, 0, len(sl.FileIDs))
	for _, fid := range sl.FileIDs {
		if af, ok := accFiles[fid]; ok {
			sharedFiles = append(sharedFiles, fileInfo{ID: af.ID, Name: af.OriginalName, Size: af.Size, Mime: af.MimeType})
		}
	}
	sharedDirs := make([]dirInfo, 0, len(sl.DirIDs))
	for _, did := range sl.DirIDs {
		if d, ok := dirs[did]; ok {
			sharedDirs = append(sharedDirs, dirInfo{ID: d.ID, Name: d.Name})
		}
	}
	storageMu.RUnlock()

	var totalSize int64
	for _, f := range sharedFiles {
		totalSize += f.Size
	}

	jsonOK(w, map[string]any{
		"id":        sl.ID,
		"title":     sl.Title,
		"expiresAt": sl.ExpiresAt,
		"createdAt": sl.CreatedAt,
		"downloads": sl.Downloads,
		"files":     sharedFiles,
		"dirs":      sharedDirs,
		"totalSize": totalSize,
	})
}

// publicShareDownloadHandler downloads a single file from a share.
// GET /api/p/{id}/download/{fileId}
func publicShareDownloadHandler(w http.ResponseWriter, r *http.Request) {
	// path: /api/p/{shareId}/download/{fileId}
	rest := strings.TrimPrefix(r.URL.Path, "/api/p/")
	parts := strings.SplitN(rest, "/", 3)
	if len(parts) < 3 {
		http.Error(w, "invalid path", http.StatusBadRequest)
		return
	}
	shareID := parts[0]
	fileID := parts[2]

	shareMu.RLock()
	sl, ok := shareLinks[shareID]
	shareMu.RUnlock()
	if !ok || time.Now().After(sl.ExpiresAt) {
		http.Error(w, "share not found or expired", http.StatusNotFound)
		return
	}

	// Check fileID is in the share
	allowed := false
	for _, fid := range sl.FileIDs {
		if fid == fileID {
			allowed = true
			break
		}
	}
	if !allowed {
		http.Error(w, "file not in share", http.StatusForbidden)
		return
	}

	storageMu.RLock()
	af, fileOK := accFiles[fileID]
	storageMu.RUnlock()
	if !fileOK {
		http.Error(w, "file not found", http.StatusNotFound)
		return
	}

	f, err := os.Open(filepath.Join(accountsDir, af.UserID, fileID))
	if err != nil {
		http.Error(w, "file not found on disk", http.StatusNotFound)
		return
	}
	defer f.Close()

	shareMu.Lock()
	sl.Downloads++
	shareMu.Unlock()

	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, af.OriginalName))
	w.Header().Set("Content-Length", strconv.FormatInt(af.Size, 10))
	w.Header().Set("Content-Type", "application/octet-stream")
	io.Copy(w, f)
}

// publicShareZipHandler streams a ZIP of all files/folders in a share.
// GET /api/p/{id}/zip
func publicShareZipHandler(w http.ResponseWriter, r *http.Request) {
	shareID := strings.TrimPrefix(r.URL.Path, "/api/p/")
	shareID = strings.Split(shareID, "/")[0]

	shareMu.RLock()
	sl, ok := shareLinks[shareID]
	shareMu.RUnlock()
	if !ok || time.Now().After(sl.ExpiresAt) {
		http.Error(w, "share not found or expired", http.StatusNotFound)
		return
	}

	title := sl.Title
	if title == "" {
		title = "shared"
	}
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s.zip"`, title))

	zw := zip.NewWriter(w)
	defer zw.Close()

	storageMu.RLock()
	// Add individual shared files
	for _, fid := range sl.FileIDs {
		af, ok := accFiles[fid]
		if !ok {
			continue
		}
		fw, err := zw.Create(af.OriginalName)
		if err != nil {
			continue
		}
		fh, err := os.Open(filepath.Join(accountsDir, af.UserID, fid))
		if err != nil {
			continue
		}
		io.Copy(fw, fh)
		fh.Close()
	}

	// Add shared directories recursively
	var addDir func(dID, prefix string, ownerID string)
	addDir = func(dID, prefix string, ownerID string) {
		var filesToAdd []*AccountFile
		var subDirs []*Directory
		for _, f := range accFiles {
			if f.UserID == ownerID && f.DirID == dID {
				filesToAdd = append(filesToAdd, f)
			}
		}
		for _, d := range dirs {
			if d.UserID == ownerID && d.ParentID == dID {
				subDirs = append(subDirs, d)
			}
		}
		for _, f := range filesToAdd {
			entryPath := f.OriginalName
			if prefix != "" {
				entryPath = prefix + "/" + f.OriginalName
			}
			fw, err := zw.Create(entryPath)
			if err != nil {
				continue
			}
			fh, err := os.Open(filepath.Join(accountsDir, ownerID, f.ID))
			if err != nil {
				continue
			}
			io.Copy(fw, fh)
			fh.Close()
		}
		for _, d := range subDirs {
			childPrefix := d.Name
			if prefix != "" {
				childPrefix = prefix + "/" + d.Name
			}
			addDir(d.ID, childPrefix, ownerID)
		}
	}

	// Determine owner from first file or dir
	ownerID := ""
	for _, fid := range sl.FileIDs {
		if af, ok := accFiles[fid]; ok {
			ownerID = af.UserID
			break
		}
	}
	if ownerID == "" {
		for _, did := range sl.DirIDs {
			if d, ok := dirs[did]; ok {
				ownerID = d.UserID
				break
			}
		}
	}

	for _, did := range sl.DirIDs {
		if d, ok := dirs[did]; ok {
			addDir(d.ID, d.Name, ownerID)
		}
	}
	storageMu.RUnlock()

	shareMu.Lock()
	sl.Downloads++
	shareMu.Unlock()
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

func cleanup() {
	for range time.Tick(time.Hour) {
		mu.Lock()
		for code, rec := range records {
			if time.Now().After(rec.ExpiresAt) {
				os.Remove(filepath.Join(uploadDir, code))
				delete(records, code)
			}
		}
		mu.Unlock()
		authMu.Lock()
		for token, sess := range sessions {
			if time.Now().After(sess.ExpiresAt) {
				delete(sessions, token)
			}
		}
		authMu.Unlock()
		shareMu.Lock()
		for id, sl := range shareLinks {
			if time.Now().After(sl.ExpiresAt) {
				delete(shareLinks, id)
			}
		}
		shareMu.Unlock()
	}
}

// ─── Persistence ──────────────────────────────────────────────────────────────

// persistFileRecord mirrors FileRecord but exports the private password field
// so it can be round-tripped through JSON.
type persistFileRecord struct {
	ShortCode    string    `json:"shortCode"`
	OriginalName string    `json:"originalName"`
	Size         int64     `json:"size"`
	UploadedAt   time.Time `json:"uploadedAt"`
	ExpiresAt    time.Time `json:"expiresAt"`
	Downloads    int       `json:"downloads"`
	MaxDownloads int       `json:"maxDownloads"`
	HasPassword  bool      `json:"hasPassword"`
	Password     string    `json:"password"`
}

// persistUser mirrors User but exports PasswordHash and Salt (tagged json:"-"
// in the live struct so they never leak into API responses).
type persistUser struct {
	ID           string    `json:"id"`
	Username     string    `json:"username"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"passwordHash"`
	Salt         string    `json:"salt"`
	CreatedAt    time.Time `json:"createdAt"`
	StorageUsed  int64     `json:"storageUsed"`
	IsAdmin      bool      `json:"isAdmin"`
	Language     string    `json:"language"`
}

type persistData struct {
	Records    []*persistFileRecord `json:"records"`
	Users      []*persistUser       `json:"users"`
	Sessions   []*Session           `json:"sessions"`
	Dirs       []*Directory         `json:"dirs"`
	AccFiles   []*AccountFile       `json:"accFiles"`
	ShareLinks []*SharedLink        `json:"shareLinks"`
}

// saveState serialises all in-memory state to dataFile atomically.
func saveState() error {
	if err := os.MkdirAll(filepath.Dir(dataFile), 0o755); err != nil {
		return err
	}

	mu.RLock()
	pRecords := make([]*persistFileRecord, 0, len(records))
	for _, r := range records {
		pRecords = append(pRecords, &persistFileRecord{
			ShortCode:    r.ShortCode,
			OriginalName: r.OriginalName,
			Size:         r.Size,
			UploadedAt:   r.UploadedAt,
			ExpiresAt:    r.ExpiresAt,
			Downloads:    r.Downloads,
			MaxDownloads: r.MaxDownloads,
			HasPassword:  r.HasPassword,
			Password:     r.password,
		})
	}
	mu.RUnlock()

	authMu.RLock()
	pUsers := make([]*persistUser, 0, len(users))
	for _, u := range users {
		pUsers = append(pUsers, &persistUser{
			ID:           u.ID,
			Username:     u.Username,
			Email:        u.Email,
			PasswordHash: u.PasswordHash,
			Salt:         u.Salt,
			CreatedAt:    u.CreatedAt,
			StorageUsed:  u.StorageUsed,
			IsAdmin:      u.IsAdmin,
			Language:     u.Language,
		})
	}
	pSessions := make([]*Session, 0, len(sessions))
	for _, s := range sessions {
		pSessions = append(pSessions, s)
	}
	authMu.RUnlock()

	storageMu.RLock()
	pDirs := make([]*Directory, 0, len(dirs))
	for _, d := range dirs {
		pDirs = append(pDirs, d)
	}
	pAccFiles := make([]*AccountFile, 0, len(accFiles))
	for _, f := range accFiles {
		pAccFiles = append(pAccFiles, f)
	}
	storageMu.RUnlock()

	shareMu.RLock()
	pShareLinks := make([]*SharedLink, 0, len(shareLinks))
	for _, sl := range shareLinks {
		pShareLinks = append(pShareLinks, sl)
	}
	shareMu.RUnlock()

	b, err := json.Marshal(&persistData{
		Records:    pRecords,
		Users:      pUsers,
		Sessions:   pSessions,
		Dirs:       pDirs,
		AccFiles:   pAccFiles,
		ShareLinks: pShareLinks,
	})
	if err != nil {
		return err
	}

	// Atomic write: write to a temp file then rename so a crash mid-write
	// never leaves a corrupt state file.
	tmp := dataFile + ".tmp"
	if err := os.WriteFile(tmp, b, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, dataFile)
}

// loadState reads dataFile and populates all in-memory maps.  Expired records
// and sessions are silently skipped.
func loadState() error {
	b, err := os.ReadFile(dataFile)
	if err != nil {
		if os.IsNotExist(err) {
			return nil // first run — start with empty state
		}
		return err
	}

	var data persistData
	if err := json.Unmarshal(b, &data); err != nil {
		return err
	}

	now := time.Now()

	mu.Lock()
	for _, r := range data.Records {
		if now.Before(r.ExpiresAt) {
			records[r.ShortCode] = &FileRecord{
				ShortCode:    r.ShortCode,
				OriginalName: r.OriginalName,
				Size:         r.Size,
				UploadedAt:   r.UploadedAt,
				ExpiresAt:    r.ExpiresAt,
				Downloads:    r.Downloads,
				MaxDownloads: r.MaxDownloads,
				HasPassword:  r.HasPassword,
				password:     r.Password,
			}
		}
	}
	mu.Unlock()

	authMu.Lock()
	for _, u := range data.Users {
		user := &User{
			ID:           u.ID,
			Username:     u.Username,
			Email:        u.Email,
			PasswordHash: u.PasswordHash,
			Salt:         u.Salt,
			CreatedAt:    u.CreatedAt,
			StorageUsed:  u.StorageUsed,
			IsAdmin:      u.IsAdmin,
			Language:     u.Language,
		}
		users[user.ID] = user
		usersByName[strings.ToLower(user.Username)] = user.ID
		if user.Email != "" {
			usersByEmail[strings.ToLower(user.Email)] = user.ID
		}
	}
	for _, s := range data.Sessions {
		if now.Before(s.ExpiresAt) {
			sessions[s.Token] = s
		}
	}
	authMu.Unlock()

	storageMu.Lock()
	for _, d := range data.Dirs {
		dirs[d.ID] = d
	}
	for _, f := range data.AccFiles {
		accFiles[f.ID] = f
	}
	storageMu.Unlock()

	shareMu.Lock()
	for _, sl := range data.ShareLinks {
		if now.Before(sl.ExpiresAt) {
			shareLinks[sl.ID] = sl
		}
	}
	shareMu.Unlock()

	log.Printf("state loaded: %d file records, %d users, %d sessions, %d dirs, %d account files, %d shares",
		len(data.Records), len(data.Users), len(data.Sessions), len(data.Dirs), len(data.AccFiles), len(shareLinks))
	return nil
}

// persistLoop saves state to disk every 5 minutes so data survives restarts.
func persistLoop() {
	for range time.Tick(5 * time.Minute) {
		if err := saveState(); err != nil {
			log.Printf("persist: %v", err)
		}
	}
}

// ─── SPA handler ──────────────────────────────────────────────────────────────

// spaHandler serves static files from ./dist and falls back to index.html for
// any path that doesn't correspond to an existing file. This lets React Router
// handle all frontend routes (e.g. /storage, /settings) when the user
// refreshes the page directly.
func spaHandler() http.Handler {
	fs := http.FileServer(http.Dir("./dist"))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Sanitise the path to prevent directory traversal.
		clean := filepath.Join("./dist", filepath.Clean("/"+r.URL.Path))
		if _, err := os.Stat(clean); os.IsNotExist(err) {
			http.ServeFile(w, r, "./dist/index.html")
			return
		}
		fs.ServeHTTP(w, r)
	})
}

// ─── Main ─────────────────────────────────────────────────────────────────────

func main() {
	os.MkdirAll(uploadDir, 0o755)
	os.MkdirAll(accountsDir, 0o755)

	if err := loadState(); err != nil {
		log.Fatalf("loadState: %v", err)
	}

	seedAdmin()
	go cleanup()
	go persistLoop()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)

	mux := http.NewServeMux()

	// Anonymous
	mux.HandleFunc("/api/upload", cors(uploadHandler))
	mux.HandleFunc("/api/file/", cors(infoHandler))
	mux.HandleFunc("/api/download/", cors(downloadHandler))
	mux.HandleFunc("/api/stats", cors(statsHandler))

	// Auth
	mux.HandleFunc("/api/auth/register", cors(registerHandler))
	mux.HandleFunc("/api/auth/login", cors(loginHandler))
	mux.HandleFunc("/api/auth/logout", cors(logoutHandler))
	mux.HandleFunc("/api/auth/me", cors(meHandler))
	mux.HandleFunc("/api/auth/change-password", cors(changePasswordHandler))
	mux.HandleFunc("/api/auth/change-email", cors(changeEmailHandler))
	mux.HandleFunc("/api/auth/settings", cors(userSettingsHandler))
	mux.HandleFunc("/api/auth/account", cors(deleteAccountHandler))

	// Admin
	mux.HandleFunc("/api/admin/stats", cors(adminStatsHandler))
	mux.HandleFunc("/api/admin/files", cors(adminFilesHandler))
	mux.HandleFunc("/api/admin/files/", cors(adminFilesHandler))
	mux.HandleFunc("/api/admin/users/", cors(adminClearStorageHandler))

	// Storage
	mux.HandleFunc("/api/storage/dirs", cors(storageDirsHandler))
	mux.HandleFunc("/api/storage/dirs/", cors(storageDirsHandler))
	mux.HandleFunc("/api/storage/files", cors(storageFilesHandler))
	mux.HandleFunc("/api/storage/files/", cors(storageFilesHandler))
	mux.HandleFunc("/api/storage/download/", cors(storageDownloadHandler))
	mux.HandleFunc("/api/storage/stats", cors(storageStatsHandler))

	// Shares (auth required)
	mux.HandleFunc("/api/shares", cors(shareLinksHandler))
	mux.HandleFunc("/api/shares/", cors(shareLinksHandler))

	// Public share view
	mux.HandleFunc("/api/p/", cors(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		// /api/p/{id}/download/{fileId}
		if strings.Contains(path[len("/api/p/"):], "/download/") {
			publicShareDownloadHandler(w, r)
			return
		}
		// /api/p/{id}/zip
		if strings.HasSuffix(path, "/zip") {
			publicShareZipHandler(w, r)
			return
		}
		// /api/p/{id}
		publicShareHandler(w, r)
	}))

	mux.Handle("/", spaHandler())

	srv := &http.Server{
		Addr:    listenAddr,
		Handler: mux,
	}

	// Graceful shutdown: wait up to 10 minutes for ongoing uploads to complete.
	go func() {
		<-quit
		log.Println("shutting down — saving state…")
		if err := saveState(); err != nil {
			log.Printf("persist: final save error: %v", err)
		}
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
		defer cancel()
		if err := srv.Shutdown(ctx); err != nil {
			log.Printf("graceful shutdown error: %v", err)
		}
	}()

	log.Printf("ToFilePath server → http://localhost%s", listenAddr)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server: %v", err)
	}
}
