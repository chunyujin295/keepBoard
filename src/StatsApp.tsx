import { useEffect, useState } from 'react'
import DailyPanel from '@/components/DailyPanel'
import WeeklyPanel from '@/components/WeeklyPanel'
import type { DailyStats, WeeklyStats } from '@/lib/types'

interface Props {
  panel: 'daily' | 'weekly'
}

/** Rendered inside the dedicated stats window (`#stats` route). Fetches the
 *  matching summary on mount and hands it to the existing panel components. */
export default function StatsApp({ panel }: Props) {
  const [daily, setDaily] = useState<DailyStats | null>(null)
  const [weekly, setWeekly] = useState<WeeklyStats | null>(null)

  useEffect(() => {
    if (panel === 'daily') {
      window.keepboard?.getDaily?.().then((d: DailyStats) => setDaily(d)).catch(() => { })
    } else {
      window.keepboard?.getWeekly?.().then((w: WeeklyStats) => setWeekly(w)).catch(() => { })
    }
  }, [panel])

  const close = () => window.keepboard?.closeStats?.()

  return (
    <div className="stats-shell">
      {panel === 'daily'
        ? <DailyPanel daily={daily} formatDuration={formatDuration} onClose={close} />
        : <WeeklyPanel weekly={weekly} formatDuration={formatDuration} onClose={close} />}
    </div>
  )
}

function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = total % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}
