import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { DailyStats, EMPTY_DAILY, Settings, DEFAULT_SETTINGS, WeeklyStats } from './types'
import { todayKey, getWeekRange, buildWeeklyStats, addDays } from './statsUtils'

type StoreShape = {
  settings: Settings
  daily: Record<string, DailyStats>
}

export class AppStore {
  private dir: string
  private file: string
  private data: StoreShape
  private dirty = false
  private flushTimer: NodeJS.Timeout | null = null

  constructor() {
    this.dir = app.getPath('userData')
    this.file = path.join(this.dir, 'keepboard-store.json')
    this.data = this.load()
  }

  private load(): StoreShape {
    try {
      if (!fs.existsSync(this.file)) {
        const fresh: StoreShape = { settings: { ...DEFAULT_SETTINGS }, daily: {} }
        this.save(fresh)
        return fresh
      }
      const raw = fs.readFileSync(this.file, 'utf8')
      const parsed = JSON.parse(raw) as Partial<StoreShape>
      return {
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
        daily: parsed.daily ?? {}
      }
    } catch {
      return { settings: { ...DEFAULT_SETTINGS }, daily: {} }
    }
  }

  private save(d = this.data) {
    try {
      if (!fs.existsSync(this.dir)) fs.mkdirSync(this.dir, { recursive: true })
      fs.writeFileSync(this.file, JSON.stringify(d, null, 0), 'utf8')
    } catch { /* ignore */ }
  }

  // ---------- Settings ----------
  getSettings(): Settings { return { ...this.data.settings } }

  updateSettings(patch: Partial<Settings>): Settings {
    this.data.settings = { ...this.data.settings, ...patch }
    this.save()
    return this.getSettings()
  }

  // ---------- Daily stats ----------
  getDaily(dateKey = todayKey()): DailyStats {
    const cached = this.data.daily[dateKey]
    if (cached) return cached
    const fresh = EMPTY_DAILY(dateKey)
    this.data.daily[dateKey] = fresh
    return fresh
  }

  mutateDaily(dateKey: string, fn: (d: DailyStats) => void): DailyStats {
    const d = this.getDaily(dateKey)
    fn(d)
    this.data.daily[dateKey] = d
    this.scheduleSave()
    return d
  }

  // Keystrokes can arrive at very high frequency; debounce full-file writes.
  private scheduleSave() {
    this.dirty = true
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), 2_000)
      this.flushTimer.unref?.()
    }
  }

  flush() {
    if (this.flushTimer) { clearTimeout(this.flushTimer); this.flushTimer = null }
    if (this.dirty) {
      this.dirty = false
      this.save()
    }
  }

  // ---------- Weekly stats ----------
  getWeekly(ref = new Date()): WeeklyStats {
    const { keys } = getWeekRange(ref)
    const days = keys.map((k) => this.data.daily[k] ?? EMPTY_DAILY(k))
    return buildWeeklyStats(days, ref)
  }

  getLastNWeeks(n = 4): WeeklyStats[] {
    const out: WeeklyStats[] = []
    const now = new Date()
    for (let i = n - 1; i >= 0; i--) {
      const ref = new Date(now)
      ref.setDate(ref.getDate() - i * 7)
      out.push(this.getWeekly(ref))
    }
    return out
  }

  // Prune daily stats older than 180 days but keep weekly snapshots
  pruneOld(days = 180) {
    const threshold = addDays(todayKey(), -days)
    let changed = false
    for (const k of Object.keys(this.data.daily)) {
      if (k < threshold) { delete this.data.daily[k]; changed = true }
    }
    if (changed) this.save()
  }
}
