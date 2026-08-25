import { useEffect, useRef, useState } from 'react'
import { drawCustomSprite, PetFrame, PET_CANVAS_W, PET_CANVAS_H } from '@/lib/pets'
import type { ThemeId } from '@/lib/types'
import MANIFEST from '@/assets/pets/manifest.json'

// Vite eager-loads every generated frame so theme switches are instant.
const FRAMES = import.meta.glob('@/assets/pets/*.png', {
  eager: true,
  query: '?url',
  import: 'default'
}) as Record<string, string>

function frameUrl(name: string): string | undefined {
  return FRAMES[`/src/assets/pets/${name}`]
}

interface PetFrames {
  open: HTMLImageElement
  blink: HTMLImageElement
  eyeL: [number, number, number, number] | null
  eyeR: [number, number, number, number] | null
  mouth: [number, number, number] | null
}

const FRAME_CACHE = new Map<string, PetFrames>()

function loadFrames(pet: string): Promise<PetFrames | null> {
  const cached = FRAME_CACHE.get(pet)
  if (cached) return Promise.resolve(cached)
  const def = (MANIFEST as unknown as { pets: Record<string, {
    frames: [string, string]
    eyeL: [number, number, number, number] | null
    eyeR: [number, number, number, number] | null
    mouth: [number, number, number] | null
  }> }).pets[pet]
  if (!def) return Promise.resolve(null)
  const openUrl = frameUrl(def.frames[0])
  const blinkUrl = frameUrl(def.frames[1])
  if (!openUrl || !blinkUrl) return Promise.resolve(null)
  const load = (src: string) => new Promise<HTMLImageElement>((res, rej) => {
    const im = new Image()
    im.onload = () => res(im)
    im.onerror = rej
    im.src = src
  })
  return Promise.all([load(openUrl), load(blinkUrl)]).then(([open, blink]) => {
    const pack: PetFrames = { open, blink, eyeL: def.eyeL, eyeR: def.eyeR, mouth: def.mouth }
    FRAME_CACHE.set(pet, pack)
    return pack
  }).catch(() => null)
}

const DRAWERS: Partial<Record<ThemeId, string>> = {
  piranha: 'piranha', cactus: 'cactus', slime: 'slime', cat: 'cat',
  mushroom: 'mushroom', ghost: 'ghost', dino: 'dino', robot: 'robot',
  pumpkin: 'pumpkin', penguin: 'penguin', alien: 'alien', fox: 'fox'
}

interface Props {
  theme: ThemeId
  /** True while panels/masks cover the window �?disables click-through logic */
  overlayActive?: boolean
  /** Filename of the uploaded custom sprite (reload trigger) */
  customFile?: string
}

interface DragState {
  startX: number
  startY: number
  winX: number
  winY: number
  lastSent: number
}

// Padding around the measured art bounding box so animations don't get clipped
const PAD_L = 5
const PAD_R = 7
const PAD_T = 12
const PAD_B = 3

// Neutral pose for extent measurement
const MEASURE_FRAME: PetFrame = {
  neckExtend: 0.6,
  mouthOpen: 0.35,
  eyeClosed: 0,
  leafSway: 0.7,
  shake: 0
}

