import {
  app, BrowserWindow, dialog, ipcMain, screen, Tray, nativeImage, shell
} from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { detectTaskbar } from './taskbar'
import { WindowManager } from './windowManager'
import { AppStore } from './store'
import { GlobalHooker, classifyKey } from './hooks'
import { buildTrayMenu, applyAutoStart, OPACITY_LEVELS, THEME_LIST } from './menu'
import { DailyStats, Settings, ThemeId, WeeklyStats } from './types'
import { todayKey, weeklyToCsv } from './statsUtils'

let mainWindow: BrowserWindow | null = null
let winMgr: WindowManager | null = null
let tray: Tray | null = null
let store: AppStore | null = null
let hooker: GlobalHooker | null = null

const isDev = process.env.NODE_ENV === 'development'
const WINDOW_SIZE = { width: 220, height: 240 }

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
  mainWindow = new BrowserWindow({
    width: WINDOW_SIZE.width,
    height: WINDOW_SIZE.height,
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
    if (!store?.getSettings().autoDock) return
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
    if (store?.getSettings().autoDock) winMgr?.dockToTaskbar()
  })
}

function iconBase(): string {
  // Packaged: extraResources copies build/* into resources/build/
  return app.isPackaged
    ? path.join(process.resourcesPath, 'build')
    : path.join(__dirname, '..')
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
  onChangeTheme: (id: ThemeId) => {
    store?.updateSettings({ theme: id })
    pushSettings()
  },
  onShowDaily: () => { mainWindow?.webContents.send('ui:open-panel', 'daily') },
  onShowWeekly: () => { mainWindow?.webContents.send('ui:open-panel', 'weekly') },
  onShowSettings: () => { mainWindow?.webContents.send('ui:open-panel', 'settings') },
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
  ipcMain.handle('themes:list', () => THEME_LIST)
  ipcMain.handle('stats:daily', () => store?.getDaily(todayKey()))
  ipcMain.handle('stats:weekly', () => store?.getWeekly(new Date()))
  ipcMain.handle('stats:weekly-at', (_e, offset = 0) => {
    const ref = new Date()
    ref.setDate(ref.getDate() - 7 * Math.min(520, Math.max(0, offset | 0)))
    return store?.getWeekly(ref)
  })
  ipcMain.handle('stats:recent-weeks', (_e, n = 4): WeeklyStats[] => store?.getLastNWeeks(n) ?? [])
  ipcMain.handle('hooks:status', () => ({ native: hooker?.nativeActive ?? false, events: hooker?.nativeEventCount ?? 0 }))
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
  // Shrink/grow the pet window to wrap the theme art (renderer-measured box,
  // offsets are relative to current window origin so the art stays in place).
  ipcMain.on('win:set-content-box', (_e, box: { x: number; y: number; w: number; h: number }) => {
    if (!mainWindow || !box) return
    const [cx, cy] = mainWindow.getPosition()
    mainWindow.setBounds({
      x: cx + Math.round(box.x),
      y: cy + Math.round(box.y),
      width: Math.max(40, Math.min(WINDOW_SIZE.width, Math.round(box.w))),
      height: Math.max(40, Math.min(WINDOW_SIZE.height, Math.round(box.h)))
    })
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

  // Custom user sprite management
  const CUSTOM_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif']
  ipcMain.handle('custom:choose', async (): Promise<boolean> => {
    if (!store || !mainWindow) return false
    const r = await dialog.showOpenDialog(mainWindow, {
      title: '选择宠物形象图片',
      filters: [{ name: '图片文件', extensions: CUSTOM_EXTS }],
      properties: ['openFile']
    })
    if (r.canceled || !r.filePaths[0]) return false
    let ext = (r.filePaths[0].split('.').pop() || 'png').toLowerCase()
    if (!CUSTOM_EXTS.includes(ext)) return false
    if (ext === 'jpg') ext = 'jpeg'
    for (const e of CUSTOM_EXTS) {
      try { fs.unlinkSync(path.join(app.getPath('userData'), `customPet.${e}`)) } catch { /* ignore */ }
    }
    const dest = path.join(app.getPath('userData'), `customPet.${ext}`)
    try {
      fs.copyFileSync(r.filePaths[0], dest)
    } catch { return false }
    applySettingsPatch({ customPetFile: `customPet.${ext}`, theme: 'custom' })
    return true
  })
  ipcMain.handle('custom:get-data', (): string | null => {
    const f = store?.getSettings().customPetFile
    if (!f) return null
    try {
      const p = path.join(app.getPath('userData'), f)
      const mime = f.toLowerCase().endsWith('.jpeg') ? 'jpeg'
        : f.toLowerCase().endsWith('.bmp') ? 'bmp'
          : f.toLowerCase().endsWith('.webp') ? 'webp'
            : f.toLowerCase().endsWith('.gif') ? 'gif' : 'png'
      const b = fs.readFileSync(p)
      return `data:image/${mime};base64,${b.toString('base64')}`
    } catch { return null }
  })
  ipcMain.handle('custom:clear', () => {
    const f = store?.getSettings().customPetFile
    if (f) {
      try { fs.unlinkSync(path.join(app.getPath('userData'), f)) } catch { /* ignore */ }
    }
    applySettingsPatch({ customPetFile: '', theme: 'piranha' })
    return true
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
  hooker.start()

  // Make degraded mode visible to the user (stderr is invisible in a
  // windowed packaged app, so surface it via tray balloon).
  if (!hooker.nativeActive) {
    try {
      tray?.displayBalloon({
        iconType: 'warning',
        title: 'keepBoard 全局监听未启用',
        content: '已降级为仅统计本窗口内的输入。可能被安全软件拦截，请检查后重启应用。'
      })
    } catch { /* ignore */ }
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
