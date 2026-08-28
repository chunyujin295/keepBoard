import { useEffect, useRef, useState } from 'react'
import type { DailyStats, LookDef, Settings } from '@/lib/types'
import { WebGLGlyphRenderer, type GlyphInstance } from '@/lib/webglGlyphRenderer'
import { audioEngine, type AudioTheme } from '@/lib/audioEngine'

interface Props {
  /** window edge length in px (square window) */
  size: number
  /** True while panels/masks cover the window — disables click-through logic */
  overlayActive?: boolean
  /** Procedural 3D shape rendered by the pet canvas. */
  shape?: Settings['shape']
  /** resolved background: dark = bright colours, light = dark colours. Only
   *  used for the glow/outline halo polarity — the aesthetic brightness is
   *  `Look.tone`. */
  dark?: boolean
  /** named colour-look preset id (see LOOKS); 'custom' uses `customLook` */
  look?: string
  /** user colour look loaded from keepboard-look.json */
  customLook?: LookDef
  /** character-set style (separate toggle from the colour look) */
  charset?: 'ascii' | 'block' | 'dot' | 'line'
  /** soft halo under the shape */
  glow?: boolean
  /** kick the spin in a random direction on each input, rather than always forward */
  randomSpin?: boolean
  /** Manual responds visually to input; automatic gears move independently. */
  driveMode?: Settings['driveMode']
  /** Extra input pulse / milestone celebration duration. */
  motionPreset?: Settings['motionPreset']
  /** Character grid density. */
  density?: Settings['density']
  /** Add a small left/right wobble to click feedback. */
  jitter?: boolean
  /** Sound theme — 'none' disables input sounds. */
  audioTheme?: AudioTheme
  /** Master volume for the input sounds (0–1). */
  volume?: number
}

/** Character-set ramps. These are a separate toggle from the colour look
 *  (`settings.charset`); a custom look can still override the raw ramp with
 *  `chars`. Shorter ramps (block/dot/line) read chunkier/more pixelated. */
const CHARSETS: Record<string, string> = {
  ascii: '.,-~:;=!*#$@',
  block: '·░▒▓█',
  dot: '·∙•●',
  line: '·-=|\\'
}
const TONES: Record<string, number> = { night: 0.45, dark: 0.65, mid: 0.85, bright: 1.0, high: 1.15 }
const SATS: Record<string, number> = { gray: 0, muted: 0.35, normal: 0.6, vivid: 0.85, neon: 1.0 }

/** Hue stops per palette id (degrees). Two stops = a straight gradient; three =
 *  a two-segment sweep (aurora). */
const HUES: Record<string, number[]> = {
  rainbow: [0, 360],
  neon: [180, 300],
  sunset: [18, 320],
  ocean: [205, 160],
  mono: [42, 42],
  aurora: [140, 300, 180],
  cyber: [300, 180],
  candy: [350, 160],
  gold: [40, 58],
  forest: [90, 160]
}

const LOOKS: Record<string, LookDef> = {
  classic: { tone: 'mid', saturation: 'normal', palette: 'rainbow' },
  neon: { tone: 'bright', saturation: 'neon', palette: 'neon' },
  cyber: { tone: 'high', saturation: 'neon', palette: 'cyber' },
  aurora: { tone: 'dark', saturation: 'vivid', palette: 'aurora' },
  sunset: { tone: 'mid', saturation: 'normal', palette: 'sunset' },
  ocean: { tone: 'mid', saturation: 'normal', palette: 'ocean' },
  forest: { tone: 'dark', saturation: 'vivid', palette: 'forest' },
  candy: { tone: 'mid', saturation: 'muted', palette: 'candy' },
  gold: { tone: 'bright', saturation: 'normal', palette: 'gold' }
}

/** Peak of the torus's luminance term over every orientation, measured
 *  numerically. The ramp MUST be normalised by it: the old code indexed with a
 *  raw `(L * 8) | 0`, so reaching '#' needed L >= 1.125 and '@' needed 1.375 —
 *  unreachable in many poses, which is why the shape faded as it turned and the
 *  bright glyphs went completely unused at some angles. */
const DONUT_LMAX = 1.902

/** 2°-grid land/sea mask for the globe (sphere shape), 180 cols x 90 rows.
 *  Row 0 = 89°N, row 89 = -89°S; col 0 = -180°, col 179 = +178°. '1' = land.
 *  Built from continent bounding boxes then eyeballed as ASCII art, with the
 *  inland seas (Mediterranean, Black, Red, Persian Gulf, Bay of Bengal, South
 *  China Sea, Caribbean, Hudson Bay, Bering/Okhotsk) carved back out. */
const LAND = [
  '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
  '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
  '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
  '000000000000000000000000000000000000000000000000000000000001111111111111111111110000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
  '000000000000000000000000000000000000000000000000000000000001111111111111111111110000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
  '000000000000000000000000000000000000000001111111111111110001111111111111111111110000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
  '000000000000000000000000000000000000000001111111111111110001111111111111111111111000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
  '000000000000000000000000000000000000000001111111111111110000000111111111111111111000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
  '000000011111111111111111111111111111111111111111111111100000000111111111111111111000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
  '000000011111111111111111111111111111111111111111111111100000000111111111111111111000000000000111111111111100000000000000000000000000000000000000000000000000000000000000000000000000',
  '000000011111111111111111111111111111111111111111111111100000000001111110000000000000000000000111111111111100000000000000000000000000000000000000000000000000000000000000000000000000',
  '000000011111111111111111111111111111111111111111111111100000000001111110000000111111100000000111111111111100000000000000000000000000000000000000000000000000000000000000000000000000',
  '000000011111111111111111111111111111111111111111111111100000000001111110000000111111100000000111111111111111111111111111111111111111111111111111111111111111111111111111111111111111',
  '000000000011111111111111111111111111111111100000000011100000000000000000000000111111100000000111111111111111111111111111111111111111111111111111111111111111111111111111111111111111',
  '000000000011111111111111111111111111111111100000000011111100000000000000000000000000000000000111111111111111111111111111111111111111111111111111111111111111111111111111111111111111',
  '000000000011111111111111111111111111111111100000000011110000000000000000000000000000001111110111111111111111111111111111111111111111111111111111111111111111111111111000000000000000',
  '000000000011111111111111111111111111111111100000000011110000000000000000000000000000001111111111111111111111111111111111111111111111111111111111111111111111111111111000000000000000',
  '000000000000000000000000111111111111111111100000000011110000000000000000000000000000001111111111111111111111111111111111111111111111111111111111111111111111111111111000000000000000',
  '000000000000000000000000111111111111111111100000000011110000000000000000000000000000001111111111111111111111111111111111111111111111111111111111111111111111111111111000000000000000',
  '000000000000000000000000111111111111111111100000000011110000000000000000000000000000001111111111111111111111111111111111111111111111111111111111111111111111111111111000000000000000',
  '000000000000000000000000001111111111111111111111111111110000000000000000000000000000001111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111',
  '000000000000000000000000001111111111111111111111111111110000000000000000000000000000001111111111111111110000000011111111111111111111111111111111111111111111111110000000000000000000',
  '000000000000000000000000001111111111111111111111111111110000000000000000000000000000001100000000000000000000000011111111111111111111111111111111111111111111111111110000000000000000',
  '000000000000000000000000001111111111111111111111111111110000000000000000000000000000001100000000000000000000000011111111111111111111111111111111111111111111111111110000000000000000',
  '000000000000000000000000000011111111111111111111111110000000000000000000000000000000001100000000000000000000000011111111111111111111111111111111111111111111111111110000000000000000',
  '000000000000000000000000000011111111111111111111111110000000000000000000000000000000001100000000000000000000000011111111111111111111111111111111111111111111111111110000000000000000',
  '000000000000000000000000000011111111111111111111111110000000000000000000000000000011111100000000000000000000111111111111111111111111111111111111111111110001111111110000000000000000',
  '000000000000000000000000000011111111111111111111111110000000000000000000000000000011111100000000000000000000111111111111111111111111111111111111111111110001111111110000000000000000',
  '000000000000000000000000000011111111111111111111111110000000000000000000000000000011111100000000000000000000111111111111111111111111111111111111111111110001111111110000000000000000',
  '000000000000000000000000000000011111111111100000000000000000000000000000000000000011111100000000000000000000111111111111111111111111111111111111111111110001111111110000000000000000',
  '000000000000000000000000000000011111111111000000000000000000000000000000000000000011111111111111111111111100000001000000111111111111111111111111111111110000000000000000000000000000',
  '000000000000000000000000000000011111111111000000001100000000000000000000000000000011111111111111111111111100000001000000111111111111111111111111111111100000000000000000000000000000',
  '000000000000000000000000000000000000000000000000001100000000000000000000000000000011111111111111111111111100000001000000111111111111111111111111111111100000000000000000000000000000',
  '000000000000000000000000000000000000011111000000000000000000000000000000000000000011111111111111111111111100000001000000111111111111111111111110000000000000000000000000000000000000',
  '000000000000000000000000000000000000011111000000001110000000000000000000000000000010000011111111111111111100000000111111111111111100000000111110000000000000000000000000000000000000',
  '000000000000000000000000000000000000011111000000000000000000000000000000000000000010000011111111111111111100000000011111000011111100000000000000000000000000000000000000000000000000',
  '000000000000000000000000000000000000011111000000000000000000000000000000000000000010000011111111111111111100000000000000000011111100000000000000000000011100000000000000000000000000',
  '000000000000000000000000000000000000011111000000000000000000000000000000000000000010000011111111111111111100000000000000000011111100000000000000000000011100000000000000000000000000',
  '000000000000000000000000000000000000011111111110000000000000100000000000000000000010000011111111111111111100000000000000000011111100000000000000000000011100000000000000000000000000',
  '000000000000000000000000000000000000000000001110000000000000100000000000000000000010000011111111111111111100000000000000000011111100000000000000000000011100000000000000000000000000',
  '000000000000000000000000000000000000000000001110000000000000000000000000000000000011111111111111111111111111111110000000000011111100000000000000000000011100000000000000000000000000',
  '000000000000000000000000000000000000000000001111111111111111000000000000000000000011111111111111111111111111111110000000000011111100000000111110000000011110000000000000000000000000',
  '000000000000000000000000000000000000000000000000001111111111000000000000000000000011111111111111111111111111111110000000000000000000000000111110000000011110000000000000000000000000',
  '000000000000000000000000000000000000000000000000001111111111111111111111100000000011111111111111111111111111111110000000000000000000000000111110000000001110000000000000000000000000',
  '000000000000000000000000000000000000000000000000001111111111111111111111100000000000000000000011111111111111111100000000000000000000000000111110000000000000000000000000000000000000',
  '000000000000000000000000000000000000000000000000001111111111111111111111100000000000000000000011111111111111111100000000000000000000000000111111111111111111111111000000000000000000',
  '000000000000000000000000000000000000000000000000001111111111111111111111100000000000000000000011111111111111111100000000000000000000000000111111111111111111111111111110000000000000',
  '000000000000000000000000000000000000000000000000001111111111111111111111100000000000000000000011111111111111111100000000000000000000000000111111111111111111111111111110000000000000',
  '000000000000000000000000000000000000000000000000001111111111111111111111100000000000000000000011111111111111111100000000000000000000000000111111111111111111111111111110000000000000',
  '000000000000000000000000000000000000000000000000001111111111111111111111100000000000000000000011111111111111111100000000000000000000000000001111111111111111111111111110000000000000',
  '000000000000000000000000000000000000000000000000000011111111111111111111100000000000000000000000111111111111111000000000000000000000000000000000000111111111111111111111000000000000',
  '000000000000000000000000000000000000000000000000000011111111111111111111100000000000000000000000111111111111111011110000000000000000000000000000000111111111111111111111000000000000',
  '000000000000000000000000000000000000000000000000000011111111111111111111100000000000000000000000111111111111111011110000000000000000000000000000000111111111111111111111000000000000',
  '000000000000000000000000000000000000000000000000000011111111111111111111100000000000000000000000111111111111111011110000000000000000000000000000000111111111111111111111000000000000',
  '000000000000000000000000000000000000000000000000000011111111111111111111100000000000000000000000111111111111111011110000000000000000000000000000000111111111111111111111000000000000',
  '000000000000000000000000000000000000000000000000000011111111111111111111100000000000000000000000111111111111111011110000000000000000000000000000000111111111111111111111000000000000',
  '000000000000000000000000000000000000000000000000000011111111111111111111100000000000000000000000111111111111111011110000000000000000000000000000000111111111111111111111000000000000',
  '000000000000000000000000000000000000000000000000000000111111111111111110000000000000000000000000111111111111110011110000000000000000000000000000000111111111111111111111000000000000',
  '000000000000000000000000000000000000000000000000000000111111111111111110000000000000000000000000111111111111110011110000000000000000000000000000000111111111111111111111000000000000',
  '000000000000000000000000000000000000000000000000000000111111111111111110000000000000000000000000111111111111110000000000000000000000000000000000000111111111111111111111000000000000',
  '000000000000000000000000000000000000000000000000000000111111111111111110000000000000000000000000111111111111110000000000000000000000000000000000000111111111111111111111000000000000',
  '000000000000000000000000000000000000000000000000000000111111111111111110000000000000000000000000111111111111110000000000000000000000000000000000000111111111111111111111000000000000',
  '000000000000000000000000000000000000000000000000000001111111111111111110000000000000000000000000000111111000000000000000000000000000000000000000000111111111111111111111000001111111',
  '000000000000000000000000000000000000000000000000000001111111111100000000000000000000000000000000000000000000000000000000000000000000000000000000000111111111111111111111000001111111',
  '000000000000000000000000000000000000000000000000000001111111111100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000111100000001111111',
  '000000000000000000000000000000000000000000000000000001111111111100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000111100000001111111',
  '000000000000000000000000000000000000000000000000000001111111111100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000111100000001111111',
  '000000000000000000000000000000000000000000000000000001111100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000111100000001111111',
  '000000000000000000000000000000000000000000000000000001111100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001111111',
  '000000000000000000000000000000000000000000000000000001111100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
  '000000000000000000000000000000000000000000000000000001111100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
  '000000000000000000000000000000000000000000000000000001111100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
  '000000000000000000000000000000000000000000000000000000111000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
  '000000000000000000000000000000000000000000000000000000111000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
  '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
  '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
  '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
  '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
  '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
  '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
  '111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111',
  '111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111',
  '111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111',
  '111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111',
  '111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111',
  '111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111',
  '111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111',
  '111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111',
  '111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111',
  '111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111'
]

