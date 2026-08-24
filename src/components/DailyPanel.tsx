import type { DailyStats } from '@/lib/types'

interface Props {
  daily: DailyStats | null
  formatDuration: (ms: number) => string
  onClose: () => void
}

function fmt(n: number) { return n.toLocaleString('en-US') }

export default function DailyPanel({ daily, formatDuration, onClose }: Props) {
  const d = daily
  return (
    <div className="panel" onMouseDown={(e) => e.stopPropagation()}>
      <div className="panel-header">
        <span className="panel-title">📊 今日统计</span>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>
      {!d ? <div className="panel-empty">加载中…</div> : (
        <>
          <div className="panel-grid">
            <Row k="日期" v={d.date} />
            <BigRow k="⌨ 键盘" v={fmt(d.keyboardTotal)} />
            <BigRow k="🖱 点击" v={fmt(d.mouseLeft + d.mouseRight + d.mouseMiddle)} />
            <Row k="  左键" v={fmt(d.mouseLeft)} dim />
            <Row k="  右键" v={fmt(d.mouseRight)} dim />
            <Row k="  中键" v={fmt(d.mouseMiddle)} dim />
            <Row k="🎡 滚轮" v={fmt(d.wheelScrolls)} />
            <BigRow k="⏱ 屏时" v={formatDuration(d.screenTimeMs)} />
            <Row k="⚡ 峰值APM" v={String(d.peakApm)} />
            <Row k="🏃 最长会话" v={formatDuration(d.longestSessionMs)} />
          </div>
          <div className="panel-divider" />
          <div className="panel-subtitle">按键分类</div>
          <div className="panel-grid">
            <Row k="字母 A-Z" v={fmt(d.keyboardByType.alpha)} />
            <Row k="数字" v={fmt(d.keyboardByType.numeric)} />
            <Row k="功能 Fx" v={fmt(d.keyboardByType.function)} />
            <Row k="修饰 Ctrl" v={fmt(d.keyboardByType.modifier)} />
            <Row k="方向键" v={fmt(d.keyboardByType.arrow)} />
            <Row k="大键" v={fmt(d.keyboardByType.bigKey)} />
            <Row k="其他" v={fmt(d.keyboardByType.other)} />
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
function BigRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="panel-row big">
      <span className="panel-k">{k}</span>
      <span className="panel-v">{v}</span>
    </div>
  )
}
