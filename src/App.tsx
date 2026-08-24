import { useEffect, useMemo, useState } from 'react'
import PetCanvas from '@/components/PetCanvas'
import DailyPanel from '@/components/DailyPanel'
import WeeklyPanel from '@/components/WeeklyPanel'
import SettingsPanel from '@/components/SettingsPanel'
import ContextMenu from '@/components/ContextMenu'
import type { DailyStats, PanelId, Settings, ThemeId, WeeklyStats } from '@/lib/types'

type ThemeList = { id: ThemeId; label: string }[]

const FALLBACK_THEMES: ThemeList = [
  { id: 'piranha', label: '🌱 食人花' }, { id: 'cactus', label: '🌵 仙人掌' },
  { id: 'slime', label: '🟢 史莱姆' }, { id: 'cat', label: '🐱 像素猫' },
  { id: 'mushroom', label: '🍄 马里奥蘑菇' }, { id: 'ghost', label: '👻 幽灵' },
  { id: 'dino', label: '🦖 小恐龙' }, { id: 'robot', label: '🤖 机器人' },
  { id: 'pumpkin', label: '🎃 南瓜灯' }
]

function formatDurationLocal(ms: number): string {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [themes, setThemes] = useState<ThemeList>(FALLBACK_THEMES)
  const [daily, setDaily] = useState<DailyStats | null>(null)
  const [weekly, setWeekly] = useState<WeeklyStats | null>(null)
  const [panel, setPanel] = useState<PanelId>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    let offs: Array<() => void> = []
    window.keepboard?.getSettings?.().then((s: Settings | undefined) => { if (s) setSettings(s) }).catch(() => { })
    window.keepboard?.listThemes?.().then((t: ThemeList | undefined) => { if (t && t.length) setThemes(t) }).catch(() => { })
    window.keepboard?.getDaily?.().then((d: DailyStats) => setDaily(d)).catch(() => { })
    window.keepboard?.getWeekly?.().then((w: WeeklyStats) => setWeekly(w)).catch(() => { })
    offs.push(window.keepboard?.onSettings?.((s: Settings) => setSettings(s)) ?? (() => { }))
    offs.push(window.keepboard?.onDaily?.((d: DailyStats) => setDaily(d)) ?? (() => { }))
    offs.push(window.keepboard?.onOpenPanel?.((id: PanelId) => { setPanel(id); setCtxMenu(null) }) ?? (() => { }))
    return () => { offs.forEach(off => off?.()) }
  }, [])

  const changeSettings = async (patch: Partial<Settings>) => {
    try {
      const s = await window.keepboard?.setSettings?.(patch) ?? null
      if (s) setSettings(s)
      return s ?? undefined
    } catch { return undefined }
  }

  const openMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setPanel(null)
    setCtxMenu({ x: e.clientX, y: e.clientY })
  }

  const theme: ThemeId = useMemo(() => settings?.theme ?? 'piranha', [settings])

  return (
    <div className="app-root" onContextMenu={openMenu}>
      <PetCanvas theme={theme} />

      {panel === 'daily' && (
        <div className="panel-mask" onClick={(e) => { e.stopPropagation(); setPanel(null) }}>
          <DailyPanel daily={daily} formatDuration={formatDurationLocal} onClose={() => setPanel(null)} />
        </div>
      )}
      {panel === 'weekly' && (
        <div className="panel-mask" onClick={(e) => { e.stopPropagation(); setPanel(null) }}>
          <WeeklyPanel weekly={weekly} formatDuration={formatDurationLocal} onClose={() => setPanel(null)} />
        </div>
      )}
      {panel === 'settings' && (
        <div className="panel-mask" onClick={(e) => { e.stopPropagation(); setPanel(null) }}>
          <SettingsPanel settings={settings} themes={themes as any} onClose={() => setPanel(null)} onChange={changeSettings} />
        </div>
      )}

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          settings={settings}
          themes={themes}
          onClose={() => setCtxMenu(null)}
          onOpenPanel={(id) => setPanel(id)}
          onChange={(patch) => { void changeSettings(patch) }}
        />
      )}
    </div>
  )
}
