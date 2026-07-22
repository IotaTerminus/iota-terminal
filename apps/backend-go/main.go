// Command backend-go implements the Go backend of the iota-terminal API contract.
package main

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/joho/godotenv"
	_ "modernc.org/sqlite"
)

type statusResponse struct {
	Backend string `json:"backend"`
	Status  string `json:"status"`
	Version string `json:"version"`
}

func statusHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(statusResponse{
		Backend: "go",
		Status:  "online",
		Version: "1.0.0",
	})
}

type contactSubmission struct {
	Name    string `json:"name"`
	Email   string `json:"email"`
	Message string `json:"message"`
	// Company is a honeypot field: real users never fill this in. A
	// non-empty value means the request is treated as spam.
	Company string `json:"company"`
}

type contactResponse struct {
	OK bool `json:"ok"`
}

type guestbookEntry struct {
	ID        int    `json:"id"`
	Name      string `json:"name"`
	Message   string `json:"message"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

type guestbookListResponse struct {
	Entries []guestbookEntry `json:"entries"`
}

type guestbookCreateRequest struct {
	Name    string `json:"name"`
	Message string `json:"message"`
	Company string `json:"company"`
}

type guestbookCreateResponse struct {
	OK        bool            `json:"ok"`
	Entry     *guestbookEntry `json:"entry,omitempty"`
	EditToken string          `json:"editToken,omitempty"`
}

type guestbookUpdateRequest struct {
	Message   string `json:"message"`
	EditToken string `json:"editToken"`
}

type guestbookUpdateResponse struct {
	OK    bool            `json:"ok"`
	Entry *guestbookEntry `json:"entry,omitempty"`
}

type guestbookDeleteRequest struct {
	EditToken string `json:"editToken"`
}

type guestbookDeleteResponse struct {
	OK bool `json:"ok"`
}

const (
	rateLimitMax    = 3
	rateLimitWindow = 10 * time.Minute
)

// rateLimiter is a simple in-memory, per-IP sliding-window rate limiter. It
// is process-local and resets on restart, which is acceptable since this is
// a best-effort defense against abuse-driven Twilio costs, not a security
// control, and each backend runs as a single container replica.
type rateLimiter struct {
	mu       sync.Mutex
	requests map[string][]time.Time
}

func newRateLimiter() *rateLimiter {
	return &rateLimiter{requests: make(map[string][]time.Time)}
}

func (rl *rateLimiter) allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	timestamps := rl.requests[key][:0]
	for _, t := range rl.requests[key] {
		if now.Sub(t) < rateLimitWindow {
			timestamps = append(timestamps, t)
		}
	}
	if len(timestamps) >= rateLimitMax {
		rl.requests[key] = timestamps
		return false
	}
	rl.requests[key] = append(timestamps, now)
	return true
}

func clientIP(r *http.Request) string {
	// Behind Cloudflare Tunnel, RemoteAddr reflects the tunnel connection
	// rather than the real visitor, so prefer Cloudflare's CF-Connecting-IP
	// header (falling back to RemoteAddr for local dev, where there's no
	// Cloudflare proxy).
	if cfIP := r.Header.Get("Cf-Connecting-Ip"); cfIP != "" {
		return cfIP
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func sendContactSms(sub contactSubmission) (bool, error) {
	accountSID := os.Getenv("TWILIO_ACCOUNT_SID")
	authToken := os.Getenv("TWILIO_AUTH_TOKEN")
	fromNumber := os.Getenv("TWILIO_FROM_NUMBER")
	toNumber := os.Getenv("TWILIO_TO_NUMBER")

	if accountSID == "" || authToken == "" || fromNumber == "" || toNumber == "" {
		log.Println("backend-go: Twilio env vars are not fully configured; skipping SMS send")
		return false, nil
	}

	form := url.Values{}
	form.Set("From", fromNumber)
	form.Set("To", toNumber)
	form.Set("Body", fmt.Sprintf("New contact form submission from %s (%s): %s", sub.Name, sub.Email, sub.Message))

	endpoint := fmt.Sprintf("https://api.twilio.com/2010-04-01/Accounts/%s/Messages.json", accountSID)
	req, err := http.NewRequest(http.MethodPost, endpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return false, err
	}
	req.SetBasicAuth(accountSID, authToken)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return false, err
	}
	defer res.Body.Close()

	return res.StatusCode >= 200 && res.StatusCode < 300, nil
}

func contactHandler(rl *rateLimiter) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		var sub contactSubmission
		if err := json.NewDecoder(r.Body).Decode(&sub); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(contactResponse{OK: false})
			return
		}

		if sub.Name == "" || sub.Email == "" || sub.Message == "" {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(contactResponse{OK: false})
			return
		}

		// Honeypot: pretend success without sending an SMS or doing further work.
		if sub.Company != "" {
			json.NewEncoder(w).Encode(contactResponse{OK: true})
			return
		}

		if !rl.allow(clientIP(r)) {
			w.WriteHeader(http.StatusTooManyRequests)
			json.NewEncoder(w).Encode(contactResponse{OK: false})
			return
		}

		sent, err := sendContactSms(sub)
		if err != nil || !sent {
			if err != nil {
				log.Printf("backend-go: failed to send contact SMS: %v", err)
			}
			w.WriteHeader(http.StatusBadGateway)
			json.NewEncoder(w).Encode(contactResponse{OK: false})
			return
		}

		json.NewEncoder(w).Encode(contactResponse{OK: true})
	}
}

func openGuestbookDB() (*sql.DB, error) {
	dbPath := os.Getenv("IOTA_DB_PATH")
	if dbPath == "" {
		dbPath = "../../shared/db/iota.sqlite"
	}

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, err
	}

	// Keep the pool on a single SQLite connection so the startup PRAGMAs apply
	// consistently for all requests handled by this demo backend.
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)

	if err := db.Ping(); err != nil {
		db.Close()
		return nil, err
	}
	if _, err := db.Exec("PRAGMA journal_mode=WAL"); err != nil {
		db.Close()
		return nil, err
	}
	if _, err := db.Exec("PRAGMA busy_timeout=5000"); err != nil {
		db.Close()
		return nil, err
	}

	return db, nil
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if payload != nil {
		json.NewEncoder(w).Encode(payload)
	}
}

func validateGuestbookName(name string) (string, bool) {
	trimmed := strings.TrimSpace(name)
	length := utf8.RuneCountInString(trimmed)
	return trimmed, length >= 1 && length <= 40
}

func validateGuestbookMessage(message string) (string, bool) {
	trimmed := strings.TrimSpace(message)
	length := utf8.RuneCountInString(trimmed)
	return trimmed, length >= 1 && length <= 280
}

// The raw edit token is only returned once to the client; the database stores
// only its SHA-256 hash so a DB leak does not reveal reusable edit secrets.
func hashEditToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func newEditToken() (string, error) {
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(tokenBytes), nil
}

func scanGuestbookEntry(row *sql.Row) (*guestbookEntry, error) {
	var entry guestbookEntry
	if err := row.Scan(&entry.ID, &entry.Name, &entry.Message, &entry.CreatedAt, &entry.UpdatedAt); err != nil {
		return nil, err
	}
	return &entry, nil
}

func guestbookHandler(db *sql.DB, rl *rateLimiter) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			rows, err := db.Query(`
				SELECT id, name, message, created_at, updated_at
				FROM guestbook_entries
				ORDER BY created_at ASC, id ASC
			`)
			if err != nil {
				log.Printf("backend-go: failed to list guestbook entries: %v", err)
				writeJSON(w, http.StatusInternalServerError, guestbookListResponse{Entries: []guestbookEntry{}})
				return
			}
			defer rows.Close()

			entries := make([]guestbookEntry, 0)
			for rows.Next() {
				var entry guestbookEntry
				if err := rows.Scan(&entry.ID, &entry.Name, &entry.Message, &entry.CreatedAt, &entry.UpdatedAt); err != nil {
					log.Printf("backend-go: failed to scan guestbook entry: %v", err)
					writeJSON(w, http.StatusInternalServerError, guestbookListResponse{Entries: []guestbookEntry{}})
					return
				}
				entries = append(entries, entry)
			}
			if err := rows.Err(); err != nil {
				log.Printf("backend-go: failed during guestbook row iteration: %v", err)
				writeJSON(w, http.StatusInternalServerError, guestbookListResponse{Entries: []guestbookEntry{}})
				return
			}

			writeJSON(w, http.StatusOK, guestbookListResponse{Entries: entries})
		case http.MethodPost:
			var req guestbookCreateRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				writeJSON(w, http.StatusBadRequest, guestbookCreateResponse{OK: false})
				return
			}

			// Honeypot: pretend success without creating a DB row or consuming
			// more work against the shared guestbook write limit.
			if req.Company != "" {
				writeJSON(w, http.StatusCreated, guestbookCreateResponse{OK: true})
				return
			}

			name, nameOK := validateGuestbookName(req.Name)
			message, messageOK := validateGuestbookMessage(req.Message)
			if !nameOK || !messageOK {
				writeJSON(w, http.StatusBadRequest, guestbookCreateResponse{OK: false})
				return
			}
			if !rl.allow(clientIP(r)) {
				writeJSON(w, http.StatusTooManyRequests, guestbookCreateResponse{OK: false})
				return
			}

			editToken, err := newEditToken()
			if err != nil {
				log.Printf("backend-go: failed to generate guestbook edit token: %v", err)
				writeJSON(w, http.StatusInternalServerError, guestbookCreateResponse{OK: false})
				return
			}

			tx, err := db.Begin()
			if err != nil {
				log.Printf("backend-go: failed to begin guestbook create tx: %v", err)
				writeJSON(w, http.StatusInternalServerError, guestbookCreateResponse{OK: false})
				return
			}
			defer tx.Rollback()

			result, err := tx.Exec(`
				INSERT INTO guestbook_entries (name, message, edit_token_hash)
				VALUES (?, ?, ?)
			`, name, message, hashEditToken(editToken))
			if err != nil {
				log.Printf("backend-go: failed to insert guestbook entry: %v", err)
				writeJSON(w, http.StatusInternalServerError, guestbookCreateResponse{OK: false})
				return
			}

			if _, err := tx.Exec(`
				DELETE FROM guestbook_entries
				WHERE id NOT IN (
					SELECT id
					FROM guestbook_entries
					ORDER BY created_at DESC, id DESC
					LIMIT 50
				)
			`); err != nil {
				log.Printf("backend-go: failed to prune guestbook entries: %v", err)
				writeJSON(w, http.StatusInternalServerError, guestbookCreateResponse{OK: false})
				return
			}

			insertedID, err := result.LastInsertId()
			if err != nil {
				log.Printf("backend-go: failed to read guestbook insert id: %v", err)
				writeJSON(w, http.StatusInternalServerError, guestbookCreateResponse{OK: false})
				return
			}

			entry, err := scanGuestbookEntry(tx.QueryRow(`
				SELECT id, name, message, created_at, updated_at
				FROM guestbook_entries
				WHERE id = ?
			`, insertedID))
			if err != nil {
				log.Printf("backend-go: failed to fetch inserted guestbook entry: %v", err)
				writeJSON(w, http.StatusInternalServerError, guestbookCreateResponse{OK: false})
				return
			}

			if err := tx.Commit(); err != nil {
				log.Printf("backend-go: failed to commit guestbook create tx: %v", err)
				writeJSON(w, http.StatusInternalServerError, guestbookCreateResponse{OK: false})
				return
			}

			writeJSON(w, http.StatusCreated, guestbookCreateResponse{
				OK:        true,
				Entry:     entry,
				EditToken: editToken,
			})
		default:
			writeJSON(w, http.StatusMethodNotAllowed, nil)
		}
	}
}

func guestbookEntryHandler(db *sql.DB, rl *rateLimiter) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		entryID := strings.TrimPrefix(r.URL.Path, "/api/go/guestbook/")
		if entryID == "" || strings.Contains(entryID, "/") {
			writeJSON(w, http.StatusNotFound, nil)
			return
		}

		id, err := strconv.Atoi(entryID)
		if err != nil || id <= 0 {
			writeJSON(w, http.StatusNotFound, nil)
			return
		}

		switch r.Method {
		case http.MethodPatch:
			var req guestbookUpdateRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				writeJSON(w, http.StatusBadRequest, guestbookUpdateResponse{OK: false})
				return
			}

			message, ok := validateGuestbookMessage(req.Message)
			if !ok || req.EditToken == "" {
				writeJSON(w, http.StatusBadRequest, guestbookUpdateResponse{OK: false})
				return
			}
			if !rl.allow(clientIP(r)) {
				writeJSON(w, http.StatusTooManyRequests, guestbookUpdateResponse{OK: false})
				return
			}

			tx, err := db.Begin()
			if err != nil {
				log.Printf("backend-go: failed to begin guestbook update tx: %v", err)
				writeJSON(w, http.StatusInternalServerError, guestbookUpdateResponse{OK: false})
				return
			}
			defer tx.Rollback()

			var storedHash string
			if err := tx.QueryRow(`SELECT edit_token_hash FROM guestbook_entries WHERE id = ?`, id).Scan(&storedHash); err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					writeJSON(w, http.StatusNotFound, guestbookUpdateResponse{OK: false})
					return
				}
				log.Printf("backend-go: failed to look up guestbook entry for update: %v", err)
				writeJSON(w, http.StatusInternalServerError, guestbookUpdateResponse{OK: false})
				return
			}
			if subtle.ConstantTimeCompare([]byte(storedHash), []byte(hashEditToken(req.EditToken))) != 1 {
				writeJSON(w, http.StatusForbidden, guestbookUpdateResponse{OK: false})
				return
			}

			if _, err := tx.Exec(`
				UPDATE guestbook_entries
				SET message = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
				WHERE id = ?
			`, message, id); err != nil {
				log.Printf("backend-go: failed to update guestbook entry: %v", err)
				writeJSON(w, http.StatusInternalServerError, guestbookUpdateResponse{OK: false})
				return
			}

			entry, err := scanGuestbookEntry(tx.QueryRow(`
				SELECT id, name, message, created_at, updated_at
				FROM guestbook_entries
				WHERE id = ?
			`, id))
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					writeJSON(w, http.StatusNotFound, guestbookUpdateResponse{OK: false})
					return
				}
				log.Printf("backend-go: failed to fetch updated guestbook entry: %v", err)
				writeJSON(w, http.StatusInternalServerError, guestbookUpdateResponse{OK: false})
				return
			}

			if err := tx.Commit(); err != nil {
				log.Printf("backend-go: failed to commit guestbook update tx: %v", err)
				writeJSON(w, http.StatusInternalServerError, guestbookUpdateResponse{OK: false})
				return
			}

			writeJSON(w, http.StatusOK, guestbookUpdateResponse{OK: true, Entry: entry})
		case http.MethodDelete:
			var req guestbookDeleteRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				writeJSON(w, http.StatusBadRequest, guestbookDeleteResponse{OK: false})
				return
			}
			if req.EditToken == "" {
				writeJSON(w, http.StatusBadRequest, guestbookDeleteResponse{OK: false})
				return
			}
			if !rl.allow(clientIP(r)) {
				writeJSON(w, http.StatusTooManyRequests, guestbookDeleteResponse{OK: false})
				return
			}

			tx, err := db.Begin()
			if err != nil {
				log.Printf("backend-go: failed to begin guestbook delete tx: %v", err)
				writeJSON(w, http.StatusInternalServerError, guestbookDeleteResponse{OK: false})
				return
			}
			defer tx.Rollback()

			var storedHash string
			if err := tx.QueryRow(`SELECT edit_token_hash FROM guestbook_entries WHERE id = ?`, id).Scan(&storedHash); err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					writeJSON(w, http.StatusNotFound, guestbookDeleteResponse{OK: false})
					return
				}
				log.Printf("backend-go: failed to look up guestbook entry for delete: %v", err)
				writeJSON(w, http.StatusInternalServerError, guestbookDeleteResponse{OK: false})
				return
			}
			if subtle.ConstantTimeCompare([]byte(storedHash), []byte(hashEditToken(req.EditToken))) != 1 {
				writeJSON(w, http.StatusForbidden, guestbookDeleteResponse{OK: false})
				return
			}

			if _, err := tx.Exec(`DELETE FROM guestbook_entries WHERE id = ?`, id); err != nil {
				log.Printf("backend-go: failed to delete guestbook entry: %v", err)
				writeJSON(w, http.StatusInternalServerError, guestbookDeleteResponse{OK: false})
				return
			}

			if err := tx.Commit(); err != nil {
				log.Printf("backend-go: failed to commit guestbook delete tx: %v", err)
				writeJSON(w, http.StatusInternalServerError, guestbookDeleteResponse{OK: false})
				return
			}

			writeJSON(w, http.StatusOK, guestbookDeleteResponse{OK: true})
		default:
			writeJSON(w, http.StatusMethodNotAllowed, nil)
		}
	}
}

func main() {
	// Local dev only: load the repo root .env (cwd is apps/backend-go per
	// the documented `cd apps/backend-go && go run main.go` workflow). In
	// production, docker-compose injects these vars directly, so a missing
	// file here is a silent no-op.
	_ = godotenv.Load("../../.env")

	db, err := openGuestbookDB()
	if err != nil {
		log.Fatalf("backend-go: failed to open sqlite db: %v", err)
	}
	defer db.Close()

	rl := newRateLimiter()

	http.HandleFunc("/api/go/system/status", statusHandler)
	http.HandleFunc("/api/go/contact", contactHandler(rl))
	http.HandleFunc("/api/go/guestbook", guestbookHandler(db, rl))
	http.HandleFunc("/api/go/guestbook/", guestbookEntryHandler(db, rl))

	addr := ":8080"
	log.Printf("backend-go listening on %s", addr)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatal(err)
	}
}
