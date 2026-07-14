// Command backend-go implements the Go backend of the iota-terminal API contract.
package main

import (
	"encoding/json"
	"log"
	"net/http"
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

func main() {
	http.HandleFunc("/api/go/system/status", statusHandler)

	addr := ":8080"
	log.Printf("backend-go listening on %s", addr)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatal(err)
	}
}
