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
  ghost: '👻', dino: '🦖', robot: '🤖', pumpkin: '🎃',
  penguin: '🐧', alien: '👾', fox: '🦊', custom: '🐾'
}

const OPACITY_STEPS = [1, 0.75, 0.5, 0.25]

export default function SettingsPanel({ settings, themes, onClose, onChange }: Props) {
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
          <span className="panel-k">🌗 不透明度</span>
          <span className="seg">
            {OPACITY_STEPS.map((v) => (
              <button
                key={v}
                className={'seg-btn' + (Math.abs((s.opacity ?? 1) - v) < 0.01 ? ' active' : '')}
                onClick={() => set({ opacity: v })}
              >{Math.round(v * 100)}</button>
            ))}
          </span>
        </div>

        <div className="panel-row big">
          <span className="panel-k">🐾 自定义形象</span>
        </div>
        <div className="panel-actions" style={{ marginTop: 2 }}>
          <button className="pixel-btn small" onClick={() => { void window.keepboard?.chooseCustomPet?.() }}>📁 上传图片…</button>
          <button
            className="pixel-btn small"
            disabled={!s.customPetFile && s.theme !== 'custom'}
            onClick={() => { void window.keepboard?.clearCustomPet?.() }}
          >↺ 恢复默认</button>
        </div>
        <span className="hint">支持 PNG / JPG / WebP / BMP / GIF（静态图 + 程序动画），详见 docs/自定义形象说明.md</span>

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
