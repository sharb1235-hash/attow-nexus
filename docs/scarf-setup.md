# Scarf Gateway Setup

Scarf Gateway can be used to measure open-source installation interest for setup and installer entrypoints. It does not change Attow Nexus local runtime privacy.

Scarf must not be used to hide what a script does. Keep direct GitHub/raw fallback links documented, and encourage developers to review scripts before executing remote shell commands.

## Placeholders

```text
SCARF_SETUP_SH_URL=<paste after Scarf Gateway created>
DIRECT_SETUP_SH_URL=https://raw.githubusercontent.com/sharb1235-hash/attow-nexus/main/scripts/setup.sh
```

## Manual Setup

- Create the Scarf account manually.
- Prefer "Sign up with Google" if available.
- Use `sharb1235@gmail.com`.
- Create a Gateway/File package for `scripts/setup.sh` or a stable installer URL.
- After the repo is public, point the Scarf Gateway target to:
  `https://raw.githubusercontent.com/sharb1235-hash/attow-nexus/main/scripts/setup.sh`
- Paste the final Scarf URL into launch docs and `.env.launch.example` local copies as needed.
- Keep the direct raw GitHub fallback in the README.

## Optional macOS/Linux Installer

Tracked link, optional:

```bash
curl -fsSL <SCARF_SETUP_SH_URL> | bash
```

Direct fallback:

```bash
curl -fsSL https://raw.githubusercontent.com/sharb1235-hash/attow-nexus/main/scripts/setup.sh | bash
```

Security note: review `scripts/setup.sh` before piping it into `bash`.

## Windows

Keep the safer clone-based setup as the default Windows path:

```powershell
git clone https://github.com/sharb1235-hash/attow-nexus.git
cd attow-nexus
.\scripts\setup.ps1
```

Do not encourage blind remote PowerShell execution by default. If a remote PowerShell installer is ever added, mark it advanced and include a review-first instruction.
