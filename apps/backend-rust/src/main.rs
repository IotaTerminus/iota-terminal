//! backend-rust: the Rust implementation of the iota-terminal API contract.

use axum::{
    extract::{ConnectInfo, Path, State},
    http::{HeaderMap, StatusCode},
    routing::{get, patch, post},
    Json, Router,
};
use rand::{rngs::OsRng, RngCore};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::{
    sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteRow},
    Row, SqlitePool,
};
use std::{
    collections::HashMap,
    net::SocketAddr,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

const DB_PATH_ENV: &str = "IOTA_DB_PATH";
const DEFAULT_DB_PATH: &str = "../../shared/db/iota.sqlite";

#[derive(Serialize)]
struct StatusResponse {
    backend: &'static str,
    status: &'static str,
    version: &'static str,
}

async fn status() -> Json<StatusResponse> {
    Json(StatusResponse {
        backend: "rust",
        status: "online",
        version: "1.0.0",
    })
}

#[derive(Deserialize)]
struct ContactSubmission {
    name: String,
    email: String,
    message: String,
    // Honeypot field: real users never fill this in. A non-empty value
    // means the request is treated as spam.
    #[serde(default)]
    company: String,
}

#[derive(Serialize)]
struct ContactResponse {
    ok: bool,
}

#[derive(Clone)]
struct AppState {
    rate_limiter: Arc<RateLimiter>,
    db: SqlitePool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GuestbookEntry {
    id: i64,
    name: String,
    message: String,
    created_at: String,
    updated_at: String,
}

#[derive(Serialize)]
struct GuestbookListResponse {
    entries: Vec<GuestbookEntry>,
}

#[derive(Deserialize)]
struct GuestbookCreateRequest {
    name: String,
    message: String,
    #[serde(default)]
    company: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GuestbookCreateResponse {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    entry: Option<GuestbookEntry>,
    #[serde(skip_serializing_if = "Option::is_none")]
    edit_token: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GuestbookUpdateRequest {
    message: String,
    edit_token: String,
}

#[derive(Serialize)]
struct GuestbookUpdateResponse {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    entry: Option<GuestbookEntry>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GuestbookDeleteRequest {
    edit_token: String,
}

#[derive(Serialize)]
struct GuestbookDeleteResponse {
    ok: bool,
}

const RATE_LIMIT_MAX: usize = 3;
const RATE_LIMIT_WINDOW: Duration = Duration::from_secs(10 * 60);

// In-memory, per-IP sliding-window rate limiter. Process-local and resets on
// restart, which is acceptable as a best-effort defense against
// abuse-driven Twilio costs (not a security control), since each backend
// runs as a single container replica.
#[derive(Default)]
struct RateLimiter {
    requests: Mutex<HashMap<String, Vec<Instant>>>,
}

impl RateLimiter {
    fn allow(&self, key: &str) -> bool {
        let mut requests = self.requests.lock().unwrap();
        let now = Instant::now();
        let timestamps = requests.entry(key.to_string()).or_default();
        timestamps.retain(|t| now.duration_since(*t) < RATE_LIMIT_WINDOW);
        if timestamps.len() >= RATE_LIMIT_MAX {
            return false;
        }
        timestamps.push(now);
        true
    }
}

async fn send_contact_sms(sub: &ContactSubmission) -> Result<bool, reqwest::Error> {
    let account_sid = std::env::var("TWILIO_ACCOUNT_SID").unwrap_or_default();
    let auth_token = std::env::var("TWILIO_AUTH_TOKEN").unwrap_or_default();
    let from_number = std::env::var("TWILIO_FROM_NUMBER").unwrap_or_default();
    let to_number = std::env::var("TWILIO_TO_NUMBER").unwrap_or_default();

    if account_sid.is_empty()
        || auth_token.is_empty()
        || from_number.is_empty()
        || to_number.is_empty()
    {
        eprintln!("backend-rust: Twilio env vars are not fully configured; skipping SMS send");
        return Ok(false);
    }

    let body = format!(
        "New contact form submission from {} ({}): {}",
        sub.name, sub.email, sub.message
    );

    let client = reqwest::Client::new();
    let res = client
        .post(format!(
            "https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
        ))
        .basic_auth(&account_sid, Some(&auth_token))
        .form(&[
            ("From", from_number.as_str()),
            ("To", to_number.as_str()),
            ("Body", body.as_str()),
        ])
        .send()
        .await?;

    Ok(res.status().is_success())
}

// Behind Cloudflare Tunnel, the socket address reflects the tunnel
// connection rather than the real visitor, so prefer Cloudflare's
// CF-Connecting-IP header (falling back to the socket address for local
// dev, where there's no Cloudflare proxy).
fn client_ip(headers: &HeaderMap, addr: &SocketAddr) -> String {
    headers
        .get("cf-connecting-ip")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .unwrap_or_else(|| addr.ip().to_string())
}

fn validate_trimmed_field(value: &str, max_len: usize) -> Option<String> {
    let trimmed = value.trim();
    let len = trimmed.chars().count();
    if (1..=max_len).contains(&len) {
        Some(trimmed.to_string())
    } else {
        None
    }
}

fn validate_name(name: &str) -> Option<String> {
    validate_trimmed_field(name, 40)
}

fn validate_message(message: &str) -> Option<String> {
    validate_trimmed_field(message, 280)
}

fn generate_edit_token() -> String {
    let mut bytes = [0_u8; 32];
    OsRng.fill_bytes(&mut bytes);
    hex::encode(bytes)
}

fn hash_edit_token(token: &str) -> String {
    hex::encode(Sha256::digest(token.as_bytes()))
}

fn guestbook_entry_from_row(row: &SqliteRow) -> Result<GuestbookEntry, sqlx::Error> {
    Ok(GuestbookEntry {
        id: row.try_get("id")?,
        name: row.try_get("name")?,
        message: row.try_get("message")?,
        created_at: row.try_get("created_at")?,
        updated_at: row.try_get("updated_at")?,
    })
}

async fn contact(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(sub): Json<ContactSubmission>,
) -> (StatusCode, Json<ContactResponse>) {
    if sub.name.is_empty() || sub.email.is_empty() || sub.message.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(ContactResponse { ok: false }));
    }

    // Honeypot: pretend success without sending an SMS or doing further work.
    if !sub.company.is_empty() {
        return (StatusCode::OK, Json(ContactResponse { ok: true }));
    }

    if !state.rate_limiter.allow(&client_ip(&headers, &addr)) {
        return (
            StatusCode::TOO_MANY_REQUESTS,
            Json(ContactResponse { ok: false }),
        );
    }

    match send_contact_sms(&sub).await {
        Ok(true) => (StatusCode::OK, Json(ContactResponse { ok: true })),
        Ok(false) => (StatusCode::BAD_GATEWAY, Json(ContactResponse { ok: false })),
        Err(err) => {
            eprintln!("backend-rust: failed to send contact SMS: {err}");
            (StatusCode::BAD_GATEWAY, Json(ContactResponse { ok: false }))
        }
    }
}

async fn list_guestbook(
    State(state): State<AppState>,
) -> (StatusCode, Json<GuestbookListResponse>) {
    match sqlx::query(
        "SELECT id, name, message, created_at, updated_at
         FROM guestbook_entries
         ORDER BY created_at ASC, id ASC",
    )
    .fetch_all(&state.db)
    .await
    {
        Ok(rows) => {
            let entries = rows
                .iter()
                .map(guestbook_entry_from_row)
                .collect::<Result<Vec<_>, _>>();
            match entries {
                Ok(entries) => (StatusCode::OK, Json(GuestbookListResponse { entries })),
                Err(err) => {
                    eprintln!("backend-rust: failed to decode guestbook entries: {err}");
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(GuestbookListResponse {
                            entries: Vec::new(),
                        }),
                    )
                }
            }
        }
        Err(err) => {
            eprintln!("backend-rust: failed to list guestbook entries: {err}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(GuestbookListResponse {
                    entries: Vec::new(),
                }),
            )
        }
    }
}

