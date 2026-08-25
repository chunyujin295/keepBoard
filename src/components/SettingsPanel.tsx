import { useEffect, useState } from 'react'
import type { Settings } from '@/lib/types'

interface Props {
  settings: Settings | null
  onClose: () => void
  onChange: (patch: Partial<Settings>) => Promise<Settings | undefined> | Settings | undefined
}

const OPACITY_STEPS = [1, 0.75, 0.5, 0.25]
const SIZE_STEPS = [160, 200, 240, 280, 320]

export default function SettingsPanel({ settings, onClose, onChange }: Props) {
  const [local, setLocal] = useState<Settings | null>(settings)
  const [hook, setHook] = useState<{ native: boolean; events: number } | null>(null)
  const [sizeLog, setSizeLog] = useState<string[]>([])
  const [version, setVersion] = useState('')
  useEffect(() => setLocal(settings), [settings])
  useEffect(() => {
    let alive = true
    const poll = () => {
      window.keepboard?.getHookStatus?.().then((s: { native: boolean; events: number } | undefined) => {
        if (alive && s) setHook(s)
      }).catch(() => { })
      window.keepboard?.getSizeLog?.().then((l: string[] | undefined) => {
        if (alive && l) setSizeLog(l)
      }).catch(() => { })
    }
    poll()
    const t = setInterval(poll, 1200)
    window.keepboard?.getAppVersion?.().then((v: string) => { if (alive && v) setVersion(v) }).catch(() => { })
    return () => { alive = false; clearInterval(t) }
  }, [])

  if (!local) return null
  const s = local

  const set = async (patch: Partial<Settings>) => {
    setLocal({ ...s, ...patch })
    await onChange(patch)
  }

  const size = Math.round(s.windowSize || 220)
  const chars = Math.max(24, Math.round(size / 5))

  return (
    <div className="panel wide" onMouseDown={(e) => e.stopPropagation()}>
      <div className="panel-header">
        <span className="panel-title">⚙ 设置</span>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>
      <div className="panel-grid">
        <div className="panel-row big">
          <span className="panel-k">🪟 窗口尺寸</span>
        </div>
        <div className="panel-row">
          <span className="panel-k dim">大小</span>
          <span className="panel-v">
            <input
              type="range" min={140} max={320} step={20} value={size}
              onChange={(e) => set({ windowSize: Number(e.target.value) })}
              style={{ width: 110 }}
            />
            <span style={{ display: 'inline-block', width: 34, textAlign: 'right' }}>{size}</span>
          </span>
        </div>
        <div className="panel-row">
          <span className="panel-k dim">预设</span>
          <span className="seg">
            {SIZE_STEPS.map((v) => (
              <button
                key={v}
                className={'seg-btn' + (size === v ? ' active' : '')}
                onClick={() => set({ windowSize: v })}
              >{v}</button>
            ))}
          </span>
        </div>
        <div className="panel-row">
          <span className="panel-k dim">字符网格</span>
          <span className="panel-v">~{chars}×{chars}（自适应）</span>
        </div>

        <div className="panel-row big">
          <span className="panel-k">🌗 不透明度</span>
        </div>
        <div className="panel-row">
          <span className="seg" style={{ width: '100%', justifyContent: 'space-between' }}>
            {OPACITY_STEPS.map((v) => (
              <button
                key={v}
                className={'seg-btn' + (Math.abs((s.opacity ?? 1) - v) < 0.01 ? ' active' : '')}
                onClick={() => set({ opacity: v })}
              >{Math.round(v * 100)}%</button>
            ))}
          </span>
        </div>

        <Toggle label="🚀 开机自启" value={s.autoStart} onChange={(v) => set({ autoStart: v })} hint="安装打包后生效" />
        <Toggle label="🧲 自动吸附任务栏" value={s.autoDock} onChange={(v) => set({ autoDock: v })} />
        <Toggle label="🔝 始终置顶" value={s.alwaysOnTop} onChange={(v) => set({ alwaysOnTop: v })} />
        <Toggle label="🔊 音效反馈" value={s.audioEnabled} onChange={(v) => set({ audioEnabled: v })} />

        <div className="panel-row">
          <span className="panel-k">📡 全局监听</span>
          <span className="panel-v">
            {hook === null
              ? '...'
              : hook.native
                ? `✅ 全局生效 · 已捕获 ${hook.events} 事件`
                : '⚠️ 仅本窗口'}
          </span>
        </div>
        {hook !== null && !hook.native && (
          <div className="hint">原生钩子未加载（可能被安全软件拦截），当前仅统计本窗口内的输入</div>
        )}
      </div>
      <div className="panel-divider" />
      <div className="panel-actions">
        <button className="pixel-btn small" onClick={() => window.keepboard?.openUserData?.()}>📂 数据目录</button>
        <button className="pixel-btn small" onClick={onClose}>关闭</button>
      </div>
      {version && <div className="panel-meta" style={{ marginTop: 6, textAlign: 'center' }}>keepBoard v{version}</div>}
      {sizeLog.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <span className="hint">📐 尺寸日志（最近真实变更）</span>
          {sizeLog.slice(0, 3).map((l, i) => (
            <div key={i} className="hint" style={{ paddingLeft: 8 }}>{l}</div>
          ))}
        </div>
      )}
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
