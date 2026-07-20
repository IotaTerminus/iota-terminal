// Command backend-go implements the Go backend of the iota-terminal API contract.
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/joho/godotenv"
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

func main() {
	// Local dev only: load the repo root .env (cwd is apps/backend-go per
	// the documented `cd apps/backend-go && go run main.go` workflow). In
	// production, docker-compose injects these vars directly, so a missing
	// file here is a silent no-op.
	_ = godotenv.Load("../../.env")

	rl := newRateLimiter()

	http.HandleFunc("/api/go/system/status", statusHandler)
	http.HandleFunc("/api/go/contact", contactHandler(rl))

	addr := ":8080"
	log.Printf("backend-go listening on %s", addr)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatal(err)
	}
}
