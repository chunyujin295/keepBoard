import { useEffect, useRef } from 'react'

interface Props {
  /** window edge length in px (square window) */
  size: number
  /** True while panels/masks cover the window — disables click-through logic */
  overlayActive?: boolean
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
/** fixed camera tilt on X — gives the 3D look while spin stays single-axis */
const TILT_X = 1.05
/** angular velocity cap (deg/frame): 3.2 ≈ half a revolution per second */
const MAX_VEL = 3.2

interface DragState {
  startX: number
  startY: number
  winX: number
  winY: number
  lastSent: number
}

export default function PetCanvas({ size, overlayActive }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef(0)
  /** spin velocity, deg/frame — 0 at rest, kicked by input, capped at MAX_VEL */
  const vel = useRef(0)
  const dragRef = useRef<DragState | null>(null)
  const ignoreMouseRef = useRef(false)
  const overlayRef = useRef(!!overlayActive)

  const triggerKick = (s: number) => {
    // each event ≈ 1° of swing (scaled by input type); linear, capped
    vel.current = Math.min(MAX_VEL, vel.current + 1.0 * s)
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
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2))
    canvas.width = size * dpr
    canvas.height = size * dpr
    canvas.style.width = size + 'px'
    canvas.style.height = size + 'px'
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const COLS = Math.max(24, Math.round(size / 5))
    const CELL = size / COLS
    const ROWS = COLS
    const K1 = 0.235 * COLS
    const cx = COLS / 2
    const cy = ROWS / 2
    const zbuf = new Float32Array(COLS * ROWS)
    const cbuf = new Uint8Array(COLS * ROWS)

    let B = 0.4
    let colorShift = 0

    const tick = () => {
      // linear spin: integrate velocity, exponential friction, static at rest
      vel.current *= 0.94
      if (vel.current < 0.02) vel.current = 0
      B += (vel.current * Math.PI) / 180
      colorShift += (vel.current / 180) * 0.5

    // fixed camera tilt (3D look) — spin happens on B only
    const cosA = Math.cos(TILT_X), sinA = Math.sin(TILT_X)
    const cosB = Math.cos(B), sinB = Math.sin(B)
      zbuf.fill(0)

      const chars: { x: number; y: number; ch: string; col: string }[] = []
      let j = 0
      for (let th = 0; th < 6.28; th += 0.07) {
        const cosT = Math.cos(th), sinT = Math.sin(th)
        const circlex = R2 + R1 * cosT
        const circley = R1 * sinT
        // dark-rainbow band flowing around the ring, tied to spin speed
        const band = ((th / 6.28 + colorShift) % 1 + 1) % 1
        const col = RAINBOW[Math.floor(band * 16) % 16]
        for (let ph = 0; ph < 6.28; ph += 0.03) {
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
            cbuf[idx] = L > 0 ? Math.min(CHARS.length - 1, (L * 8) | 0) : 0
            chars.push({ x: xp, y: yp, ch: CHARS[cbuf[idx]], col })
          }
        }
        j++
        void j
      }

      ctx.clearRect(0, 0, size, size)
      ctx.font = `${Math.max(9, Math.round(CELL + 3))}px Consolas, "Courier New", monospace`
      ctx.textBaseline = 'top'
      for (const c of chars) {
        ctx.fillStyle = c.col
        ctx.fillText(c.ch, c.x * CELL + 0.5, c.y * CELL)
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    // window content = full square; main-process delta math keeps origin
    window.keepboard?.setContentBox?.({ x: 0, y: 0, w: size, h: size })

    return () => cancelAnimationFrame(rafRef.current)
  }, [size])

  return (
    <canvas
      ref={canvasRef}
      style={{
        imageRendering: 'auto',
        width: size,
        height: size,
        display: 'block',
        cursor: 'grab',
        userSelect: 'none',
        touchAction: 'none'
      }}
      title="左键拖动 · 右键调透明度 · 打字让它转起来"
      onMouseDown={startDrag}
      aria-label="keepBoard 3D 甜甜圈"
    />
  )
}
