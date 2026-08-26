import { useEffect, useRef, useState } from 'react'

interface Props {
  /** window edge length in px (square window) */
  size: number
  /** True while panels/masks cover the window — disables click-through logic */
  overlayActive?: boolean
  /** 'donut' | 'sphere' */
  shape?: 'donut' | 'sphere'
}

const CHARS = '.,-~:;=!*#$@'

/** dark-tone rainbow: 16 steps, hue rotates, low lightness */
function hslCss(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)))
  }
  const r = Math.round(f(0) * 255)
  const g = Math.round(f(8) * 255)
  const b = Math.round(f(4) * 255)
  return `rgb(${r},${g},${b})`
}
const RAINBOW = Array.from({ length: 16 }, (_, i) => hslCss(i * 22.5, 0.72, 0.30 + (i % 2) * 0.045))

const R1 = 1, R2 = 2, K2 = 5
/** secondary tumble axis base tilt */
const TILT_BASE = 0.9
/** angular velocity caps (deg/frame): main spin ≈ half rev/sec at cap */
const MAX_VEL_B = 3.2
const MAX_VEL_A = 1.7

interface DragState {
  startX: number
  startY: number
  winX: number
  winY: number
  lastSent: number
}

export default function PetCanvas({ size, overlayActive, shape = 'donut' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef(0)
  /** main spin + secondary tumble, deg/frame — 0 at rest, capped */
  const velB = useRef(0)
  const velA = useRef(0)
  const dragRef = useRef<DragState | null>(null)
  const ignoreMouseRef = useRef(false)
  const overlayRef = useRef(!!overlayActive)
  const [dragging, setDragging] = useState(false)

  const triggerKick = (s: number) => {
    // main spin ≈1°/event; secondary tumble ≈0.45°/event; both capped
    velB.current = Math.min(MAX_VEL_B, velB.current + 1.0 * s)
    velA.current = Math.min(MAX_VEL_A, velA.current + 0.45 * s)
  }

  // ---------------- pixel-perfect mouse pass-through ----------------
  const applyIgnore = (v: boolean) => {
    if (ignoreMouseRef.current === v) return
    ignoreMouseRef.current = v
    window.keepboard?.setIgnoreMouseEvents?.(v, { forward: true })
  }

  useEffect(() => {
    overlayRef.current = !!overlayActive
    if (overlayActive) applyIgnore(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlayActive])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (overlayRef.current || dragRef.current) return
      const canvas = canvasRef.current
      if (!canvas) return
      const r = canvas.getBoundingClientRect()
      const lx = Math.floor(e.clientX - r.left)
      const ly = Math.floor(e.clientY - r.top)
      if (lx < 0 || ly < 0 || lx >= size || ly >= size) return
      const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2))
      const px = canvas.getContext('2d', { willReadFrequently: true })!.getImageData(lx * dpr, ly * dpr, 1, 1).data[3]
      applyIgnore(px < 16)
    }
    const onLeave = () => {
      if (!dragRef.current && !overlayRef.current) applyIgnore(true)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseleave', onLeave)
    document.addEventListener('mouseleave', onLeave)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseleave', onLeave)
      document.removeEventListener('mouseleave', onLeave)
      window.keepboard?.setIgnoreMouseEvents?.(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size])

  // ---------------- dragging ----------------
  const startDrag = (e: React.MouseEvent) => {
    if (e.button !== 0 || dragRef.current) return
    triggerKick(0.5)
    window.keepboard?.reportWebClick?.(0)
    const sx = e.screenX
    const sy = e.screenY
    window.keepboard?.getWindowPos?.().then((b: { x: number; y: number } | null) => {
      if (!b) return
      dragRef.current = { startX: sx, startY: sy, winX: b.x, winY: b.y, lastSent: 0 }
      setDragging(true)
      window.keepboard?.notifyDragStart?.()
      const onMove = (ev: MouseEvent) => {
        const st = dragRef.current
        if (!st) return
        const now = performance.now()
        if (now - st.lastSent < 16) return
        st.lastSent = now
        window.keepboard?.dragWindowTo?.(
          Math.round(st.winX + ev.screenX - st.startX),
          Math.round(st.winY + ev.screenY - st.startY)
        )
      }
      const onUp = () => {
        dragRef.current = null
        setDragging(false)
        window.keepboard?.notifyDragEnd?.()
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    }).catch(() => { })
  }

  // ---------------- global input -> spin impulses ----------------
  useEffect(() => {
    const off = window.keepboard?.onInputEvent?.((e: { type: string }) => {
      if (!e) return
      if (e.type === 'keypress') triggerKick(1)
      else if (e.type === 'wheel') triggerKick(0.35)
      else if (typeof e.type === 'string' && e.type.startsWith('mousedown')) triggerKick(0.8)
    })
    return () => off?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fallback-mode data feed ONLY (ignored by main when native hook is active)
  useEffect(() => {
    const kd = (e: KeyboardEvent) => { window.keepboard?.reportWebKey?.(e.code || 'AnyKey') }
    window.addEventListener('keydown', kd)
    return () => window.removeEventListener('keydown', kd)
  }, [])

  // ---------------- donut render loop ----------------
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const w = window.innerWidth
    const h = window.innerHeight
    const sz = Math.min(w, h)
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2))
    canvas.width = sz * dpr
    canvas.height = sz * dpr
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const COLS = Math.max(20, Math.round(sz / 4.5))
    const CELL = sz / COLS
    const ROWS = COLS
    const K1 = 0.345 * COLS
    const cx = COLS / 2
    const cy = ROWS / 2
    const zbuf = new Float32Array(COLS * ROWS)

    let A = TILT_BASE
    let B = 0.4
    let colorShift = 0

    const tick = () => {
      // dual-axis spin: A tumbles, B main rotation; both kick + decay; static at rest
      velB.current *= 0.94
      velA.current *= 0.94
      if (velB.current < 0.02) velB.current = 0
      if (velA.current < 0.02) velA.current = 0
      A += (velA.current * Math.PI) / 180
      B += (velB.current * Math.PI) / 180
      colorShift += (velB.current / 180) * 0.5

      const cosA = Math.cos(A), sinA = Math.sin(A)
      const cosB = Math.cos(B), sinB = Math.sin(B)
      zbuf.fill(0)

      const chars: { x: number; y: number; ch: string; col: string }[] = []

      if (shape === 'donut') {
        for (let th = 0; th < 6.28; th += 0.07) {
          const cosT = Math.cos(th), sinT = Math.sin(th)
          const circlex = R2 + R1 * cosT
          const circley = R1 * sinT
          const band = ((th / 6.28 + colorShift) % 1 + 1) % 1
          const col = RAINBOW[Math.floor(band * 16) % 16]
          for (let ph = 0; ph < 6.28; ph += 0.04) {
            const cosP = Math.cos(ph), sinP = Math.sin(ph)
            const x = circlex * (cosB * cosP + sinA * sinB * sinP) - circley * sinB * cosA
            const y = circlex * (sinB * cosP - sinA * cosB * sinP) + circley * cosA * sinB
            const z = K2 + cosA * circlex * sinP + circley * sinA
            const ooz = 1 / z
            const xp = Math.round(cx + K1 * ooz * x)
            const yp = Math.round(cy - K1 * ooz * y)
            if (xp < 0 || yp < 0 || xp >= COLS || yp >= ROWS) continue
            const idx = yp * COLS + xp
            if (ooz > zbuf[idx]) {
              zbuf[idx] = ooz
              const L = cosP * cosT * sinB - cosA * sinT * cosB - sinA * sinT + cosB * cosP * cosT
              chars.push({ x: xp, y: yp, ch: L > 0 ? CHARS[Math.min(CHARS.length - 1, (L * 8) | 0)] : ' ', col })
            }
          }
        }
      } else {
        // sphere: rotate longitude with B for color flow, tilt with A for 3D
        for (let lat = -1.35; lat < 1.35; lat += 0.10) {
          const cLat = Math.cos(lat), sLat = Math.sin(lat)
          for (let lon = 0; lon < 6.28; lon += 0.07) {
            const cLon = Math.cos(lon), sLon = Math.sin(lon)
            // surface point on unit sphere
            const x0 = cLat * cLon
            const y0 = sLat
            const z0 = cLat * sLon
            // rotate Y by B, then X by A
            const xr = x0 * cosB + z0 * sinB
            const zr1 = -x0 * sinB + z0 * cosB
            const yr = y0 * cosA - zr1 * sinA
            const zr = y0 * sinA + zr1 * cosA

            const z = 2.2 + zr
            const ooz = 1 / z
            const xp = Math.round(cx + K1 * ooz * xr * 1.5)
            const yp = Math.round(cy - K1 * ooz * yr * 1.5)
            if (xp < 0 || yp < 0 || xp >= COLS || yp >= ROWS) continue
            const idx = yp * COLS + xp
            // lighting: dot(normal, light) — light from top-left-front
            const L = -(xr * 0.45 + yr * 0.55 - zr * 0.7)
            if (ooz > zbuf[idx] && L > 0) {
              zbuf[idx] = ooz
              const band = (((lon + B * 0.5) / 6.28) + colorShift) % 1
              const col = RAINBOW[Math.floor(((band % 1) + 1) % 1 * 16) % 16]
              chars.push({ x: xp, y: yp, ch: CHARS[Math.min(CHARS.length - 1, (L * 9) | 0)], col })
            }
          }
        }
      }

      ctx.clearRect(0, 0, size, size)
      ctx.font = `${Math.max(9, Math.round(CELL + 2))}px Consolas, "Courier New", monospace`
      ctx.textBaseline = 'top'
      for (const c of chars) {
        ctx.fillStyle = c.col
        ctx.fillText(c.ch, c.x * CELL + 0.5, c.y * CELL)
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(rafRef.current)
  }, [shape])

  return (
    <div style={{
      width: '100%',
      height: '100%',
      boxSizing: 'border-box',
      border: dragging ? '1.5px dashed rgba(100,160,255,0.7)' : '1.5px solid transparent',
      background: dragging ? 'rgba(60,120,220,0.18)' : 'transparent',
      transition: 'border-color 0.15s, background 0.15s',
      cursor: 'grab'
    }}>
      <canvas
        ref={canvasRef}
        style={{
          imageRendering: 'auto',
          width: '100%',
          height: '100%',
          display: 'block',
          cursor: 'grab',
          userSelect: 'none',
          touchAction: 'none'
        }}
        title="左键拖动 · 打字让它转起来"
        onMouseDown={startDrag}
        aria-label="keepBoard 3D 甜甜圈"
      />
    </div>
  )
}
