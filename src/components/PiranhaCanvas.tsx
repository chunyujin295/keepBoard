import { useEffect, useRef } from 'react'
import { drawPiranha, CANVAS_W, CANVAS_H, PiranhaFrame } from '@/lib/piranha'

export default function PiranhaCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number>(0)
  const startTime = useRef<number>(performance.now())
  const biteUntilRef = useRef<number>(0)
  const extendUntilRef = useRef<number>(0)
  const frenzyUntilRef = useRef<number>(0)
  const blinkUntilRef = useRef<number>(performance.now() + 4000)
  const nextBlinkRef = useRef<number>(performance.now() + 4000)
  const lastKeyTsRef = useRef<number>(0)
  const comboCountRef = useRef<number>(0)

  const triggerBite = (intensity = 1) => {
    const now = performance.now()
    biteUntilRef.current = now + 320 * intensity
    extendUntilRef.current = now + 280 * intensity
    if (now - lastKeyTsRef.current < 180) {
      comboCountRef.current++
      if (comboCountRef.current > 5) {
        frenzyUntilRef.current = now + 900
      }
    } else {
      comboCountRef.current = 1
    }
    lastKeyTsRef.current = now
  }

  useEffect(() => {
    const onKeyDown = () => triggerBite(Math.random() * 0.4 + 0.8)
    const onMouseDown = () => {
      blinkUntilRef.current = performance.now() + 200
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('mousedown', onMouseDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('mousedown', onMouseDown)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2))
    canvas.width = CANVAS_W * dpr
    canvas.height = CANVAS_H * dpr
    canvas.style.width = CANVAS_W + 'px'
    canvas.style.height = CANVAS_H + 'px'
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const tick = () => {
      const now = performance.now()
      const t = (now - startTime.current) / 1000

      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)

      const breathe = 0.05 + 0.05 * Math.sin(t * 2)
      const neckExtendBase = breathe
      const biteProgress = clamp01((biteUntilRef.current - now) / 320)
      const extendProgress = clamp01((extendUntilRef.current - now) / 280)
      const frenzyProgress = clamp01((frenzyUntilRef.current - now) / 900)
      const blinkProgress = clamp01((blinkUntilRef.current - now) / 200)

      if (now >= nextBlinkRef.current) {
        blinkUntilRef.current = now + 180
        nextBlinkRef.current = now + 3500 + Math.random() * 5000
      }

      const mouthOpen =
        frenzyProgress > 0
          ? 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(now / 40))
          : easeOutCubic(1 - biteProgress)

      const neckExtend =
        neckExtendBase +
        easeOutBack(1 - extendProgress) * 0.7 +
        frenzyProgress * 0.3

      const frame: PiranhaFrame = {
        neckExtend,
        mouthOpen,
        eyeClosed: blinkProgress > 0.1 ? 1 - blinkProgress : 0,
        leafSway: t * 1.5 + frenzyProgress * 6,
        shake: frenzyProgress
      }

      drawPiranha(ctx, frame)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const style: React.CSSProperties = {
    imageRendering: 'pixelated',
    width: CANVAS_W,
    height: CANVAS_H,
    display: 'block',
    cursor: 'grab',
    userSelect: 'none',
    touchAction: 'none',
    WebkitAppRegion: 'drag',
    appRegion: 'drag'
  } as React.CSSProperties

  return (
    <canvas
      ref={canvasRef}
      style={style}
      onContextMenu={(e) => e.preventDefault()}
      aria-label="keepBoard 食人花"
    />
  )
}

function clamp01(v: number) { return Math.max(0, Math.min(1, v)) }
function easeOutCubic(x: number): number { return 1 - Math.pow(1 - x, 3) }
function easeOutBack(x: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}
