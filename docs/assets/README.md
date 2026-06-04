# Demo Assets

This directory contains committed demo media for Attow Nexus.

Current output files:

- `docs/assets/nexus-demo.mp4`
- `docs/assets/nexus-demo.gif`
- `docs/assets/attow-nexus-launch.mp4`
- `docs/assets/attow-nexus-launch-still.png`

Do not commit fake or empty binary recordings. Regenerate assets locally when the product flow changes, then verify the rendered video before publishing.

## Polished Remotion Product Intro Video

`docs/assets/attow-nexus-launch.mp4` is a scripted 60-second product intro video built with Remotion. It is separate from the live captured product demo above: the Remotion video uses accurate generated terminal/dashboard visuals and product copy for a clean public intro.

Regenerate it from the repository root with:

```powershell
cd scripts\remotion-launch-video
npm.cmd install
npm.cmd run render
npm.cmd run still
```

The render writes:

- `docs/assets/attow-nexus-launch.mp4`
- `docs/assets/attow-nexus-launch-still.png`

## Regenerate the Captured Product Demo

Use the scripted pipeline in `scripts/demo`:

```powershell
cd <repo>
cd scripts\demo
npm.cmd install
npx.cmd playwright install chromium
cd ..\..
npm.cmd --prefix scripts/demo run demo
```

The script writes the MP4 to `docs/assets/nexus-demo.mp4`. To also write or refresh the GIF:

```powershell
npm.cmd --prefix scripts/demo run demo:gif
```

If FFmpeg is missing, install it with:

```powershell
winget install Gyan.FFmpeg
```

## 30-60 Second Recording Shot List

1. Show `docker compose up --build` running the Attow Nexus daemon.
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
