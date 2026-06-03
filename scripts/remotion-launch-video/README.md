# Attow Nexus Remotion Launch Video

Scriptable Remotion source for the 60-second Attow Nexus developer launch video.

## Render

```powershell
cd scripts\remotion-launch-video
npm.cmd install
npm.cmd run render
```

Output:

```text
docs/assets/attow-nexus-launch.mp4
```

## Still Frame Check

```powershell
npm.cmd run still
```

The video is 1920x1080, 30fps, 60 seconds, and uses generated terminal/dashboard scenes rather than stock footage or cloud services.
