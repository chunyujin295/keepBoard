export interface Settings {
  windowSize: number
  shape: 'donut' | 'sphere' | 'cube' | 'dna' | 'mobius' | 'heart' | 'saturn' | 'jellyfish' | 'rainbow'
  autoStart: boolean
  autoDock: boolean
  alwaysOnTop: boolean
  /** @deprecated Use audioTheme; kept to migrate old settings files. */
  audioEnabled: boolean
  audioTheme: 'none' | 'ghost' | 'robot' | '8bit' | 'droplet' | 'choir'
  volume: number
  dockEdge: 'auto' | 'top' | 'bottom' | 'left' | 'right'
  opacity: number
  theme: 'dark' | 'light'
  look: string
  charset: 'ascii' | 'block' | 'dot' | 'line'
  glow: boolean
  randomSpin: boolean
  /** @deprecated Use motionPreset; kept to migrate old settings files. */
  motionEffects: boolean
  motionPreset: 'off' | 'short' | 'medium' | 'long'
  density: 'sparse' | 'normal' | 'dense'
  jitter: boolean
}

export interface LookDef {
  chars?: string
  tone?: 'night' | 'dark' | 'mid' | 'bright' | 'high'
  saturation?: 'gray' | 'muted' | 'normal' | 'vivid' | 'neon'
  palette?: string
  colors?: string[]
  gamma?: number
}

export interface CustomLook extends LookDef {
  id: string
  name: string
  icon: string
}

export interface DailyStats {
  date: string
  keyboardTotal: number
  keyboardByType: {
    alpha: number
    numeric: number
    function: number
    modifier: number
    arrow: number
    bigKey: number
    other: number
  }
  mouseLeft: number
  mouseRight: number
  mouseMiddle: number
  wheelScrolls: number
  screenTimeMs: number
  peakApm: number
  longestSessionMs: number
}

export interface WeeklyStats {
  fromDate: string
  toDate: string
  totalKeystrokes: number
  totalClicks: number
  totalScreenTimeMs: number
  dailyBreakdown: DailyStats[]
  averageApm: number
  bestDay: DailyStats | null
}

export type PanelId = 'daily' | 'weekly' | 'settings' | null
