import { app, Menu } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { CustomLook, Settings } from './types'

export interface MenuHandlers {
  onToggleAutoStart: (next: boolean) => void
  onToggleAutoDock: (next: boolean) => void
  onToggleOnTop: (next: boolean) => void
  onShowDaily: () => void
  onShowWeekly: () => void
  onRedock: () => void
  onQuit: () => void
  onAudioTheme: (theme: Settings['audioTheme']) => void
  onVolume: (v: number) => void
  onOpacity: (v: number) => void
  onShape: (shape: Settings['shape']) => void
  onSize: (size: number) => void
  onTheme: (t: 'dark' | 'light') => void
  onLook: (id: string) => void
  onCharset: (c: 'ascii' | 'block' | 'dot' | 'line') => void
  onGlow: (next: boolean) => void
  onToggleRandomSpin: (next: boolean) => void
  onMotionPreset: (preset: Settings['motionPreset']) => void
  onDensity: (density: Settings['density']) => void
  onToggleJitter: (next: boolean) => void
  onOpenLookConfig: () => void
}

const THEME_LEVELS: { id: 'dark' | 'light'; label: string }[] = [
  { id: 'dark', label: '深色背景' },
  { id: 'light', label: '浅色背景' }
]

const CHARSET_LEVELS: { id: 'ascii' | 'block' | 'dot' | 'line'; label: string }[] = [
  { id: 'ascii', label: 'ASCII 经典' },
  { id: 'block', label: '像素方块 ░▒▓█' },
  { id: 'dot', label: '点阵 ·∙•●' },
  { id: 'line', label: '线条 ·-=|\\' }
]

const DENSITY_LEVELS: { id: Settings['density']; label: string }[] = [
  { id: 'sparse', label: '稀疏' },
  { id: 'normal', label: '正常' },
  { id: 'dense', label: '密集' }
]

const MOTION_LEVELS: { id: Settings['motionPreset']; label: string }[] = [
  { id: 'off', label: '不启用动效' },
  { id: 'short', label: '短：轻快' },
  { id: 'medium', label: '中：丝滑' },
  { id: 'long', label: '长：舒展' }
]

// Built-in colour-look presets — the full definitions live in PetCanvas (LOOKS).
// Character set and glow are separate settings, not part of a look.
const LOOK_PRESETS: { id: string; label: string }[] = [
  { id: 'classic', label: '🌈 经典彩虹' },
  { id: 'neon', label: '🩵 霓虹' },
  { id: 'cyber', label: '🤖 赛博朋克' },
  { id: 'aurora', label: '🌌 极光' },
  { id: 'sunset', label: '🌇 日落' },
  { id: 'ocean', label: '🌊 海洋' },
  { id: 'forest', label: '🌲 森林' },
  { id: 'candy', label: '🍬 马卡龙' },
  { id: 'gold', label: '✨ 鎏金' }
]

export const OPACITY_LEVELS = [1, 0.75, 0.5, 0.25]
// Volume in 10% steps (0.1–1.0); 0 is the mute level and sits above as its own item.
const VOLUME_LEVELS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
const SIZE_LEVELS = [180, 240, 320, 400, 480, 640]

// Sound themes — 'none' sits at the top and disables audio.
const AUDIO_THEME_LEVELS: { id: Settings['audioTheme']; label: string }[] = [
  { id: 'none', label: '🔇 不启用音效' },
  { id: 'ghost', label: '👻 宇宙幽灵' },
  { id: 'robot', label: '🤖 机器人' },
  { id: '8bit', label: '👾 8-bit 芯片' },
  { id: 'droplet', label: '💧 水滴' },
  { id: 'choir', label: '⛪ 圣歌管风琴' }
]

