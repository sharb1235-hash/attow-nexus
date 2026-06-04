# Attow Nexus Launch Demo Video

This directory contains the repeatable local pipeline for creating the Attow Nexus public launch demo video.

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

## Troubleshooting

If the dashboard scene is blank, make sure the dashboard dev server can start from `dashboard/`:

```powershell
cd dashboard
npm.cmd install
npm.cmd run dev
```

The demo script starts Vite automatically when no dashboard server is already running. Vite may choose `5174`, `5175`, or another nearby port if `5173` is busy; the script reads the URL from Vite output.

Dashboard screenshots are captured into `scripts/demo/out/dashboard-*.png`. The final dashboard slide embeds those screenshots as base64 data URIs before rendering, so it does not depend on fragile relative paths or `file://` image loading during MP4 creation.

Before rendering the MP4, the script validates the dashboard slide and stops with this message if any screenshot image fails to load:

```text
Demo video render aborted: broken image asset detected in dashboard scene.
```

Rerun the pipeline from the repository root after fixing the dashboard or screenshot issue:

```powershell
npm.cmd --prefix scripts\demo run demo
```

The script also extracts a dashboard-scene preview frame to `scripts/demo/out/dashboard-scene-preview.png` so you can visually confirm that the MP4 contains populated Console panels before committing `docs/assets/nexus-demo.mp4`.
