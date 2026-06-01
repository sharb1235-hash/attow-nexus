pub fn unavailable_error() -> anyhow::Error {
    anyhow::anyhow!("RocksDB store requires building Nexus with --features rocksdb-store")
}
