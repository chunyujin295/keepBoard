import { useEffect, useState } from 'react'

export default function StatsPanel() {
  const [keys, setKeys] = useState(0)
  const [clicks, setClicks] = useState(0)
  const [seconds, setSeconds] = useState(0)
  const [panelOpen, setPanelOpen] = useState(false)

  useEffect(() => {
    const onKey = () => setKeys((k) => k + 1)
    const onClick = (e: MouseEvent) => {
      if (e.button <= 2) setClicks((c) => c + 1)
    }
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000)
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onClick)
    return () => {
      clearInterval(timer)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onClick)
    }
  }, [])

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')

  return (
    <div className="stats-wrap">
      <button
        className="pixel-btn"
        onClick={(e) => { e.stopPropagation(); setPanelOpen((v) => !v) }}
        onMouseDown={(e) => e.stopPropagation()}
        title="切换统计面板"
      >
        {panelOpen ? '×' : '📊'}
      </button>
      {panelOpen && (
        <div className="stats-panel" onMouseDown={(e) => e.stopPropagation()}>
          <div className="stats-row"><span className="k">⌨ 键击</span><span className="v">{keys.toLocaleString()}</span></div>
          <div className="stats-row"><span className="k">🖱 点击</span><span className="v">{clicks.toLocaleString()}</span></div>
          <div className="stats-row"><span className="k">⏱ 时长</span><span className="v">{mm}:{ss}</span></div>
        </div>
      )}
    </div>
  )
}
