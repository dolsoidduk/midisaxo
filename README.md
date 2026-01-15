# Midisaxo configurator (OpenDeck UI fork)

This repository hosts the **Midisaxo** configurator UI, based on the upstream OpenDeck configurator.

- Midisaxo UI (GitHub Pages): https://dolsoidduk.github.io/midisaxo/
- Upstream OpenDeck project: https://github.com/shanteacontrols/OpenDeck
- Upstream online configurator: https://config.shanteacontrols.com

## Quick start (web)

1. Open https://dolsoidduk.github.io/midisaxo/ in Chrome/Edge.
2. Click any UI button once (required for WebMIDI permission).
3. Allow **MIDI + SysEx** → select the OpenDeck MIDI output.

## 개발/배포 최소 루틴 (로컬 + 원격)

로컬에서 기능 확인하고, PR 머지 후 GitHub Pages로 반영하는 가장 짧은 루틴입니다.

1. 로컬 UI 실행
    - Install: `npm install` (또는 `yarn`)
    - Dev: `npm run dev` (기본 포트 `3004`)
    - 접속: `http://localhost:3004/`
    - 원격 컨테이너/SSH 환경이면 VS Code Ports에서 `3004` 포트 포워딩 후 접속

2. PR 전 체크
    - `npm run lint && npm run build`

3. 원격 배포 (GitHub Pages)
    - `master`에 머지/푸시되면 `.github/workflows/pages.yml`가 실행되어 Pages가 갱신됩니다.
    - URL: <https://dolsoidduk.github.io/midisaxo/>

4. (대체) Pages 배포 큐가 막힐 때
    - `deployment_queued`로 오래 멈추면 `.github/workflows/pages-branch.yml`로 `gh-pages` 브랜치에 직접 배포해서 우회할 수 있습니다.

주의: 기본 포트/호스트는 `vite.config.ts`에서 설정합니다. 포트를 바꾸려면 `npm run dev -- --port 5173`처럼 인자로 **한 번만** 넘기세요.

## “이 펌웨어/디바이스에서는 지원되지 않습니다”가 뜰 때

UI에서 특정 설정 항목이 비활성화되고 위 문구가 표시되는 경우, 대부분은 UI가 해당 값을 읽거나 쓰려다 펌웨어로부터 `NOT_SUPPORTED(13)` 또는 잘못된 인덱스/섹션 에러를 받았다는 뜻입니다.

### 빠른 확인(체크리스트)

1) 장치를 연결한 상태에서 상단의 **Request Log**(요청 로그) 화면을 엽니다.

2) 문제가 되는 설정 화면을 열어(또는 값을 한 번 변경해) 해당 설정에 대한 `GetValue/SetValue` 요청이 발생하게 합니다.

3) Request Log에서 실패한 항목을 확인합니다.
    - `NOT_SUPPORTED(13)`이면: 해당 보드/타깃 펌웨어가 그 기능(블록/섹션/인덱스)을 구현하지 않은 상태입니다.
    - `INDEX/SECTION/BLOCK` 관련 에러면: UI/펌웨어 간 설정 인덱스 매핑이 맞지 않거나, 펌웨어가 해당 범위를 허용하지 않는 상태일 수 있습니다.

4) 펌웨어 업데이트 후 다시 연결해 같은 요청이 `ACK`로 바뀌는지 확인합니다.

### midisaxo 자동 비브라토(압력 게이트) 관련

`자동 비브라토 (압력 게이트)` 설정들은 시스템 설정 인덱스 14~18을 사용합니다.
펌웨어에서 커스텀 시스템 설정 범위(`MAX_CUSTOM_SYSTEM_SETTINGS`)가 충분히 크지 않으면 인덱스가 범위 밖으로 취급되어 UI에 미지원으로 표시될 수 있습니다.

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

## Firmware (Midisaxo RP2040)

This repo includes the firmware sources under `OpenDeck-firmware/`.

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
- Analog index 2: GPIO28 / ADC2 (피치 Amount 또는 Pitch Bend 센서)

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

Push a tag like `v0.1.0` to trigger GitHub Actions to build and attach:
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
