export interface Settings {
  windowSize: number
  autoStart: boolean
  autoDock: boolean
  alwaysOnTop: boolean
  audioEnabled: boolean
  volume: number
  dockEdge: 'auto' | 'top' | 'bottom' | 'left' | 'right'
  opacity: number
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
