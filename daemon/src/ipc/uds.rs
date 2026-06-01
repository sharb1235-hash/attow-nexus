#[cfg(unix)]
pub fn restrict_current_user(path: &std::path::Path) -> anyhow::Result<()> {
    use std::os::unix::fs::PermissionsExt;
    let permissions = std::fs::Permissions::from_mode(0o600);
    std::fs::set_permissions(path, permissions)?;
    Ok(())
}

#[cfg(not(unix))]
pub fn restrict_current_user(_path: &std::path::Path) -> anyhow::Result<()> {
    Ok(())
}
