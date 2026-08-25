import { contextBridge, ipcRenderer } from 'electron'
import type { Settings, ThemeId, DailyStats, WeeklyStats } from './types'

export type ThemeList = { id: ThemeId; label: string }[]

const api = {
  getTaskbar: () => ipcRenderer.invoke('win:get-taskbar'),
  reDock: () => ipcRenderer.invoke('win:re-dock'),
  getWindowPos: (): Promise<{ x: number; y: number; width: number; height: number } | null> =>
    ipcRenderer.invoke('win:get-pos'),
  dragWindowTo: (x: number, y: number): void => ipcRenderer.send('win:drag-to', x, y),
  setContentBox: (box: { x: number; y: number; w: number; h: number }): void =>
    ipcRenderer.send('win:set-content-box', box),
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) =>
    ipcRenderer.send('win:set-ignore-mouse-events', ignore, options),
  quitApp: () => ipcRenderer.send('app:quit'),

  openContextMenu: (pt: { x: number; y: number }): Promise<void> =>
    ipcRenderer.invoke('win:open-context-menu', pt),
  onMenuData: (cb: (d: unknown) => void) => {
    const h = (_e: unknown, d: unknown) => cb(d)
    ipcRenderer.on('menu:data', h)
    return () => ipcRenderer.off('menu:data', h)
  },
  reportMenuReady: (): void => ipcRenderer.send('menu:ready'),
  reportMenuHeight: (h: number): void => ipcRenderer.send('menu:height', h),
  sendMenuAction: (a: { type: string; payload?: unknown }): void => ipcRenderer.send('menu:action', a),

  getSettings: (): Promise<Settings> => ipcRenderer.invoke('settings:get'),
  setSettings: (patch: Partial<Settings>): Promise<Settings> => ipcRenderer.invoke('settings:set', patch),
  onSettings: (cb: (s: Settings) => void) => {
    const h = (_e: any, s: Settings) => cb(s)
    ipcRenderer.on('settings:update', h)
    return () => ipcRenderer.off('settings:update', h)
  },

  listThemes: (): Promise<ThemeList> => ipcRenderer.invoke('themes:list'),
  getHookStatus: (): Promise<{ native: boolean; events: number }> => ipcRenderer.invoke('hooks:status'),
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),

  getDaily: (): Promise<DailyStats> => ipcRenderer.invoke('stats:daily'),
  getWeekly: (): Promise<WeeklyStats> => ipcRenderer.invoke('stats:weekly'),
  getWeeklyAt: (offset = 0): Promise<WeeklyStats> => ipcRenderer.invoke('stats:weekly-at', offset),
  exportWeekCsv: (offset = 0): Promise<string | null> => ipcRenderer.invoke('stats:export-week-csv', offset),
  getRecentWeeks: (n = 4): Promise<WeeklyStats[]> => ipcRenderer.invoke('stats:recent-weeks', n),
  onDaily: (cb: (d: DailyStats) => void) => {
    const h = (_e: any, d: DailyStats) => cb(d)
    ipcRenderer.on('stats:daily', h)
    return () => ipcRenderer.off('stats:daily', h)
  },
  onInputEvent: (cb: (e: { type: string; subtype?: string }) => void) => {
    const h = (_e: any, d: any) => cb(d)
    ipcRenderer.on('stats:event', h)
    return () => ipcRenderer.off('stats:event', h)
  },
  onOpenPanel: (cb: (id: 'daily' | 'weekly' | 'settings') => void) => {
    const h = (_e: any, id: any) => cb(id)
    ipcRenderer.on('ui:open-panel', h)
    return () => ipcRenderer.off('ui:open-panel', h)
  },

  reportWebKey: (code: string) => ipcRenderer.send('stats:key-via-web', code),
  reportWebClick: (btn: number) => ipcRenderer.send('stats:click-via-web', btn),

  openUserData: () => ipcRenderer.invoke('app:open-path', 'userData')
}

contextBridge.exposeInMainWorld('keepboard', api)

export type KeepboardAPI = typeof api
