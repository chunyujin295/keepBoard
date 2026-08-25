import { useState } from 'react'
import type { Settings, ThemeId } from '@/lib/types'

export interface MenuData {
  settings: Settings
  themes: { id: ThemeId; label: string }[]
}

export type MenuAction =
  | { type: 'panel'; payload: 'daily' | 'weekly' | 'settings' }
  | { type: 'patch'; payload: Partial<Settings> }
  | { type: 'quit' }

interface Props {
  data: MenuData
  onAction: (a: MenuAction) => void
}

export default function ContextMenu({ data, onAction }: Props) {
  const [view, setView] = useState<'root' | 'themes'>('root')
  const { settings, themes } = data

  const act = (fn: () => void) => () => fn()

  return (
    <div className="ctx-menu">
      {view === 'root' ? (
        <>
          <CtxItem icon="📊" label="今日统计" onClick={act(() => onAction({ type: 'panel', payload: 'daily' }))} />
          <CtxItem icon="📈" label="本周统计" onClick={act(() => onAction({ type: 'panel', payload: 'weekly' }))} />
          <Sep />
          <CtxItem icon="🎨" label="主题皮肤" arrow onClick={() => setView('themes')} />
          <Sep />
          <CtxCheck icon="🔝" label="始终置顶" on={!!settings?.alwaysOnTop} onClick={() => onAction({ type: 'patch', payload: { alwaysOnTop: !settings?.alwaysOnTop } })} />
          <CtxCheck icon="🧲" label="吸附任务栏" on={!!settings?.autoDock} onClick={() => onAction({ type: 'patch', payload: { autoDock: !settings?.autoDock } })} />
          <CtxCheck icon="🚀" label="开机自启" on={!!settings?.autoStart} onClick={() => onAction({ type: 'patch', payload: { autoStart: !settings?.autoStart } })} />
          <CtxCheck icon="🔊" label="音效反馈" on={!!settings?.audioEnabled} onClick={() => onAction({ type: 'patch', payload: { audioEnabled: !settings?.audioEnabled } })} />
          <Sep />
          <CtxItem icon="⚙" label="设置面板" onClick={act(() => onAction({ type: 'panel', payload: 'settings' }))} />
          <CtxItem icon="❌" label="退出" danger onClick={act(() => onAction({ type: 'quit' }))} />
        </>
      ) : (
        <div className="ctx-themes">
          <div className="ctx-back" onClick={() => setView('root')}>‹ 返回</div>
          {themes.map((t) => (
            <button
              key={t.id}
              className={'ctx-item' + (settings?.theme === t.id ? ' checked' : '')}
              onClick={act(() => onAction({ type: 'patch', payload: { theme: t.id } }))}
            >
              <span className="ctx-ico">{t.label.slice(0, 2)}</span>
              <span className="ctx-label">{t.label.slice(2)}</span>
              {settings?.theme === t.id && <span className="ctx-tick">✓</span>}
            </button>
          ))}
        </div>
      )}
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
