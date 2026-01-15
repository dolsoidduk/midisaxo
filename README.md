# Midisaxo configurator (OpenDeck UI fork)

This repository hosts the **Midisaxo** configurator UI, based on the upstream OpenDeck configurator.

- Midisaxo UI (GitHub Pages): https://dolsoidduk.github.io/midisaxo/
- Upstream OpenDeck project: https://github.com/shanteacontrols/OpenDeck
- Upstream online configurator: https://config.shanteacontrols.com

## Quick start (web)

1. Open https://dolsoidduk.github.io/midisaxo/ in Chrome/Edge.
2. Click any UI button once (required for WebMIDI permission).
3. Allow **MIDI + SysEx** → select the OpenDeck MIDI output.

## Resume (next time)

Get back to a known-good state:

```bash
git fetch --all --tags
git checkout session-2026-01-13
```

Start the UI locally:

```bash
npm install
npm run dev
```

Notes:

- Default dev URL: `http://localhost:3004/`
- If you need to bind outside localhost (e.g. dev container), use the helper script:
    - Example: `npm run dev:lan` (or `yarn dev:lan`)
- If you need a different port, prefer CLI args (config avoids duplication):
    - Example: `npm run dev -- --port 5173`
- If you need to bind outside localhost (e.g. dev container), prefer env vars:
    - Example: `VITE_HOST=0.0.0.0 VITE_PORT=3004 npm run dev`
    - Note: Vite v1 uses `--hostname` (not `--host`).

## Desktop에서도 사용하기

Midisaxo UI는 아래 두 방식 모두 지원합니다.

### 1) 데스크탑 브라우저로 사용 (LAN 원격 접속)

이 방식은 "설정 UI"가 떠 있는 머신(예: dev container/서버)에 접속만 하면 됩니다.

- UI 서버 실행: `npm run dev:lan`
- 데스크탑에서 접속: `http://<서버의_IP>:3004/`

예: 이더넷 IP가 `192.168.219.104` 라면

- `http://192.168.219.104:3004/`

주의:

- 방화벽/공유기 AP isolation 설정에 따라 다른 기기에서 접속이 막힐 수 있습니다.

### 2) 데스크탑 앱으로 사용 (AppImage/Windows 실행 파일)

이 방식은 UI를 "데스크탑에 설치/실행"해서, USB로 연결된 장치(MIDI)를 로컬에서 직접 제어할 때 유용합니다.

Linux (AppImage):

```bash
chmod +x Midisaxo-*.AppImage
./Midisaxo-*.AppImage
```

만약 실행 시 FUSE 관련 에러가 나오면 Ubuntu/Debian 계열에서 아래가 필요할 수 있습니다:

```bash
sudo apt update
sudo apt install -y libfuse2
```

Windows:

- `Midisaxo-*.exe` (portable) 또는 `Midisaxo-*-win.zip`을 내려받아 실행합니다.

MIDI가 안 보일 때(데스크탑 앱):

- 장치가 OS에서 인식되는지 먼저 확인(USB 케이블/포트, 장치 전원, BOOTSEL 모드 아님)
- 앱을 실행한 뒤 화면에서 한 번 클릭/조작 후 다시 MIDI 목록 확인(권한/사용자 제스처 이슈 회피)
- Linux에서 AppImage 실행 시 권한 에러가 나면 `chmod +x` 적용 여부 확인

## Desktop packaging (Linux/Windows)

## Firmware (Midisaxo RP2040)

This repo includes the firmware sources under `OpenDeck-firmware/`.

Firmware version note (Midisaxo):

- Midisaxo 타겟(`midisaxo_*`)의 펌웨어 버전은 upstream OpenDeck 태그(v7.x)와 분리되어 있으며
    `OpenDeck-firmware/MIDISAXO_FIRMWARE_VERSION` 파일의 값을 사용합니다.

### Build

```bash
cd OpenDeck-firmware
make TARGET=midisaxo_pico -j
```

Artifacts:

- `OpenDeck-firmware/build/midisaxo_pico/release/merged.uf2` (BOOTSEL drag & drop)
- `OpenDeck-firmware/build/midisaxo_pico/release/sysexgen/firmware.sysex` (SysEx updater)

### Flash via UF2 (BOOTSEL)

1. Hold **BOOTSEL** while connecting the RP2040 board via USB.
2. A USB drive (typically `RPI-RP2`) appears.
3. Copy `merged.uf2` to that drive.

Notes:

- While the board is in BOOTSEL/storage mode, it will **not** appear as a MIDI device.
- If the UI only shows `MIDI Through`, double-check the board is not in BOOTSEL mode.

### Firmware update via SysEx

If your device is already running firmware and enumerates as USB-MIDI, you can update using the generated SysEx file:

- `OpenDeck-firmware/build/midisaxo_pico/release/sysexgen/firmware.sysex`

You can send it via a SysEx sender tool, or via the configurator's firmware update page (when the board is connected).

## 2x MPXV7002DP (Breath + Pitch Bend) 추천 구성

MPXV7002DP(차압 센서) 2개를 다음처럼 분리해서 쓰는 구성을 지원합니다.

- 센서 #1: 브레스 전용 → CC2 + CC11 (동시 전송)
- 센서 #2: 피치벤드 전용 → Pitch Bend

### 배선/ADC 인덱스 (midisaxo_pico 기본)

`OpenDeck-firmware/config/target/midisaxo_pico.yml` 기준으로 RP2040 Pico의 native ADC는 다음 인덱스로 잡힙니다.