async fn create_guestbook_entry(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(req): Json<GuestbookCreateRequest>,
) -> (StatusCode, Json<GuestbookCreateResponse>) {
    let Some(name) = validate_name(&req.name) else {
        return (
            StatusCode::BAD_REQUEST,
            Json(GuestbookCreateResponse {
                ok: false,
                entry: None,
                edit_token: None,
            }),
        );
    };
    let Some(message) = validate_message(&req.message) else {
        return (
            StatusCode::BAD_REQUEST,
            Json(GuestbookCreateResponse {
                ok: false,
                entry: None,
                edit_token: None,
            }),
        );
    };

    // Honeypot: mimic a successful submit without writing to the database.
    if !req.company.is_empty() {
        return (
            StatusCode::CREATED,
            Json(GuestbookCreateResponse {
                ok: true,
                entry: None,
                edit_token: None,
            }),
        );
    }

    if !state.rate_limiter.allow(&client_ip(&headers, &addr)) {
        return (
            StatusCode::TOO_MANY_REQUESTS,
            Json(GuestbookCreateResponse {
                ok: false,
                entry: None,
                edit_token: None,
            }),
        );
    }

    let edit_token = generate_edit_token();
    let edit_token_hash = hash_edit_token(&edit_token);

    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(err) => {
            eprintln!("backend-rust: failed to open guestbook transaction: {err}");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(GuestbookCreateResponse {
                    ok: false,
                    entry: None,
                    edit_token: None,
                }),
            );
        }
    };

    let insert_result = sqlx::query(
        "INSERT INTO guestbook_entries (name, message, edit_token_hash)
         VALUES (?, ?, ?)",
    )
    .bind(&name)
    .bind(&message)
    .bind(&edit_token_hash)
    .execute(&mut *tx)
    .await;

    let insert_result = match insert_result {
        Ok(result) => result,
        Err(err) => {
            eprintln!("backend-rust: failed to insert guestbook entry: {err}");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(GuestbookCreateResponse {
                    ok: false,
                    entry: None,
                    edit_token: None,
                }),
            );
        }
    };

    let entry_id = insert_result.last_insert_rowid();

    if let Err(err) = sqlx::query(
        "DELETE FROM guestbook_entries
         WHERE id NOT IN (
             SELECT id
             FROM guestbook_entries
             ORDER BY created_at DESC, id DESC
             LIMIT 50
         )",
    )
    .execute(&mut *tx)
    .await
    {
        eprintln!("backend-rust: failed to prune guestbook entries: {err}");
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(GuestbookCreateResponse {
                ok: false,
                entry: None,
                edit_token: None,
            }),
        );
    }

    let row = match sqlx::query(
        "SELECT id, name, message, created_at, updated_at
         FROM guestbook_entries
         WHERE id = ?",
    )
    .bind(entry_id)
    .fetch_one(&mut *tx)
    .await
    {
        Ok(row) => row,
        Err(err) => {
            eprintln!("backend-rust: failed to fetch created guestbook entry: {err}");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(GuestbookCreateResponse {
                    ok: false,
                    entry: None,
                    edit_token: None,
                }),
            );
        }
    };

    let entry = match guestbook_entry_from_row(&row) {
        Ok(entry) => entry,
        Err(err) => {
            eprintln!("backend-rust: failed to decode created guestbook entry: {err}");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(GuestbookCreateResponse {
                    ok: false,
                    entry: None,
                    edit_token: None,
                }),
            );
        }
    };

    if let Err(err) = tx.commit().await {
        eprintln!("backend-rust: failed to commit guestbook transaction: {err}");
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(GuestbookCreateResponse {
                ok: false,
                entry: None,
                edit_token: None,
            }),
        );
    }

    (
        StatusCode::CREATED,
        Json(GuestbookCreateResponse {
            ok: true,
            entry: Some(entry),
            edit_token: Some(edit_token),
        }),
    )
}

