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

## clean-all: remove all node_modules, .turbo, dist, .angular, out-tsc, and bin directories
clean-all:
	@echo "🧹 Sweeping monorepo caches and build artifacts..."
	@find . -name "node_modules" -type d -prune -exec rm -rf '{}' +
	@find . -name ".turbo" -type d -prune -exec rm -rf '{}' +
	@find . -name "dist" -type d -prune -exec rm -rf '{}' +
	@find . -name ".angular" -type d -prune -exec rm -rf '{}' +
	@find . -name "out-tsc" -type d -prune -exec rm -rf '{}' +
	@find . -name "bin" -type d -prune -exec rm -rf '{}' +
	@echo "✅ Workspace cleansed."

## refresh: clean-all, then reinstall dependencies and rebuild the monorepo via Turborepo
refresh: clean-all
ifeq ($(REGEN_LOCK),true)
	@echo "🗑️ REGEN_LOCK is true. Deleting root package-lock.json..."
	@rm -f package-lock.json
endif
	@echo "📦 Installing fresh dependencies..."
	@npm install
	@echo "🔨 Rebuilding the monorepo via Turborepo..."
	@npx turbo run build
	@echo "🚀 Refresh sequence complete!"