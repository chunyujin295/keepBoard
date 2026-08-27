import { useEffect, useState } from 'react'
import type { WeeklyStats } from '@/lib/types'

interface Props {
  weekly: WeeklyStats | null
  formatDuration: (ms: number) => string
}

const DAY = ['一', '二', '三', '四', '五', '六', '日']

export default function WeeklyPanel({ weekly, formatDuration }: Props) {
  const [offset, setOffset] = useState(0)
  const [w, setW] = useState<WeeklyStats | null>(weekly)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    window.keepboard?.getWeeklyAt?.(offset).then((d: WeeklyStats) => { if (alive) setW(d) }).catch(() => { })
    return () => { alive = false }
  }, [offset])

  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(''), 4000)
    return () => clearTimeout(t)
  }, [msg])

  const nav = (delta: number) => setOffset((o) => Math.max(0, o + delta))

  const exportCsv = async () => {
    setBusy(true)
    try {
      const p = await window.keepboard?.exportWeekCsv?.(offset)
      setMsg(p ? '已导出 CSV 周报' : '已取消导出')
    } catch { setMsg('导出失败') }
    setBusy(false)
  }

  const isCurrent = offset === 0

  return (
    <div className="panel wide weekly-panel" onMouseDown={(e) => e.stopPropagation()}>
      <div className="panel-header">
        <div>
          <span className="panel-title">每周统计</span>
          <div className="panel-meta">
            {!w ? '加载中...' : (offset === 0 ? '本周' : `${offset} 周前`)}
            {w ? ` ${w.fromDate.slice(5)} ~ ${w.toDate.slice(5)}` : ''}
          </div>
        </div>
      </div>
      <div className="week-nav">
        <button className="pixel-btn small" disabled={w === null} onClick={() => nav(-1)}>◀</button>
        <span className="week-nav-label">{offset === 0 ? '当前周' : '历史周'}</span>
        <button className="pixel-btn small" disabled={isCurrent} onClick={() => nav(1)}>▶</button>
      </div>
      {!w ? (
        <div className="panel-empty">加载中...</div>
      ) : (
        <>
          <div className="metric-hero weekly">
            <Metric label="键击" value={w.totalKeystrokes.toLocaleString()} tone="gold" />
            <Metric label="点击" value={w.totalClicks.toLocaleString()} tone="green" />
            <Metric label="屏时" value={formatDuration(w.totalScreenTimeMs)} tone="blue" />
          </div>
          <div className="panel-grid compact">
            <div className="panel-row">
              <span className="panel-k">日均 APM</span>
              <span className="panel-v">{w.averageApm}</span>
            </div>
            <div className="panel-row">
              <span className="panel-k">最佳日</span>
              <span className="panel-v">{w.bestDay ? w.bestDay.date : '---'}</span>
            </div>
          </div>
          <div className="panel-divider"></div>
          <div className="panel-subtitle">每日节奏</div>
          <div className="bar-chart">
            {(() => {
              const max = Math.max(1, ...w.dailyBreakdown.map(x => x.keyboardTotal))
              return w.dailyBreakdown.map((d, i) => {
                const ratio = d.keyboardTotal / max
                const h = Math.max(4, Math.round(ratio * 100))
                return (
                  <div key={d.date} className="bar-col" title={d.date + ' ' + d.keyboardTotal}>
                    <div className="bar-val">{d.keyboardTotal > 0 ? d.keyboardTotal : ''}</div>
                    <div className="bar-box">
                      <div className="bar-fill" style={{ height: `${h}%` }}></div>
                    </div>
                    <div className="bar-day">周{DAY[i]}</div>
                    <div className="bar-date">{d.date.slice(5)}</div>
                  </div>
                )
              })
            })()}
          </div>
          <div className="panel-divider" />
          <div className="panel-actions">
            <button className="pixel-btn small" disabled={busy} onClick={() => { void exportCsv() }}>💾 导出CSV周报</button>
          </div>
          {msg && <div className="export-msg">{msg}</div>}
        </>
      )}
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
