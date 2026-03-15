package main

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

// setupTestDirs creates required upload directories and registers cleanup.
func setupTestDirs(t *testing.T) {
	t.Helper()
	os.MkdirAll(uploadDir, 0o755)
	os.MkdirAll(accountsDir, 0o755)
}

// buildUploadRequest creates a multipart POST request for /api/upload.
func buildUploadRequest(t *testing.T, filename string, content []byte, fields map[string]string) *http.Request {
	t.Helper()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)

	fw, err := mw.CreateFormFile("file", filename)
	if err != nil {
		t.Fatalf("CreateFormFile: %v", err)
	}
	if _, err := fw.Write(content); err != nil {
		t.Fatalf("write file part: %v", err)
	}
	for k, v := range fields {
		if wErr := mw.WriteField(k, v); wErr != nil {
			t.Fatalf("WriteField %s: %v", k, wErr)
		}
	}
	mw.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/upload", &buf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	return req
}

// TestUploadHandler_Success verifies a normal small-file upload returns valid JSON.
func TestUploadHandler_Success(t *testing.T) {
	setupTestDirs(t)

	req := buildUploadRequest(t, "test.txt", bytes.Repeat([]byte("a"), 1024), map[string]string{
		"expiryHours":  "24",
		"maxDownloads": "5",
	})
	rw := httptest.NewRecorder()
	uploadHandler(rw, req)

	if rw.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rw.Code, rw.Body.String())
	}
	var resp map[string]any
	if err := json.NewDecoder(rw.Body).Decode(&resp); err != nil {
		t.Fatalf("response is not valid JSON: %v", err)
	}
	code, _ := resp["shortCode"].(string)
	if code == "" {
		t.Error("expected non-empty shortCode")
	}
	if resp["originalName"] != "test.txt" {
		t.Errorf("originalName: want test.txt, got %v", resp["originalName"])
	}

	// Cleanup
	os.Remove(uploadDir + "/" + code)
	mu.Lock()
	delete(records, code)
	mu.Unlock()
}

// TestUploadHandler_WithPassword verifies that password-protected uploads are recorded.
func TestUploadHandler_WithPassword(t *testing.T) {
	setupTestDirs(t)

	req := buildUploadRequest(t, "secret.zip", bytes.Repeat([]byte("z"), 512), map[string]string{
		"expiryHours": "1",
		"password":    "hunter2",
	})
	rw := httptest.NewRecorder()
	uploadHandler(rw, req)

	if rw.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rw.Code, rw.Body.String())
	}
	var resp map[string]any
	json.NewDecoder(rw.Body).Decode(&resp)

	if resp["hasPassword"] != true {
		t.Errorf("expected hasPassword=true, got %v", resp["hasPassword"])
	}

	// Cleanup
	if code, ok := resp["shortCode"].(string); ok {
		os.Remove(uploadDir + "/" + code)
		mu.Lock()
		delete(records, code)
		mu.Unlock()
	}
}

// TestUploadHandler_NoFile verifies that a missing file part returns a JSON 400.
func TestUploadHandler_NoFile(t *testing.T) {
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	mw.WriteField("expiryHours", "24")
	mw.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/upload", &buf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	rw := httptest.NewRecorder()
	uploadHandler(rw, req)

	if rw.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rw.Code)
	}
	var resp map[string]string
	if err := json.NewDecoder(rw.Body).Decode(&resp); err != nil {
		t.Fatalf("expected JSON error response, got: %s", rw.Body.String())
	}
	if resp["error"] == "" {
		t.Error("expected non-empty error field")
	}
}

// TestUploadHandler_WrongMethod verifies that non-POST requests return 405.
func TestUploadHandler_WrongMethod(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/upload", nil)
	rw := httptest.NewRecorder()
	uploadHandler(rw, req)

	if rw.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", rw.Code)
	}
}

// TestUploadHandler_AbruptDisconnect simulates a connection drop mid-upload.
// The handler must return a server-side error (not panic) and clean up the partial file.
func TestUploadHandler_AbruptDisconnect(t *testing.T) {
	setupTestDirs(t)

	// Write a valid multipart header but truncate the body mid-way.
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	fw, _ := mw.CreateFormFile("file", "partial.bin")
	fw.Write(bytes.Repeat([]byte("d"), 4096)) // 4 KB – then we intentionally DON'T call mw.Close()
	// buf contains a well-formed header + 4 KB body but no closing boundary.
	truncated := buf.Bytes()

	req := httptest.NewRequest(http.MethodPost, "/api/upload", bytes.NewReader(truncated))
	req.Header.Set("Content-Type", mw.FormDataContentType())
	rw := httptest.NewRecorder()

	// Must not panic.
	uploadHandler(rw, req)

	// The handler should return an error status (400 or 500) – not 200.
	if rw.Code == http.StatusOK {
		t.Fatal("expected an error response for a truncated multipart body, got 200")
	}
	// The response must be JSON so the frontend can display a message.
	var resp map[string]string
	if err := json.NewDecoder(rw.Body).Decode(&resp); err != nil {
		t.Fatalf("error response is not valid JSON: %v — body: %q", err, rw.Body.String())
	}
}

// TestStatsHandler verifies that /api/stats always returns valid JSON.
func TestStatsHandler(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/stats", nil)
	rw := httptest.NewRecorder()
	statsHandler(rw, req)

	if rw.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rw.Code)
	}
	var resp map[string]any
	if err := json.NewDecoder(rw.Body).Decode(&resp); err != nil {
		t.Fatalf("stats is not valid JSON: %v", err)
	}
}
