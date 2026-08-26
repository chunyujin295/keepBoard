import { useEffect, useState } from 'react'
import PetCanvas from '@/components/PetCanvas'
import DailyPanel from '@/components/DailyPanel'
import WeeklyPanel from '@/components/WeeklyPanel'
import type { DailyStats, PanelId, Settings, WeeklyStats } from '@/lib/types'

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [daily, setDaily] = useState<DailyStats | null>(null)
  const [weekly, setWeekly] = useState<WeeklyStats | null>(null)
  const [panel, setPanel] = useState<PanelId>(null)
  const [durationFn] = useState<(ms: number) => string>(formatDurationLocal)

  useEffect(() => {
    let offs: Array<() => void> = []
    window.keepboard?.getSettings?.().then((s: Settings | undefined) => { if (s) setSettings(s) }).catch(() => { })
    window.keepboard?.getDaily?.().then((d: DailyStats) => setDaily(d)).catch(() => { })
    window.keepboard?.getWeekly?.().then((w: WeeklyStats) => setWeekly(w)).catch(() => { })
    offs.push(window.keepboard?.onSettings?.((s: Settings) => setSettings(s)) ?? (() => { }))
    offs.push(window.keepboard?.onDaily?.((d: DailyStats) => setDaily(d)) ?? (() => { }))
    offs.push(window.keepboard?.onOpenPanel?.((id: PanelId) => setPanel(id)) ?? (() => { }))
    return () => { offs.forEach(off => off?.()) }
  }, [])

  const size = Math.max(140, Math.min(640, Math.round(settings?.windowSize || 220)))

  return (
    <div className="app-root">
      <PetCanvas size={size} overlayActive={panel !== null} shape={settings?.shape ?? 'donut'} />

      {panel === 'daily' && (
        <div className="panel-mask" onClick={(e) => { e.stopPropagation(); setPanel(null) }}>
          <DailyPanel daily={daily} formatDuration={durationFn} onClose={() => setPanel(null)} />
        </div>
      )}
      {panel === 'weekly' && (
        <div className="panel-mask" onClick={(e) => { e.stopPropagation(); setPanel(null) }}>
          <WeeklyPanel weekly={weekly} formatDuration={durationFn} onClose={() => setPanel(null)} />
        </div>
      )}
    </div>
  )
}

function formatDurationLocal(ms: number): string {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = total % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}
