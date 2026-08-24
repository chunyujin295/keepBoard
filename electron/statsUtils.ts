import { DailyStats, EMPTY_DAILY, WeeklyStats } from './types'

export function todayKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  return todayKey(date)
}

export function mergeDailyInto(base: DailyStats, patch: Partial<DailyStats>): DailyStats {
  const kbt = base.keyboardByType
  const pbt = (patch.keyboardByType ?? {}) as Partial<DailyStats['keyboardByType']>
  return {
    ...base,
    ...patch,
    keyboardByType: {
      alpha: kbt.alpha + (pbt.alpha ?? 0),
      numeric: kbt.numeric + (pbt.numeric ?? 0),
      function: kbt.function + (pbt.function ?? 0),
      modifier: kbt.modifier + (pbt.modifier ?? 0),
      arrow: kbt.arrow + (pbt.arrow ?? 0),
      bigKey: kbt.bigKey + (pbt.bigKey ?? 0),
      other: kbt.other + (pbt.other ?? 0)
    }
  }
}

export function sumDaily(days: DailyStats[]) {
  return days.reduce<DailyStats>((acc, d) => mergeDailyInto(acc, d), EMPTY_DAILY('__sum__'))
}

export function getWeekRange(d = new Date()): { from: Date; to: Date; keys: string[] } {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dayOfWeek = (date.getDay() + 6) % 7 // Monday=0
  const from = new Date(date)
  from.setDate(date.getDate() - dayOfWeek)
  const to = new Date(from)
  to.setDate(from.getDate() + 6)
  const keys: string[] = []
  for (let i = 0; i < 7; i++) {
    keys.push(addDays(todayKey(from), i))
  }
  return { from, to, keys }
}

export function buildWeeklyStats(days: DailyStats[], ref = new Date()): WeeklyStats {
  const { keys } = getWeekRange(ref)
  const byDate = new Map(days.map((d) => [d.date, d]))
  const dailyBreakdown = keys.map((k) => byDate.get(k) ?? EMPTY_DAILY(k))
  const total = sumDaily(dailyBreakdown)
  const withActivity = dailyBreakdown.filter((d) => d.keyboardTotal + d.mouseLeft + d.mouseRight > 0)
  const bestDay = withActivity.length
    ? withActivity.reduce((best, d) => (d.keyboardTotal > best.keyboardTotal ? d : best), withActivity[0])
    : null
  const totalMins = total.screenTimeMs / 60000 || 1
  const averageApm = Math.round(total.keyboardTotal / totalMins)
  return {
    fromDate: keys[0],
    toDate: keys[6],
    totalKeystrokes: total.keyboardTotal,
    totalClicks: total.mouseLeft + total.mouseRight + total.mouseMiddle,
    totalScreenTimeMs: total.screenTimeMs,
    dailyBreakdown,
    averageApm,
    bestDay
  }
}

export function classifyKey(code: string): keyof DailyStats['keyboardByType'] {
  if (!code) return 'other'
  if (/^Key[A-Z]$/.test(code)) return 'alpha'
  if (/^Digit[0-9]$|^Numpad[0-9]$/.test(code)) return 'numeric'
  if (/^F[0-9]{1,2}$/.test(code)) return 'function'
  if (/(Control|Shift|Alt|Meta|OS)/i.test(code)) return 'modifier'
  if (/^Arrow(Left|Right|Up|Down)$/.test(code)) return 'arrow'
  if (['Space', 'Enter', 'Backspace', 'NumpadEnter', 'Tab'].includes(code)) return 'bigKey'
  return 'other'
}

export function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function weeklyToCsv(w: WeeklyStats): string {
  const lines: string[] = []
  lines.push(`keepBoard 每周统计,${w.fromDate} ~ ${w.toDate}`)
  lines.push('日期,键击,左键,右键,中键,滚轮,屏幕时间(分),峰值APM')
  for (const d of w.dailyBreakdown) {
    const mins = Math.round(d.screenTimeMs / 60000)
    lines.push([d.date, d.keyboardTotal, d.mouseLeft, d.mouseRight, d.mouseMiddle, d.wheelScrolls, mins, d.peakApm].join(','))
  }
  lines.push('')
  lines.push(`合计键击,${w.totalKeystrokes}`)
  lines.push(`合计点击,${w.totalClicks}`)
  const totalMins = Math.round(w.totalScreenTimeMs / 60000)
  lines.push(`合计屏时(分),${totalMins}`)
  lines.push(`日均APM,${w.averageApm}`)
  lines.push(`最佳日,${w.bestDay ? w.bestDay.date : '-'},${w.bestDay ? w.bestDay.keyboardTotal : ''}`)
  return lines.join('\r\n') + '\r\n'
}
