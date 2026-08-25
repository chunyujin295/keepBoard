import { useEffect, useRef, useState } from 'react'
import ContextMenu, { MenuData, MenuAction } from '@/components/ContextMenu'
import './index.css'

export default function MenuApp() {
  const [data, setData] = useState<MenuData | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    window.keepboard?.reportMenuReady?.()
    return window.keepboard?.onMenuData?.((d: unknown) => setData(d as MenuData))
  }, [])

  // Keep the host window sized to the menu content so main-process
  // positioning/clamping always matches what is actually rendered.
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const report = () => window.keepboard?.reportMenuHeight?.(el.offsetHeight)
    report()
    const ro = new ResizeObserver(report)
    ro.observe(el)
    return () => ro.disconnect()
  }, [data])

  const handleAction = (a: MenuAction) => {
    window.keepboard?.sendMenuAction?.(a)
  }

  if (!data) return <div className="menu-root" ref={rootRef} />
  return (
    <div className="menu-root" ref={rootRef}>
      <ContextMenu data={data} onAction={handleAction} />
    </div>
  )
}