/** Convert HSL to an RGB tuple (0..255). Same math as the old hslCss, but keeps
 *  the components separate so a brightness factor can be applied before the CSS
 *  string is produced. */
function hslRgb(h: number, s: number, l: number): [number, number, number] {
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)))
  }
  return [f(0) * 255, f(8) * 255, f(4) * 255]
}
const css = (c: [number, number, number], bright: number) =>
  `rgb(${Math.max(0, Math.min(255, Math.round(c[0] * bright)))},` +
  `${Math.max(0, Math.min(255, Math.round(c[1] * bright)))},` +
  `${Math.max(0, Math.min(255, Math.round(c[2] * bright)))})`

function parseHex(h: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec((h || '').trim())
  if (!m) return null
  const v = parseInt(m[1], 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}

/** Sample a hue from a (possibly multi-stop) gradient at t in [0,1]. */
function sampleStops(stops: number[], t: number): number {
  if (stops.length === 1) return stops[0]
  const pos = t * (stops.length - 1)
  const a = Math.min(stops.length - 1, Math.floor(pos))
  const b = Math.min(stops.length - 1, a + 1)
  return stops[a] + (stops[b] - stops[a]) * (pos - a)
}

/** 16-step gradient from hue stops at a given saturation and tone (brightness). */
function buildGradient(stops: number[], sat: number, tone: number): string[] {
  return Array.from({ length: 16 }, (_, i) => css(hslRgb(sampleStops(stops, i / 15), sat, 0.6), tone))
}

/** Interpolate a user's hex list up to the 16-step gradient the render needs. */
function makeCustom(colors: string[], tone: number): string[] {
  const c = colors.map(parseHex).filter((x): x is [number, number, number] => !!x)
  if (!c.length) return buildGradient(HUES.rainbow, 0.6, tone)
  return Array.from({ length: 16 }, (_, i) => {
    const t = i / 15
    const pos = t * (c.length - 1)
    const a = Math.min(c.length - 1, Math.floor(pos))
    const b = Math.min(c.length - 1, a + 1)
    const f = pos - a
    const rgb: [number, number, number] = [
      c[a][0] + (c[b][0] - c[a][0]) * f,
      c[a][1] + (c[b][1] - c[a][1]) * f,
      c[a][2] + (c[b][2] - c[a][2]) * f
    ]
    return css(rgb, tone)
  })
}

/** Earth palette for the globe. `shades` precomputes the lighting ramp once per
 *  frame so the per-cell hot loop is a single array index. `tone` scales the
 *  whole thing. */
const shades = (base: [number, number, number], n: number, bright: number, floor: number) =>
  Array.from({ length: n }, (_, i) => {
    const t = bright * (floor + (1 - floor) * (i / (n - 1)))
    const r = Math.round(base[0] * t)
    const g = Math.round(base[1] * t)
    const b = Math.round(base[2] * t)
    return `rgb(${r},${g},${b})`
  })
const GLOBE = {
  // floor 0.62 keeps even the dark side of the ocean a readable blue, so the
  // sphere reads as a solid ball instead of continents floating in black.
  ocean: (bright: number) => shades([58, 132, 205], 8, bright, 0.62),
  land: (bright: number) => shades([72, 156, 74], 8, bright, 0.35),
  ice: (bright: number) => shades([226, 240, 250], 8, bright, 0.6)
}

const R1 = 1, R2 = 2, K2 = 5
/** Fixed projection fit per shape, as a fraction of the canvas: `k` scales the
 *  normalized projection, `ox`/`oy` place its origin.
 *
 *  Derived offline from the union of the projected silhouette over ALL
 *  orientations, sized to 98% of the canvas — the largest constant that never
 *  clips at any pose. Both unions turn out to be centred, so ox/oy are 0.5:
 *  perspective drifts an individual pose's bbox off-centre, but the drift
 *  cancels once you take the union.
 *
 *  These are constants on purpose. Re-fitting per frame fills more of the
 *  window but makes the shape visibly grow/shrink while it spins. */
const FIT = {
  donut: { k: 0.542, ox: 0.5, oy: 0.5 },
  sphere: { k: 0.963, ox: 0.5, oy: 0.5 },
  cube: { k: 1.255, ox: 0.5, oy: 0.5 },
  dna: { k: 1.458, ox: 0.5, oy: 0.5 },
  mobius: { k: 1.077, ox: 0.5, oy: 0.5 },
  heart: { k: 1.9, ox: 0.5, oy: 0.5 },
  saturn: { k: 1.02, ox: 0.5, oy: 0.5 },
  jellyfish: { k: 1.48, ox: 0.5, oy: 0.48 },
  rainbow: { k: 2.3, ox: 0.5, oy: 0.9 },
  fish: { k: 1.16, ox: 0.5, oy: 0.5 }
} as const

/** Hard ceiling on torus samples per frame. Honouring the tightest sampling
 *  pitch outright costs
 *  192k samples at a 640px window (~400M flops/s at 60fps — too hot for JS).
 *  Backing off to 90k measured 99.6% coverage instead of 99.8%: half the work
 *  for two tenths of a percent. */
const MAX_SAMPLES = 90_000

/** Glyph size in px is computed per window inside the effect (see FONT_PX there):
 *  it scales down a little as the window grows, so a large window renders more,
 *  finer characters — the globe especially wants the resolution. */
/** Row pitch as a fraction of the glyph size. The ramp `.,-~:;=!*#$@` has almost
 *  no descenders, so rows can pack a little tighter than a full em. */
const LINE_RATIO = 0.85
/** Grab tolerance in CSS px. The cursor counts as "on the pet" if ANY ink sits
 *  within this radius, so you can grab the shape without landing on a glyph. */
const HIT_RADIUS = 7
/** secondary tumble axis base tilt */
const TILT_BASE = 0.9
/** angular velocity caps (deg/frame): main spin ≈ half rev/sec at cap */
const MAX_VEL_B = 3.2
const MAX_VEL_A = 1.7
/** Manual input fills a target-speed reservoir. The renderer eases toward it,
 * then lets it drain after input stops, giving manual mode a smooth coast. */
const MANUAL_TARGET_DECAY = 0.97
const MANUAL_STEERING = 0.12
/** Rainbow light-sweep physics: input kicks the sweep velocity, the light band
 *  coasts with damping and bounces off each end with energy loss — so it glides
 *  left↔right and settles instead of stepping one node per press. */
const SWEEP_IMPULSE = 0.016
const SWEEP_MAXV = 0.016
const SWEEP_DAMP = 0.95
const SWEEP_BOUNCE = 0.5
/** sweep velocity below which the light is treated as at rest */
const SWEEP_REST = 0.0008
/** Rainbow vertical stretch: a true semicircle is 2:1 wide and would only fill
 *  half the square window; stretching y makes a taller, fuller arch. */
const RAINBOW_SY = 1.35

type SurfacePoint = { x: number; y: number; z: number; nx: number; ny: number; nz: number }
const heartSurfaceCache = new Map<number, SurfacePoint[]>()

/** Lazily voxelise the implicit heart surface once, then rotate/project only
 *  the resulting shell points on subsequent frames. The polynomial is the
 *  classic 3D heart with its pointed axis remapped to screen-up Y. */
function heartSurface(detail: number): SurfacePoint[] {
  const cached = heartSurfaceCache.get(detail)
  if (cached) return cached
  const out: SurfacePoint[] = []
  const n = detail
  const zSteps = Math.round(n * 0.74)
  const tolerance = 0.022 * 70 / n
  for (let ix = 0; ix <= n; ix++) {
    const x = -1.35 + 2.7 * ix / n
    for (let iy = 0; iy <= n; iy++) {
      const y = -1.2 + 2.55 * iy / n
      for (let iz = 0; iz <= zSteps; iz++) {
        const z = -0.78 + 1.56 * iz / zSteps
        const a = x * x + 2.25 * z * z + y * y - 1
        const y3 = y * y * y
        const f = a * a * a - x * x * y3 - 0.1125 * z * z * y3
        if (Math.abs(f) > tolerance) continue
        let nx = 6 * x * a * a - 2 * x * y3
        let ny = 6 * y * a * a - 3 * x * x * y * y - 0.3375 * z * z * y * y
        let nz = 13.5 * z * a * a - 0.225 * z * y3
        const len = Math.hypot(nx, ny, nz)
        if (len < 1e-5) continue
        nx /= len; ny /= len; nz /= len
        out.push({ x, y, z, nx, ny, nz })
      }
    }
  }
  heartSurfaceCache.set(detail, out)
  return out
}

interface DragState {
  startX: number
  startY: number
  winX: number
  winY: number
  lastSent: number
}

type InputImpulse = 'key' | 'click' | 'wheel'

type KickOptions = {
  audio?: boolean
  visual?: boolean
}

const MOTION_MS: Record<NonNullable<Settings['motionPreset']>, number> = {
  off: 0,
  short: 260,
  medium: 520,
  long: 900
}

/** Continuous target velocities for automatic gears. Values are degrees/frame,
 * and `steering` controls how gently the actual velocity approaches the target. */
const AUTO_MOTION: Record<Exclude<Settings['driveMode'], 'manual'>, {
  velB: number
  velA: number
  sweepVelocity: number
  steering: number
  turnIntervalMs: number
}> = {
  'auto-slow': { velB: 0.35, velA: 0.12, sweepVelocity: 0.003, steering: 0.018, turnIntervalMs: 4_500 },
  'auto-medium': { velB: 0.65, velA: 0.23, sweepVelocity: 0.0055, steering: 0.025, turnIntervalMs: 3_300 },
  'auto-fast': { velB: 1.1, velA: 0.38, sweepVelocity: 0.009, steering: 0.035, turnIntervalMs: 2_200 }
}

export default function PetCanvas({ size, overlayActive, shape = 'donut', dark = true, look = 'classic', customLook, charset = 'ascii', glow = false, randomSpin = false, driveMode = 'manual', motionPreset = 'medium', density = 'normal', jitter = true, audioTheme = 'none', volume = 0.5 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef(0)
  const idleTimerRef = useRef<number | null>(null)
  /** Restarts the demand-driven render loop after it has gone idle. */
  const wakeAnimationRef = useRef<() => void>(() => { })
  /** main spin + secondary tumble, deg/frame — 0 at rest, capped */
  const velB = useRef(0)
  const velA = useRef(0)
  const manualTargetB = useRef(0)
  const manualTargetA = useRef(0)
  const dragRef = useRef<DragState | null>(null)
  const ignoreMouseRef = useRef(false)
  const hitGridRef = useRef<{ mask: Uint8Array; cols: number; rows: number } | null>(null)
  const overlayRef = useRef(!!overlayActive)
  const randomSpinRef = useRef(!!randomSpin)
  const driveModeRef = useRef<Settings['driveMode']>(driveMode)
  /** Automatic movement changes direction sparingly; velocity interpolation in
   * the render loop makes each turn arc smoothly instead of snapping. */
  const autoDirectionRef = useRef(1)
  const autoNextTurnRef = useRef(0)
  const motionPresetRef = useRef<Settings['motionPreset']>(motionPreset)
  const impulseTimerRef = useRef<number | null>(null)
  const celebrationTimerRef = useRef<number | null>(null)
  const spinDirRef = useRef(1)
  const impulseRef = useRef({ key: 0, click: 0, wheel: 0, combo: 0 })
  const metricRef = useRef({ frames: 0, evalMs: 0, drawMs: 0, chars: 0, lastLog: performance.now() })
  const milestoneRef = useRef('')
  /** rotation state lives outside the render effect so a resize/shape swap
   *  rebuilds the canvas without snapping the shape back to its start pose */
  const angA = useRef(TILT_BASE)
  const angB = useRef(0.4)
  /** latest shape, mirrored from the prop so triggerKick (captured once in a
   *  [] effect) still sees the currently selected shape. */
  const shapeRef = useRef(shape)
  /** Rainbow light sweep: `pos` walks 0 (left end) → 1 (right end); `vel` is a
   *  signed coasting velocity (sign = travel direction) that bounces off each
   *  end with energy loss, so the light glides and settles. */
  const sweepRef = useRef({ pos: 0, vel: 0 })
  /** Fish route time advances only while the pet is actually in motion. Start
   * halfway through its first route so manual gear opens with a visible fish. */
  const fishClockRef = useRef({ elapsed: 9_090, lastFrame: performance.now() })
  const [dragging, setDragging] = useState(false)
  const [impulse, setImpulse] = useState<InputImpulse | null>(null)
  const [celebration, setCelebration] = useState('')
  /** bumped on window resize — the canvas backing store must be rebuilt */
  const [viewTick, setViewTick] = useState(0)

  const triggerKick = (s: number, kind: InputImpulse = 'key', options: KickOptions = {}) => {
    const playAudio = options.audio !== false
    const showVisual = options.visual !== false
    // The rainbow has no spin; input instead kicks a velocity impulse on its
    // light sweep — the direction follows the current heading (or +1 when at
    // rest), and the end-bounce flip is handled by the per-frame physics.
    if (shapeRef.current === 'rainbow') {
      const c = sweepRef.current
      const dir = c.vel >= 0 ? 1 : -1
      c.vel += dir * SWEEP_IMPULSE
      if (c.vel > SWEEP_MAXV) c.vel = SWEEP_MAXV
      else if (c.vel < -SWEEP_MAXV) c.vel = -SWEEP_MAXV
      if (playAudio) audioEngine.note(kind, impulseRef.current.combo)
      wakeAnimationRef.current()
      return
    }
    // main spin ≈1°/event; secondary tumble ≈0.45°/event; both capped.
    //
    // Random direction has inertia: it is only re-rolled when the spin comes to
    // rest. Rolling per event would make a burst of typing flip direction every
    // press ("左一下右一下") — this way one spin session keeps one direction,
    // and the next fresh start picks a new random one.
    if (randomSpinRef.current && manualTargetB.current === 0 && manualTargetA.current === 0 && velB.current === 0 && velA.current === 0) {
      spinDirRef.current = Math.random() < 0.5 ? -1 : 1
    }
    const dir = randomSpinRef.current ? spinDirRef.current : 1
    manualTargetB.current = Math.max(-MAX_VEL_B, Math.min(MAX_VEL_B, manualTargetB.current + dir * 1.0 * s))
    manualTargetA.current = Math.max(-MAX_VEL_A, Math.min(MAX_VEL_A, manualTargetA.current + dir * 0.45 * s))
    const motionMs = MOTION_MS[motionPresetRef.current ?? 'medium'] ?? MOTION_MS.medium
    if (showVisual && motionMs > 0) {
      if (kind === 'key') {
        impulseRef.current.key = Math.min(1, impulseRef.current.key + 0.9 * s)
        impulseRef.current.combo = Math.min(1, impulseRef.current.combo + 0.18 * s)
      } else if (kind === 'click') {
        impulseRef.current.click = Math.min(1, impulseRef.current.click + 1.0 * s)
      } else {
        impulseRef.current.wheel = Math.min(1, impulseRef.current.wheel + 1.2 * s)
      }
      setImpulse(kind)
      if (impulseTimerRef.current !== null) window.clearTimeout(impulseTimerRef.current)
      impulseTimerRef.current = window.setTimeout(() => {
        setImpulse(null)
        impulseTimerRef.current = null
      }, motionMs)
    }
    if (playAudio) audioEngine.note(kind, impulseRef.current.combo)
    wakeAnimationRef.current()
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
    randomSpinRef.current = !!randomSpin
  }, [randomSpin])

  useEffect(() => {
    driveModeRef.current = driveMode
    if (driveMode !== 'manual') {
      manualTargetB.current = 0
      manualTargetA.current = 0
    }
    autoDirectionRef.current = randomSpin ? (Math.random() < 0.5 ? -1 : 1) : 1
    autoNextTurnRef.current = performance.now()
    // A manual pet can have stopped its demand-driven render loop; wake it as
    // soon as an automatic gear is selected.
    if (driveMode !== 'manual') wakeAnimationRef.current()
  }, [driveMode, randomSpin])

  useEffect(() => {
    shapeRef.current = shape
    // Re-entering the rainbow restarts its light sweep at the left end, at rest.
    if (shape === 'rainbow') sweepRef.current = { pos: 0, vel: 0 }
  }, [shape])

  useEffect(() => {
    motionPresetRef.current = motionPreset
    if (motionPreset === 'off') {
      impulseRef.current = { key: 0, click: 0, wheel: 0, combo: 0 }
      if (impulseTimerRef.current !== null) window.clearTimeout(impulseTimerRef.current)
      if (celebrationTimerRef.current !== null) window.clearTimeout(celebrationTimerRef.current)
      impulseTimerRef.current = null
      celebrationTimerRef.current = null
      setImpulse(null)
      setCelebration('')
    }
  }, [motionPreset])

  // Sounds are independent of motion — mirror the settings into the audio
  // engine so typing/clicking can play even with motion off.
  useEffect(() => {
    audioEngine.setTheme(audioTheme)
  }, [audioTheme])

  useEffect(() => {
    audioEngine.setVolume(volume ?? 0.5)
  }, [volume])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (overlayRef.current || dragRef.current) return
      const canvas = canvasRef.current
      if (!canvas) return
      const r = canvas.getBoundingClientRect()
      const lx = e.clientX - r.left
      const ly = e.clientY - r.top
      if (lx < 0 || ly < 0 || lx >= r.width || ly >= r.height) return
      // Query the CPU-side occupied-cell mask. This avoids synchronously
      // reading pixels back from the GPU on every mousemove.
      const grid = hitGridRef.current
      if (!grid) return
      const gx = Math.floor(lx / r.width * grid.cols)
      const gy = Math.floor(ly / r.height * grid.rows)
      const rx = Math.max(1, Math.ceil(HIT_RADIUS / r.width * grid.cols))
      const ry = Math.max(1, Math.ceil(HIT_RADIUS / r.height * grid.rows))
      let solid = false
      for (let y = Math.max(0, gy - ry); y <= Math.min(grid.rows - 1, gy + ry) && !solid; y++) {
        for (let x = Math.max(0, gx - rx); x <= Math.min(grid.cols - 1, gx + rx); x++) {
          if (grid.mask[y * grid.cols + x]) { solid = true; break }
        }
      }
      applyIgnore(!solid)
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

  // Window size changes arrive as a settings push AND as a native resize; the
  // push can land before the OS has actually resized us, so trust the resize.
  // Guard on the edge length actually changing: dragging the window emits a
  // steady stream of same-size resize events, and rebuilding the canvas on
  // each one makes the shape flicker/jump for the whole drag.
  useEffect(() => {
    let last = Math.min(window.innerWidth, window.innerHeight)
    const onResize = () => {
      const sz = Math.min(window.innerWidth, window.innerHeight)
      if (sz === last) return
      last = sz
      setViewTick((t) => t + 1)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // ---------------- dragging ----------------
  const startDrag = (e: React.MouseEvent) => {
    if (e.button !== 0 || dragRef.current) return
    // The native hook (or the fallback IPC forwarder) delivers the same
    // mousedown to the input listener below. Keeping this handler free of a
    // second kick prevents one click from producing a double flash.
    window.keepboard?.reportWebClick?.(0)
    const sx = e.screenX
    const sy = e.screenY
    window.keepboard?.getWindowPos?.().then((b: { x: number; y: number } | null) => {
      if (!b) return
      dragRef.current = { startX: sx, startY: sy, winX: b.x, winY: b.y, lastSent: 0 }
      let dragStarted = false
      const onMove = (ev: MouseEvent) => {
        const st = dragRef.current
        if (!st) return
        const dx = ev.screenX - st.startX
        const dy = ev.screenY - st.startY
        if (!dragStarted && Math.hypot(dx, dy) < 4) return
        if (!dragStarted) {
          dragStarted = true
          setDragging(true)
          window.keepboard?.notifyDragStart?.()
        }
        const now = performance.now()
        if (now - st.lastSent < 16) return
        st.lastSent = now
        window.keepboard?.dragWindowTo?.(
          Math.round(st.winX + dx),
          Math.round(st.winY + dy)
        )
      }
      const onUp = () => {
        dragRef.current = null
        if (dragStarted) {
          setDragging(false)
          window.keepboard?.notifyDragEnd?.()
        }
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
      const kind: InputImpulse | null = e.type === 'keypress'
        ? 'key'
        : e.type === 'wheel'
          ? 'wheel'
          : typeof e.type === 'string' && e.type.startsWith('mousedown')
            ? 'click'
            : null
      if (!kind) return
      // Sound always follows real input. Only manual gear turns that input into
      // a visible motion impulse; automatic gears are driven by their own loop.
      if (driveModeRef.current === 'manual') triggerKick(kind === 'wheel' ? 0.35 : kind === 'click' ? 0.8 : 1, kind)
      else audioEngine.note(kind, impulseRef.current.combo)
    })
    return () => off?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const off = window.keepboard?.onDaily?.((d: DailyStats) => {
      if (driveModeRef.current !== 'manual') return
      if ((MOTION_MS[motionPresetRef.current ?? 'medium'] ?? MOTION_MS.medium) <= 0) return
      if (!d) return
      const bucket = Math.floor(d.keyboardTotal / 1000)
      const key = `${d.date}:${bucket}`
      if (bucket <= 0 || key === milestoneRef.current) return
      milestoneRef.current = key
      setCelebration(`${bucket * 1000}`)
      impulseRef.current.combo = 1
      triggerKick(1.2, 'key')
      audioEngine.celebrate()
      if (celebrationTimerRef.current !== null) window.clearTimeout(celebrationTimerRef.current)
      celebrationTimerRef.current = window.setTimeout(() => {
        setCelebration('')
        celebrationTimerRef.current = null
      }, Math.max(1800, (MOTION_MS[motionPresetRef.current ?? 'medium'] ?? MOTION_MS.medium) * 2))
    })
    return () => off?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Local visual-QA hook for motion checks without a native Electron input
  // bridge. It is removed from production builds by Vite's DEV constant.
  useEffect(() => {
    if (!import.meta.env.DEV || new URLSearchParams(window.location.search).get('spin') !== '1') return
    triggerKick(0.8, 'key')
    const timer = window.setInterval(() => triggerKick(0.16, 'key'), 180)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fallback-mode data feed ONLY (ignored by main when native hook is active)
  useEffect(() => {
    const kd = (e: KeyboardEvent) => { if (!e.repeat) window.keepboard?.reportWebKey?.(e.code || 'AnyKey') }
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
    canvas.width = Math.round(sz * dpr)
    canvas.height = Math.round(sz * dpr)
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    const measureCanvas = document.createElement('canvas')
    const measureCtx = measureCanvas.getContext('2d')!

    // The cell grid follows the GLYPH's aspect, not a square. A monospace glyph
    // advances ~0.55-0.6em horizontally but occupies a full em vertically, so a
    // square grid can only ever match one axis: size the font to the cell height
    // and ~40% of every cell's width is empty (the shape reads as a dot matrix);
    // size it to the width and rows overprint each other. donut.c solves this by
    // scaling x by 2 for terminal cells — same idea, measured instead of guessed.
    // Glyph size scales down a little as the window grows, so a large window
    // renders finer (the globe in particular needs the resolution).
    // Density controls grid pitch separately from glyph size. In dense mode
    // glyphs overlap slightly, filling holes between characters so rounded
    // ASCII/dot/line surfaces read as solid volume instead of loose points.
    // All three modes keep the surface filled. Sparse has fewer, deliberately
    // larger glyphs; dense has smaller glyphs on a much tighter, overlapping
    // grid. The pitch-to-glyph ratio stays below 1 in every mode.
    const fontScale = density === 'dense' ? 0.82 : density === 'sparse' ? 1.28 : 1
    const pitchScale = density === 'dense' ? 0.62 : density === 'sparse' ? 1.14 : 0.86
    const FONT_PX = Math.max(3.4, Math.min(7.4, (6.6 - (sz - 220) / 420 * 2.4) * fontScale))
    measureCtx.font = `${FONT_PX}px Consolas, "Courier New", monospace`
    const GLYPH_W = measureCtx.measureText('M').width || FONT_PX * 0.6
    const GLYPH_H = FONT_PX * LINE_RATIO
    const CELL_W = GLYPH_W * pitchScale
    const CELL_H = GLYPH_H * pitchScale
    const COLS = Math.max(20, Math.round(sz / CELL_W))
    const ROWS = Math.max(20, Math.round(sz / CELL_H))
    const zbuf = new Float32Array(COLS * ROWS)

    // Fixed projection fit (see FIT). Deliberately NOT re-fitted per frame:
    // a per-pose fit fills more of the window but visibly rescales the shape as
    // it spins, and a spin is exactly what a drag/keypress triggers.
    //
    // The fit is a fraction of the canvas in PIXELS; converting to cell indices
    // is just dividing by the cell size, i.e. scaling by COLS on x and ROWS on
    // y. Same pixel scale on both axes => the shape stays undistorted.
    const resolved = customLook ?? (LOOKS[look] ?? LOOKS.classic)
    const tone = TONES[resolved.tone ?? 'mid'] ?? 0.85
    const sat = SATS[resolved.saturation ?? 'normal'] ?? 0.6
    const PALETTE = resolved.colors?.length
      ? makeCustom(resolved.colors, tone)
      : buildGradient(HUES[resolved.palette ?? 'rainbow'] ?? HUES.rainbow, sat, tone)
    const OCEAN = GLOBE.ocean(tone)
    const LANDC = GLOBE.land(tone)
    const ICE = GLOBE.ice(tone)
    const CHARS = resolved.chars ?? (CHARSETS[charset] ?? CHARSETS.ascii)
    const gamma = resolved.gamma ?? 0.6
    const glyphContrast = charset === 'block' ? 1 : 1.22
    const NCH = CHARS.length
    /** normalised shade in [0,1] -> ramp index */
    const glyph = (s: number) => {
      const contrasted = Math.max(0, Math.min(1, (s - (1 - 1 / glyphContrast) * 0.5) * glyphContrast))
      return CHARS[Math.min(NCH - 1, Math.max(0, (Math.pow(contrasted, gamma) * NCH) | 0))]
    }

    let gpu: WebGLGlyphRenderer | null = null
    const forceCanvas2d = import.meta.env.DEV &&
      new URLSearchParams(window.location.search).get('renderer') === 'canvas2d'
    if (!forceCanvas2d) {
      try {
        gpu = WebGLGlyphRenderer.create(canvas, {
          cols: COLS, rows: ROWS, cellWidth: CELL_W, cellHeight: CELL_H,
          glyphWidth: GLYPH_W, glyphHeight: GLYPH_H,
          cssWidth: sz, cssHeight: sz, chars: CHARS, fontPx: FONT_PX,
          dark, glow
        })
      } catch (error) {
        console.warn('[keepBoard] WebGL2 glyph renderer failed:', error)
      }
    }
    const ctx = gpu ? null : canvas.getContext('2d')
    if (!gpu && !ctx) return
    if (ctx) canvas.dataset.renderer = 'canvas2d'
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)

    const fit = FIT[shape]
    const K1x = fit.k * COLS
    const K1y = fit.k * ROWS
    const cx = fit.ox * COLS
    const cy = fit.oy * ROWS

    // Sampling steps derived from how many cells one unit of 3D length spans at
    // the NEAREST point of the torus — that's where samples spread out most.
    // Use the denser axis (x) so neither axis under-samples.
    const cellsPerUnit = K1x / (K2 - (R1 + R2))
    // Denser character grids need denser surface samples as well. Otherwise
    // the glyphs overlap but the torus still has unvisited grid cells between
    // samples, which reads as a hollow perforated surface.
    const sampleGap = density === 'dense' ? 0.58 : density === 'sparse' ? 1.45 : 1.0
    const sampleBudget = density === 'dense'
      ? Math.min(220_000, Math.max(120_000, Math.ceil(COLS * ROWS * 0.75)))
      : Math.min(140_000, Math.max(MAX_SAMPLES, Math.ceil(COLS * ROWS * 0.5)))
    let dTh = sampleGap / cellsPerUnit
    let dPh = sampleGap / (cellsPerUnit * (R1 + R2))
    // Back both steps off together if the budget is blown, so the sampling stays
    // proportioned the same way (th is R1 across, ph is R1+R2 across).
    const over = (6.283 / dTh) * (6.283 / dPh) / sampleBudget
    if (over > 1) { const f = Math.sqrt(over); dTh *= f; dPh *= f }
    const NTH = Math.ceil(6.283 / dTh)
    const NPH = Math.ceil(6.283 / dPh)
    // Trig tables: these angles are fixed for the life of the canvas, so hoist
    // every cos/sin out of a loop that runs ~90k times per frame at 640px.
    const cosTh = new Float32Array(NTH), sinTh = new Float32Array(NTH)
    for (let i = 0; i < NTH; i++) { cosTh[i] = Math.cos(i * dTh); sinTh[i] = Math.sin(i * dTh) }
    const cosPh = new Float32Array(NPH), sinPh = new Float32Array(NPH)
    for (let i = 0; i < NPH; i++) { cosPh[i] = Math.cos(i * dPh); sinPh[i] = Math.sin(i * dPh) }

    // Reuse cells across frames. At large sizes the torus can emit thousands
    // of glyphs per frame; retaining this small pool avoids creating and
    // collecting the same number of short-lived objects on every tick.
    const chars: GlyphInstance[] = []
    const hitMask = new Uint8Array(COLS * ROWS)
    hitGridRef.current = { mask: hitMask, cols: COLS, rows: ROWS }
    let charCount = 0
    const addChar = (x: number, y: number, ch: string, col: string) => {
      const cell = chars[charCount]
      if (cell) {
        cell.x = x; cell.y = y; cell.ch = ch; cell.col = col
      } else {
        chars.push({ x, y, ch, col })
      }
      charCount++
    }
    const metricsEnabled = import.meta.env.DEV && new URLSearchParams(window.location.search).get('metrics') === '1'

    const tick = () => {
      rafRef.current = 0
      const frameStart = performance.now()
      const autoMode = driveModeRef.current
      const auto = autoMode === 'manual' ? null : AUTO_MOTION[autoMode]
      if (auto) {
        // Automatic movement is a continuous target speed, rather than a
        // sequence of short impulses. This keeps slow gear visibly in motion
        // at all times and lets turns curve into their new direction.
        if (randomSpinRef.current && frameStart >= autoNextTurnRef.current) {
          autoDirectionRef.current = Math.random() < 0.5 ? -1 : 1
          autoNextTurnRef.current = frameStart + auto.turnIntervalMs
        } else if (!randomSpinRef.current) {
          autoDirectionRef.current = 1
        }
        const dir = autoDirectionRef.current
        velB.current += (dir * auto.velB - velB.current) * auto.steering
        velA.current += (dir * auto.velA - velA.current) * auto.steering
      } else {
        // Input changes the target speed; actual velocity follows it rather
        // than jumping instantly. Once input ceases, the target drains away
        // and the pet glides to rest without the old pulse-by-pulse feel.
        manualTargetB.current *= MANUAL_TARGET_DECAY
        manualTargetA.current *= MANUAL_TARGET_DECAY
        if (Math.abs(manualTargetB.current) < 0.01) manualTargetB.current = 0
        if (Math.abs(manualTargetA.current) < 0.01) manualTargetA.current = 0
        velB.current += (manualTargetB.current - velB.current) * MANUAL_STEERING
        velA.current += (manualTargetA.current - velA.current) * MANUAL_STEERING
        if (Math.abs(velB.current) < 0.02) velB.current = 0
        if (Math.abs(velA.current) < 0.02) velA.current = 0
      }
      impulseRef.current.key *= 0.86
      impulseRef.current.click *= 0.78
      impulseRef.current.wheel *= 0.9
      impulseRef.current.combo *= 0.965
      angA.current += (velA.current * Math.PI) / 180
      angB.current += (velB.current * Math.PI) / 180

      // Rainbow light-sweep physics: coast, damp, and bounce off each end with
      // an energy loss so the light glides and settles with a little overshoot.
      if (shape === 'rainbow') {
        const c = sweepRef.current
        c.pos += c.vel
        if (c.pos >= 1) { c.pos = 1; c.vel = -Math.abs(c.vel) * SWEEP_BOUNCE }
        else if (c.pos <= 0) { c.pos = 0; c.vel = Math.abs(c.vel) * SWEEP_BOUNCE }
        c.vel *= SWEEP_DAMP
        if (auto) {
          const target = autoDirectionRef.current * auto.sweepVelocity
          c.vel += (target - c.vel) * auto.steering
        } else if (Math.abs(c.vel) < SWEEP_REST) c.vel = 0
      }

      // A full end-over-end tumble makes the long DNA silhouette collapse to
      // a short line for much of the rotation. Keep its secondary axis as a
      // bounded sway while the main axis still spins freely, so it maintains
      // desktop-pet-scale coverage without dynamic zooming.
      const A = shape === 'dna'
        ? Math.sin(angA.current - TILT_BASE) * 0.25
        : shape === 'heart'
          ? Math.sin(angA.current - TILT_BASE) * 0.22
        : shape === 'saturn'
          // A Y-axis spin is invisible on an axially symmetric planet/ring.
          // Couple the main B rotation into a bounded precession so input
          // produces an obvious change in ring tilt without ever going flat.
          ? 0.54 + Math.sin(angB.current * 2.2) * 0.38 +
            Math.sin(angA.current - TILT_BASE) * 0.1
          : shape === 'jellyfish'
            ? Math.sin(angA.current - TILT_BASE) * 0.18
            : angA.current
      const B = shape === 'heart'
        ? Math.sin(angB.current - 0.4) * 0.35
        : angB.current
      // Keep the palette anchored to the shape. Rotation should change the
      // silhouette and lighting, not leave the pet parked on a darker palette
      // band after the input impulse settles.
      const colorShift = 0
      const cosA = Math.cos(A), sinA = Math.sin(A)
      const cosB = Math.cos(B), sinB = Math.sin(B)
      zbuf.fill(0)
      hitMask.fill(0)

      charCount = 0

      if (shape === 'donut') {
        for (let i = 0; i < NTH; i++) {
          const cosT = cosTh[i], sinT = sinTh[i]
          const circlex = R2 + R1 * cosT
          const circley = R1 * sinT
          const band = ((i / NTH + colorShift) % 1 + 1) % 1
          const col = PALETTE[Math.floor(band * 16) % 16]
          for (let j = 0; j < NPH; j++) {
            const cosP = cosPh[j], sinP = sinPh[j]
            const x = circlex * (cosB * cosP + sinA * sinB * sinP) - circley * sinB * cosA
            const y = circlex * (sinB * cosP - sinA * cosB * sinP) + circley * cosA * sinB
            const ooz = 1 / (K2 + cosA * circlex * sinP + circley * sinA)
            const xp = Math.round(cx + K1x * ooz * x)
            const yp = Math.round(cy - K1y * ooz * y)
            if (xp < 0 || yp < 0 || xp >= COLS || yp >= ROWS) continue
            const idx = yp * COLS + xp
            if (ooz > zbuf[idx]) {
              zbuf[idx] = ooz
              const L = cosP * cosT * sinB - cosA * sinT * cosB - sinA * sinT + cosB * cosP * cosT
              if (L > 0) addChar(xp, yp, glyph(L / DONUT_LMAX), col)
            }
          }
        }
      } else if (shape === 'cube') {
        // Screen-space ray/box intersection fills every visible cell exactly
        // once. Surface sampling left holes after the cube was scaled up to
        // fill the window, especially at 480/640px.
        const half = 1.05
        const invKx = 1 / K1x, invKy = 1 / K1y
        for (let yp = 0; yp < ROWS; yp++) {
          const rv = -(yp - cy) * invKy
          for (let xp = 0; xp < COLS; xp++) {
            const ru = (xp - cx) * invKx
            // Camera ray p(t)=(ru*t, rv*t, t-K2), transformed back to object space.
            const oy1 = -K2 * sinA, oz1 = -K2 * cosA
            const ox = -oz1 * sinB, oy = oy1, oz = oz1 * cosB
            const dy1 = rv * cosA + sinA
            const dz1 = -rv * sinA + cosA
            const dx = ru * cosB - dz1 * sinB
            const dy = dy1
            const dz = ru * sinB + dz1 * cosB
            let near = -Infinity, far = Infinity
            let nx = 0, ny = 0, nz = 0
            let miss = false
            if (Math.abs(dx) < 1e-8) {
              if (ox < -half || ox > half) miss = true
            } else {
              let t1 = (-half - ox) / dx, t2 = (half - ox) / dx, sign = -1
              if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; sign = 1 }
              if (t1 > near) { near = t1; nx = sign; ny = 0; nz = 0 }
              if (t2 < far) far = t2
              if (near > far) miss = true
            }
            if (!miss) {
              if (Math.abs(dy) < 1e-8) {
                if (oy < -half || oy > half) miss = true
              } else {
                let t1 = (-half - oy) / dy, t2 = (half - oy) / dy, sign = -1
                if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; sign = 1 }
                if (t1 > near) { near = t1; nx = 0; ny = sign; nz = 0 }
                if (t2 < far) far = t2
                if (near > far) miss = true
              }
            }
            if (!miss) {
              if (Math.abs(dz) < 1e-8) {
                if (oz < -half || oz > half) miss = true
              } else {
                let t1 = (-half - oz) / dz, t2 = (half - oz) / dz, sign = -1
                if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; sign = 1 }
                if (t1 > near) { near = t1; nx = 0; ny = 0; nz = sign }
                if (t2 < far) far = t2
                if (near > far) miss = true
              }
            }
            if (miss || far <= 0) continue
            const nnx1 = nx * cosB + nz * sinB
            const nnz1 = -nx * sinB + nz * cosB
            const nny = ny * cosA - nnz1 * sinA
            const nnz = ny * sinA + nnz1 * cosA
            const light = Math.max(0.14, -0.45 * nnx1 + 0.55 * nny - 0.7 * nnz)
            const face = nx ? (nx > 0 ? 0 : 1) : ny ? (ny > 0 ? 2 : 3) : (nz > 0 ? 4 : 5)
            const band = (face / 6 + colorShift + 1) % 1
            addChar(xp, yp, glyph(Math.min(1, light)), PALETTE[(band * 16) | 0])
          }
        }
      } else if (shape === 'dna') {
        // Two phase-opposed helices plus base-pair rungs. This is deliberately
        // curve-based: it remains crisp while costing far less than a surface.
        const turns = 3
        const end = Math.PI * turns
        const steps = Math.max(700, Math.min(2400, COLS * 10))
        const plotDna = (x0: number, y0: number, z0: number, shade: number, col: string) => {
          const x1 = x0 * cosB + z0 * sinB
          const z1 = -x0 * sinB + z0 * cosB
          const x = x1, y = y0 * cosA - z1 * sinA, z = y0 * sinA + z1 * cosA
          const ooz = 1 / (K2 + z)
          const xp = Math.round(cx + K1x * ooz * x)
          const yp = Math.round(cy - K1y * ooz * y)
          if (xp < 0 || yp < 0 || xp >= COLS || yp >= ROWS) return
          const idx = yp * COLS + xp
          if (ooz <= zbuf[idx]) return
          zbuf[idx] = ooz
          addChar(xp, yp, glyph(shade), col)
        }
        for (let i = 0; i <= steps; i++) {
          const t = -end + (2 * end * i) / steps
          const y = t / end * 1.45
          for (let strand = 0; strand < 2; strand++) {
            const phase = t + strand * Math.PI
            const z = 0.66 * Math.sin(phase)
            const shade = 0.55 + 0.4 * ((z + 0.66) / 1.32)
            const band = ((i / steps) + strand * 0.5 + colorShift + 1) % 1
            plotDna(0.66 * Math.cos(phase), y, z, shade, PALETTE[(band * 16) | 0])
          }
        }
        const rungs = 13
        for (let rung = 0; rung < rungs; rung++) {
          const t = -end + (2 * end * rung) / (rungs - 1)
          const y = t / end * 1.45
          const x = 0.66 * Math.cos(t), z = 0.66 * Math.sin(t)
          const rungSteps = Math.max(18, Math.round(COLS * 0.18))
          for (let j = 0; j <= rungSteps; j++) {
            const q = -1 + (2 * j) / rungSteps
            const band = ((rung / rungs) + colorShift + 1) % 1
            plotDna(x * q, y, z * q, 0.72, PALETTE[(band * 16) | 0])
          }
        }
      } else if (shape === 'mobius') {
        const nu = Math.max(100, Math.min(360, Math.ceil(COLS * 1.4)))
        const nv = Math.max(18, Math.min(90, Math.ceil(ROWS * 0.32)))
        const radius = 1.45, width = 0.62
        for (let iu = 0; iu < nu; iu++) {
          const u = 2 * Math.PI * iu / nu
          const cu = Math.cos(u), su = Math.sin(u)
          const ch = Math.cos(u / 2), sh = Math.sin(u / 2)
          for (let iv = 0; iv <= nv; iv++) {
            const v = -width + 2 * width * iv / nv
            const q = radius + v * ch
            const x0 = q * cu, y0 = q * su, z0 = v * sh
            // Analytic normal: cross(partial p / partial u, partial p / partial v).
            const ux = -q * su - 0.5 * v * sh * cu
            const uy = q * cu - 0.5 * v * sh * su
            const uz = 0.5 * v * ch
            const vx = ch * cu, vy = ch * su, vz = sh
            let nx = uy * vz - uz * vy
            let ny = uz * vx - ux * vz
            let nz = ux * vy - uy * vx
            const nl = Math.hypot(nx, ny, nz) || 1
            nx /= nl; ny /= nl; nz /= nl
            const x1 = x0 * cosB + z0 * sinB
            const z1 = -x0 * sinB + z0 * cosB
            const x = x1, y = y0 * cosA - z1 * sinA, z = y0 * sinA + z1 * cosA
            const nnx1 = nx * cosB + nz * sinB
            const nnz1 = -nx * sinB + nz * cosB
            const nny = ny * cosA - nnz1 * sinA
            const nnz = ny * sinA + nnz1 * cosA
            const ooz = 1 / (K2 + z)
            const xp = Math.round(cx + K1x * ooz * x)
            const yp = Math.round(cy - K1y * ooz * y)
            if (xp < 0 || yp < 0 || xp >= COLS || yp >= ROWS) continue
            const idx = yp * COLS + xp
            if (ooz <= zbuf[idx]) continue
            zbuf[idx] = ooz
            const light = Math.max(0.12, Math.abs(-0.45 * nnx1 + 0.55 * nny - 0.7 * nnz))
            const band = (iu / nu + colorShift + 1) % 1
            addChar(xp, yp, glyph(Math.min(1, light)), PALETTE[(band * 16) | 0])
          }
        }
      } else if (shape === 'heart') {
        // Larger windows get a denser cached voxel shell; a fixed 70³ grid
        // leaves the heart's curved lobes perforated once character cells grow.
        const heartDetail = Math.min(112, Math.max(70, Math.round(sz / 5 * (density === 'dense' ? 1.1 : 1))))
        const points = heartSurface(heartDetail)
        for (let i = 0; i < points.length; i++) {
          const p = points[i]
          const x1 = p.x * cosB + p.z * sinB
          const z1 = -p.x * sinB + p.z * cosB
          const x = x1, y = p.y * cosA - z1 * sinA, z = p.y * sinA + z1 * cosA
          const nnx1 = p.nx * cosB + p.nz * sinB
          const nnz1 = -p.nx * sinB + p.nz * cosB
          const nny = p.ny * cosA - nnz1 * sinA
          const nnz = p.ny * sinA + nnz1 * cosA
          const ooz = 1 / (K2 + z)
          const xp = Math.round(cx + K1x * ooz * x)
          const yp = Math.round(cy - K1y * ooz * y)
          if (xp < 0 || yp < 0 || xp >= COLS || yp >= ROWS) continue
          const idx = yp * COLS + xp
          if (ooz <= zbuf[idx]) continue
          zbuf[idx] = ooz
          const light = Math.max(0.1, -0.45 * nnx1 + 0.55 * nny - 0.7 * nnz)
          const band = ((p.y + 1.2) / 2.55 + colorShift + 1) % 1
          addChar(xp, yp, glyph(Math.min(1, light)), PALETTE[(band * 16) | 0])
        }
      } else if (shape === 'saturn') {
        // One object-space ray tests both the planet and its ring; selecting
        // the nearest positive t gives correct front/back ring occlusion.
        const invKx = 1 / K1x, invKy = 1 / K1y
        const oy1 = -K2 * sinA, oz1 = -K2 * cosA
        const ox = -oz1 * sinB, oy = oy1, oz = oz1 * cosB
        const roll = Math.sin(angB.current * 1.45) * 0.42
        const cosR = Math.cos(roll), sinR = Math.sin(roll)
        const planetR = 0.9, ringInner = 1.22, ringOuter = 2.05
        for (let yp = 0; yp < ROWS; yp++) {
          const rv = -(yp - cy) * invKy
          for (let xp = 0; xp < COLS; xp++) {
            const ru = (xp - cx) * invKx
            // Inverse screen-space roll, then inverse X/Y model rotations.
            const rdx = ru * cosR + rv * sinR
            const rdy = -ru * sinR + rv * cosR
            const dy1 = rdy * cosA + sinA
            const dz1 = -rdy * sinA + cosA
            const dx = rdx * cosB - dz1 * sinB
            const dy = dy1
            const dz = ru * sinB + dz1 * cosB
            let planetT = Infinity
            const qa = dx * dx + dy * dy + dz * dz
            const qb = 2 * (ox * dx + oy * dy + oz * dz)
            const qc = ox * ox + oy * oy + oz * oz - planetR * planetR
            const disc = qb * qb - 4 * qa * qc
            if (disc >= 0) {
              const root = Math.sqrt(disc)
              const t1 = (-qb - root) / (2 * qa), t2 = (-qb + root) / (2 * qa)
              planetT = t1 > 0 ? t1 : t2 > 0 ? t2 : Infinity
            }
            let ringT = Infinity, ringRadius = 0
            if (Math.abs(dy) > 1e-7) {
              const t = -oy / dy
              if (t > 0) {
                const rx = ox + dx * t, rz = oz + dz * t
                const rr = Math.hypot(rx, rz)
                if (rr >= ringInner && rr <= ringOuter) { ringT = t; ringRadius = rr }
              }
            }
            if (!Number.isFinite(planetT) && !Number.isFinite(ringT)) continue
            if (ringT < planetT) {
              const nny = cosA * cosR, nnz = sinA
              const nnx = -cosA * sinR
              const light = Math.max(0.3, Math.abs(-0.45 * nnx + 0.55 * nny - 0.7 * nnz))
              const rx = ox + dx * ringT, rz = oz + dz * ringT
              const azimuth = (Math.atan2(rz, rx) / (2 * Math.PI) + 1) % 1
              const band = ((ringRadius - ringInner) / (ringOuter - ringInner) * 0.38 +
                azimuth * 0.42 + colorShift + 1) % 1
              const sectors = 0.76 + 0.24 * Math.sin(azimuth * Math.PI * 8)
              addChar(xp, yp, glyph(Math.min(1, light * sectors)), PALETTE[(band * 16) | 0])
            } else {
              const hx = ox + dx * planetT, hy = oy + dy * planetT, hz = oz + dz * planetT
              const nx = hx / planetR, ny = hy / planetR, nz = hz / planetR
              const nnx1 = nx * cosB + nz * sinB
              const nnz1 = -nx * sinB + nz * cosB
              const nny1 = ny * cosA - nnz1 * sinA
              const nnz = ny * sinA + nnz1 * cosA
              const nnx = nnx1 * cosR - nny1 * sinR
              const nny = nnx1 * sinR + nny1 * cosR
              const light = Math.max(0.16, -0.45 * nnx + 0.55 * nny - 0.7 * nnz)
              const longitude = Math.atan2(hz, hx)
              const belts = 0.06 * Math.sin(longitude * 3 + hy * 7)
              const band = ((hy / planetR + 1) * 0.42 + longitude / (2 * Math.PI) * 0.24 +
                colorShift + 1) % 1
              addChar(xp, yp, glyph(Math.min(1, light + belts)), PALETTE[(band * 16) | 0])
            }
          }
        }
      } else if (shape === 'jellyfish') {
        const phase = performance.now() * 0.002
        const pulse = 1 + 0.045 * Math.sin(phase)
        const plotJelly = (x0: number, y0: number, z0: number, shade: number, band: number) => {
          const x1 = x0 * cosB + z0 * sinB
          const z1 = -x0 * sinB + z0 * cosB
          const x = x1, y = y0 * cosA - z1 * sinA, z = y0 * sinA + z1 * cosA
          const ooz = 1 / (K2 + z)
          const xp = Math.round(cx + K1x * ooz * x)
          const yp = Math.round(cy - K1y * ooz * y)
          if (xp < 0 || yp < 0 || xp >= COLS || yp >= ROWS) return
          const idx = yp * COLS + xp
          if (ooz <= zbuf[idx]) return
          zbuf[idx] = ooz
          addChar(xp, yp, glyph(Math.min(1, shade)), PALETTE[((band + colorShift + 1) % 1 * 16) | 0])
        }
        const nu = Math.max(90, Math.min(360, Math.ceil(COLS * 1.6)))
        const nv = Math.max(20, Math.min(90, Math.ceil(ROWS * 0.34)))
        for (let iu = 0; iu < nu; iu++) {
          const u = 2 * Math.PI * iu / nu, cu = Math.cos(u), su = Math.sin(u)
          for (let iv = 0; iv <= nv; iv++) {
            const v = Math.PI * 0.5 * iv / nv
            const sv = Math.sin(v), cv = Math.cos(v)
            const x0 = 0.96 * pulse * sv * cu
            const y0 = 0.42 + 0.82 * cv
            const z0 = 0.96 * pulse * sv * su
            const nx = sv * cu, ny = cv, nz = sv * su
            const nnx1 = nx * cosB + nz * sinB
            const nnz1 = -nx * sinB + nz * cosB
            const nny = ny * cosA - nnz1 * sinA
            const nnz = ny * sinA + nnz1 * cosA
            const light = Math.max(0.16, -0.45 * nnx1 + 0.55 * nny - 0.7 * nnz)
            plotJelly(x0, y0, z0, light, iu / nu)
          }
        }
        const tentacles = 9
        const lineSteps = Math.max(90, Math.min(300, Math.ceil(ROWS * 1.2)))
        for (let line = 0; line < tentacles; line++) {
          const anchor = -0.74 + 1.48 * line / (tentacles - 1)
          const depth = 0.18 * Math.sin(line * 2.1)
          for (let j = 0; j <= lineSteps; j++) {
            const q = j / lineSteps
            const wave = 0.11 * q * Math.sin(q * 7 + phase * 1.35 + line * 0.8)
            const x0 = anchor * (1 - 0.16 * q) + wave
            const y0 = 0.39 - 1.86 * q
            const z0 = depth + 0.08 * q * Math.cos(q * 6 + phase + line)
            plotJelly(x0, y0, z0, 0.48 + 0.45 * (1 - q), line / tentacles)
          }
        }
      } else if (shape === 'rainbow') {
        // Rainbow as a set of concentric 3D tube arcs (a "semi-torus" per
        // colour band). Each band is a circular-cross-section tube with its own
        // radius and colour, so the arch reads as solid lit pipes rather than a
        // flat silhouette. Animation is a TRAVELLING WAVE: the whole arch
        // undulates like a ribbon in the wind — input drives the wave phase
        // forward (with inertia and end-bounce) and the wave amplitude grows
        // with speed; at rest it settles into a slow idle swell. The entire
        // silhouette moving makes the motion unmistakable, unlike a single local
        // glint on already-colourful pipes.
        const R_OUT = 1.0
        const R_IN = 0.5
        const TUBE = 0.05
        const NBANDS = 8
        const NTH = Math.max(60, Math.min(200, Math.ceil(COLS * 2.4)))
        const NPH = Math.max(8, Math.min(14, Math.ceil(ROWS * 0.1)))
        const now = performance.now()
        // Wave phase: driven by the sweep physics while moving; otherwise a slow
        // autonomous back-and-forth keeps the breath alive at idle.
        const wavePos = sweepRef.current.vel !== 0
          ? sweepRef.current.pos
          : 0.5 + 0.5 * Math.sin(now * 0.0006)
        const motion = Math.min(1, Math.abs(sweepRef.current.vel) / SWEEP_MAXV)
        const WAVE_K = 2.5                              // ~2.5 humps along the arc
        const amp = 0.03 + 0.09 * motion                // idle swell → full wave
        for (let b = 0; b < NBANDS; b++) {
          const R = R_IN + (R_OUT - R_IN) * b / (NBANDS - 1)
          const col = PALETTE[Math.round((b / (NBANDS - 1)) * 13)]
          for (let i = 0; i <= NTH; i++) {
            const t = i / NTH
            const theta = Math.PI * (1 - t) // π (left) → 0 (right)
            const cosT = Math.cos(theta)
            const sinT = Math.sin(theta)
            // The wave: radius and brightness both follow a travelling sine, so
            // crests bulge AND brighten while troughs dim — the whole arch
            // ripples end to end.
            const wave = amp * Math.sin(2 * Math.PI * WAVE_K * (t - wavePos))
            const Rc = R * (1 + wave)
            const boost = wave * 1.3
            for (let j = 0; j <= NPH; j++) {
              const phi = 2 * Math.PI * j / NPH
              const cosP = Math.cos(phi)
              const sinP = Math.sin(phi)
              const x0 = (Rc + TUBE * cosP) * cosT
              const y0 = (Rc + TUBE * cosP) * sinT * RAINBOW_SY
              const z0 = TUBE * sinP
              // Tube normal in object space.
              const nx = cosP * cosT, ny = cosP * sinT, nz = sinP
              const ooz = 1 / (K2 + z0)
              const xp = Math.round(cx + K1x * ooz * x0)
              const yp = Math.round(cy - K1y * ooz * y0)
              if (xp < 0 || yp < 0 || xp >= COLS || yp >= ROWS) continue
              const idx = yp * COLS + xp
              if (ooz <= zbuf[idx]) continue
              zbuf[idx] = ooz
              // Light from up-left and toward the viewer, so the top and the
              // front of each tube read bright and the underside falls into
              // shadow — the source of the 3D depth. The wave adds the ripple.
              const light = Math.max(0.2, -0.25 * nx + 0.7 * ny - 0.67 * nz) + boost
              addChar(xp, yp, glyph(Math.min(1, light)), col)
            }
          }
        }
      } else if (shape === 'fish') {
        // A single volumetric fish. Surface samples preserve real perspective,
        // lighting and self-occlusion; the tail and fins animate around the
        // body so it feels like it is swimming rather than merely rotating.
        const fishClock = fishClockRef.current
        const fishIsMoving = auto !== null || velB.current !== 0 || velA.current !== 0
        const elapsedSinceLastFrame = Math.min(100, Math.max(0, frameStart - fishClock.lastFrame))
        fishClock.lastFrame = frameStart
        if (fishIsMoving) fishClock.elapsed += elapsedSinceLastFrame
        const now = fishClock.elapsed
        // Each pass starts and ends well outside the viewport. Routes cover
        // horizontal, vertical and diagonal entries; the fish's body rotates
        // to match the route tangent, so it visibly propels itself forward.
        const routes = [
          [-4.1, -1.1, 4.1, 0.9], [-0.9, 4.1, 1.0, -4.1],
          [4.1, 0.9, -4.1, -1.0], [1.0, -4.1, -0.9, 4.1],
          [-4.1, 3.5, 4.1, -3.5], [4.1, 3.5, -4.1, -3.5]
        ] as const
        const routePosition = now * 0.000055
        const route = routes[Math.floor(routePosition) % routes.length]
        const travel = routePosition % 1
        const [startX, startY, endX, endY] = route
        const dx = endX - startX, dy = endY - startY
        const course = Math.atan2(dy, dx)
        const cosC = Math.cos(course), sinC = Math.sin(course)
        const yaw = Math.sin(now * 0.00038) * 0.18 + angB.current * 0.16
        const pitch = Math.sin(now * 0.00061) * 0.12 + angA.current * 0.08
        const cosY = Math.cos(yaw), sinY = Math.sin(yaw)
        const cosP = Math.cos(pitch), sinP = Math.sin(pitch)
        const swimX = startX + dx * travel
        const swimY = startY + dy * travel
        const plotFish = (x0: number, y0: number, z0: number, nx0: number, ny0: number, nz0: number, shade: number, col: string) => {
          const x1 = x0 * cosY + z0 * sinY
          const z1 = -x0 * sinY + z0 * cosY
          const y1 = y0 * cosP - z1 * sinP
          const z = y0 * sinP + z1 * cosP
          const x = x1 * cosC - y1 * sinC + swimX
          const y = x1 * sinC + y1 * cosC + swimY
          const ooz = 1 / (K2 + z)
          const xp = Math.round(cx + K1x * ooz * x)
          const yp = Math.round(cy - K1y * ooz * y)
          if (xp < 0 || yp < 0 || xp >= COLS || yp >= ROWS) return
          const idx = yp * COLS + xp
          if (ooz <= zbuf[idx]) return
          zbuf[idx] = ooz
          const nnx1 = nx0 * cosY + nz0 * sinY
          const nnz1 = -nx0 * sinY + nz0 * cosY
          const nny1 = ny0 * cosP - nnz1 * sinP
          const nnz = ny0 * sinP + nnz1 * cosP
          const nnx = nnx1 * cosC - nny1 * sinC
          const nny = nnx1 * sinC + nny1 * cosC
          const light = Math.max(0.12, -0.38 * nnx + 0.58 * nny - 0.72 * nnz)
          addChar(xp, yp, glyph(Math.min(1, shade * light)), col)
        }
        // Finer character grids get a correspondingly denser mesh, preserving
        // the fish's silhouette and lighting detail on large window sizes.
        const slices = Math.max(48, Math.min(260, Math.round(COLS * 1.05)))
        const rings = Math.max(18, Math.min(72, Math.round(ROWS * 0.45)))
        for (let i = 0; i <= slices; i++) {
          const q = -0.96 + 1.92 * i / slices
          // The rear half flexes more than the head, producing a travelling
          // body wave that feeds naturally into the tail beat.
          const rear = Math.pow((1 - q) * 0.5, 1.65)
          const bodyWave = Math.sin(now * 0.008 - q * 3.5) * 0.18 * rear
          const headBulge = 1 + 0.12 * Math.exp(-Math.pow((q - 0.52) / 0.28, 2))
          const taper = (1 - 0.15 * Math.max(0, q)) * headBulge
          const radius = 0.62 * Math.sqrt(Math.max(0, 1 - q * q)) * taper
          for (let j = 0; j < rings; j++) {
            const phi = 2 * Math.PI * j / rings
            const x = 1.42 * q
            const y = radius * Math.cos(phi) + bodyWave
            const z = radius * 0.78 * Math.sin(phi)
            const nl = Math.hypot(q / 1.42, y / 0.62, z / 0.49) || 1
            const band = (0.32 + q * 0.18 + j / rings * 0.12 + 1) % 1
            plotFish(x, y, z, q / 1.42 / nl, (y - bodyWave) / 0.62 / nl, z / 0.49 / nl, 0.95, PALETTE[(band * 16) | 0])
          }
        }
        const tailWave = Math.sin(now * 0.009) * 0.2
        const tailSteps = Math.max(16, Math.min(48, Math.round(ROWS * 0.28)))
        const tailWidthSteps = Math.max(14, Math.min(40, Math.round(COLS * 0.16)))
        for (let ti = 0; ti <= tailSteps; ti++) {
          const t = ti / tailSteps
          for (let si = 0; si <= tailWidthSteps; si++) {
            const s = -1 + 2 * si / tailWidthSteps
            const x = -1.23 - 0.62 * t
            const y = s * (0.08 + 0.58 * t) + tailWave * (0.35 + t)
            const z = 0.12 * Math.sin(s * Math.PI) + tailWave * t
            plotFish(x, y, z, -0.7, s, 0.2, 0.9, PALETTE[3])
          }
        }
        const finSteps = Math.max(14, Math.min(42, Math.round(COLS * 0.15)))
        for (let fi = 0; fi <= finSteps; fi++) {
          const t = fi / finSteps
          // A broad dorsal fin and layered pectoral fin surfaces instead of
          // single strokes give the fish a more sculpted silhouette.
          for (let w = 0; w <= 5; w++) {
            const width = w / 5
            plotFish(-0.5 + t * 1.1, 0.38 + t * 0.28 + width * (0.28 - t * 0.14), tailWave * 0.32, 0, 1, 0.2, 0.78, PALETTE[11])
            plotFish(0.08 + t * 0.52 + width * 0.2, -0.22 - t * 0.24 - width * 0.18, -0.2 - tailWave * (0.2 + width * 0.2), 0, -0.6, -0.6, 0.7, PALETTE[13])
          }
        }
        // Gill cover and lateral line supply the small structural cues that
        // make the illuminated body read as fish anatomy rather than a blob.
        for (let gi = 0; gi <= rings / 2; gi++) {
          const phi = -1.12 + 2.24 * gi / (rings / 2)
          const x = 0.67
          const r = 0.53 * (1 + 0.08 * Math.cos(phi))
          plotFish(x, r * Math.cos(phi), r * 0.7 * Math.sin(phi), 0.8, Math.cos(phi), Math.sin(phi), 0.66, PALETTE[2])
        }
        for (let li = 0; li <= slices; li += 2) {
          const q = -0.58 + 1.42 * li / slices
          const wave = Math.sin(now * 0.008 - q * 3.5) * 0.18 * Math.pow((1 - q) * 0.5, 1.65)
          plotFish(1.42 * q, wave - 0.06, -0.48 * Math.sqrt(Math.max(0, 1 - q * q)), 0, 0, -1, 0.55, PALETTE[2])
        }
        // Snout and mouth sit ahead of the eyes and remain visible through the
        // shared depth buffer as the fish turns.
        for (let mi = 0; mi < 8; mi++) {
          const a = -0.22 + mi * 0.065
          plotFish(1.39, a, -0.04, 1, 0, 0, 0.64, PALETTE[1])
        }
        // Raised white eye globes + large dark pupils are intentionally drawn
        // with strong contrast. Their size is kept in model units, so they
        // remain legible even when the character grid is small.
        for (const side of [-1, 1]) {
          for (let ei = 0; ei <= 6; ei++) {
            const theta = Math.PI * ei / 6
            for (let ej = 0; ej < 10; ej++) {
              const phi = 2 * Math.PI * ej / 10
              const ex = 0.98 + 0.14 * Math.cos(theta)
              const ey = 0.16 + 0.14 * Math.sin(theta) * Math.cos(phi)
              const ez = side * (0.39 + 0.085 * Math.sin(theta) * Math.sin(phi))
              plotFish(ex, ey, ez, Math.cos(theta), Math.sin(theta) * Math.cos(phi), side * Math.sin(theta) * Math.sin(phi), 1.35, '#F7FBFF')
            }
          }
          for (let pi = -1; pi <= 1; pi++) {
            for (let pj = -1; pj <= 1; pj++) {
              plotFish(1.08 + pi * 0.035, 0.16 + pj * 0.04, side * 0.49, 0, 0, side, 1.2, '#121826')
            }
          }
        }
      } else {
        // Sphere by screen-space raycast: walk CELLS and invert the projection,
        // instead of walking the surface and hoping the samples cover the cells.
        // The silhouette is a circle at every orientation, so each cell is hit
        // exactly once -> 100% coverage for O(cells) work. Surface sampling
        // would need ~300k samples/frame to match.
        //
        // u = xr/(2.2+zr), v = yr/(2.2+zr) on the unit sphere reduces to
        //   (m+1)t^2 - 4.4t + 3.84 = 0,   m = u^2+v^2,  t = 2.2+zr
        // whose smaller root is the near surface. Real iff m <= 4/15.36, i.e.
        // screen radius <= 0.5103 — exactly the measured silhouette.
        const invKx = 1 / K1x, invKy = 1 / K1y
        for (let yp = 0; yp < ROWS; yp++) {
          const v = -(yp - cy) * invKy
          for (let xp = 0; xp < COLS; xp++) {
            const u = (xp - cx) * invKx
            const m = u * u + v * v
            const D = 4 - 15.36 * m
            if (D < 0) continue
            const t = (4.4 - Math.sqrt(D)) / (2 * (m + 1))
            const xr = u * t, yr = v * t, zr = t - 2.2
            // dot(normal, light) with the light toward the viewer (-z), up (+y)
            // and left (-x). The old vector pointed AWAY from the camera, which
            // left only 2.7% of the visible disc lit — the sphere was a sliver.
            const L = -(xr * 0.45 - yr * 0.55 + zr * 0.7)
            if (L <= 0) continue
            // Un-rotate into object space (inverse of: rotate Y by B, then X by
            // A). y0 is the latitude sine, lon the longitude.
            const y0 = yr * cosA + zr * sinA
            const zr1 = -yr * sinA + zr * cosA
            const x0 = xr * cosB - zr1 * sinB
            const z0 = xr * sinB + zr1 * cosB
            // The globe's continents live in object space, so unlike a uniform
            // sphere they carry a visible texture that turns with A/B.
            const lat = Math.asin(y0)
            const lon = Math.atan2(z0, x0)
            const glat = Math.max(0, Math.min(89, Math.round((89 - lat * 57.29578) / 2)))
            const glon = Math.max(0, Math.min(179, Math.round((lon * 57.29578 + 180) / 2)))
            let terrain = 0 // 0 ocean, 1 land, 2 ice
            if (lat > 1.134) terrain = 2                 // 65°N+ = ice caps
            else if (LAND[glat].charCodeAt(glon) === 49) terrain = 1
            // Shading: a mild latitudinal falloff near the poles (skipped for the
            // ice caps so they stay white) + a terrain bias so land reads denser
            // than ocean at the same light level.
            const globe = terrain === 2 ? 1 : 1 - 0.12 * y0 * y0
            const shade = Math.max(0, Math.min(1, L * globe * (terrain === 1 ? 1.25 : 0.95)))
            const pal = terrain === 0 ? OCEAN : terrain === 1 ? LANDC : ICE
            const col = pal[Math.min(7, (shade * 8) | 0)]
            // ocean uses a lighter glyph than its true shade would pick, so the
            // ball stays a smooth blue with land visibly denser on top of it
            addChar(xp, yp, glyph(terrain === 0 ? shade * 0.7 : shade), col)
          }
        }
      }

      const evalEnd = performance.now()
      // clear in canvas units (sz), not the window-setting prop — they diverge
      for (let i = 0; i < charCount; i++) {
        const c = chars[i]
        hitMask[c.y * COLS + c.x] = 1
      }
      if (gpu) {
        gpu.draw(chars, charCount)
      } else if (ctx) {
        ctx.clearRect(0, 0, sz, sz)
        ctx.font = `${FONT_PX}px Consolas, "Courier New", monospace`
        ctx.textBaseline = 'middle'
        ctx.textAlign = 'center'
        if (glow) {
          ctx.shadowColor = dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)'
          ctx.shadowBlur = Math.max(1.5, FONT_PX * 0.4)
        }
        let lastCol = ''
        for (let i = 0; i < charCount; i++) {
          const c = chars[i]
          if (c.col !== lastCol) { ctx.fillStyle = c.col; lastCol = c.col }
          ctx.fillText(c.ch, (c.x + 0.5) * CELL_W, (c.y + 0.5) * CELL_H)
        }
        ctx.shadowBlur = 0
      }
      const drawEnd = performance.now()
      if (metricsEnabled) {
        const m = metricRef.current
        m.frames += 1
        m.evalMs += evalEnd - frameStart
        m.drawMs += drawEnd - evalEnd
        m.chars += charCount
        if (drawEnd - m.lastLog >= 1000) {
          const fps = m.frames * 1000 / (drawEnd - m.lastLog)
          console.info(
            `[keepBoard:metrics] shape=${shape} ${COLS}x${ROWS} renderer=${gpu ? 'webgl2' : 'canvas2d'} ` +
            `fps=${fps.toFixed(1)} eval=${(m.evalMs / m.frames).toFixed(2)}ms ` +
            `draw=${(m.drawMs / m.frames).toFixed(2)}ms chars=${Math.round(m.chars / m.frames)}`
          )
          m.frames = 0
          m.evalMs = 0
          m.drawMs = 0
          m.chars = 0
          m.lastLog = drawEnd
        }
      }

      // Once both axes settle, preserve the final frame and stop consuming a
      // browser frame forever. The next input impulse calls wake() below.
      // The rainbow keeps rendering while its sweep velocity is non-zero, so it
      // coasts to a stop with inertia instead of freezing the instant input ends.
      if (velB.current !== 0 || velA.current !== 0 ||
          (shape === 'rainbow' && sweepRef.current.vel !== 0)) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }
    const wake = () => {
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current)
        idleTimerRef.current = null
      }
      if (!rafRef.current) rafRef.current = requestAnimationFrame(tick)
    }
    wakeAnimationRef.current = wake
    wake()

    return () => {
      wakeAnimationRef.current = () => { }
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current)
      if (impulseTimerRef.current !== null) window.clearTimeout(impulseTimerRef.current)
      if (celebrationTimerRef.current !== null) window.clearTimeout(celebrationTimerRef.current)
      idleTimerRef.current = null
      impulseTimerRef.current = null
      celebrationTimerRef.current = null
      gpu?.dispose()
      if (!gpu) delete canvas.dataset.renderer
      if (hitGridRef.current?.mask === hitMask) hitGridRef.current = null
      rafRef.current = 0
    }
  }, [shape, size, viewTick, dark, look, customLook, charset, glow, randomSpin, density])

  const stageClass = [
    'pet-stage',
    dragging ? 'dragging' : '',
    motionPreset !== 'off' && impulse ? `impulse-${impulse}` : '',
    motionPreset !== 'off' && jitter && impulse === 'click' ? 'jitter-on' : '',
    motionPreset !== 'off' && celebration ? 'celebrating' : ''
  ].filter(Boolean).join(' ')

  return (
    <div className={stageClass}>
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
        onMouseDown={startDrag}
        aria-label="keepBoard 3D 甜甜圈"
      />
      <div className="pet-ring" aria-hidden="true" />
      {motionPreset !== 'off' && celebration && (
        <div className="pet-celebration" aria-hidden="true">
          <span>{celebration}</span>
          <small>KEYS</small>
        </div>
      )}
    </div>
  )
}
