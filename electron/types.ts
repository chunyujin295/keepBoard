export interface Settings {
  windowSize: number
  shape: 'donut' | 'sphere' | 'cube' | 'dna' | 'mobius' | 'heart' | 'saturn' | 'jellyfish'
  autoStart: boolean
  autoDock: boolean
  alwaysOnTop: boolean
  audioEnabled: boolean
  volume: number
  dockEdge: 'auto' | 'top' | 'bottom' | 'left' | 'right'
  opacity: number
  /** Background theme. Picks the glow halo polarity (dark background -> light
   *  halo, light background -> dark halo). Aesthetic brightness is `Look.tone`. */
  theme: 'dark' | 'light'
  /** Named look preset (see LOOKS in PetCanvas). 'custom' reads the user's
   *  keepboard-look.json. Colour-ish dimensions only: tone/saturation/palette. */
  look: string
  /** Character-set style — a separate toggle from the colour look. */
  charset: 'ascii' | 'block' | 'dot' | 'line'
  /** Soft halo under the shape for legibility on any desktop. */
  glow: boolean
  /** Kick the spin in a random direction per input, instead of always forward. */
  randomSpin: boolean
  /** @deprecated Use motionPreset; kept to migrate old settings files. */
  motionEffects: boolean
  /** Extra input pulse / milestone celebration duration. Core spin still works when off. */
  motionPreset: 'off' | 'short' | 'medium' | 'long'
  /** Character grid density. Smaller glyphs make denser shapes. */
  density: 'sparse' | 'normal' | 'dense'
  /** Add a small left/right wobble to click feedback. */
  jitter: boolean
}

/** The colour-ish appearance dimensions of a look, exposed in a preset and
 *  individually in keepboard-look.json. Character set and glow are separate
 *  settings, not part of the look. */
export interface LookDef {
  /** direct override of the shading ramp (ignores `settings.charset`) */
  chars?: string
  /** overall brightness, decoupled from the background */
  tone?: 'night' | 'dark' | 'mid' | 'bright' | 'high'
  /** saturation / vividness */
  saturation?: 'gray' | 'muted' | 'normal' | 'vivid' | 'neon'
  /** hue gradient id (rainbow/neon/sunset/ocean/mono/aurora/cyber/candy/gold/forest) */
  palette?: string
  /** custom hex list, interpolated to a gradient — overrides `palette` */
  colors?: string[]
  /** shading-ramp weighting (gamma < 1 pushes toward heavier glyphs) */
  gamma?: number
}

/** A user-defined look from keepboard-look.json: a LookDef plus the id, display
 *  name and menu icon that identify it in the tray. */
export interface CustomLook extends LookDef {
  id: string
  name: string
  icon: string
}

export const DEFAULT_SETTINGS: Settings = {
  windowSize: 220,
  shape: 'donut',
  autoStart: false,
  autoDock: true,
  alwaysOnTop: true,
  audioEnabled: false,
  volume: 0.4,
  dockEdge: 'auto',
  opacity: 1,
  theme: 'dark',
  look: 'classic',
  charset: 'ascii',
  glow: false,
  randomSpin: false,
  motionEffects: true,
  motionPreset: 'medium',
  density: 'normal',
  jitter: true
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
