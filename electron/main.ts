import {
  app, BrowserWindow, dialog, ipcMain, screen, Tray, nativeImage, shell, Menu
} from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { detectTaskbar } from './taskbar'
import { WindowManager } from './windowManager'
import { AppStore } from './store'
import { GlobalHooker, classifyKey } from './hooks'
import { buildTrayMenu, applyAutoStart, OPACITY_LEVELS } from './menu'
import { CustomLook, DailyStats, Settings, WeeklyStats } from './types'
import { todayKey, weeklyToCsv } from './statsUtils'
import { logSize, getSizeLog } from './sizeLog'

let mainWindow: BrowserWindow | null = null
let statsWindow: BrowserWindow | null = null
let winMgr: WindowManager | null = null
let tray: Tray | null = null
let store: AppStore | null = null
let hooker: GlobalHooker | null = null
/** True while the user is dragging the pet — autoDock must stay suspended
 *  so slow drags don't get yanked back to the taskbar mid-drag. */
let dragging = false
/** Timestamp when drag ended — suppresses move-handler re-dock for 300ms. */
let dragEndTs = 0

const isDev = process.env.NODE_ENV === 'development'
/** Padding between canvas edge and window border (包围盒边距) */
const BORDER = 0
function winSize(): number {
  const raw = store?.getSettings().windowSize || 220
  const clamped = Math.max(140, Math.min(640, Math.round(raw)))
  return clamped + BORDER * 2
}
// Wayland forbids global input hooks and programmatic window positioning —
// degrade gracefully instead of attempting native capture.
const isWayland = !!process.env.WAYLAND_DISPLAY || process.env.XDG_SESSION_TYPE === 'wayland'

// Screen time tracking: sliding session with 30s idle threshold.
let sessionStartTs = Date.now()
let sessionAccumulatedMs = 0
let lastActivityTs = Date.now()
let apmWindowStart = Date.now()
let apmWindowCount = 0

const IDLE_MS = 30_000

function rollIdleSession() {
  const now = Date.now()
  if (now - lastActivityTs < IDLE_MS) {
    sessionAccumulatedMs += (now - lastActivityTs)
  } else {
    sessionStartTs = now
    sessionAccumulatedMs = 0
  }
  lastActivityTs = now
}

function computeApmInc(keys: number): number {
  const now = Date.now()
  apmWindowCount += keys
  if (now - apmWindowStart >= 60_000) {
    const peak = Math.round(apmWindowCount * 60_000 / Math.max(1, now - apmWindowStart))
    apmWindowStart = now
    apmWindowCount = 0
    return peak
  }
  return 0
}

function onInputEvent(ev: { type: string; subtype?: string; ts: number; x?: number; y?: number }) {
  if (!store || !mainWindow) return
  rollIdleSession()
  const date = todayKey()
  store.mutateDaily(date, (d: DailyStats) => {
    switch (ev.type) {
      case 'keypress': {
        d.keyboardTotal += 1
        const cat = ev.subtype ? classifyKey(ev.subtype) : 'other'
        d.keyboardByType[cat] += 1
        const peak = computeApmInc(1)
        if (peak > d.peakApm) d.peakApm = peak
        break
      }
      case 'mousedown-left': d.mouseLeft += 1; break
      case 'mousedown-right': d.mouseRight += 1; break
      case 'mousedown-middle': d.mouseMiddle += 1; break
      case 'wheel': d.wheelScrolls += 1; break
    }
    d.screenTimeMs = sessionAccumulatedMs
    d.longestSessionMs = Math.max(d.longestSessionMs, Date.now() - sessionStartTs)
  })
  // Broadcast to renderer for animations
  mainWindow.webContents.send('stats:event', { type: ev.type, subtype: ev.subtype })
  // Also send fresh daily summary 2fps throttled
  maybePushStats()
}

let lastPush = 0
function maybePushStats() {
  if (!mainWindow || !store) return
  const now = Date.now()
  if (now - lastPush < 500) return
  lastPush = now
  mainWindow.webContents.send('stats:daily', store.getDaily(todayKey()))
}

