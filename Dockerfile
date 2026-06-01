FROM rust:1.95-bookworm AS rust-builder
WORKDIR /src
COPY Cargo.toml ./
COPY proto ./proto
COPY daemon ./daemon
COPY cli ./cli
RUN cargo build --release --workspace

FROM debian:bookworm-slim AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates libsqlite3-0 \
  && rm -rf /var/lib/apt/lists/*
COPY --from=rust-builder /src/target/release/nexusd /usr/local/bin/nexusd
COPY --from=rust-builder /src/target/release/nexus /usr/local/bin/nexus
ENV NEXUS_DATA_DIR=/data \
    NEXUS_SQLITE_PATH=/data/nexus.sqlite \
    NEXUS_ARTIFACT_DIR=/data/artifacts \
    NEXUS_HTTP_ADDR=127.0.0.1:7822 \
    NEXUS_METRICS_ADDR=127.0.0.1:7823 \
    NEXUS_GRPC_ADDR=127.0.0.1:7821
VOLUME ["/data"]
EXPOSE 7821 7822 7823
CMD ["nexusd"]

