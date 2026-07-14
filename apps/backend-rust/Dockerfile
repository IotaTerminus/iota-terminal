# Build context: apps/backend-rust (this backend has no monorepo/npm dependencies)
FROM rust:1-slim AS build
WORKDIR /src
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo build --release

FROM debian:bookworm-slim
COPY --from=build /src/target/release/backend-rust /usr/local/bin/backend-rust
EXPOSE 8081
ENTRYPOINT ["/usr/local/bin/backend-rust"]
