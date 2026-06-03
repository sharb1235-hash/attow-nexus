# Nexus Launch Demo Video

This directory contains the repeatable local pipeline for creating the public launch demo video.

The script captures real local daemon output, CLI output, dashboard screenshots, and generated title/caption slides, then assembles them into:

- `docs/assets/nexus-demo.mp4`
- optionally `docs/assets/nexus-demo.gif`

No paid software is required.

## Prerequisites

Start the daemon first from the repository root:

```powershell
docker compose up --build
```

Install this demo package once:

```powershell
cd scripts\demo
npm.cmd install
```

Install Playwright Chromium if it is missing:

```powershell
npx.cmd playwright install chromium
```

Install FFmpeg if it is missing:

```powershell
winget install Gyan.FFmpeg
```

The Python SDK should be installed for the demo:

```powershell
cd ..\..\sdks\python
py -m pip install -e .
```

## Generate the MP4

From the repository root:

```powershell
npm.cmd --prefix scripts/demo run demo
```

Or:

```powershell
node scripts/demo/create-demo-video.mjs
```

To also generate a GIF:

```powershell
npm.cmd --prefix scripts/demo run demo:gif
```

## Fresh Daemon Expectation

For the cleanest recording, run the script against a fresh Docker daemon data volume. The video is designed to show:

- `nexus_agents_connected 2`
- `nexus_channels_total 2`
- `nexus_deltas_total 2`
- `nexus_durable_deltas_total 2`
- `nexus_commits_total 2`

If those counters already show the exact demo state, the script reuses that state to avoid creating duplicate commits. If the counters show a different partially-used state, the script stops and asks you to restart with a clean daemon before recording.

## Outputs

Raw captured files are written to `scripts/demo/out/` and ignored by Git. The final MP4/GIF files in `docs/assets/` are intentionally not ignored, so they can be committed when the real launch recording is ready.