function createWindow() {
  const settings = store!.getSettings()
  const S = winSize()
  mainWindow = new BrowserWindow({
    width: S,
    height: S,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    skipTaskbar: true,
    alwaysOnTop: settings.alwaysOnTop,
    hasShadow: false,
    focusable: true,
    show: false,
    backgroundColor: '#00000000',
    icon: windowIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // Ghost sounds are triggered by the GLOBAL input hook, which arrives via
      // IPC rather than a user gesture inside the page — so autoplay must be
      // allowed or the AudioContext would stay suspended.
      autoplayPolicy: 'no-user-gesture-required'
    }
  })
  mainWindow.setMinimumSize(S, S)
  mainWindow.setMaximumSize(S, S)

  if (settings.alwaysOnTop) {
    mainWindow.setAlwaysOnTop(true, 'screen-saver')
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  }

  const primaryDisplay = screen.getPrimaryDisplay()
  const taskbar = detectTaskbar(primaryDisplay.bounds, primaryDisplay.workArea)
  winMgr = new WindowManager(mainWindow, taskbar, winSize)
  if (settings.autoDock) winMgr.dockToTaskbar()

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.setOpacity(store?.getSettings().opacity ?? 1)
    mainWindow?.show()
  })

  let moveTimer: NodeJS.Timeout | null = null
  mainWindow.on('move', () => {
    if (dragging || !store?.getSettings().autoDock) return
    if (Date.now() - dragEndTs < 300) return
    if (moveTimer) clearTimeout(moveTimer)
    moveTimer = setTimeout(() => {
      // Re-check: a drag can start inside the 150ms window, and a timer armed
      // before it would otherwise yank the window to the taskbar mid-drag.
      if (dragging || Date.now() - dragEndTs < 300) return
      if (!store?.getSettings().autoDock) return
      winMgr?.dockToTaskbar()
    }, 150)
  })

  mainWindow.on('closed', () => {
    mainWindow = null
    winMgr = null
    if (moveTimer) clearTimeout(moveTimer)
  })

  screen.on('display-metrics-changed', () => {
    const pd = screen.getPrimaryDisplay()
    const tb = detectTaskbar(pd.bounds, pd.workArea)
    winMgr?.updateTaskbar(tb)
    if (!dragging && store?.getSettings().autoDock) winMgr?.dockToTaskbar()
  })
}

/** The stats panels are a SEPARATE window: they are wider than the pet window
 *  (daily 260px, weekly 320px vs a 140–640px square), and the pet window is
 *  pinned to its size with min==max — putting the panel inside it clipped it to
 *  the pet's width and covered the donut. A dedicated window sidesteps both. */
function loadStats(win: BrowserWindow, panel: 'daily' | 'weekly') {
  if (isDev) {
    win.loadURL(`http://localhost:5173/?panel=${panel}#stats`).catch(() => { })
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'), { query: { panel }, hash: 'stats' })
  }
}

