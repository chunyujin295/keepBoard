import { useEffect, useState } from 'react'
import type { Settings, ThemeId } from '@/lib/types'

interface Props {
  settings: Settings | null
  themes: { id: ThemeId; label: string }[]
  onClose: () => void
  onChange: (patch: Partial<Settings>) => Promise<Settings | undefined> | Settings | undefined
}

const THEME_PREV: Record<ThemeId, string> = {
  piranha: '🌱', cactus: '🌵', slime: '🟢', cat: '🐱', mushroom: '🍄',
  ghost: '👻', dino: '🦖', robot: '🤖', pumpkin: '🎃'
}

export default function SettingsPanel({ settings, themes, onClose, onChange }: Props) {
  const [local, setLocal] = useState<Settings | null>(settings)
  useEffect(() => setLocal(settings), [settings])

  if (!local) return null
  const s = local

  const set = async (patch: Partial<Settings>) => {
    setLocal({ ...s, ...patch })
    await onChange(patch)
  }

  return (
    <div className="panel wide" onMouseDown={(e) => e.stopPropagation()}>
      <div className="panel-header">
        <span className="panel-title">⚙ 设置</span>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>
      <div className="panel-grid">
        <div className="panel-row big">
          <span className="panel-k">🎨 主题</span>
        </div>
        <div className="theme-grid">
          {themes.map((t) => (
            <button
              key={t.id}
            className={'theme-chip' + (s.theme === t.id ? ' active' : '')}
            onClick={() => set({ theme: t.id })}
            title={t.label}
            >
              <span className="theme-ico">{THEME_PREV[t.id]}</span>
              <span className="theme-lab">{t.label.slice(2)}</span>
            </button>
          ))}
        </div>

        <Toggle label="🚀 开机自启" value={s.autoStart} onChange={(v) => set({ autoStart: v })} hint="安装打包后生效" />
        <Toggle label="🧲 自动吸附任务栏" value={s.autoDock} onChange={(v) => set({ autoDock: v })} />
        <Toggle label="🔝 始终置顶" value={s.alwaysOnTop} onChange={(v) => set({ alwaysOnTop: v })} />
        <Toggle label="🔊 音效反馈" value={s.audioEnabled} onChange={(v) => set({ audioEnabled: v })} />

        <div className="panel-row">
          <span className="panel-k">🔊 音量</span>
          <span className="panel-v">
            <input
              type="range" min={0} max={100} value={Math.round(s.volume * 100)}
              onChange={(e) => set({ volume: Number(e.target.value) / 100 })}
              style={{ width: 80 }}
            />
            <span style={{ display: 'inline-block', width: 36, textAlign: 'right' }}>{Math.round(s.volume * 100)}</span>
          </span>
        </div>
      </div>
      <div className="panel-divider" />
      <div className="panel-actions">
        <button className="pixel-btn small" onClick={() => window.keepboard?.openUserData?.()}>📂 数据目录</button>
        <button className="pixel-btn small" onClick={onClose}>关闭</button>
      </div>
    </div>
  )
}

function Toggle({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <div className="panel-row">
      <span className="panel-k">
        {label}
        {hint ? <span className="hint">（{hint}）</span> : null}
      </span>
      <button
        className={'toggle' + (value ? ' on' : '')}
        onClick={() => onChange(!value)}
      >
        <span className="toggle-dot" />
        <span className="toggle-label">{value ? 'ON' : 'OFF'}</span>
      </button>
    </div>
  )
}
