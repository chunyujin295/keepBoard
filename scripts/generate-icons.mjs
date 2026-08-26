/**
 * Generate keepBoard app icons from docs/img/icon.png.
 * Outputs to assets/icons/ (COMMITTED — runtime & installer resource):
 *   assets/icons/icon.png (512x512), assets/icons/icon.ico (multi-size),
 *   assets/icons/icon-{16..256}.png, including Windows DPI taskbar sizes
 * Run:  node scripts/generate-icons.mjs
 */
import { PNG } from 'pngjs'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'assets', 'icons')
const SRC = path.join(ROOT, 'docs', 'img', 'icon.png')
fs.mkdirSync(OUT_DIR, { recursive: true })

if (!fs.existsSync(SRC)) {
  console.error(`source icon not found: ${SRC}`)
  process.exit(1)
}

const src = PNG.sync.read(fs.readFileSync(SRC))
console.log(`source: ${src.width}x${src.height}`)

function resize(srcImg, size) {
  const dst = new PNG({ width: size, height: size })
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = Math.floor((x / size) * srcImg.width)
      const sy = Math.floor((y / size) * srcImg.height)
      const si = (sy * srcImg.width + sx) << 2
      const di = (y * size + x) << 2
      dst.data[di]     = srcImg.data[si]
      dst.data[di + 1] = srcImg.data[si + 1]
      dst.data[di + 2] = srcImg.data[si + 2]
      dst.data[di + 3] = srcImg.data[si + 3]
    }
  }
  return PNG.sync.write(dst)
}

function writePng(name, size) {
  const buf = resize(src, size)
  const out = path.join(OUT_DIR, name)
  fs.writeFileSync(out, buf)
  console.log(`  wrote ${path.relative(ROOT, out)}`)
  return buf
}

// Windows commonly requests 16/20/24/32px at 100–150% UI scale and
// 32/40/48/64/80/96px variants at higher DPI. Supplying each exact bitmap
// prevents the shell from applying a second, blurry interpolation pass.
const iconSizes = [16, 20, 24, 32, 40, 48, 64, 80, 96, 128, 256]
for (const size of iconSizes) writePng(`icon-${size}.png`, size)
const buf512 = writePng('icon.png', 512)
fs.copyFileSync(path.join(OUT_DIR, 'icon.png'), path.join(OUT_DIR, 'icon-512.png'))

// ---- Build multi-size ICO ----
const icoSizes = iconSizes
const pngs = icoSizes.map(s => ({ size: s, data: resize(src, s) }))

function pngDimensions(buf) {
  const w = buf.readUInt32BE(16)
  const h = buf.readUInt32BE(20)
  return { w, h }
}

const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0)
header.writeUInt16LE(1, 2)       // type: ico
header.writeUInt16LE(pngs.length, 4)

const entries = []
let offset = 6 + 16 * pngs.length
for (const p of pngs) {
  const { w, h } = pngDimensions(p.data)
  const e = Buffer.alloc(16)
  e.writeUInt8(w >= 256 ? 0 : w, 0)
  e.writeUInt8(h >= 256 ? 0 : h, 1)
  e.writeUInt8(0, 2)
  e.writeUInt8(0, 3)
  e.writeUInt16LE(1, 4)
  e.writeUInt16LE(32, 6)
  e.writeUInt32LE(p.data.length, 8)
  e.writeUInt32LE(offset, 12)
  offset += p.data.length
  entries.push(e)
}
const icoBuf = Buffer.concat([header, ...entries, ...pngs.map(p => p.data)])
const icoPath = path.join(OUT_DIR, 'icon.ico')
fs.writeFileSync(icoPath, icoBuf)
console.log(`  wrote ${path.relative(ROOT, icoPath)} (${icoSizes.join('/')} sizes)`)
