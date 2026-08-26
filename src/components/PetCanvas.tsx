import { useEffect, useRef, useState } from 'react'
import type { LookDef } from '@/lib/types'

interface Props {
  /** window edge length in px (square window) */
  size: number
  /** True while panels/masks cover the window — disables click-through logic */
  overlayActive?: boolean
  /** 'donut' | 'sphere' */
  shape?: 'donut' | 'sphere'
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
  sphere: { k: 0.963, ox: 0.5, oy: 0.5 }
} as const

/** Max spacing between adjacent surface samples, in cells. The old hardcoded
 *  angular steps under-sampled as soon as COLS grew — at 640px a quarter of the
 *  torus's cells came out empty. 1.4 measures >=98.7% cell coverage at every
 *  window size; halving it costs 2x the samples for +0.3%. */
const SAMPLE_GAP = 1.4
/** Hard ceiling on torus samples per frame. Honouring SAMPLE_GAP outright costs
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

interface DragState {
  startX: number
  startY: number
  winX: number
  winY: number
  lastSent: number
}

export default function PetCanvas({ size, overlayActive, shape = 'donut', dark = true, look = 'classic', customLook, charset = 'ascii', glow = false, randomSpin = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef(0)
  /** main spin + secondary tumble, deg/frame — 0 at rest, capped */
  const velB = useRef(0)
  const velA = useRef(0)
  const dragRef = useRef<DragState | null>(null)
  const ignoreMouseRef = useRef(false)
  const overlayRef = useRef(!!overlayActive)
  const randomSpinRef = useRef(!!randomSpin)
  const spinDirRef = useRef(1)
  /** rotation state lives outside the render effect so a resize/shape swap
   *  rebuilds the canvas without snapping the shape back to its start pose */
  const angA = useRef(TILT_BASE)
  const angB = useRef(0.4)
  const colorShiftRef = useRef(0)
  const [dragging, setDragging] = useState(false)
  /** bumped on window resize — the canvas backing store must be rebuilt */
  const [viewTick, setViewTick] = useState(0)

  const triggerKick = (s: number) => {
    // main spin ≈1°/event; secondary tumble ≈0.45°/event; both capped.
    //
    // Random direction has inertia: it is only re-rolled when the spin comes to
    // rest. Rolling per event would make a burst of typing flip direction every
    // press ("左一下右一下") — this way one spin session keeps one direction,
    // and the next fresh start picks a new random one.
    if (randomSpinRef.current && velB.current === 0 && velA.current === 0) {
      spinDirRef.current = Math.random() < 0.5 ? -1 : 1
    }
    const dir = randomSpinRef.current ? spinDirRef.current : 1
    velB.current = Math.max(-MAX_VEL_B, Math.min(MAX_VEL_B, velB.current + dir * 1.0 * s))
    velA.current = Math.max(-MAX_VEL_A, Math.min(MAX_VEL_A, velA.current + dir * 0.45 * s))
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
    const onMove = (e: MouseEvent) => {
      if (overlayRef.current || dragRef.current) return
      const canvas = canvasRef.current
      if (!canvas) return
      const r = canvas.getBoundingClientRect()
      const lx = e.clientX - r.left
      const ly = e.clientY - r.top
      if (lx < 0 || ly < 0 || lx >= r.width || ly >= r.height) return
      // CSS px -> backing-store px via the real rect: the canvas box is not
      // necessarily the window size (dpr clamp, borders, stale resize).
      const sx = canvas.width / r.width
      const sy = canvas.height / r.height
      // Sample a NEIGHBOURHOOD, not the single pixel under the cursor. ASCII art
      // is mostly holes — the glyphs only ink ~14% of the area they cover — so
      // an exact-pixel test made the window land in a gap far more often than
      // on ink, and it felt like you had to hit a character dead-on to grab it.
      const rx = Math.max(1, Math.round(HIT_RADIUS * sx))
      const ry = Math.max(1, Math.round(HIT_RADIUS * sy))
      const x0 = Math.max(0, Math.round(lx * sx) - rx)
      const y0 = Math.max(0, Math.round(ly * sy) - ry)
      const bw = Math.min(canvas.width - x0, rx * 2 + 1)
      const bh = Math.min(canvas.height - y0, ry * 2 + 1)
      if (bw <= 0 || bh <= 0) return
      const data = canvas.getContext('2d', { willReadFrequently: true })!
        .getImageData(x0, y0, bw, bh).data
      let solid = false
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] >= 16) { solid = true; break }
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
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // The cell grid follows the GLYPH's aspect, not a square. A monospace glyph
    // advances ~0.55-0.6em horizontally but occupies a full em vertically, so a
    // square grid can only ever match one axis: size the font to the cell height
    // and ~40% of every cell's width is empty (the shape reads as a dot matrix);
    // size it to the width and rows overprint each other. donut.c solves this by
    // scaling x by 2 for terminal cells — same idea, measured instead of guessed.
    // Glyph size scales down a little as the window grows, so a large window
    // renders finer (the globe in particular needs the resolution).
    const FONT_PX = Math.max(4.2, Math.min(6.4, 6.6 - (sz - 220) / 420 * 2.4))
    ctx.font = `${FONT_PX}px Consolas, "Courier New", monospace`
    const CELL_W = ctx.measureText('M').width || FONT_PX * 0.6
    const CELL_H = FONT_PX * LINE_RATIO
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
    const NCH = CHARS.length
    /** normalised shade in [0,1] -> ramp index */
    const glyph = (s: number) =>
      CHARS[Math.min(NCH - 1, Math.max(0, (Math.pow(s, gamma) * NCH) | 0))]

    const fit = FIT[shape]
    const K1x = fit.k * COLS
    const K1y = fit.k * ROWS
    const cx = fit.ox * COLS
    const cy = fit.oy * ROWS

    // Sampling steps derived from how many cells one unit of 3D length spans at
    // the NEAREST point of the torus — that's where samples spread out most.
    // Use the denser axis (x) so neither axis under-samples.
    const cellsPerUnit = K1x / (K2 - (R1 + R2))
    let dTh = SAMPLE_GAP / cellsPerUnit
    let dPh = SAMPLE_GAP / (cellsPerUnit * (R1 + R2))
    // Back both steps off together if the budget is blown, so the sampling stays
    // proportioned the same way (th is R1 across, ph is R1+R2 across).
    const over = (6.283 / dTh) * (6.283 / dPh) / MAX_SAMPLES
    if (over > 1) { const f = Math.sqrt(over); dTh *= f; dPh *= f }
    const NTH = Math.ceil(6.283 / dTh)
    const NPH = Math.ceil(6.283 / dPh)
    // Trig tables: these angles are fixed for the life of the canvas, so hoist
    // every cos/sin out of a loop that runs ~90k times per frame at 640px.
    const cosTh = new Float32Array(NTH), sinTh = new Float32Array(NTH)
    for (let i = 0; i < NTH; i++) { cosTh[i] = Math.cos(i * dTh); sinTh[i] = Math.sin(i * dTh) }
    const cosPh = new Float32Array(NPH), sinPh = new Float32Array(NPH)
    for (let i = 0; i < NPH; i++) { cosPh[i] = Math.cos(i * dPh); sinPh[i] = Math.sin(i * dPh) }

    const tick = () => {
      // dual-axis spin: A tumbles, B main rotation; both kick + decay; static at rest
      velB.current *= 0.94
      velA.current *= 0.94
      if (Math.abs(velB.current) < 0.02) velB.current = 0
      if (Math.abs(velA.current) < 0.02) velA.current = 0
      angA.current += (velA.current * Math.PI) / 180
      angB.current += (velB.current * Math.PI) / 180
      colorShiftRef.current += (velB.current / 180) * 0.5

      const A = angA.current, B = angB.current
      const colorShift = colorShiftRef.current
      const cosA = Math.cos(A), sinA = Math.sin(A)
      const cosB = Math.cos(B), sinB = Math.sin(B)

      zbuf.fill(0)

      const chars: { x: number; y: number; ch: string; col: string }[] = []

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
              if (L > 0) chars.push({ x: xp, y: yp, ch: glyph(L / DONUT_LMAX), col })
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
            chars.push({ x: xp, y: yp, ch: glyph(terrain === 0 ? shade * 0.7 : shade), col })
          }
        }
      }

      // clear in canvas units (sz), not the window-setting prop — they diverge
      ctx.clearRect(0, 0, sz, sz)
      ctx.font = `${FONT_PX}px Consolas, "Courier New", monospace`
      // center each glyph in its cell; top/left anchoring biased the whole
      // shape up-left by most of a cell
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'center'

      // Optional glow: a soft halo whose polarity follows the background
      // (`dark`), so the pet stays legible over either desktop. Kept SMALL and
      // low-alpha on purpose — a big per-glyph shadow bleeds neighbours together
      // and turns the whole shape fuzzy.
      if (glow) {
        ctx.shadowColor = dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)'
        ctx.shadowBlur = Math.max(1.5, FONT_PX * 0.4)
      }

      // Only touch fillStyle when the colour actually changes. The torus emits
      // chars in ring order (one colour per ring) so this collapses thousands of
      // state changes into ~16.
      let lastCol = ''
      for (const c of chars) {
        if (c.col !== lastCol) { ctx.fillStyle = c.col; lastCol = c.col }
        ctx.fillText(c.ch, (c.x + 0.5) * CELL_W, (c.y + 0.5) * CELL_H)
      }
      ctx.shadowBlur = 0

      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(rafRef.current)
  }, [shape, size, viewTick, dark, look, customLook, charset, glow, randomSpin])

  return (
    <div style={{
      width: '100%',
      height: '100%',
      // inset shadow rather than a border: a border shrinks the canvas box and
      // costs the shape 3px of fill on every edge
      boxShadow: dragging ? 'inset 0 0 0 1.5px rgba(100,160,255,0.7)' : 'none',
      background: dragging ? 'rgba(60,120,220,0.18)' : 'transparent',
      transition: 'box-shadow 0.15s, background 0.15s',
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
