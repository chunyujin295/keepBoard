import { app, Menu } from 'electron'
import path from 'node:path'
import { Settings, ThemeId } from './types'

export interface MenuHandlers {
  onToggleAutoStart: (next: boolean) => void
  onToggleAutoDock: (next: boolean) => void
  onToggleOnTop: (next: boolean) => void
  onChangeTheme: (id: ThemeId) => void
  onShowDaily: () => void
  onShowWeekly: () => void
  onShowSettings: () => void
  onRedock: () => void
  onQuit: () => void
  onToggleAudio: (next: boolean) => void
  onOpacity: (v: number) => void
}

const THEMES: { id: ThemeId; label: string }[] = [
  { id: 'piranha', label: '🌱 食人花' },
  { id: 'cactus', label: '🌵 仙人掌' },
  { id: 'slime', label: '🟢 史莱姆' },
  { id: 'cat', label: '🐱 像素猫' },
  { id: 'mushroom', label: '🍄 马里奥蘑菇' },
  { id: 'ghost', label: '👻 幽灵' },
  { id: 'dino', label: '🦖 小恐龙' },
  { id: 'robot', label: '🤖 机器人' },
  { id: 'pumpkin', label: '🎃 南瓜灯' },
  { id: 'penguin', label: '🐧 企鹅' },
  { id: 'alien', label: '👾 外星人' },
  { id: 'fox', label: '🦊 狐狸' },
  { id: 'custom', label: '🐾 自定义形象' }
]

export const OPACITY_LEVELS = [1, 0.75, 0.5, 0.25]

export function buildTrayMenu(settings: Settings, h: MenuHandlers): Menu {
  const curOpacity = settings.opacity ?? 1
  return Menu.buildFromTemplate([
    { label: '📊 今日统计', click: () => h.onShowDaily() },
    { label: '📈 本周统计', click: () => h.onShowWeekly() },
    { type: 'separator' },
    {
      label: '🎨 主题',
      submenu: THEMES.map((t) => ({
        label: t.label,
        type: 'radio' as const,
        checked: settings.theme === t.id,
        click: () => h.onChangeTheme(t.id)
      }))
    },
    {
      label: '🌗 不透明度',
      submenu: OPACITY_LEVELS.map((v) => ({
        label: `${Math.round(v * 100)}%`,
        type: 'radio' as const,
        checked: Math.abs(curOpacity - v) < 0.01,
        click: () => h.onOpacity(v)
      }))
    },
    { type: 'separator' },
    {
      label: '🧲 自动吸附任务栏',
      type: 'checkbox',
      checked: settings.autoDock,
      click: (m) => h.onToggleAutoDock(m.checked)
    },
    {
      label: '🔝 始终置顶',
      type: 'checkbox',
      checked: settings.alwaysOnTop,
      click: (m) => h.onToggleOnTop(m.checked)
    },
    {
      label: '🚀 开机自启动',
      type: 'checkbox',
      checked: settings.autoStart,
      click: (m) => h.onToggleAutoStart(m.checked)
    },
    {
      label: '🔊 音效反馈',
      type: 'checkbox',
      checked: settings.audioEnabled,
      click: (m) => h.onToggleAudio(m.checked)
    },
    { label: '📌 立即重新吸附', click: () => h.onRedock() },
    { type: 'separator' },
    { label: '⚙ 设置面板', click: () => h.onShowSettings() },
    {
      label: '🔖 打包版本',
      enabled: false,
      click: () => { /* noop */ }
    },
    { type: 'separator' },
    { label: '❌ 退出 keepBoard', click: () => h.onQuit() }
  ])
}

export function applyAutoStart(enabled: boolean) {
  const exe = process.execPath
  const appName = app.getName()
  // Skip when running via node/electron dev binary; only works for installed app
  const isDev = /electron(\.exe)?$/i.test(path.basename(exe)) || !app.isPackaged
  if (isDev) return
  app.setLoginItemSettings({
    openAtLogin: enabled,
    openAsHidden: true,
    path: exe
  })
}

export const THEME_LIST = THEMES
