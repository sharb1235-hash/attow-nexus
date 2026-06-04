# Scripts

Launch-day setup scripts live at the top of this directory:

- `setup.ps1` for Windows PowerShell.
- `setup.sh` for macOS/Linux shells.

Both scripts assume the Attow Nexus Docker daemon is already running in Terminal 1:

```powershell
docker compose up --build
```

The setup scripts do not require API keys. By default, they verify the local daemon, install the Python SDK in editable mode, run the no-key universal translation demo, run the TypeScript/Vercel-style demo, print CLI inspection output, and start the Vite dashboard dev server.

For nonblocking validation:

```powershell
.\scripts\setup.ps1 -NoDashboard
```

If PowerShell blocks local scripts, use:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup.ps1 -NoDashboard
```

```bash
./scripts/setup.sh --no-dashboard
```

For the smaller basic Python demo fallback:

```powershell
.\scripts\setup.ps1 -Basic
```

```bash
./scripts/setup.sh --basic
```

## Syntax Checks

PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "$null = [scriptblock]::Create((Get-Content .\scripts\setup.ps1 -Raw)); 'setup.ps1 syntax ok'"
```

Bash:

```bash
bash -n scripts/setup.sh
```

If Bash is not available on a Windows workstation, run the Bash syntax check on macOS/Linux or in CI.
