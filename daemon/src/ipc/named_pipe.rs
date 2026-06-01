pub fn supported() -> bool {
    cfg!(windows)
}

pub fn fallback_message() -> &'static str {
    "Windows named pipe support is represented in configuration; TCP loopback is the portable MVP fallback."
}