async fn update_guestbook_entry(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Path(id): Path<i64>,
    Json(req): Json<GuestbookUpdateRequest>,
) -> (StatusCode, Json<GuestbookUpdateResponse>) {
    let Some(message) = validate_message(&req.message) else {
        return (
            StatusCode::BAD_REQUEST,
            Json(GuestbookUpdateResponse {
                ok: false,
                entry: None,
            }),
        );
    };
    let edit_token = req.edit_token.trim();
    if edit_token.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(GuestbookUpdateResponse {
                ok: false,
                entry: None,
            }),
        );
    }

    if !state.rate_limiter.allow(&client_ip(&headers, &addr)) {
        return (
            StatusCode::TOO_MANY_REQUESTS,
            Json(GuestbookUpdateResponse {
                ok: false,
                entry: None,
            }),
        );
    }

    let row = match sqlx::query("SELECT edit_token_hash FROM guestbook_entries WHERE id = ?")
        .bind(id)
        .fetch_optional(&state.db)
        .await
    {
        Ok(Some(row)) => row,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(GuestbookUpdateResponse {
                    ok: false,
                    entry: None,
                }),
            );
        }
        Err(err) => {
            eprintln!("backend-rust: failed to read guestbook entry for update: {err}");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(GuestbookUpdateResponse {
                    ok: false,
                    entry: None,
                }),
            );
        }
    };

    let stored_hash: String = match row.try_get("edit_token_hash") {
        Ok(hash) => hash,
        Err(err) => {
            eprintln!("backend-rust: failed to decode guestbook token hash: {err}");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(GuestbookUpdateResponse {
                    ok: false,
                    entry: None,
                }),
            );
        }
    };

    if stored_hash != hash_edit_token(edit_token) {
        return (
            StatusCode::FORBIDDEN,
            Json(GuestbookUpdateResponse {
                ok: false,
                entry: None,
            }),
        );
    }

    if let Err(err) = sqlx::query(
        "UPDATE guestbook_entries
         SET message = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?",
    )
    .bind(&message)
    .bind(id)
    .execute(&state.db)
    .await
    {
        eprintln!("backend-rust: failed to update guestbook entry: {err}");
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(GuestbookUpdateResponse {
                ok: false,
                entry: None,
            }),
        );
    }

    let row = match sqlx::query(
        "SELECT id, name, message, created_at, updated_at
         FROM guestbook_entries
         WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(row)) => row,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(GuestbookUpdateResponse {
                    ok: false,
                    entry: None,
                }),
            );
        }
        Err(err) => {
            eprintln!("backend-rust: failed to fetch updated guestbook entry: {err}");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(GuestbookUpdateResponse {
                    ok: false,
                    entry: None,
                }),
            );
        }
    };

    match guestbook_entry_from_row(&row) {
        Ok(entry) => (
            StatusCode::OK,
            Json(GuestbookUpdateResponse {
                ok: true,
                entry: Some(entry),
            }),
        ),
        Err(err) => {
            eprintln!("backend-rust: failed to decode updated guestbook entry: {err}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(GuestbookUpdateResponse {
                    ok: false,
                    entry: None,
                }),
            )
        }
    }
}

