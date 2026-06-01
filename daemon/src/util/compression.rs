pub fn maybe_compress(bytes: &[u8], threshold: usize) -> anyhow::Result<(Vec<u8>, bool)> {
    if bytes.len() < threshold {
        return Ok((bytes.to_vec(), false));
    }
    let compressed = zstd::stream::encode_all(bytes, 3)?;
    Ok((compressed, true))
}

pub fn maybe_decompress(bytes: &[u8], compressed: bool) -> anyhow::Result<Vec<u8>> {
    if compressed {
        Ok(zstd::stream::decode_all(bytes)?)
    } else {
        Ok(bytes.to_vec())
    }
}
