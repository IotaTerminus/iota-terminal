//! backend-rust: the Rust implementation of the iota-terminal API contract.

use axum::{routing::get, Json, Router};
use serde::Serialize;

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

#[tokio::main]
async fn main() {
    let app = Router::new().route("/api/rust/system/status", get(status));

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8081")
        .await
        .expect("failed to bind port 8081");
    println!("backend-rust listening on :8081");
    axum::serve(listener, app).await.expect("server error");
}