function openStatsWindow(panel: 'daily' | 'weekly') {
  if (statsWindow && !statsWindow.isDestroyed()) {
    loadStats(statsWindow, panel)
    statsWindow.show()
    statsWindow.focus()
    return
  }
  const W = panel === 'weekly' ? 340 : 280
  statsWindow = new BrowserWindow({
    width: W,
    height: 520,
    frame: true,
    resizable: true,
    maximizable: false,
    minimizable: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#1A1C2C',
    icon: windowIcon(),
    title: panel === 'weekly' ? 'keepBoard · 本周统计' : 'keepBoard · 今日统计',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
  statsWindow.setMenuBarVisibility(false)
  loadStats(statsWindow, panel)
  statsWindow.once('ready-to-show', () => statsWindow?.show())
  statsWindow.on('closed', () => { statsWindow = null })
}

function closeStatsWindow() {
  if (statsWindow && !statsWindow.isDestroyed()) statsWindow.close()
}

function iconBase(): string {
  // Dev: committed resource at assets/icons. Packaged: extraResources copies
  // assets/icons/* into resources/build/ (see package.json extraResources).
  return app.isPackaged
    ? path.join(process.resourcesPath, 'build')
    : path.join(__dirname, '..', 'assets', 'icons')
}

function loadIcon(file: string): Electron.NativeImage | undefined {
  try {
    const img = nativeImage.createFromPath(path.join(iconBase(), file))
    return img.isEmpty() ? undefined : img
  } catch { return undefined }
}

function windowIcon(): Electron.NativeImage | undefined {
  // Windows must receive the multi-representation ICO so the taskbar can pick
  // an exact bitmap for the current DPI. Passing the 512px PNG forces the
  // shell to downscale it and makes the pixel-art icon visibly soft.
  return process.platform === 'win32'
    ? loadIcon('icon.ico') ?? loadIcon('icon.png')
    : loadIcon('icon.png') ?? loadIcon('icon.ico')
}

function trayIcon(): Electron.NativeImage | undefined {
  // ICO lets Windows select 16/20/24/32px according to tray DPI. Other
  // platforms keep the dedicated 16px PNG as their first choice.
  return process.platform === 'win32'
    ? loadIcon('icon.ico') ?? loadIcon('icon-16.png') ?? loadIcon('icon.png')
    : loadIcon('icon-16.png') ?? loadIcon('icon.png') ?? loadIcon('icon.ico')
}

const menuHandlers = {
  onToggleAutoStart: (next: boolean) => {
    store?.updateSettings({ autoStart: next })
    applyAutoStart(next)
    pushSettings()
  },
  onToggleAutoDock: (next: boolean) => {
    store?.updateSettings({ autoDock: next })
    if (next) winMgr?.dockToTaskbar()
    pushSettings()
  },
  onToggleOnTop: (next: boolean) => {
    store?.updateSettings({ alwaysOnTop: next })
    mainWindow?.setAlwaysOnTop(next, next ? 'screen-saver' : 'normal')
    pushSettings()
  },
  onShowDaily: () => openStatsWindow('daily'),
  onShowWeekly: () => openStatsWindow('weekly'),
  onRedock: () => winMgr?.dockToTaskbar(),
  onQuit: () => app.quit(),
  onAudioTheme: (audioTheme: Settings['audioTheme']) => {
    applySettingsPatch({ audioTheme, audioEnabled: audioTheme !== 'none' })
  },
  onVolume: (v: number) => {
    applySettingsPatch({ volume: v })
  },
  onOpacity: (v: number) => {
    applySettingsPatch({ opacity: v })
  },
    onShape: (shape: Settings['shape']) => {
    applySettingsPatch({ shape })
  },
  onSize: (size: number) => {
    applySettingsPatch({ windowSize: size })
  },
  onTheme: (theme: 'dark' | 'light') => {
    applySettingsPatch({ theme })
  },
  onLook: (look: string) => {
    applySettingsPatch({ look })
  },
  onCharset: (charset: 'ascii' | 'block' | 'dot' | 'line') => {
    applySettingsPatch({ charset })
  },
  onGlow: (next: boolean) => {
    applySettingsPatch({ glow: next })
  },
  onToggleRandomSpin: (next: boolean) => {
    applySettingsPatch({ randomSpin: next })
  },
  onDriveMode: (driveMode: Settings['driveMode']) => {
    applySettingsPatch({ driveMode })
  },
  onMotionPreset: (motionPreset: Settings['motionPreset']) => {
    applySettingsPatch({ motionPreset, motionEffects: motionPreset !== 'off' })
  },
  onDensity: (density: Settings['density']) => {
    applySettingsPatch({ density })
  },
  onToggleJitter: (jitter: boolean) => {
    applySettingsPatch({ jitter })
  },
  onOpenLookConfig: () => {
    loadCustomLooks() // ensures the file exists
    shell.openPath(lookConfigPath()).catch(() => { })
  }
}

function pushSettings() {
  if (!mainWindow || !store) return
  mainWindow.webContents.send('settings:update', store.getSettings())
}

// Apply a settings patch with all side effects (shared by IPC + tray menu)
function applySettingsPatch(patch: Partial<Settings>): Settings | undefined {
  if (!store) return undefined
  const s = store.updateSettings(patch)
  if (patch.autoStart !== undefined) applyAutoStart(patch.autoStart)
  if (patch.alwaysOnTop !== undefined) {
    mainWindow?.setAlwaysOnTop(!!patch.alwaysOnTop, patch.alwaysOnTop ? 'screen-saver' : 'normal')
  }
  if (patch.opacity !== undefined && mainWindow) {
    mainWindow.setOpacity(patch.opacity)
  }
  if (patch.windowSize !== undefined && mainWindow) {
    const canvasSize = Math.max(140, Math.min(640, Math.round(patch.windowSize)))
    const winW = canvasSize + BORDER * 2
    const cur = mainWindow.getBounds()
    // The window is pinned by min == max, so relax the constraints before
    // setBounds or the new size is clamped back to the old one — previously
    // only min/max moved and the window never actually resized.
    // Deliberately NOT touching `resizable`: flipping it rewrites the Win32
    // window style, which can shift the window on its own.
    mainWindow.setMinimumSize(1, 1)
    mainWindow.setMaximumSize(10000, 10000)
    mainWindow.setBounds({
      x: Math.round(cur.x + (cur.width - winW) / 2),
      y: Math.round(cur.y + (cur.height - winW) / 2),
      width: winW,
      height: winW
    })
    mainWindow.setMinimumSize(winW, winW)
    mainWindow.setMaximumSize(winW, winW)
    logSize('resize', mainWindow.getBounds())
    if (store?.getSettings().autoDock) setTimeout(() => winMgr?.dockToTaskbar(), 80)
  }
  if (patch.autoDock) winMgr?.dockToTaskbar()
  pushSettings()
  return s
}

function lookConfigPath(): string {
  return path.join(app.getPath('userData'), 'keepboard-look.json')
}

function writeDefaultLookConfig(file: string) {
  const def = {
    looks: [
      {
        id: 'custom-neon',
        name: '我的霓虹',
        icon: '🎇',
        tone: 'bright',
        saturation: 'neon',
        palette: 'cyber'
      }
    ]
  }
  try { fs.writeFileSync(file, JSON.stringify(def, null, 2), 'utf8') } catch { /* ignore */ }
}

function sanitizeCustomLook(e: unknown): CustomLook | null {
  if (!e || typeof e !== 'object') return null
  const o = e as Record<string, unknown>
  if (typeof o.id !== 'string' || !o.id) return null
  const pick = <T extends string>(k: string, set: readonly T[]): T | undefined => {
    const v = o[k]
    return typeof v === 'string' && set.includes(v as T) ? (v as T) : undefined
  }
  return {
    id: o.id,
    name: typeof o.name === 'string' ? o.name : o.id,
    icon: typeof o.icon === 'string' ? o.icon : '🎨',
    chars: typeof o.chars === 'string' ? o.chars : undefined,
    tone: pick('tone', ['night', 'dark', 'mid', 'bright', 'high'] as const),
    saturation: pick('saturation', ['gray', 'muted', 'normal', 'vivid', 'neon'] as const),
    palette: typeof o.palette === 'string' ? o.palette : undefined,
    colors: Array.isArray(o.colors) ? (o.colors as unknown[]).filter((c) => typeof c === 'string') as string[] : undefined,
    gamma: typeof o.gamma === 'number' ? o.gamma : undefined
  }
}

function loadCustomLooks(): CustomLook[] {
  const file = lookConfigPath()
  try {
    if (!fs.existsSync(file)) writeDefaultLookConfig(file)
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
    const list = Array.isArray(raw) ? raw : Array.isArray((raw as any)?.looks) ? (raw as any).looks : []
    return (list as unknown[]).map(sanitizeCustomLook).filter((x): x is CustomLook => !!x)
  } catch {
    return []
  }
}

function createTray() {
  if (tray) return
  try {
    const icon = trayIcon() ?? nativeImage.createEmpty()
    tray = new Tray(icon)
    tray.setToolTip('keepBoard · 你的像素桌面宠物')
    tray.on('click', () => {
      if (!mainWindow) createWindow()
      else if (mainWindow.isMinimized()) mainWindow.restore()
      else mainWindow.show()
    })
    // Rebuild the menu from CURRENT settings on every right-click and pass it
    // directly to popUpContextMenu — never caches stale state.
    tray.on('right-click', () => {
      if (!store) return
      tray?.popUpContextMenu(buildTrayMenu(store.getSettings(), menuHandlers, loadCustomLooks()))
    })
  } catch { /* ignore */ }
}

function registerIpc() {
  ipcMain.handle('settings:get', () => store?.getSettings())
  ipcMain.handle('settings:set', (_e, patch: Partial<Settings>) => applySettingsPatch(patch))
  ipcMain.handle('bounds:get', (_e, key: string) => store?.getBound(String(key ?? '')) ?? null)
  ipcMain.handle('bounds:set', (_e, key: string, box: { x: number; y: number; w: number; h: number }) => {
    if (!store || typeof key !== 'string' || !key || !box) return false
    store.setBound(key, box)
    return true
  })
  ipcMain.handle('stats:daily', () => store?.getDaily(todayKey()))
  ipcMain.handle('stats:weekly', () => store?.getWeekly(new Date()))
  ipcMain.handle('stats:weekly-at', (_e, offset = 0) => {
    const ref = new Date()
    ref.setDate(ref.getDate() - 7 * Math.min(520, Math.max(0, offset | 0)))
    return store?.getWeekly(ref)
  })
  ipcMain.handle('stats:recent-weeks', (_e, n = 4): WeeklyStats[] => store?.getLastNWeeks(n) ?? [])
  ipcMain.on('stats:close', () => closeStatsWindow())
  ipcMain.handle('hooks:status', () => ({ native: hooker?.nativeActive ?? false, events: hooker?.nativeEventCount ?? 0 }))
  ipcMain.handle('debug:size-log', () => getSizeLog())
  ipcMain.handle('app:version', () => app.getVersion())
  ipcMain.handle('stats:export-week-csv', async (_e, offset = 0): Promise<string | null> => {
    if (!store || !mainWindow) return null
    const ref = new Date()
    ref.setDate(ref.getDate() - 7 * Math.min(520, Math.max(0, offset | 0)))
    const w = store.getWeekly(ref)
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: '导出每周统计',
      defaultPath: `keepBoard-周报_${w.fromDate}_${w.toDate}.csv`,
      filters: [{ name: 'CSV 文件', extensions: ['csv'] }]
    })
    if (canceled || !filePath) return null
    try {
      fs.writeFileSync(filePath, '\uFEFF' + weeklyToCsv(w), 'utf8')
      return filePath
    } catch { return null }
  })
  ipcMain.handle('win:re-dock', () => winMgr?.dockToTaskbar())
  ipcMain.handle('win:get-pos', () => mainWindow?.getBounds() ?? null)
  ipcMain.on('win:drag-to', (_e, x: number, y: number) => {
    if (!mainWindow || typeof x !== 'number' || typeof y !== 'number') return
    // Always write the size from SETTINGS, never from getSize().
    //
    // On fractional display scaling (125%/150%/175%) Chromium converts DIP<->
    // physical with an *enclosing* rect: floor the origin, ceil the far edge.
    // The physical width therefore depends on the fractional part of x, so a
    // 220 DIP window reads back as 222 at some x values. The old handler did
    // `const [w,h] = getSize()` and wrote that back — feeding a measurement
    // into the thing being measured, ~60x/s, which ratcheted the window bigger
    // for the whole drag. Writing a constant cannot accumulate.
    //
    // setPosition() is NOT a way out: on Windows Electron implements it as
    // getBounds() + SetBounds(), so the size round-trips there too.
    const S = winSize()
    mainWindow.setBounds({ x: Math.round(x), y: Math.round(y), width: S, height: S })
  })

  // Drag lifecycle: suspend autoDock while dragging, snap once on release.
  ipcMain.on('win:drag-start', () => { dragging = true })
  ipcMain.on('win:drag-end', () => {
    dragging = false
    dragEndTs = Date.now()
    // Settle point: assert the canonical size once so any drift introduced by
    // something other than the drag path is corrected, and journal the result
    // so an unexpected size is attributable instead of mysterious.
    if (mainWindow) {
      const S = winSize()
      const b = mainWindow.getBounds()
      if (b.width !== S || b.height !== S) {
        mainWindow.setBounds({ x: b.x, y: b.y, width: S, height: S })
        logSize('drag-end-correct', { x: b.x, y: b.y, width: S, height: S })
      }
    }
    if (store?.getSettings().autoDock) setTimeout(() => winMgr?.dockToTaskbar(), 60)
  })
  // Window size is set at creation and by applySettingsPatch — no need for
  // a content-box handler since the canvas always sits at (BORDER, BORDER).
  ipcMain.on('win:set-ignore-mouse-events', (_e, ignore: boolean, options?: { forward?: boolean }) => {
    mainWindow?.setIgnoreMouseEvents(!!ignore, options ?? undefined)
  })

  // Cycle window opacity: 100% -> 75% -> 50% -> 25% -> 100%
  ipcMain.handle('win:cycle-opacity', () => {
    if (!store) return undefined
    const cur = store.getSettings().opacity ?? 1
    const idx = OPACITY_LEVELS.findIndex((v) => Math.abs(v - cur) < 0.01)
    const next = OPACITY_LEVELS[(idx + 1 + OPACITY_LEVELS.length) % OPACITY_LEVELS.length]
    applySettingsPatch({ opacity: next })
    return next
  })

  ipcMain.handle('app:open-path', (_e, p: string) => {
    if (!store) return
    if (p === 'userData') shell.openPath(app.getPath('userData'))
  })

  // Resolved dark/light from the persisted theme (manual dark/light only).
  ipcMain.handle('app:dark', () => {
    return (store?.getSettings().theme ?? 'dark') === 'dark'
  })

  // User-defined looks from userData/keepboard-look.json (a list, each with id /
  // name / icon plus the LookDef fields).
  ipcMain.handle('look:custom', () => loadCustomLooks())

  // Open the config file in the system editor, creating a default one first.
  ipcMain.handle('look:open-config', () => {
    loadCustomLooks() // ensures the file exists
    return shell.openPath(lookConfigPath()).then(() => true).catch(() => false)
  })

  ipcMain.on('app:quit', () => app.quit())
}

