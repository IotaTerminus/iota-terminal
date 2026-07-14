.PHONY: db-init db-clean

DB_DIR := shared/db
DB_FILE := $(DB_DIR)/iota.sqlite
SCHEMA := $(DB_DIR)/migrations/schema.sql

## db-init: create/refresh the SQLite database, enable WAL, apply schema.sql
db-init:
	mkdir -p $(DB_DIR)
	sqlite3 $(DB_FILE) "PRAGMA journal_mode=WAL;"
	sqlite3 $(DB_FILE) < $(SCHEMA)
	@echo "iota.sqlite initialized at $(DB_FILE) (WAL enabled)"

## db-clean: remove the database file and its WAL/SHM sidecars
db-clean:
	rm -f $(DB_FILE) $(DB_FILE)-wal $(DB_FILE)-shm
	@echo "removed $(DB_FILE) and WAL sidecars"
