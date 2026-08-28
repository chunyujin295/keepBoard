import { useEffect, useState } from 'react'
import PetCanvas from '@/components/PetCanvas'
import type { CustomLook, Settings } from '@/lib/types'

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [dark, setDark] = useState(true)
  const [customLooks, setCustomLooks] = useState<CustomLook[]>([])

  // Resolved dark/light + the list of user-defined looks. Re-resolve whenever
  // settings change (picking a look from the tray triggers one).
  useEffect(() => {
    window.keepboard?.getDark?.().then((d: boolean) => setDark(d)).catch(() => { })
    window.keepboard?.getCustomLooks?.().then((list: CustomLook[]) => setCustomLooks(list ?? [])).catch(() => { })
  }, [settings])

  const customLook = settings ? customLooks.find((c) => c.id === settings.look) : undefined

  useEffect(() => {
    let offs: Array<() => void> = []
    window.keepboard?.getSettings?.().then((s: Settings | undefined) => { if (s) setSettings(s) }).catch(() => { })
    offs.push(window.keepboard?.onSettings?.((s: Settings) => setSettings(s)) ?? (() => { }))
    return () => { offs.forEach(off => off?.()) }
  }, [])

  const size = Math.max(140, Math.min(640, Math.round(settings?.windowSize || 220)))
  // Local visual-QA hook; packaged builds always use the persisted setting.
  const previewShape = import.meta.env.DEV
    ? new URLSearchParams(window.location.search).get('shape')
    : null
  const shape = previewShape && ['donut', 'sphere', 'cube', 'dna', 'mobius', 'heart', 'saturn', 'jellyfish', 'rainbow'].includes(previewShape)
    ? previewShape as Settings['shape']
    : settings?.shape ?? 'donut'

  return (
    <div className="app-root">
      <PetCanvas
        size={size}
        overlayActive={false}
        shape={shape}
        dark={dark}
        look={settings?.look ?? 'classic'}
        customLook={customLook ?? undefined}
        charset={settings?.charset ?? 'ascii'}
        glow={settings?.glow === true}
        randomSpin={settings?.randomSpin === true}
        driveMode={settings?.driveMode ?? 'manual'}
        motionPreset={settings?.motionPreset ?? (settings?.motionEffects === false ? 'off' : 'medium')}
        density={settings?.density ?? 'normal'}
        jitter={settings?.jitter !== false}
        audioTheme={settings?.audioTheme ?? (settings?.audioEnabled === true ? 'ghost' : 'none')}
        volume={settings?.volume ?? 0.5}
      />
    </div>
  )
}