// Single instance: two copies would BOTH install global hooks AND overwrite
// each other's stats file (each holds its own in-memory snapshot), silently
// wiping recorded counts every few seconds.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) createWindow()
    else mainWindow.show()
  })
  void startApp()
}

async function startApp() {
  await app.whenReady()

  store = new AppStore()
  store.pruneOld(180)
  const s = store.getSettings()
  applyAutoStart(s.autoStart)

  registerIpc()
  createWindow()
  createTray()

  hooker = new GlobalHooker()
  hooker.on('event', onInputEvent)
  hooker.start(isWayland)

  // Make degraded mode visible to the user (stderr is invisible in a
  // windowed packaged app, so surface it via tray balloon).
  if (!hooker.nativeActive) {
    if (process.platform === 'win32') {
      try {
        tray?.displayBalloon({
          iconType: 'warning',
          title: 'keepBoard 全局监听未启用',
          content: isWayland
            ? '检测到 Wayland 会话：全局键鼠捕获不可用，已降级为仅统计本窗口内的输入。可切换到 X11 会话获得完整功能。'
            : '已降级为仅统计本窗口内的输入。可能被安全软件拦截，请检查后重启应用。'
        })
      } catch { /* ignore */ }
    } else {
      console.warn(`[keepBoard] Global input capture inactive (${isWayland ? 'Wayland' : 'native module unavailable'}).`)
    }
  }

  // Periodic screen-time flusher (for when user idle-sessions end quietly)
  setInterval(() => {
    if (!store) return
    const d = todayKey()
    const now = Date.now()
    if (now - lastActivityTs < IDLE_MS) {
      sessionAccumulatedMs += (now - lastActivityTs)
      lastActivityTs = now
    } else {
      sessionStartTs = now
    }
    store.mutateDaily(d, (x) => { x.screenTimeMs = sessionAccumulatedMs })
    maybePushStats()
  }, 5_000).unref?.()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  hooker?.stop()
  try { store?.flush() } catch { /* ignore */ }
})
