import { useEffect, useRef } from 'react'
import {
  drawPetPiranha, drawPetCactus, drawPetSlime, drawPetCat, drawPetMushroom,
  drawPetGhost, drawPetDino, drawPetRobot, drawPetPumpkin,
  PetFrame, PET_CANVAS_W, PET_CANVAS_H, PET_PIXEL
} from '@/lib/pets'
import type { ThemeId } from '@/lib/types'

const DRAWERS: Record<ThemeId, (ctx: CanvasRenderingContext2D, f: PetFrame) => void> = {
  piranha: drawPetPiranha,
  cactus: drawPetCactus,
  slime: drawPetSlime,
  cat: drawPetCat,
  mushroom: drawPetMushroom,
  ghost: drawPetGhost,
  dino: drawPetDino,
  robot: drawPetRobot,
  pumpkin: drawPetPumpkin
}

interface Props {
  theme: ThemeId
}

interface DragState {
  startX: number
  startY: number
  winX: number
  winY: number
  lastSent: number
}

export default function PetCanvas({ theme }: Props) {
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
  const dragRef = useRef<DragState | null>(null)

  const triggerBite = (intensity = 1) => {
    const now = performance.now()
    biteUntilRef.current = now + 320 * intensity
    extendUntilRef.current = now + 280 * intensity
    if (now - lastKeyTsRef.current < 180) {
      comboCountRef.current++
      if (comboCountRef.current > 5) frenzyUntilRef.current = now + 900
    } else comboCountRef.current = 1
    lastKeyTsRef.current = now
  }

  const triggerBlink = () => {
    const now = performance.now()
    if (now >= blinkUntilRef.current - 50) blinkUntilRef.current = now + 220
  }

  // Manual window dragging via IPC. CSS `-webkit-app-region: drag` is NOT used:
  // drag regions are non-client areas on Windows and swallow right-clicks
  // (the OS shows the system menu instead of our context menu).
  const startDrag = (e: React.MouseEvent) => {
    if (e.button !== 0 || dragRef.current) return
    triggerBlink()
    window.keepboard?.reportWebClick?.(0)
    const sx = e.screenX
    const sy = e.screenY
    window.keepboard?.getWindowPos?.().then((b: { x: number; y: number } | null) => {
      if (!b) return
      dragRef.current = { startX: sx, startY: sy, winX: b.x, winY: b.y, lastSent: 0 }
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
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    }).catch(() => { })
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2))
    canvas.width = PET_CANVAS_W * dpr
    canvas.height = PET_CANVAS_H * dpr
    canvas.style.width = PET_CANVAS_W + 'px'
    canvas.style.height = PET_CANVAS_H + 'px'
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    void PET_PIXEL

    const drawer = DRAWERS[theme] ?? drawPetPiranha

    const tick = () => {
      const now = performance.now()
      const t = (now - startTime.current) / 1000
      ctx.clearRect(0, 0, PET_CANVAS_W, PET_CANVAS_H)
      const breathe = 0.05 + 0.05 * Math.sin(t * 2)
      const biteProgress = clamp01((biteUntilRef.current - now) / 320)
      const extendProgress = clamp01((extendUntilRef.current - now) / 280)
      const frenzyProgress = clamp01((frenzyUntilRef.current - now) / 900)
      const blinkProgress = clamp01((blinkUntilRef.current - now) / 200)
      if (now >= nextBlinkRef.current) {
        blinkUntilRef.current = now + 180
        nextBlinkRef.current = now + 3500 + Math.random() * 5000
      }
      const mouthOpen = frenzyProgress > 0
        ? 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(now / 40))
        : easeOutCubic(1 - biteProgress)
      const neckExtend = breathe + easeOutBack(1 - extendProgress) * 0.7 + frenzyProgress * 0.3
      const frame: PetFrame = {
        neckExtend,
        mouthOpen,
        eyeClosed: blinkProgress > 0.1 ? 1 - blinkProgress : 0,
        leafSway: t * 1.5 + frenzyProgress * 6,
        shake: frenzyProgress
      }
      drawer(ctx, frame)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [theme])

  // Drive animations from the MAIN PROCESS global input stream (native hook),
  // NOT from DOM events — DOM events only fire when this window is focused.
  // keypress -> bite/chomp, any mouse button press -> blink.
  useEffect(() => {
    const off = window.keepboard?.onInputEvent?.((e: { type: string; subtype?: string }) => {
      if (!e) return
      if (e.type === 'keypress') {
        triggerBite(Math.random() * 0.4 + 0.8)
      } else if (typeof e.type === 'string' && e.type.startsWith('mousedown')) {
        triggerBlink()
      }
    })
    return () => off?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fallback-mode data feed ONLY: forward focused-window keystrokes/clicks to
  // main (which ignores these channels when the native hook is active).
  // Animations are driven exclusively by the broadcast above, so this never
  // causes double animation or event loops.
  useEffect(() => {
    const kd = (e: KeyboardEvent) => { window.keepboard?.reportWebKey?.(e.code || 'AnyKey') }
    window.addEventListener('keydown', kd)
    return () => window.removeEventListener('keydown', kd)
  }, [])

  const style: React.CSSProperties = {
    imageRendering: 'pixelated',
    width: PET_CANVAS_W,
    height: PET_CANVAS_H,
    display: 'block',
    cursor: 'grab',
    userSelect: 'none',
    touchAction: 'none'
  }

  return (
    <canvas
      ref={canvasRef}
      style={style}
      title="左键拖动 · 右键打开菜单"
      onMouseDown={startDrag}
      aria-label="keepBoard 像素宠物"
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
