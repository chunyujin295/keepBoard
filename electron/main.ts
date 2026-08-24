import {
  app, BrowserWindow, dialog, ipcMain, screen, Tray, nativeImage, shell
} from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { detectTaskbar } from './taskbar'
import { WindowManager } from './windowManager'
import { AppStore } from './store'
import { GlobalHooker, classifyKey } from './hooks'
import { buildTrayMenu, applyAutoStart, THEME_LIST } from './menu'
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

function onInputEvent(ev: { type: string; subtype?: string; ts: number }) {
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
  winMgr = new WindowManager(mainWindow, WINDOW_SIZE, taskbar)
  if (settings.autoDock) winMgr.dockToTaskbar()

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => { mainWindow?.show() })

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
    store?.updateSettings({ audioEnabled: next })
    pushSettings()
  }
}

function pushSettings() {
  if (!mainWindow || !store) return
  mainWindow.webContents.send('settings:update', store.getSettings())
}

function createTray() {
  if (tray) return
  try {
    const icon = trayIcon() ?? nativeImage.createEmpty()
    tray = new Tray(icon)
    tray.setToolTip('keepBoard · 你的像素桌面宠物')
    if (store) tray.setContextMenu(buildTrayMenu(store.getSettings(), menuHandlers))
    tray.on('click', () => {
      if (!mainWindow) createWindow()
      else if (mainWindow.isMinimized()) mainWindow.restore()
      else mainWindow.show()
    })
    tray.on('right-click', () => {
      if (!store) return
      tray?.setContextMenu(buildTrayMenu(store.getSettings(), menuHandlers))
      tray?.popUpContextMenu()
    })
  } catch { /* ignore */ }
}

function registerIpc() {
  ipcMain.handle('settings:get', () => store?.getSettings())
  ipcMain.handle('settings:set', (_e, patch: Partial<Settings>) => {
    const s = store?.updateSettings(patch)
    if (patch.autoStart !== undefined && store) applyAutoStart(patch.autoStart)
    if (patch.alwaysOnTop !== undefined) {
      mainWindow?.setAlwaysOnTop(!!patch.alwaysOnTop, patch.alwaysOnTop ? 'screen-saver' : 'normal')
    }
    if (patch.autoDock) winMgr?.dockToTaskbar()
    pushSettings()
    return s
  })
  ipcMain.handle('themes:list', () => THEME_LIST)
  ipcMain.handle('stats:daily', () => store?.getDaily(todayKey()))
  ipcMain.handle('stats:weekly', () => store?.getWeekly(new Date()))
  ipcMain.handle('stats:weekly-at', (_e, offset = 0) => {
    const ref = new Date()
    ref.setDate(ref.getDate() - 7 * Math.min(520, Math.max(0, offset | 0)))
    return store?.getWeekly(ref)
  })
  ipcMain.handle('stats:recent-weeks', (_e, n = 4): WeeklyStats[] => store?.getLastNWeeks(n) ?? [])
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
  ipcMain.handle('app:open-path', (_e, p: string) => {
    if (!store) return
    if (p === 'userData') shell.openPath(app.getPath('userData'))
  })
  ipcMain.on('app:quit', () => app.quit())
}

app.whenReady().then(() => {
  store = new AppStore()
  store.pruneOld(180)
  const s = store.getSettings()
  applyAutoStart(s.autoStart)

  hooker = new GlobalHooker()
  hooker.on('event', onInputEvent)
  hooker.start()

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

  registerIpc()
  createWindow()
  createTray()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  hooker?.stop()
})
