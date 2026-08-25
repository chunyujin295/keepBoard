export type ThemeId =
  | 'piranha' | 'cactus' | 'slime' | 'cat' | 'mushroom'
  | 'ghost' | 'dino' | 'robot' | 'pumpkin'
  | 'penguin' | 'alien' | 'fox'
  | 'custom'

export interface Settings {
  theme: ThemeId
  autoStart: boolean
  autoDock: boolean
  alwaysOnTop: boolean
  audioEnabled: boolean
  volume: number
  dockEdge: 'auto' | 'top' | 'bottom' | 'left' | 'right'
  opacity: number
  customPetFile?: string
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'piranha',
  autoStart: false,
  autoDock: true,
  alwaysOnTop: true,
  audioEnabled: false,
  volume: 0.4,
  dockEdge: 'auto',
  opacity: 1
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

export const EMPTY_DAILY = (date: string): DailyStats => ({
  date,
  keyboardTotal: 0,
  keyboardByType: {
    alpha: 0, numeric: 0, function: 0, modifier: 0, arrow: 0, bigKey: 0, other: 0
  },
  mouseLeft: 0,
  mouseRight: 0,
  mouseMiddle: 0,
  wheelScrolls: 0,
  screenTimeMs: 0,
  peakApm: 0,
  longestSessionMs: 0
})

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

export type InputEventType =
  | 'keypress'
  | 'mousedown-left'
  | 'mousedown-right'
  | 'mousedown-middle'
  | 'wheel'

export interface InputEvent {
  type: InputEventType
  subtype?: string
  ts: number
}
