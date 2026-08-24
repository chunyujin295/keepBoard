import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PanelId, Settings, ThemeId } from '@/lib/types'

interface Props {
  x: number
  y: number
  settings: Settings | null
  themes: { id: ThemeId; label: string }[]
  onClose: () => void
  onOpenPanel: (id: PanelId) => void
  onChange: (patch: Partial<Settings>) => void
}

export default function ContextMenu({ x, y, settings, themes, onClose, onOpenPanel, onChange }: Props) {
  const [view, setView] = useState<'root' | 'themes'>('root')
  const [pos, setPos] = useState({ x, y })
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({
      x: Math.max(2, Math.min(x, 220 - r.width - 2)),
      y: Math.max(2, Math.min(y, 240 - r.height - 2))
    })
  }, [x, y, view])

  const stop = (e: React.MouseEvent) => e.stopPropagation()

  const act = (fn: () => void) => () => { fn(); onClose() }

  return (
    <div className="ctx-overlay" onMouseDown={onClose} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation() }}>
      <div
        ref={ref}
        className="ctx-menu"
        style={{ left: pos.x, top: pos.y, width: 128 }}
        onMouseDown={stop}
      >
        {view === 'root' ? (
          <>
            <CtxItem icon="📊" label="今日统计" onClick={act(() => onOpenPanel('daily'))} />
            <CtxItem icon="📈" label="本周统计" onClick={act(() => onOpenPanel('weekly'))} />
            <Sep />
            <CtxItem icon="🎨" label="主题皮肤" arrow onClick={() => setView('themes')} />
            <Sep />
            <CtxCheck icon="🔝" label="始终置顶" on={!!settings?.alwaysOnTop} onClick={() => onChange({ alwaysOnTop: !settings?.alwaysOnTop })} />
            <CtxCheck icon="🧲" label="吸附任务栏" on={!!settings?.autoDock} onClick={() => onChange({ autoDock: !settings?.autoDock })} />
            <CtxCheck icon="🚀" label="开机自启" on={!!settings?.autoStart} onClick={() => onChange({ autoStart: !settings?.autoStart })} />
            <CtxCheck icon="🔊" label="音效反馈" on={!!settings?.audioEnabled} onClick={() => onChange({ audioEnabled: !settings?.audioEnabled })} />
            <Sep />
            <CtxItem icon="⚙" label="设置面板" onClick={act(() => onOpenPanel('settings'))} />
            <CtxItem icon="❌" label="退出" danger onClick={act(() => window.keepboard?.quitApp?.())} />
          </>
        ) : (
          <div className="ctx-themes">
            <div className="ctx-back" onClick={() => setView('root')}>‹ 返回</div>
            {themes.map((t) => (
              <button
                key={t.id}
                className={'ctx-item' + (settings?.theme === t.id ? ' checked' : '')}
                onClick={act(() => onChange({ theme: t.id }))}
              >
                <span className="ctx-ico">{t.label.slice(0, 2)}</span>
                <span className="ctx-label">{t.label.slice(2)}</span>
                {settings?.theme === t.id && <span className="ctx-tick">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CtxItem({ icon, label, onClick, arrow, danger }: {
  icon: string; label: string; onClick: () => void; arrow?: boolean; danger?: boolean
}) {
  return (
    <button className={'ctx-item' + (danger ? ' danger' : '')} onClick={onClick}>
      <span className="ctx-ico">{icon}</span>
      <span className="ctx-label">{label}</span>
      {arrow && <span className="ctx-arrow">▸</span>}
    </button>
  )
}

function CtxCheck({ icon, label, on, onClick }: { icon: string; label: string; on: boolean; onClick: () => void }) {
  return (
    <button className={'ctx-item' + (on ? ' checked' : '')} onClick={onClick}>
      <span className="ctx-ico">{icon}</span>
      <span className="ctx-label">{label}</span>
      <span className="ctx-tick">{on ? 'ON' : ''}</span>
    </button>
  )
}

function Sep() { return <div className="ctx-sep" /> }
