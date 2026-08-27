import type { DailyStats } from '@/lib/types'

interface Props {
  daily: DailyStats | null
  formatDuration: (ms: number) => string
}

function fmt(n: number) { return n.toLocaleString('en-US') }

export default function DailyPanel({ daily, formatDuration }: Props) {
  const d = daily
  const totalClicks = d ? d.mouseLeft + d.mouseRight + d.mouseMiddle : 0
  const keyTypes = d ? [
    ['字母', d.keyboardByType.alpha],
    ['数字', d.keyboardByType.numeric],
    ['功能', d.keyboardByType.function],
    ['修饰', d.keyboardByType.modifier],
    ['方向', d.keyboardByType.arrow],
    ['大键', d.keyboardByType.bigKey],
    ['其他', d.keyboardByType.other]
  ] as const : []
  const maxKeyType = Math.max(1, ...keyTypes.map(([, v]) => v))

  return (
    <div className="panel daily-panel" onMouseDown={(e) => e.stopPropagation()}>
      <div className="panel-header">
        <div>
          <span className="panel-title">今日统计</span>
          {d && <div className="panel-meta">{d.date}</div>}
        </div>
      </div>
      {!d ? <div className="panel-empty">加载中…</div> : (
        <>
          <div className="metric-hero">
            <Metric label="键击" value={fmt(d.keyboardTotal)} tone="gold" />
            <Metric label="点击" value={fmt(totalClicks)} tone="green" />
            <Metric label="屏时" value={formatDuration(d.screenTimeMs)} tone="blue" />
          </div>
          <div className="panel-grid compact">
            <Row k="峰值 APM" v={String(d.peakApm)} />
            <Row k="最长会话" v={formatDuration(d.longestSessionMs)} />
            <Row k="滚轮" v={fmt(d.wheelScrolls)} />
            <Row k="鼠标细分" v={`${fmt(d.mouseLeft)} / ${fmt(d.mouseRight)} / ${fmt(d.mouseMiddle)}`} dim />
          </div>
          <div className="panel-divider" />
          <div className="panel-subtitle">按键分类</div>
          <div className="type-bars">
            {keyTypes.map(([label, value]) => (
              <div className="type-bar" key={label}>
                <span>{label}</span>
                <div className="type-track">
                  <i style={{ width: `${Math.max(4, value / maxKeyType * 100)}%` }} />
                </div>
                <b>{fmt(value)}</b>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Row({ k, v, dim }: { k: string; v: string; dim?: boolean }) {
  return (
    <div className="panel-row">
      <span className={'panel-k' + (dim ? ' dim' : '')}>{k}</span>
      <span className="panel-v">{v}</span>
    </div>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone: 'gold' | 'green' | 'blue' }) {
  return (
    <div className={`metric-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
