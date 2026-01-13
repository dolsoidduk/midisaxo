const {
  app,
  BrowserWindow
} = require('electron')

const fs = require('fs')
const path = require('path')

// Ensure WebMIDI is enabled in Electron/Chromium.
// Some Linux setups will otherwise only expose generic ports (e.g. MIDI Through).
try {
  app.commandLine.appendSwitch('enable-web-midi')

  // Keep enable-features unified (multiple appendSwitch calls can override).
  const enableFeatures = ['WebMidi']

  // Some Linux/Wayland setups exhibit a compositor paint bug where text isn't
  // visible until the first click/resize. Allow forcing X11 via env var.
  // Usage: OPENDECK_CONFIGURATOR_FORCE_X11=1
  const forceX11Env = process.env.OPENDECK_CONFIGURATOR_FORCE_X11
  const forceX11 = forceX11Env === '1' || forceX11Env === 'true'
  if (process.platform === 'linux' && forceX11) {
    enableFeatures.push('UseOzonePlatform')
    try {
      app.commandLine.appendSwitch('ozone-platform', 'x11')
    } catch (_) {
      // ignore
    }
  }

  app.commandLine.appendSwitch('enable-features', enableFeatures.join(','))
} catch (_) {
  // ignore
}

// Linux/Electron GPU rendering can occasionally fail to paint text until the
// first user interaction (click/resize). Since this app is mostly UI/forms,
// prefer a stable software-rendered path by default.
// Opt out via: OPENDECK_CONFIGURATOR_ENABLE_GPU=1
try {
  const enableGpuEnv = process.env.OPENDECK_CONFIGURATOR_ENABLE_GPU
  const enableGpu = enableGpuEnv === '1' || enableGpuEnv === 'true'
  if (process.platform === 'linux' && !enableGpu) {
    app.disableHardwareAcceleration()

    // Be extra strict: disable GPU compositing as well.
    try {
      app.commandLine.appendSwitch('disable-gpu')
      app.commandLine.appendSwitch('disable-gpu-compositing')
    } catch (_) {
      // ignore
    }
  }
} catch (_) {
  // ignore
}

// Optional: allow disabling Chromium sandbox for environments where MIDI device
// enumeration is blocked (e.g. only "MIDI Through" shows up).
// Enable via:
//   OPENDECK_CONFIGURATOR_NO_SANDBOX=1 ./OpenDeckConfigurator
// or (short):
//   NO_SANDBOX=1 ./OpenDeckConfigurator
// or:
//   ./OpenDeckConfigurator --no-sandbox
try {
  const noSandboxEnv = process.env.OPENDECK_CONFIGURATOR_NO_SANDBOX || process.env.NO_SANDBOX
  const noSandboxArgv = Array.isArray(process.argv) && process.argv.includes('--no-sandbox')

  // Electron on Linux may abort if chrome-sandbox isn't setuid root (4755).
  // In zip distributions, ownership may not be preserved, so auto-fallback.
  let shouldDisableSandbox = false
  if (noSandboxEnv === '1' || noSandboxEnv === 'true' || noSandboxArgv) {
    shouldDisableSandbox = true
  } else if (process.platform === 'linux') {
    try {
      const chromeSandboxPath = path.join(process.resourcesPath, '..', 'chrome-sandbox')
      const st = fs.statSync(chromeSandboxPath)
      const isRoot = st.uid === 0
      const mode = st.mode & 0o7777
      const isSetuid4755 = mode === 0o4755
      if (!isRoot || !isSetuid4755) {
        shouldDisableSandbox = true
      }
    } catch (_) {
      // If we can't stat the helper, prefer safe execution over aborting.
      // (This mirrors Chromium behavior when helper is missing/misconfigured.)
      shouldDisableSandbox = true
    }
  }

  if (shouldDisableSandbox) {
    app.commandLine.appendSwitch('no-sandbox')
    app.commandLine.appendSwitch('disable-setuid-sandbox')
  }
} catch (_) {
  // ignore
}

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win

function createWindow() {
  // Create the browser window.
  win = new BrowserWindow({
    width: 1200,
    height: 675,
    show: false,
    // Match the app's default dark surface to avoid transparent/undefined
    // backgrounds affecting first paint.
    backgroundColor: '#171717',
    webPreferences: {
      nodeIntegration: false,
      // WebMIDI lives behind blink features in some Electron versions.
      enableBlinkFeatures: 'WebMIDI'
    }
  })

  // and load the index.html of the app.
  win.loadFile('index.html')

  // Avoid showing a partially painted UI (e.g. text invisible until first click)
  // by waiting for the renderer to be ready and forcing one repaint.
  win.once('ready-to-show', () => {
    try {
      win.show()
      win.focus()
      if (win.webContents && typeof win.webContents.invalidate === 'function') {
        win.webContents.invalidate()
      }
    } catch (_) {
      // ignore
    }
  })

  // Emitted when the window is closed.
  win.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) {
    createWindow()
  }
})