# Launch Demo Assets

Place the final public launch recording in this directory before switching the repository to public visibility.

Recommended output files:

- `docs/assets/nexus-demo.mp4`
- `docs/assets/nexus-demo.gif`

Do not commit a fake or empty binary recording. This placeholder exists so the README can link to the intended launch asset location while the repository is still private.

## Generate the Recording

Use the scripted pipeline in `scripts/demo`:

```powershell
cd <repo>
cd scripts\demo
npm.cmd install
npx.cmd playwright install chromium
cd ..\..
npm.cmd --prefix scripts/demo run demo
```

The script writes the MP4 to `docs/assets/nexus-demo.mp4`. To also write a GIF:

```powershell
npm.cmd --prefix scripts/demo run demo:gif
```

If FFmpeg is missing, install it with:

```powershell
winget install Gyan.FFmpeg
```

## 30-60 Second Recording Shot List

1. Show `docker compose up --build` running the Nexus daemon.
2. Show API health returning ok from `http://127.0.0.1:7822/api/health`.
3. Show metrics available at `http://127.0.0.1:7823/metrics`.
4. Run `py examples\python-basic\main.py` and show the demo creating two durable commits.
5. Show metrics changing from zero to active agents, channels, and commits.
6. Run `cargo run -p nexus -- agents`.
7. Run `cargo run -p nexus -- channels`.
8. Run `cargo run -p nexus -- log --run demo-run`.
9. Open the Vite dashboard URL and show connected agents, channels, and recent commits.
10. Optionally show `cargo run -p nexus -- diff <commit_a> <commit_b>` and `cargo run -p nexus -- replay <commit_id>`.

Keep the recording focused on the validated local flow: Docker daemon/API, Python demo, CLI inspection, metrics, and the dashboard dev UI.
