//! backend-rust: the Rust implementation of the iota-terminal API contract.

use axum::{
    extract::{ConnectInfo, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    net::SocketAddr,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

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

type AppState = Arc<RateLimiter>;

async fn send_contact_sms(sub: &ContactSubmission) -> Result<bool, reqwest::Error> {
    let account_sid = std::env::var("TWILIO_ACCOUNT_SID").unwrap_or_default();
    let auth_token = std::env::var("TWILIO_AUTH_TOKEN").unwrap_or_default();
    let from_number = std::env::var("TWILIO_FROM_NUMBER").unwrap_or_default();
    let to_number = std::env::var("TWILIO_TO_NUMBER").unwrap_or_default();

    if account_sid.is_empty() || auth_token.is_empty() || from_number.is_empty() || to_number.is_empty() {
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

async fn contact(
    State(rate_limiter): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Json(sub): Json<ContactSubmission>,
) -> (StatusCode, Json<ContactResponse>) {
    if sub.name.is_empty() || sub.email.is_empty() || sub.message.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(ContactResponse { ok: false }));
    }

    // Honeypot: pretend success without sending an SMS or doing further work.
    if !sub.company.is_empty() {
        return (StatusCode::OK, Json(ContactResponse { ok: true }));
    }

    if !rate_limiter.allow(&addr.ip().to_string()) {
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

#[tokio::main]
async fn main() {
    // Local dev only: load the repo root .env (cwd is apps/backend-rust per
    // the documented `cd apps/backend-rust && cargo run` workflow). In
    // production, docker-compose injects these vars directly, so a missing
    // file here is a silent no-op.
    let _ = dotenvy::from_path("../../.env");

    let rate_limiter: AppState = Arc::new(RateLimiter::default());

    let app = Router::new()
        .route("/api/rust/system/status", get(status))
        .route("/api/rust/contact", post(contact))
        .with_state(rate_limiter);

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
