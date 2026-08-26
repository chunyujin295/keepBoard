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
import { DailyStats, Settings, WeeklyStats } from './types'
import { todayKey, weeklyToCsv } from './statsUtils'
import { logSize, rectsClose, getSizeLog } from './sizeLog'

let mainWindow: BrowserWindow | null = null
let winMgr: WindowManager | null = null
let tray: Tray | null = null
let store: AppStore | null = null
let hooker: GlobalHooker | null = null
/** True while the user is dragging the pet — autoDock must stay suspended
 *  so slow drags don't get yanked back to the taskbar mid-drag. */
let dragging = false

const isDev = process.env.NODE_ENV === 'development'
/** Padding between canvas edge and window border (包围盒边距) */
const BORDER = 8
function winSize(): number {
  return Math.max(140, Math.min(640, Math.round(store?.getSettings().windowSize || 220))) + BORDER * 2
}
// Content-box currently applied to the pet window (canvas buffer coordinates).
// Used to move the window by the DELTA between boxes — without this the origin
// drifts on every resize (the reported "window keeps growing" bug).
let lastBox: { x: number; y: number; w: number; h: number } = { x: BORDER, y: BORDER, w: 220, h: 220 }
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
  const canvasSize = S - BORDER * 2
  lastBox = { x: BORDER, y: BORDER, w: canvasSize, h: canvasSize }
  mainWindow = new BrowserWindow({
    width: winSize(),
    height: winSize(),
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
      sandbox: false
    }
  })

  if (settings.alwaysOnTop) {
    mainWindow.setAlwaysOnTop(true, 'screen-saver')
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  }

  const primaryDisplay = screen.getPrimaryDisplay()
  const taskbar = detectTaskbar(primaryDisplay.bounds, primaryDisplay.workArea)
  winMgr = new WindowManager(mainWindow, taskbar)
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
    // Never fight the user's cursor: docking is suspended while dragging.
    if (dragging || !store?.getSettings().autoDock) return
    if (moveTimer) clearTimeout(moveTimer)
    moveTimer = setTimeout(() => winMgr?.dockToTaskbar(), 150)
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
  return loadIcon('icon.png') ?? loadIcon('icon.ico')
}

function trayIcon(): Electron.NativeImage | undefined {
  // Dedicated full-bleed 16px render stays crisp in the system tray
  return loadIcon('icon-16.png') ?? loadIcon('icon.ico') ?? loadIcon('icon.png')
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
  onShowDaily: () => { mainWindow?.webContents.send('ui:open-panel', 'daily') },
  onShowWeekly: () => { mainWindow?.webContents.send('ui:open-panel', 'weekly') },
  onRedock: () => winMgr?.dockToTaskbar(),
  onQuit: () => app.quit(),
  onToggleAudio: (next: boolean) => {
    applySettingsPatch({ audioEnabled: next })
  },
  onOpacity: (v: number) => {
    applySettingsPatch({ opacity: v })
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
    mainWindow.setBounds({
      x: Math.round(cur.x + (cur.width - winW) / 2),
      y: Math.round(cur.y + (cur.height - winW) / 2),
      width: winW,
      height: winW
    })
    lastBox = { x: BORDER, y: BORDER, w: canvasSize, h: canvasSize }
    if (store?.getSettings().autoDock) setTimeout(() => winMgr?.dockToTaskbar(), 80)
  }
  if (patch.autoDock) winMgr?.dockToTaskbar()
  pushSettings()
  return s
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
      tray?.popUpContextMenu(buildTrayMenu(store.getSettings(), menuHandlers))
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
    mainWindow.setPosition(Math.round(x), Math.round(y))
  })
  // Drag lifecycle: suspend autoDock while dragging, snap once on release.
  ipcMain.on('win:drag-start', () => { dragging = true })
  ipcMain.on('win:drag-end', () => {
    dragging = false
    if (store?.getSettings().autoDock) setTimeout(() => winMgr?.dockToTaskbar(), 60)
  })
  // Shrink/grow the pet window to wrap the theme art.
  // The canvas is CSS-shifted by -offset, so buffer point P sits at screen
  // (winOrigin + P - lastBox). Keeping the art visually anchored therefore
  // requires moving the origin by the DELTA between boxes:
  //   newOrigin = curOrigin + (box.xy - lastBox.xy)
  // Missing this subtraction caused cumulative drift ("self-growing window").
  ipcMain.on('win:set-content-box', (_e, box: { x: number; y: number; w: number; h: number }) => {
    if (!mainWindow || !box) return
    const cur = mainWindow.getBounds()
    const next = {
      x: cur.x + Math.round(box.x - lastBox.x),
      y: cur.y + Math.round(box.y - lastBox.y),
      width: Math.max(40, Math.min(480, Math.round(box.w))),
      height: Math.max(40, Math.min(480, Math.round(box.h)))
    }
    // Dedupe gate: never touch the OS window when nothing actually changes.
    if (rectsClose(next, cur)) return
    mainWindow.setBounds(next)
    logSize('content-box', next)
    lastBox = { ...box }
    // Re-snap to the taskbar with the NEW size (avoids races with the
    // debounced 'move' handler running against stale dimensions).
    if (store?.getSettings().autoDock) {
      setTimeout(() => winMgr?.dockToTaskbar(), 80)
    }
  })
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

  // Right-click context menu on the pet window
  ipcMain.on('win:context-menu', () => {
    if (!mainWindow || !store) return
    const s = store.getSettings()
    const curOpacity = s.opacity ?? 1
    const curSize = s.windowSize || 220
    const curShape = s.shape || 'donut'

    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: '📊 今日统计',
        click: () => mainWindow?.webContents.send('ui:open-panel', 'daily')
      },
      {
        label: '📈 本周统计',
        click: () => mainWindow?.webContents.send('ui:open-panel', 'weekly')
      },
      { type: 'separator' },
      {
        label: '🧊 形状',
        submenu: [
          { label: '🍩 甜甜圈', type: 'radio', checked: curShape === 'donut', click: () => applySettingsPatch({ shape: 'donut' }) },
          { label: '🔵 球体', type: 'radio', checked: curShape === 'sphere', click: () => applySettingsPatch({ shape: 'sphere' }) }
        ]
      },
      {
        label: '📐 尺寸',
        submenu: [180, 240, 320, 400, 480, 640].map((v) => ({
          label: `${v}px`,
          type: 'radio' as const,
          checked: curSize === v,
          click: () => applySettingsPatch({ windowSize: v })
        }))
      },
      {
        label: '🌗 不透明度',
        submenu: OPACITY_LEVELS.map((v) => ({
          label: `${Math.round(v * 100)}%`,
          type: 'radio' as const,
          checked: Math.abs(curOpacity - v) < 0.01,
          click: () => applySettingsPatch({ opacity: v })
        }))
      },
      { type: 'separator' },
      {
        label: s.alwaysOnTop ? '🔝 取消置顶' : '🔝 置顶窗口',
        click: () => applySettingsPatch({ alwaysOnTop: !s.alwaysOnTop })
      },
      {
        label: s.autoDock ? '🧲 取消吸附' : '🧲 自动吸附任务栏',
        click: () => applySettingsPatch({ autoDock: !s.autoDock })
      },
      { type: 'separator' },
      {
        label: '❌ 退出',
        click: () => app.quit()
      }
    ]

    const menu = Menu.buildFromTemplate(template)
    menu.popup({ window: mainWindow })
  })

  ipcMain.handle('app:open-path', (_e, p: string) => {
    if (!store) return
    if (p === 'userData') shell.openPath(app.getPath('userData'))
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
