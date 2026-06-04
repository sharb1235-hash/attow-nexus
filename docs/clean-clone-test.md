# Clean Clone Test

Run this before switching the repository from private to public.

## Windows PowerShell

Terminal 1:

```powershell
cd C:\Users\Sharb\Documents
git clone https://github.com/sharb1235-hash/attow-nexus.git attow-nexus-clean-test
cd attow-nexus-clean-test
docker compose up --build
```

Terminal 2:

```powershell
cd C:\Users\Sharb\Documents\attow-nexus-clean-test
.\scripts\setup.ps1
```

If PowerShell blocks local scripts:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup.ps1
```

Open the Vite URL printed by `.\scripts\setup.ps1`.

For a nonblocking validation run that skips the dashboard dev server:

```powershell
.\scripts\setup.ps1 -NoDashboard
```

If PowerShell blocks local scripts:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup.ps1 -NoDashboard
```

The setup script assumes Docker is already running in Terminal 1. It does not require API keys, installs the Python SDK in editable mode, runs the universal demo by default, prints CLI inspection output, and starts the Vite dashboard unless `-NoDashboard` is provided.

## macOS/Linux

Terminal 1:

```bash
cd ~/Documents
git clone https://github.com/sharb1235-hash/attow-nexus.git attow-nexus-clean-test
cd attow-nexus-clean-test
docker compose up --build
```

Terminal 2:

```bash
cd ~/Documents/attow-nexus-clean-test
chmod +x scripts/setup.sh
./scripts/setup.sh
```

Open the Vite URL printed by `./scripts/setup.sh`.

For a nonblocking validation run that skips the dashboard dev server:

```bash
./scripts/setup.sh --no-dashboard
```

The setup script assumes Docker is already running in Terminal 1. It does not require API keys, installs the Python SDK in editable mode, runs the universal demo by default, prints CLI inspection output, and starts the Vite dashboard unless `--no-dashboard` is provided.
