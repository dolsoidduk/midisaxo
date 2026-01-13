# Midisaxo configurator (OpenDeck UI fork)

This repository hosts the **Midisaxo** configurator UI, based on the upstream OpenDeck configurator.

- Midisaxo UI (GitHub Pages): https://dolsoidduk.github.io/midisaxo/
- Upstream OpenDeck project: https://github.com/shanteacontrols/OpenDeck
- Upstream online configurator: https://config.shanteacontrols.com

## Quick start (web)

1. Open https://dolsoidduk.github.io/midisaxo/ in Chrome/Edge.
2. Click any UI button once (required for WebMIDI permission).
3. Allow **MIDI + SysEx** → select the OpenDeck MIDI output.

## Midisaxo: rhythm / arranger controls

If you are using OpenDeck as a MIDI controller for an arranger keyboard (e.g. Ketron MS60), you can map arranger functions such as **Intro / Variation / Fill / Ending / Start / Stop** to OpenDeck buttons.

Recommended workflow:

1. Capture the MIDI message sent by the arranger when you press a function button.
2. Paste the captured bytes into the OpenDeck UI button **RAW MIDI HEX** field.
3. Save → test.

Docs:

- Ketron MS60 control template (copy/paste ready): [KETRON_MS60_CONTROLS_TEMPLATE.md](./KETRON_MS60_CONTROLS_TEMPLATE.md)

Important notes:

- Not all devices use the same message type for arranger functions (it may be Note/CC/MMC/SysEx), so capture-first is the safest approach.
- Custom SysEx storage has a size limit (see the template for details); if your captured SysEx is longer, you may need to switch to an alternative message type or extend firmware support.

Upstream demo video (OpenDeck configurator):

[![OpenDeck configurator demo video](https://img.youtube.com/vi/7X2LC0JMfAU/maxresdefault.jpg)](https://youtu.be/7X2LC0JMfAU)

Offline versions are available under the upstream [Releases section](https://github.com/shanteacontrols/OpenDeckUI/releases). Each release has attached 3 zip files. Download the appropriate one depending on your operating system:

* darwin-x64 -> Intel macOS
* linux-x64 -> Linux x64
* win32-x64 -> Windows x64

## Development

This projects uses Docker container for development. To use it, run the following command from the root repository directory:

    ./scripts/dev.sh

The development version of the configurator with local server can be started with the following commands:

    make


## Desktop packaging (Linux/Windows)

This repo can be packaged as a cross-platform desktop app via Electron.

### Development (Electron)

Run Vite + Electron together:

```bash
npm run electron:dev
```

### Build UI (static)

```bash
npm run build
```

### Package for Linux

```bash
npm run dist:linux
```

Output will be created under `release/`.

### Package for Windows

```bash
npm run dist:win
```

Notes:
- Building Windows installers on Linux may require Wine. If it fails, run the command on a Windows machine.
To package the configurator for offline usage, `make pkg` command can be used with `PLATFORM` variable being set to the platform for which to build the configurator:

* Linux: `make pkg PLATFORM=linux`
* Windows: `make PLATFORM=win32`
* macOS: `make PLATFORM=darwin`

## GitHub Pages (always-on UI)

This repository can publish the configurator to GitHub Pages so the UI is always available online.

1. Push to `master` (or run the workflow manually).
2. In GitHub repo settings: **Settings → Pages → Build and deployment → Source = GitHub Actions**.
3. Open the published URL (usually `https://<owner>.github.io/<repo>/`).

This fork uses the GitHub Actions workflow in `.github/workflows/pages.yml`.

Notes:

- Browsers require a user gesture before WebMIDI can be enabled (you must click something in the UI first).
- WebMIDI support varies by browser; Chrome/Edge are typically the best.
- SysEx access usually requires explicit permission (allow SysEx / sysex=true).