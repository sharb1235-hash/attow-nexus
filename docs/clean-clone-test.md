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
curl.exe http://127.0.0.1:7822/api/health
curl.exe http://127.0.0.1:7823/metrics
cd sdks\python
py -m pip install -e .
cd ..\..
py examples\python-basic\main.py
cargo run -p nexus -- agents
cargo run -p nexus -- channels
cargo run -p nexus -- log --run demo-run
```

Terminal 3:

```powershell
cd C:\Users\Sharb\Documents\attow-nexus-clean-test\dashboard
npm.cmd install
npm.cmd run dev
```

Open the Vite URL printed by `npm.cmd run dev`.

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
curl http://127.0.0.1:7822/api/health
curl http://127.0.0.1:7823/metrics
cd sdks/python
python3 -m pip install -e .
cd ../..
python3 examples/python-basic/main.py
cargo run -p nexus -- agents
cargo run -p nexus -- channels
cargo run -p nexus -- log --run demo-run
```

Terminal 3:

```bash
cd ~/Documents/attow-nexus-clean-test/dashboard
npm install
npm run dev
```

Open the Vite URL printed by `npm run dev`.
