/**
 * Generate keepBoard pixel-art app icon.
 * Design: a red piranha popping out of a keyboard keycap ("keepBoard").
 * Outputs: build/icon.png (512x512), build/icon.ico (multi-size)
 * Run:  node scripts/generate-icons.mjs
 */
import { PNG } from 'pngjs'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const BUILD_DIR = path.join(ROOT, 'build')
fs.mkdirSync(BUILD_DIR, { recursive: true })

// ---- palette RGBA ----
const rgba = (r, g, b, a = 255) => [r, g, b, a]
const PAL = {
  T:           rgba(0, 0, 0, 0),
  // piranha head
  OUTLINE:     rgba(194, 59, 34),    // petal dark outline
  PETAL:       rgba(232, 93, 58),
  LIGHT:       rgba(255, 140, 66),
  SPOT:        rgba(255, 255, 255),
  SHINE:       rgba(255, 255, 255),
  EYE:         rgba(0, 0, 0),
  TOOTH:       rgba(255, 246, 216),
  CHEEK:       rgba(240, 138, 138),
  // keycap
  CAP_DARK:    rgba(26, 28, 44),
  CAP_TOP:     rgba(159, 176, 194),
  CAP_FRONT:   rgba(107, 122, 138),
  LED:         rgba(255, 217, 61)
}

// char -> color
const M = {
  '.': PAL.T,
  o: PAL.OUTLINE,
  p: PAL.PETAL,
  l: PAL.LIGHT,
  W: PAL.SPOT,
  s: PAL.SHINE,
  B: PAL.EYE,
  t: PAL.TOOTH,
  k: PAL.CHEEK,
  d: PAL.CAP_DARK,
  g: PAL.CAP_TOP,
  f: PAL.CAP_FRONT,
  y: PAL.LED
}

// 16x16 art, rows top -> bottom (every row MUST be 16 chars)
//
//  ....oooooooo....      head top outline
//  ...olpppppppo...      highlight sweep
//  ..olpWWppWWppo..      white spots
//  .oppBsppppBsppo.      eyes (shine pixel)
//  .opkBBppppBBkpo.      pupils + blush
//  .oppttttttttpp o.     wide toothy grin
//  .optBBBBBBBBtpo..     mouth interior
//  ..oppttttttpp o..     lower teeth
//  ...oppppppppo...      chin
//  ....oooooooo....      chin outline
//  .dddddddddddddd.      keycap top edge
//  .dggggggggggggd.      keycap top face
//  .dggyggggggyggd.      keycap LEDs
//  .dffffffffffffd.      keycap front
//  .dddddddddddddd.      keycap base
const ART = [
  '................',
  '....oooooooo....',
  '...olpppppppo...',
  '..olpWWppWWppo..',
  '.oppBsppppBsppo.',
  '.opkBBppppBBkpo.',
  '.oppttttttttppo.',
  '.optBBBBBBBBtpo.',
  '..oppttttttppo..',
  '...oppppppppo...',
  '....oooooooo....',
  '.dddddddddddddd.',
  '.dggggggggggggd.',
  '.dggyggggggyggd.',
  '.dffffffffffffd.',
  '.dddddddddddddd.'
]

for (const row of ART) {
  if (row.length !== 16) throw new Error(`Icon row length ${row.length} != 16: "${row}"`)
}

function colorAt(gx, gy) {
  const ch = ART[gy]?.[gx] ?? '.'
  return M[ch] ?? PAL.T
}

function renderTo(size) {
  // Large sizes get a symmetric 1/17-cell breathing margin; small sizes stay full-bleed
  const cells = size >= 128 ? 17 : 16
  const scale = Math.max(1, Math.floor(size / cells))
  const pad = Math.floor((size - scale * 16) / 2)
  const png = new PNG({ width: size, height: size })
  for (let y = 0; y < size; y++) {
    const gy = Math.floor((y - pad) / scale)
    for (let x = 0; x < size; x++) {
      const gx = Math.floor((x - pad) / scale)
      const c = colorAt(gx, gy)
      const idx = (y * size + x) << 2
      png.data[idx]     = c[0]
      png.data[idx + 1] = c[1]
      png.data[idx + 2] = c[2]
      png.data[idx + 3] = c[3]
    }
  }
  return PNG.sync.write(png)
}

function writePng(name, size) {
  const buf = renderTo(size)
  const out = path.join(BUILD_DIR, name)
  fs.writeFileSync(out, buf)
  console.log(`  wrote ${path.relative(ROOT, out)}`)
  return buf
}

// Write PNG sizes
writePng('icon-16.png', 16)
writePng('icon-32.png', 32)
writePng('icon-48.png', 48)
writePng('icon-64.png', 64)
writePng('icon-128.png', 128)
writePng('icon-256.png', 256)
const buf512 = writePng('icon.png', 512)
// keep an extra copy so tray can find it
fs.copyFileSync(path.join(BUILD_DIR, 'icon.png'), path.join(BUILD_DIR, 'icon-512.png'))

// Committed copy for README display (build/ is gitignored)
const readmeDir = path.join(ROOT, 'docs', 'img')
fs.mkdirSync(readmeDir, { recursive: true })
fs.writeFileSync(path.join(readmeDir, 'icon.png'), buf512)
console.log(`  wrote ${path.relative(ROOT, path.join(readmeDir, 'icon.png'))} (README)`)

// ---- Build multi-size ICO ----
const icoSizes = [16, 32, 48, 64, 128, 256]
const pngs = icoSizes.map(s => ({ size: s, data: renderTo(s) }))

function pngDimensions(buf) {
  const w = buf.readUInt32BE(16)
  const h = buf.readUInt32BE(20)
  return { w, h }
}

const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0)       // reserved
header.writeUInt16LE(1, 2)       // type: ico
header.writeUInt16LE(pngs.length, 4)

const entries = []
let offset = 6 + 16 * pngs.length
for (const p of pngs) {
  const { w, h } = pngDimensions(p.data)
  const e = Buffer.alloc(16)
  e.writeUInt8(w >= 256 ? 0 : w, 0)
  e.writeUInt8(h >= 256 ? 0 : h, 1)
  e.writeUInt8(0, 2)         // color count
  e.writeUInt8(0, 3)         // reserved
  e.writeUInt16LE(1, 4)      // color planes
  e.writeUInt16LE(32, 6)     // bits per pixel
  e.writeUInt32LE(p.data.length, 8)
  e.writeUInt32LE(offset, 12)
  offset += p.data.length
  entries.push(e)
}
const icoBuf = Buffer.concat([header, ...entries, ...pngs.map(p => p.data)])
const icoPath = path.join(BUILD_DIR, 'icon.ico')
fs.writeFileSync(icoPath, icoBuf)
console.log(`  wrote ${path.relative(ROOT, icoPath)} (${icoSizes.join('/')} sizes)`)