export default function PetCanvas({ theme, overlayActive, customFile }: Props) {
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
  const ignoreMouseRef = useRef<boolean>(false)
  const overlayRef = useRef<boolean>(!!overlayActive)
  const customImgRef = useRef<HTMLImageElement | null>(null)
  const framesRef = useRef<PetFrames | null>(null)
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [artReady, setArtReady] = useState(0)

  // ---------------- asset loading ----------------
  useEffect(() => {
    let alive = true
    if (theme === 'custom') {
      window.keepboard?.getCustomPetData?.().then((d: { url: string; stamp: string } | null) => {
        if (!alive) return
        if (!d || !d.url) {
          customImgRef.current = null
          setArtReady((v) => v + 1)
          return
        }
        const im = new Image()
        im.onload = () => {
          if (!alive) return
          customImgRef.current = im
          setArtReady((v) => v + 1)
        }
        im.src = d.url
      }).catch(() => { })
      return () => { alive = false }
    }
    const pet = DRAWERS[theme]
    if (!pet) return
    loadFrames(pet).then((pack) => {
      if (!alive) return
      framesRef.current = pack
      setArtReady((v) => v + 1)
    })
    return () => { alive = false }
  }, [theme, customFile])

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
      if (lx < 0 || ly < 0 || lx >= PET_CANVAS_W || ly >= PET_CANVAS_H) return
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
  }, [])

  // ---------------- dragging (manual IPC; CSS drag regions swallow right-clicks)
  const startDrag = (e: React.MouseEvent) => {
    if (e.button !== 0 || dragRef.current) return
    triggerBlink()
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

  // ---------------- render loop ----------------
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2))
    canvas.width = PET_CANVAS_W * dpr
    canvas.height = PET_CANVAS_H * dpr
    canvas.style.width = PET_CANVAS_W + 'px'
    canvas.style.height = PET_CANVAS_H + 'px'
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    ctx.imageSmoothingEnabled = false
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const isCustom = theme === 'custom'
    const frames = framesRef.current

    const drawer = (c: CanvasRenderingContext2D, f: PetFrame) => {
      if (isCustom) {
        drawCustomSprite(c, f, customImgRef.current)
        return
      }
      if (!frames) return
      const blinking = f.eyeClosed > 0.5
      const img = blinking ? frames.blink : frames.open
      const scale = Math.min((PET_CANVAS_H * 0.78) / 32, (PET_CANVAS_W * 0.72) / 32)
      const w = 32 * scale
      const h = 32 * scale
      const bob = Math.sin(f.leafSway * 1.5) * 2 - f.neckExtend * 4
      const jitX = (Math.random() - 0.5) * 4 * f.shake
      const jitY = (Math.random() - 0.5) * 4 * f.shake
      const sq = Math.min(1, f.mouthOpen)
      const sx = 1 + sq * 0.07
      const sy = 1 - sq * 0.05
      c.save()
      c.imageSmoothingEnabled = false
      c.translate(PET_CANVAS_W / 2 + jitX, PET_CANVAS_H - 30 + jitY)
      c.scale(sx, sy)
      c.drawImage(img, -w / 2, -h + bob, w, h)
      // procedural mouth from manifest rects (32-space -> drawn space)
      if (frames.mouth && sq > 0.15) {
        const [mx, my, mw] = frames.mouth
        const k = scale
        const left = -w / 2 + mx * k
        const top = -h + bob + my * k
        const mh = Math.max(1, Math.round(sq * 3)) * k
        c.fillStyle = '#181828'
        c.fillRect(left, top, mw * k, mh)
      }
      c.restore()
    }

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

    // Shrink-wrap the OS window ONCE per art version: bounds are persisted in
    // the store cache and reused �?never re-measured at runtime.
    const ready = isCustom ? !!customImgRef.current : !!frames
    if (ready) {
      const key = `v4:${isCustom ? `custom:${customFile || ''}` : theme}`
      let alive = true
      window.keepboard?.getSavedBox?.(key).then((saved: { x: number; y: number; w: number; h: number } | null) => {
        if (!alive) return
        if (saved && saved.w > 0 && saved.h > 0) {
          setOffset({ x: saved.x, y: saved.y })
          window.keepboard?.setContentBox?.(saved)
          return
        }
        try {
          const box = measureArt(drawer)
          // Sanity guard: a collapsed measurement (e.g. frame not fully drawn
          // yet) must never shrink-wrap the window to garbage.
          if (box.w < 60 || box.h < 60) return
          void window.keepboard?.saveBox?.(key, box)
          setOffset({ x: box.x, y: box.y })
          window.keepboard?.setContentBox?.(box)
        } catch { /* keep default window size */ }
      }).catch(() => { })
      return () => { alive = false; cancelAnimationFrame(rafRef.current) }
    }

    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, artReady])

  // Drive animations from the MAIN PROCESS global input stream (native hook).
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

  // Fallback-mode data feed ONLY (ignored by main when native hook is active)
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
    touchAction: 'none',
    marginLeft: -offset.x,
    marginTop: -offset.y
  }

  return (
    <canvas
      ref={canvasRef}
      style={style}
      title="左键拖动 · 右键调透明度"
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

function measureArt(drawer: (ctx: CanvasRenderingContext2D, f: PetFrame) => void): { x: number; y: number; w: number; h: number } {
  const c = document.createElement('canvas')
  c.width = PET_CANVAS_W
  c.height = PET_CANVAS_H
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  drawer(ctx, MEASURE_FRAME)
  const img = ctx.getImageData(0, 0, PET_CANVAS_W, PET_CANVAS_H).data
  let minX = PET_CANVAS_W, minY = PET_CANVAS_H, maxX = -1, maxY = -1
  for (let y = 0; y < PET_CANVAS_H; y++) {
    for (let x = 0; x < PET_CANVAS_W; x++) {
      if (img[(y * PET_CANVAS_W + x) << 2 | 3] > 10) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return { x: 0, y: 0, w: PET_CANVAS_W, h: PET_CANVAS_H }
  const bx = Math.max(0, minX - PAD_L)
  const by = Math.max(0, minY - PAD_T)
  const bw = Math.min(PET_CANVAS_W - bx, maxX - minX + 1 + PAD_L + PAD_R)
  const bh = Math.min(PET_CANVAS_H - by, maxY - minY + 1 + PAD_T + PAD_B)
  return { x: bx, y: by, w: bw, h: bh }
}