export function buildTrayMenu(settings: Settings, h: MenuHandlers, customLooks: CustomLook[] = []): Menu {
  const curOpacity = settings.opacity ?? 1
  const curVolume = settings.volume ?? 0.5
  const curAudioTheme = settings.audioTheme ?? (settings.audioEnabled ? 'ghost' : 'none')
  const curSize = settings.windowSize || 220
  const curShape = settings.shape || 'donut'
  const curMotion = settings.motionPreset ?? (settings.motionEffects === false ? 'off' : 'medium')
  const lookItems: Electron.MenuItemConstructorOptions[] = LOOK_PRESETS.map((p) => ({
    label: p.label,
    type: 'radio' as const,
    checked: (settings.look ?? 'classic') === p.id,
    click: () => h.onLook(p.id)
  }))
  // Custom looks live below a separator, each with its own icon + name, then a
  // final separator and an "open config file" shortcut.
  if (customLooks.length) {
    lookItems.push({ type: 'separator' })
    for (const c of customLooks) {
      lookItems.push({
        label: `${c.icon} ${c.name}`,
        type: 'radio' as const,
        checked: settings.look === c.id,
        click: () => h.onLook(c.id)
      })
    }
  }
  lookItems.push({ type: 'separator' })
  lookItems.push({ label: '📂 打开配置文件', click: () => h.onOpenLookConfig() })

  return Menu.buildFromTemplate([
    { label: '📊 今日统计', click: () => h.onShowDaily() },
    { label: '📈 本周统计', click: () => h.onShowWeekly() },
    { type: 'separator' },
    {
      label: '🧊 形状',
      submenu: [
        { label: '🍩 甜甜圈', type: 'radio', checked: curShape === 'donut', click: () => h.onShape('donut') },
        { label: '🌍 地球仪', type: 'radio', checked: curShape === 'sphere', click: () => h.onShape('sphere') },
        { label: '🧊 立方体', type: 'radio', checked: curShape === 'cube', click: () => h.onShape('cube') },
        { label: '🧬 DNA 双螺旋', type: 'radio', checked: curShape === 'dna', click: () => h.onShape('dna') },
        { label: '➰ 莫比乌斯环', type: 'radio', checked: curShape === 'mobius', click: () => h.onShape('mobius') },
        { label: '❤️ 爱心', type: 'radio', checked: curShape === 'heart', click: () => h.onShape('heart') },
        { label: '🪐 土星', type: 'radio', checked: curShape === 'saturn', click: () => h.onShape('saturn') },
        { label: '🪼 水母', type: 'radio', checked: curShape === 'jellyfish', click: () => h.onShape('jellyfish') }
      ]
    },
    {
      label: '📐 尺寸',
      submenu: SIZE_LEVELS.map((v) => ({
        label: `${v}px`,
        type: 'radio' as const,
        checked: curSize === v,
        click: () => h.onSize(v)
      }))
    },
    {
      label: '🎨 配色',
      submenu: lookItems
    },
    {
      label: '🔡 字符集',
      submenu: CHARSET_LEVELS.map((c) => ({
        label: c.label,
        type: 'radio' as const,
        checked: (settings.charset ?? 'ascii') === c.id,
        click: () => h.onCharset(c.id)
      }))
    },
    {
      label: '▦ 字符密度',
      submenu: DENSITY_LEVELS.map((d) => ({
        label: d.label,
        type: 'radio' as const,
        checked: (settings.density ?? 'normal') === d.id,
        click: () => h.onDensity(d.id)
      }))
    },
    {
      label: '✨ 光晕',
      type: 'checkbox',
      checked: settings.glow === true,
      click: (m) => h.onGlow(m.checked)
    },
    {
      label: '🌓 背景',
      submenu: THEME_LEVELS.map((t) => ({
        label: t.label,
        type: 'radio' as const,
        checked: (settings.theme ?? 'dark') === t.id,
        click: () => h.onTheme(t.id)
      }))
    },
    {
      label: '🎲 随机转向',
      type: 'checkbox',
      checked: settings.randomSpin === true,
      click: (m) => h.onToggleRandomSpin(m.checked)
    },
    {
      label: '🌊 动效',
      submenu: [
        ...MOTION_LEVELS.map((m) => ({
          label: m.label,
          type: 'radio' as const,
          checked: curMotion === m.id,
          click: () => h.onMotionPreset(m.id)
        })),
        { type: 'separator' as const },
        {
          label: '↔ 点击抖动',
          type: 'checkbox' as const,
          checked: curMotion !== 'off' && settings.jitter !== false,
          enabled: curMotion !== 'off',
          click: (m: Electron.MenuItem) => h.onToggleJitter(m.checked)
        }
      ]
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
      label: '👽 音效主题',
      submenu: AUDIO_THEME_LEVELS.map((a) => ({
        label: a.label,
        type: 'radio' as const,
        checked: curAudioTheme === a.id,
        click: () => h.onAudioTheme(a.id)
      }))
    },
    {
      label: '🔉 音量',
      submenu: [
        {
          label: '🔇 静音',
          type: 'radio' as const,
          checked: curVolume <= 0.01,
          click: () => h.onVolume(0)
        },
        ...VOLUME_LEVELS.map((v) => ({
          label: `${Math.round(v * 100)}%`,
          type: 'radio' as const,
          checked: Math.abs(curVolume - v) < 0.01,
          click: () => h.onVolume(v)
        }))
      ]
    },
    { label: '📌 立即重新吸附', click: () => h.onRedock() },
    { type: 'separator' },
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
  // Skip when running via node/electron dev binary; only works for installed app
  const isDev = /electron(\.exe)?$/i.test(path.basename(exe)) || !app.isPackaged
  if (isDev) return

  if (process.platform === 'linux') {
    applyAutoStartLinux(enabled)
    return
  }
  // Windows / macOS
  app.setLoginItemSettings({
    openAtLogin: enabled,
    openAsHidden: process.platform === 'darwin' ? true : undefined,
    path: exe
  })
}

// Electron's setLoginItemSettings is a no-op on Linux — write a freedesktop
// autostart entry instead.
function applyAutoStartLinux(enabled: boolean) {
  const dir = path.join(os.homedir(), '.config', 'autostart')
  const file = path.join(dir, 'keepboard.desktop')
  if (!enabled) {
    try { fs.unlinkSync(file) } catch { /* ignore */ }
    return
  }
  const execPath = process.env.APPIMAGE || process.execPath
  const content = [
    '[Desktop Entry]',
    'Type=Application',
    'Name=keepBoard',
    'Comment=Pixel desktop pet & input statistics',
    `Exec=${execPath.includes(' ') ? `"${execPath}"` : execPath}`,
    'Terminal=false',
    'X-GNOME-Autostart-enabled=true',
    ''
  ].join('\n')
  try {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(file, content, 'utf8')
  } catch { /* ignore */ }
}
