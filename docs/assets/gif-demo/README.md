# Attow Nexus Debug GIF Demo

This directory contains the reproducible source for `docs/assets/attow-nexus-debug-demo.gif`.

The animation is a stylized terminal walkthrough for README comprehension. It uses tiny local helper scripts so the GIF stays short, deterministic, and readable. The public commands shown in the animation use the real `nexus` CLI name, but the helper scripts in `bin/` are only for this generated asset.

Generate from the repository root with Docker:

```powershell
docker run --rm -v "${PWD}:/vhs" ghcr.io/charmbracelet/vhs docs/assets/gif-demo/attow-nexus-debug-demo.tape
```

Do not add private paths, credentials, launch-ops notes, or internal checklist language to the tape output.