async fn delete_guestbook_entry(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Path(id): Path<i64>,
    Json(req): Json<GuestbookDeleteRequest>,
) -> (StatusCode, Json<GuestbookDeleteResponse>) {
    let edit_token = req.edit_token.trim();
    if edit_token.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(GuestbookDeleteResponse { ok: false }),
        );
    }

    if !state.rate_limiter.allow(&client_ip(&headers, &addr)) {
        return (
            StatusCode::TOO_MANY_REQUESTS,
            Json(GuestbookDeleteResponse { ok: false }),
        );
    }

    let row = match sqlx::query("SELECT edit_token_hash FROM guestbook_entries WHERE id = ?")
        .bind(id)
        .fetch_optional(&state.db)
        .await
    {
        Ok(Some(row)) => row,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(GuestbookDeleteResponse { ok: false }),
            );
        }
        Err(err) => {
            eprintln!("backend-rust: failed to read guestbook entry for delete: {err}");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(GuestbookDeleteResponse { ok: false }),
            );
        }
    };

    let stored_hash: String = match row.try_get("edit_token_hash") {
        Ok(hash) => hash,
        Err(err) => {
            eprintln!("backend-rust: failed to decode guestbook token hash: {err}");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(GuestbookDeleteResponse { ok: false }),
            );
        }
    };

    if stored_hash != hash_edit_token(edit_token) {
        return (
            StatusCode::FORBIDDEN,
            Json(GuestbookDeleteResponse { ok: false }),
        );
    }

    match sqlx::query("DELETE FROM guestbook_entries WHERE id = ?")
        .bind(id)
        .execute(&state.db)
        .await
    {
        Ok(result) if result.rows_affected() == 1 => {
            (StatusCode::OK, Json(GuestbookDeleteResponse { ok: true }))
        }
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(GuestbookDeleteResponse { ok: false }),
        ),
        Err(err) => {
            eprintln!("backend-rust: failed to delete guestbook entry: {err}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(GuestbookDeleteResponse { ok: false }),
            )
        }
    }
}

// Open the shared SQLite database once at startup so guestbook requests reuse
// a small async pool instead of reconnecting for every request.
async fn connect_db() -> SqlitePool {
    let db_path = std::env::var(DB_PATH_ENV).unwrap_or_else(|_| DEFAULT_DB_PATH.to_string());
    let options = SqliteConnectOptions::new()
        .filename(db_path)
        .journal_mode(SqliteJournalMode::Wal)
        .busy_timeout(Duration::from_secs(5));

    SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await
        .expect("failed to connect to SQLite database")
}

#[tokio::main]
async fn main() {
    // Local dev only: load the repo root .env (cwd is apps/backend-rust per
    // the documented `cd apps/backend-rust && cargo run` workflow). In
    // production, docker-compose injects these vars directly, so a missing
    // file here is a silent no-op.
    let _ = dotenvy::from_path("../../.env");

    let state = AppState {
        rate_limiter: Arc::new(RateLimiter::default()),
        db: connect_db().await,
    };

    let app = Router::new()
        .route("/api/rust/system/status", get(status))
        .route("/api/rust/contact", post(contact))
        .route(
            "/api/rust/guestbook",
            get(list_guestbook).post(create_guestbook_entry),
        )
        .route(
            "/api/rust/guestbook/:id",
            patch(update_guestbook_entry).delete(delete_guestbook_entry),
        )
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8081")
        .await
        .expect("failed to bind port 8081");
    println!("backend-rust listening on :8081");
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await
    .expect("server error");
}