- Analog index 0: GPIO26 / ADC0 (트림/예약 용도)
- Analog index 1: GPIO27 / ADC1 (브레스 센서 추천)
- Analog index 2: GPIO28 / ADC2 (피치 데드존 트림(예약) 또는 Pitch Bend 센서)

즉, 2개의 MPXV7002DP를 쓰려면 보통:

- 센서 #1 출력 → GPIO27(Analog index 1)
- 센서 #2 출력 → GPIO28(Analog index 2)

로 두고, 3.3V/GND는 공통으로 연결합니다.

### UI 설정 절차

1. Global → `색소폰 브레스 컨트롤러 (MPXV7002DP)`
    - Enable: ON
    - 브레스 아날로그 인덱스: 센서 #1이 연결된 인덱스(보통 `1`)
    - 브레스 CC: `CC2 + CC11`

2. Analog 블록
    - 센서 #2가 연결된 아날로그 입력을 선택
    - 타입(Type)을 `Pitch Bend`로 설정

주의:

- Analog 블록에서도 CC2/CC11을 직접 내보내도록 설정하면, Global의 브레스 CC와 중복될 수 있습니다.

## Development notes

Build/test the firmware (from the firmware repo root):

```bash
cd OpenDeck-firmware
make TARGET=midisaxo_pico -j
make TARGET=midisaxo_pico test TEST_EXECUTE=0
```

If you need any parked work from this session, check the backup branches:

```bash
git branch -a | grep 'backup/'
```

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

### GitHub Releases (recommended)

Push a tag like `v0.1.0` to trigger GitHub Actions (`.github/workflows/desktop-release.yml`) to build and attach:
- Windows installer `.exe` (NSIS)
- Windows single-file `.exe` (portable)
- Windows portable `.zip`
- Linux `.AppImage`
- Linux portable `.tar.gz`

Recommended flow (safe + repeatable):

```bash
# bumps version, updates release notes draft (template), commits, tags, pushes
npm run release -- 0.1.5
```

By default, the script also auto-fills the release notes "Changes" section from git log (since the previous tag).
Disable it if you prefer writing notes manually:

```bash
npm run release -- --no-auto-notes 0.1.5
```

Dry-run (no changes, just prints commands):

```bash
npm run release -- --dry-run 0.1.5
```

### Development (Electron)

Run Vite + Electron together:

```bash
npm run electron:dev
```

컨테이너 환경(샌드박스 제한)에서 Electron을 띄워야 하면:

```bash
npm run electron:dev:container
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

Portable (extract and run):

```bash
npm run dist:linux:portable
```

This produces a `*.tar.gz` under `release/`.

### Package for Windows

```bash
npm run dist:win
```

Single-file executable (portable `.exe`):

```bash
npm run dist:win:exe
```

This produces an `.exe` under `release/` (e.g. `Midisaxo-0.1.1.exe`).

Portable (extract and run):

```bash
npm run dist:win:portable
```

This produces a `*.zip` under `release/`.

Notes:
- Building Windows installers on Linux may require Wine. If it fails, run the command on a Windows machine.
To package the configurator for offline usage, `make pkg` command can be used with `PLATFORM` variable being set to the platform for which to build the configurator:

* Linux: `make pkg PLATFORM=linux`
* Windows: `make PLATFORM=win32`
* macOS: `make PLATFORM=darwin`

## GitHub Pages (always-on UI)

This repository can publish the configurator to GitHub Pages so the UI is always available online.

1. Push to `master` (this triggers the GitHub Pages deploy workflow).
2. In GitHub repo settings: **Settings → Pages → Build and deployment → Source = GitHub Actions**.
3. Open the published URL (usually `https://<owner>.github.io/<repo>/`).

### Alternative: deploy via `gh-pages` branch (manual)

If GitHub Pages deployments get stuck in `deployment_queued` (and hit the 10 minute timeout), you can bypass the Pages Deploy API entirely by publishing the built `dist/` output to a `gh-pages` branch by running the **Deploy UI (gh-pages branch)** workflow manually.

This fork uses the GitHub Actions workflow in `.github/workflows/pages.yml`.

### Alternative: deploy via `gh-pages` branch (avoids Pages deploy queue)

If GitHub Pages deployments get stuck in `deployment_queued` (and hit the 10 minute timeout), you can bypass the Pages Deploy API entirely by publishing the built `dist/` output to a `gh-pages` branch.

This repo includes an additional workflow: `.github/workflows/pages-branch.yml`.

To enable it:

1. GitHub repo → **Settings → Pages**
2. **Build and deployment → Source = Deploy from a branch**
3. Branch = `gh-pages`, Folder = `/ (root)`

Notes:
- If you use the branch method, you can keep `.github/workflows/pages.yml` as a manual fallback (workflow_dispatch).
- The published URL stays the same.

### Firmware repo setting (recommended)

This UI checks firmware updates via the GitHub Releases API.

To keep it strictly **Midisaxo-focused**, set a repository variable:

- GitHub repo → **Settings → Secrets and variables → Actions → Variables**
- Add variable: `FIRMWARE_REPO = dolsoidduk/OpenDeck`

If this variable is not set, the build defaults to `dolsoidduk/OpenDeck`.

Notes:

- Browsers require a user gesture before WebMIDI can be enabled (you must click something in the UI first).
- WebMIDI support varies by browser; Chrome/Edge are typically the best.
- SysEx access usually requires explicit permission (allow SysEx / sysex=true).
