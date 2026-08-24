import { PALETTE } from './palette'
import { drawPixel, drawPixelRect, drawPiranha } from './piranha'
import type { PiranhaFrame as PetFrame } from './piranha'

export { PALETTE, drawPixel, drawPixelRect }
export type { PetFrame }

export const PET_CANVAS_W = 220
export const PET_CANVAS_H = 240

export const PET_PIXEL = 4

export interface PetDrawer {
  (ctx: CanvasRenderingContext2D, frame: PetFrame): void
}

export function p(): number { return PET_PIXEL }

export const drawPetPiranha: PetDrawer = (ctx, f) => drawPiranha(ctx, f)

// ---------- Theme 2: Cactus
export const drawPetCactus: PetDrawer = (ctx, f) => {
  const sway = Math.sin(f.leafSway)
  const bob = Math.sin(f.neckExtend * Math.PI) * 2
  const sh = f.shake
  const ox = (Math.random() - 0.5) * 4 * sh
  const oy = (Math.random() - 0.5) * 4 * sh
  const baseY = 48
  // Pot
  drawPixelRect(ctx, 9 + ox / p(), baseY + oy / p(), 24, 3, PALETTE.POT_LIGHT)
  drawPixelRect(ctx, 8 + ox / p(), baseY + 3 + oy / p(), 26, 8, PALETTE.POT)
  drawPixelRect(ctx, 9 + ox / p(), baseY + 11 + oy / p(), 24, 3, PALETTE.POT_DARK)
  drawPixelRect(ctx, 10 + ox / p(), baseY + 1 + oy / p(), 22, 1, PALETTE.DIRT)
  // Spikes grass
  for (let i = 0; i < 6; i++) {
    drawPixel(ctx, 6 + i * 6 + ox / p(), baseY + 14 + oy / p(), PALETTE.LEAF_LIGHT)
  }
  // Main body (columns
  const cactusX = 19 + ox / p()
  const cactusBase = baseY - 20 + bob
  // Arm left + sway
  // Body
  drawPixelRect(ctx, cactusX, cactusBase + oy / p(), 8, 20, PALETTE.STEM_DARK)
  drawPixelRect(ctx, cactusX + 1, cactusBase + 1 + oy / p(), 6, 18, PALETTE.STEM)
  drawPixelRect(ctx, cactusX + 2, cactusBase + 2 + oy / p(), 4, 16, PALETTE.LEAF)
  drawPixelRect(ctx, cactusX + 3, cactusBase + 3 + oy / p(), 2, 14, PALETTE.LEAF_LIGHT)
  // Left arm
  const la = -4 + sway
  drawPixelRect(ctx, cactusX - 3, cactusBase + 10 + oy / p() + la, 4, 10, PALETTE.STEM_DARK)
  drawPixelRect(ctx, cactusX - 3, cactusBase + 9 + oy / p() + la, 4, 4, PALETTE.STEM)
  drawPixelRect(ctx, cactusX - 2, cactusBase + 5 + oy / p() + la, 3, 4, PALETTE.LEAF)
  drawPixelRect(ctx, cactusX - 3, cactusBase + 9 + oy / p() + la, 4, 1, PALETTE.LEAF_LIGHT)
  // Right arm
  const ra = 4 - sway
  drawPixelRect(ctx, cactusX + 7, cactusBase + 8 + oy / p() + ra, 4, 12, PALETTE.STEM_DARK)
  drawPixelRect(ctx, cactusX + 7, cactusBase + 7 + oy / p() + ra, 4, 4, PALETTE.STEM)
  drawPixelRect(ctx, cactusX + 8, cactusBase + 3 + oy / p() + ra, 3, 4, PALETTE.LEAF)
  drawPixelRect(ctx, cactusX + 7, cactusBase + 7 + oy / p() + ra, 4, 1, PALETTE.LEAF_LIGHT)
  // Eyes + mouth
  const topY = cactusBase + 5 + oy / p()
  const topX = cactusX
  const mouthOpen = f.mouthOpen
  if (f.eyeClosed < 0.5) {
    drawPixel(ctx, topX + 2, topY, PALETTE.WHITE)
    drawPixel(ctx, topX + 3, topY, PALETTE.WHITE)
    drawPixel(ctx, topX + 5, topY, PALETTE.WHITE)
    drawPixel(ctx, topX + 6, topY, PALETTE.WHITE)
    drawPixel(ctx, topX + 3, topY + 1, PALETTE.BLACK)
    drawPixel(ctx, topX + 6, topY + 1, PALETTE.BLACK)
  } else {
    drawPixel(ctx, topX + 2, topY + 1, PALETTE.BLACK)
    drawPixel(ctx, topX + 3, topY + 1, PALETTE.BLACK)
    drawPixel(ctx, topX + 5, topY + 1, PALETTE.BLACK)
    drawPixel(ctx, topX + 6, topY + 1, PALETTE.BLACK)
  }
  // Mouth
  const openRows = Math.max(1, Math.round(mouthOpen * 4))
  drawPixelRect(ctx, topX + 3, topY + 4, 4, openRows, PALETTE.BLACK)
  for (let i = 0; i < 2; i++) {
    drawPixel(ctx, topX + 3 + i * 3, topY + 4, PALETTE.TEETH)
  }
  // Cheek blush
  drawPixel(ctx, topX + 1, topY + 3, PALETTE.CHEEK)
  drawPixel(ctx, topX + 8, topY + 3, PALETTE.CHEEK)
  // Spikes around
  for (let r = 0; r < 6; r++) {
    drawPixel(ctx, cactusX - 1, cactusBase + 3 + r * 3, PALETTE.YELLOW)
    drawPixel(ctx, cactusX + 8, cactusBase + 3 + r * 3, PALETTE.YELLOW)
  }
  // Flower on top when bite excited
  if (f.neckExtend > 0.2) {
    const fx = cactusX + 3
    const fy = cactusBase - 2
    drawPixelRect(ctx, fx - 1, fy, 3, 2, PALETTE.PETAL)
    drawPixelRect(ctx, fx, fy - 1, 3, 2, PALETTE.PETAL_LIGHT)
    drawPixel(ctx, fx + 1, fy, PALETTE.YELLOW)
  }
}

// ---------- Theme 3: Slime
export const drawPetSlime: PetDrawer = (ctx, f) => {
  const squash = 1 - Math.sin(f.leafSway) * 0.1
  const bite = f.mouthOpen
  const shake = f.shake
  const ox = (Math.random() - 0.5) * 4 * shake
  const oy = (Math.random() - 0.5) * 4 * shake
  const baseY = 48
  // Ground
  for (let i = 0; i < 6; i++) {
    drawPixel(ctx, 6 + i * 6 + ox / p(), baseY + 14 + oy / p(), PALETTE.LEAF)
  }
  // Slime body (squashed ellipse pixels)
  const slimeTopY = baseY - 2 - f.neckExtend * 4
  const slimeL = 8 + ox / p()
  const slimeR = 34 + ox / p()
  const slimeW = slimeR - slimeL
  const height = 20
  const squashOffset = Math.round(squash * 4)
  // Body rows
  for (let row = 0; row < height; row++) {
    const shrink = Math.round(Math.sin((row / height) * Math.PI) * 2)
    const w = slimeW - shrink - squashOffset
    const x = slimeL + Math.floor((slimeW - w) / 2)
    drawPixelRect(ctx, x, slimeTopY + row + oy / p(), w, 1, row < 3 ? PALETTE.PETAL_DARK : PALETTE.LEAF)
    if (row >= 3 && row < height - 3) {
      drawPixelRect(ctx, x + 1, slimeTopY + row + oy / p(), Math.max(1, w - 2), 1, PALETTE.LEAF_LIGHT)
    }
  }
  // Highlight shine top-left
  drawPixelRect(ctx, slimeL + 4, slimeTopY + 3 + oy / p(), 3, 2, '#E6FFB0')
  drawPixel(ctx, slimeL + 3, slimeTopY + 4 + oy / p(), PALETTE.WHITE)
  // Eyes
  const ey = slimeTopY + 7 + oy / p()
  const e1x = slimeL + 8
  const e2x = slimeL + 18
  if (f.eyeClosed > 0.5) {
    drawPixelRect(ctx, e1x, ey + 1, 3, 1, PALETTE.BLACK)
    drawPixelRect(ctx, e2x, ey + 1, 3, 1, PALETTE.BLACK)
  } else {
    drawPixelRect(ctx, e1x, ey, 4, 3, PALETTE.WHITE)
    drawPixelRect(ctx, e2x, ey, 4, 3, PALETTE.WHITE)
    drawPixel(ctx, e1x + 1, ey + 1, PALETTE.BLACK)
    drawPixel(ctx, e2x + 1, ey + 1, PALETTE.BLACK)
    drawPixel(ctx, e1x + 2, ey, PALETTE.WHITE)
    drawPixel(ctx, e2x + 2, ey, PALETTE.WHITE)
  }
  // Mouth
  const mouthY = ey + 5
  const mouthW = 6 + Math.round(bite * 6)
  const mouthH = 1 + Math.round(bite * 3)
  drawPixelRect(ctx, slimeL + 12, mouthY, mouthW, mouthH, PALETTE.BLACK)
  if (bite > 0.4) {
    drawPixel(ctx, slimeL + 12, mouthY, PALETTE.TEETH)
    drawPixel(ctx, slimeL + 12 + mouthW - 1, mouthY, PALETTE.TEETH)
  }
  // Blush
  drawPixel(ctx, slimeL + 5, ey + 4, PALETTE.CHEEK)
  drawPixel(ctx, slimeL + 25, ey + 4, PALETTE.CHEEK)
  // Droplet on head when extended
  if (f.neckExtend > 0.3) {
    drawPixel(ctx, slimeL + 2, slimeTopY - 2, PALETTE.PETAL_LIGHT)
  }
}

// ---------- Theme 4: Pixel Cat (sits)
export const drawPetCat: PetDrawer = (ctx, f) => {
  const ox = (Math.random() - 0.5) * 4 * f.shake
  const oy = (Math.random() - 0.5) * 4 * f.shake
  const baseY = 48
  // Tail sway
  const tail = Math.sin(f.leafSway) * 2
  // Sitting cushion (mat)
  drawPixelRect(ctx, 7 + ox / p(), baseY + 12 + oy / p(), 28, 2, PALETTE.PETAL_DARK)
  drawPixelRect(ctx, 8 + ox / p(), baseY + 14 + oy / p(), 26, 1, PALETTE.POT)
  // Body (sitting gray tabby)
  const bodyTop = baseY - 2
  drawPixelRect(ctx, 14 + ox / p(), bodyTop + oy / p(), 14, 14, '#B9B9C9')
  drawPixelRect(ctx, 14 + ox / p(), bodyTop + 1 + oy / p(), 14, 1, '#D6D6E4')
  drawPixelRect(ctx, 15 + ox / p(), bodyTop + 13 + oy / p(), 12, 1, '#8E8EA3')
  // Belly
  drawPixelRect(ctx, 18 + ox / p(), bodyTop + 8 + oy / p(), 6, 6, '#F2F2F8')
  // Tabby stripes
  drawPixel(ctx, 17 + ox / p(), bodyTop + 3 + oy / p(), '#8E8EA3')
  drawPixel(ctx, 25 + ox / p(), bodyTop + 3 + oy / p(), '#8E8EA3')
  drawPixel(ctx, 16 + ox / p(), bodyTop + 6 + oy / p(), '#8E8EA3')
  drawPixel(ctx, 26 + ox / p(), bodyTop + 6 + oy / p(), '#8E8EA3')
  // Head
  const headX = 15 + ox / p()
  const headY = bodyTop - 11 + f.neckExtend * 4
  drawPixelRect(ctx, headX, headY + oy / p(), 12, 11, '#B9B9C9')
  drawPixelRect(ctx, headX + 1, headY + 1 + oy / p(), 10, 9, '#C9C9D8')
  drawPixelRect(ctx, headX, headY + 10 + oy / p(), 12, 1, '#8E8EA3')
  // Ears
  drawPixel(ctx, headX + 1, headY - 2 + oy / p(), '#8E8EA3')
  drawPixelRect(ctx, headX, headY - 1 + oy / p(), 3, 2, '#B9B9C9')
  drawPixel(ctx, headX + 10, headY - 2 + oy / p(), '#8E8EA3')
  drawPixelRect(ctx, headX + 9, headY - 1 + oy / p(), 3, 2, '#B9B9C9')
  // Inner ears
  drawPixel(ctx, headX + 1, headY + 1 + oy / p(), PALETTE.CHEEK)
  drawPixel(ctx, headX + 10, headY + 1 + oy / p(), PALETTE.CHEEK)
  // Eyes
  const ey = headY + 3 + oy / p()
  const eyeOpen = f.eyeClosed < 0.5
  if (eyeOpen) {
    drawPixelRect(ctx, headX + 3, ey, 2, 3, PALETTE.YELLOW)
    drawPixelRect(ctx, headX + 7, ey, 2, 3, PALETTE.YELLOW)
    drawPixel(ctx, headX + 3, ey + 1, PALETTE.BLACK)
    drawPixel(ctx, headX + 7, ey + 1, PALETTE.BLACK)
    drawPixel(ctx, headX + 4, ey + 2, PALETTE.BLACK)
    drawPixel(ctx, headX + 8, ey + 2, PALETTE.BLACK)
  } else {
    drawPixelRect(ctx, headX + 3, ey + 1, 3, 1, PALETTE.BLACK)
    drawPixelRect(ctx, headX + 7, ey + 1, 3, 1, PALETTE.BLACK)
  }
  // Nose + mouth
  drawPixel(ctx, headX + 5, ey + 4 + oy / p(), PALETTE.CHEEK)
  drawPixel(ctx, headX + 6, ey + 4 + oy / p(), PALETTE.CHEEK)
  drawPixel(ctx, headX + 5, ey + 5 + oy / p(), PALETTE.BLACK)
  drawPixel(ctx, headX + 4, ey + 6 + oy / p(), PALETTE.BLACK)
  drawPixel(ctx, headX + 7, ey + 6 + oy / p(), PALETTE.BLACK)
  // Whiskers
  drawPixel(ctx, headX - 2, ey + 5, PALETTE.WHITE)
  drawPixel(ctx, headX - 1, ey + 5 + 1, PALETTE.WHITE)
  drawPixel(ctx, headX + 12, ey + 5, PALETTE.WHITE)
  drawPixel(ctx, headX + 13, ey + 5 + 1, PALETTE.WHITE)
  // Bite open mouth
  if (f.mouthOpen > 0.3) {
    const my = ey + 7 + oy / p()
    drawPixelRect(ctx, headX + 5, my, 3, Math.max(1, Math.round(f.mouthOpen * 3)), PALETTE.BLACK)
    drawPixel(ctx, headX + 4, my, PALETTE.TEETH)
    drawPixel(ctx, headX + 8, my, PALETTE.TEETH)
  }
  // Tail
  drawPixelRect(ctx, 28 + tail, bodyTop + 4 + oy / p(), 2, 8, '#B9B9C9')
  drawPixelRect(ctx, 30 + tail, bodyTop + 2 + oy / p(), 2, 3, '#B9B9C9')
  drawPixelRect(ctx, 30 + tail, bodyTop + 12 + oy / p(), 2, 2, '#C9C9D8')
  // Paws
  drawPixelRect(ctx, 15 + ox / p(), baseY - 1 + oy / p(), 4, 3, '#8E8EA3')
  drawPixelRect(ctx, 23 + ox / p(), baseY - 1 + oy / p(), 4, 3, '#8E8EA3')
}

// ---------- Theme 5: Mario Mushroom
export const drawPetMushroom: PetDrawer = (ctx, f) => {
  const ox = (Math.random() - 0.5) * 4 * f.shake
  const oy = (Math.random() - 0.5) * 4 * f.shake
  const baseY = 48
  // Stem body
  const stemX = 17 + ox / p()
  const stemY = baseY - 14 + f.neckExtend * 3
  drawPixelRect(ctx, stemX, stemY + oy / p(), 10, 16, '#F7E9C8')
  drawPixelRect(ctx, stemX + 1, stemY + 1 + oy / p(), 8, 14, PALETTE.WHITE)
  drawPixelRect(ctx, stemX, stemY + 15 + oy / p(), 10, 1, '#C4B58D')
  // Cap top (red)
  const capY = stemY - 10 + oy / p()
  drawPixelRect(ctx, 9 + ox / p(), capY + 6, 26, 4, PALETTE.PETAL_DARK)
  drawPixelRect(ctx, 8 + ox / p(), capY + 3, 28, 3, PALETTE.PETAL)
  drawPixelRect(ctx, 10 + ox / p(), capY + 1, 24, 2, PALETTE.PETAL)
  drawPixelRect(ctx, 13 + ox / p(), capY, 18, 1, PALETTE.PETAL)
  drawPixelRect(ctx, 10 + ox / p(), capY + 9, 24, 1, PALETTE.PETAL_DARK)
  // White spots
  drawPixelRect(ctx, 12 + ox / p(), capY + 2, 3, 3, PALETTE.WHITE)
  drawPixelRect(ctx, 22 + ox / p(), capY + 1, 4, 3, PALETTE.WHITE)
  drawPixelRect(ctx, 30 + ox / p(), capY + 4, 2, 2, PALETTE.WHITE)
  drawPixelRect(ctx, 15 + ox / p(), capY + 6, 2, 2, PALETTE.WHITE)
  // Eyes on stem
  const ey = stemY + 4 + oy / p()
  if (f.eyeClosed > 0.5) {
    drawPixelRect(ctx, stemX + 2, ey + 1, 2, 1, PALETTE.BLACK)
    drawPixelRect(ctx, stemX + 6, ey + 1, 2, 1, PALETTE.BLACK)
  } else {
    drawPixelRect(ctx, stemX + 1, ey, 3, 3, PALETTE.WHITE)
    drawPixelRect(ctx, stemX + 6, ey, 3, 3, PALETTE.WHITE)
    drawPixel(ctx, stemX + 2, ey + 1, PALETTE.BLACK)
    drawPixel(ctx, stemX + 7, ey + 1, PALETTE.BLACK)
    drawPixel(ctx, stemX + 3, ey, PALETTE.WHITE)
    drawPixel(ctx, stemX + 8, ey, PALETTE.WHITE)
  }
  // Cheeks
  drawPixel(ctx, stemX, ey + 3, PALETTE.CHEEK)
  drawPixel(ctx, stemX + 9, ey + 3, PALETTE.CHEEK)
  // Mouth
  const my = ey + 5
  const mo = f.mouthOpen
  drawPixelRect(ctx, stemX + 4, my, 3, 1 + Math.round(mo * 3), PALETTE.BLACK)
  if (mo > 0.5) {
    drawPixel(ctx, stemX + 3, my, PALETTE.TEETH)
    drawPixel(ctx, stemX + 7, my, PALETTE.TEETH)
  }
  // Grass below
  for (let i = 0; i < 6; i++) {
    drawPixel(ctx, 6 + i * 6 + ox / p(), baseY + 14 + oy / p(), PALETTE.LEAF)
  }
}

// ---------- Theme 6: Ghost
export const drawPetGhost: PetDrawer = (ctx, f) => {
  const bob = Math.sin(f.leafSway * 1.5) * 2 - f.neckExtend * 3
  const ox = (Math.random() - 0.5) * 4 * f.shake
  const oy = (Math.random() - 0.5) * 4 * f.shake
  const bx = 8 + ox / p()
  const by = 22 + bob + oy / p()
  const w = 26
  const h = 22

  ctx.globalAlpha = 0.88
  // Dome body
  drawPixelRect(ctx, bx + 2, by, w - 4, 1, PALETTE.GHOST_SHADE)
  drawPixelRect(ctx, bx + 1, by + 1, w - 2, 2, PALETTE.GHOST)
  drawPixelRect(ctx, bx, by + 3, w, h - 6, PALETTE.GHOST)
  // Side shading
  drawPixelRect(ctx, bx, by + 3, 1, h - 6, PALETTE.GHOST_SHADE)
  drawPixelRect(ctx, bx + w - 1, by + 3, 1, h - 6, PALETTE.GHOST_SHADE)
  // Wavy tail
  const waveShift = Math.round(Math.sin(f.leafSway * 2) * 1.5)
  for (let c = 0; c < w; c += 4) {
    const dip = ((c / 4) % 2 === 0) ? 3 : 2
    drawPixelRect(ctx, bx + c, by + h - 3, Math.min(4, w - c), dip + (c === waveShift * 4 ? 1 : 0), PALETTE.GHOST)
    drawPixel(ctx, bx + c, by + h - 1 + (dip - 2), PALETTE.GHOST_SHADE)
  }
  drawPixelRect(ctx, bx + 2, by + h - 4, w - 4, 1, PALETTE.GHOST_DEEP)
  ctx.globalAlpha = 1

  // Eyes
  const e1x = bx + 6
  const e2x = bx + 16
  const eyy = by + 7
  if (f.eyeClosed > 0.5) {
    drawPixelRect(ctx, e1x, eyy + 1, 3, 1, PALETTE.BLACK)
    drawPixelRect(ctx, e2x, eyy + 1, 3, 1, PALETTE.BLACK)
  } else {
    drawPixelRect(ctx, e1x, eyy, 3, 4, PALETTE.BLACK)
    drawPixelRect(ctx, e2x, eyy, 3, 4, PALETTE.BLACK)
    drawPixel(ctx, e1x + 1, eyy + 1, PALETTE.GHOST)
    drawPixel(ctx, e2x + 1, eyy + 1, PALETTE.GHOST)
  }
  // Blush
  drawPixel(ctx, bx + 3, eyy + 3, PALETTE.CHEEK)
  drawPixel(ctx, bx + 22, eyy + 3, PALETTE.CHEEK)
  // Mouth "o"
  const mo = f.mouthOpen
  const mw = 2 + Math.round(mo * 2)
  const mh = 2 + Math.round(mo * 3)
  const mx = bx + 11
  const myy = eyy + 5
  drawPixelRect(ctx, mx, myy, mw, mh, PALETTE.BLACK)
  if (mo > 0.5) {
    drawPixel(ctx, mx, myy, PALETTE.TEETH)
    drawPixel(ctx, mx + mw - 1, myy, PALETTE.TEETH)
  }
  // Frenzy sparks
  if (f.shake > 0.2) {
    for (let i = 0; i < 3; i++) {
      const sx = bx + Math.floor(Math.random() * w)
      const sy = by - 2 - Math.floor(Math.random() * 4)
      drawPixel(ctx, sx, sy, i % 2 ? PALETTE.YELLOW : PALETTE.LEAF_LIGHT)
    }
  }
}

// ---------- Theme 7: Pixel Dino
export const drawPetDino: PetDrawer = (ctx, f) => {
  const ox = (Math.random() - 0.5) * 4 * f.shake
  const oy = (Math.random() - 0.5) * 4 * f.shake
  const baseY = 48
  // Ground pebbles
  for (let i = 0; i < 7; i++) {
    drawPixel(ctx, 5 + i * 6 + ox / p(), baseY + 13 + oy / p(), PALETTE.GHOST_DEEP)
  }
  const lift = Math.round(f.neckExtend * 3)
  // Tail (wags)
  const wag = Math.round(Math.sin(f.leafSway) * 1.5)
  const tx = 28 + wag
  drawPixelRect(ctx, tx + oy / p(), baseY - 8, 4, 2, PALETTE.DINO_DARK)
  drawPixelRect(ctx, tx - 3, baseY - 6, 6, 2, PALETTE.DINO)
  // Legs
  drawPixelRect(ctx, 17 + ox / p(), baseY + 6 + oy / p(), 4, 6, PALETTE.DINO_DARK)
  drawPixelRect(ctx, 25 + ox / p(), baseY + 6 + oy / p(), 4, 6, PALETTE.DINO_DARK)
  drawPixelRect(ctx, 17 + ox / p(), baseY + 10 + oy / p(), 5, 2, PALETTE.DINO)
  drawPixelRect(ctx, 25 + ox / p(), baseY + 10 + oy / p(), 5, 2, PALETTE.DINO)
  // Body
  drawPixelRect(ctx, 14 + ox / p(), baseY - 6 + oy / p(), 18, 12, PALETTE.DINO)
  drawPixelRect(ctx, 14 + ox / p(), baseY + 2 + oy / p(), 18, 4, PALETTE.DINO_LIGHT)
  drawPixelRect(ctx, 14 + ox / p(), baseY - 6 + oy / p(), 18, 1, PALETTE.DINO_DARK)
  drawPixelRect(ctx, 31 + ox / p(), baseY - 6 + oy / p(), 1, 12, PALETTE.DINO_DARK)
  // Belly stripe
  drawPixelRect(ctx, 16 + ox / p(), baseY + 3 + oy / p(), 14, 1, PALETTE.WHITE)
  // Back spikes
  for (let i = 0; i < 4; i++) {
    drawPixel(ctx, 20 + i * 3 + ox / p(), baseY - 8 + oy / p(), PALETTE.DINO_DARK)
  }
  // Head (lifts when excited)
  const hx = 10 + ox / p()
  const hy = baseY - 18 - lift + oy / p()
  drawPixelRect(ctx, hx + 2, hy + 8, 12, 4, PALETTE.DINO)
  drawPixelRect(ctx, hx, hy, 14, 8, PALETTE.DINO)
  drawPixelRect(ctx, hx, hy, 14, 1, PALETTE.DINO_DARK)
  drawPixelRect(ctx, hx, hy, 1, 8, PALETTE.DINO_DARK)
  drawPixelRect(ctx, hx + 2, hy + 6, 8, 1, PALETTE.DINO_LIGHT)
  // Upper jaw teeth notches
  for (let i = 0; i < 3; i++) {
    drawPixel(ctx, hx + 2 + i * 4, hy + 7, PALETTE.TEETH)
  }
  // Lower jaw opens with bite
  const jawGap = Math.round(f.mouthOpen * 4)
  drawPixelRect(ctx, hx + 1, hy + 8 + jawGap, 12, 2, PALETTE.DINO_DARK)
  for (let i = 0; i < 3; i++) {
    drawPixel(ctx, hx + 3 + i * 4, hy + 8 + jawGap, PALETTE.TEETH)
  }
  // Eye
  if (f.eyeClosed > 0.5) {
    drawPixelRect(ctx, hx + 9, hy + 2, 3, 1, PALETTE.BLACK)
  } else {
    drawPixelRect(ctx, hx + 9, hy + 1, 3, 3, PALETTE.WHITE)
    drawPixel(ctx, hx + 10, hy + 2, PALETTE.BLACK)
  }
  // Nostril
  drawPixel(ctx, hx + 2, hy + 3, PALETTE.DINO_DARK)
  // Roar burst
  if (f.shake > 0.3) {
    drawPixel(ctx, hx - 2, hy + 9, PALETTE.YELLOW)
    drawPixel(ctx, hx - 4, hy + 10, PALETTE.PETAL_LIGHT)
  }
}

// ---------- Theme 8: Robot
export const drawPetRobot: PetDrawer = (ctx, f) => {
  const ox = (Math.random() - 0.5) * 4 * f.shake
  const oy = (Math.random() - 0.5) * 4 * f.shake
  const baseY = 48
  const x = (v: number) => v + ox / p()
  const y = (v: number) => v + oy / p()

  // Treads
  drawPixelRect(ctx, x(10), y(baseY + 10), 24, 4, PALETTE.ROBO_DARK)
  drawPixelRect(ctx, x(12), y(baseY + 14), 20, 1, PALETTE.ROBO)
  for (let i = 0; i < 4; i++) {
    drawPixel(ctx, x(12 + i * 6), y(baseY + 12), PALETTE.YELLOW)
  }
  // Body
  drawPixelRect(ctx, x(12), y(baseY - 6), 20, 16, PALETTE.ROBO)
  drawPixelRect(ctx, x(12), y(baseY - 6), 2, 16, PALETTE.ROBO_LIGHT)
  drawPixelRect(ctx, x(30), y(baseY - 6), 2, 16, PALETTE.ROBO_DARK)
  drawPixelRect(ctx, x(12), y(baseY + 8), 20, 2, PALETTE.ROBO_DARK)
  // Chest LEDs blink in sequence
  const ledPhase = Math.floor(f.leafSway * 2) % 3
  for (let i = 0; i < 3; i++) {
    drawPixelRect(ctx, x(15 + i * 4), y(baseY + 2), 2, 2,
      i === ledPhase ? PALETTE.LED_GREEN : PALETTE.ROBO_DARK)
  }
  // Chest vent
  for (let r = 0; r < 2; r++) {
    drawPixelRect(ctx, x(16), y(baseY + 5 + r * 2), 12, 1, PALETTE.ROBO_DARK)
  }
  // Neck
  drawPixelRect(ctx, x(19), y(baseY - 8), 6, 2, PALETTE.ROBO_DARK)
  // Antenna
  const blinkOn = Math.sin(f.leafSway * 3) > 0 || f.shake > 0.3
  drawPixelRect(ctx, x(21), y(baseY - 22), 2, 4, PALETTE.ROBO)
  drawPixelRect(ctx, x(20), y(baseY - 25), 4, 3, blinkOn ? PALETTE.LED_RED : PALETTE.ROBO_DARK)
  if (blinkOn && f.shake > 0.2) {
    drawPixel(ctx, x(19), y(baseY - 26), PALETTE.YELLOW)
    drawPixel(ctx, x(24), y(baseY - 26), PALETTE.YELLOW)
  }
  // Head
  drawPixelRect(ctx, x(14), y(baseY - 20), 16, 12, PALETTE.ROBO)
  drawPixelRect(ctx, x(14), y(baseY - 20), 16, 1, PALETTE.ROBO_LIGHT)
  drawPixelRect(ctx, x(14), y(baseY - 9), 16, 1, PALETTE.ROBO_DARK)
  // Ear bolts
  drawPixelRect(ctx, x(12), y(baseY - 17), 2, 4, PALETTE.ROBO_DARK)
  drawPixelRect(ctx, x(30), y(baseY - 17), 2, 4, PALETTE.ROBO_DARK)
  // Face screen
  drawPixelRect(ctx, x(16), y(baseY - 18), 12, 8, '#10121E')
  // Eyes
  if (f.eyeClosed > 0.5) {
    drawPixelRect(ctx, x(18), y(baseY - 15), 3, 1, PALETTE.LED_GREEN)
    drawPixelRect(ctx, x(23), y(baseY - 15), 3, 1, PALETTE.LED_GREEN)
  } else {
    drawPixelRect(ctx, x(18), y(baseY - 17), 3, 3, f.shake > 0.3 ? PALETTE.LED_RED : PALETTE.LED_GREEN)
    drawPixelRect(ctx, x(23), y(baseY - 17), 3, 3, f.shake > 0.3 ? PALETTE.LED_RED : PALETTE.LED_GREEN)
  }
  // Equalizer mouth bars
  const bars = [1, 3, 2, 4]
  for (let i = 0; i < 4; i++) {
    const amp = Math.max(1, Math.round(bars[i] * (0.4 + f.mouthOpen)))
    drawPixelRect(ctx, x(17 + i * 3), y(baseY - 13 - amp + 2), 2, amp, PALETTE.LED_GREEN)
  }
}

// ---------- Theme 9: Pumpkin Lantern
export const drawPetPumpkin: PetDrawer = (ctx, f) => {
  const ox = (Math.random() - 0.5) * 4 * f.shake
  const oy = (Math.random() - 0.5) * 4 * f.shake
  const baseY = 48
  const x = (v: number) => v + ox / p()
  const y = (v: number) => v + oy / p()
  // Grass tufts
  for (let i = 0; i < 6; i++) {
    drawPixel(ctx, x(6 + i * 6), y(baseY + 14), PALETTE.LEAF)
  }
  // Curling vine (sways)
  const sway = Math.round(Math.sin(f.leafSway) * 2)
  drawPixelRect(ctx, x(21), y(baseY - 18), 3, 4, PALETTE.STEM_DARK)
  drawPixelRect(ctx, x(21 + sway), y(baseY - 21), 2, 4, PALETTE.STEM)
  drawPixel(ctx, x(20 + sway), y(baseY - 23), PALETTE.LEAF)
  drawPixel(ctx, x(19 + sway), y(baseY - 22), PALETTE.LEAF_LIGHT)
  // Stem
  drawPixelRect(ctx, x(19), y(baseY - 15), 6, 3, PALETTE.POT_DARK)
  // Pumpkin body
  drawPixelRect(ctx, x(9), y(baseY - 12), 26, 2, PALETTE.PUMPKIN_DARK)
  drawPixelRect(ctx, x(7), y(baseY - 10), 30, 14, PALETTE.PUMPKIN)
  drawPixelRect(ctx, x(5), y(baseY - 6), 34, 8, PALETTE.PUMPKIN)
  drawPixelRect(ctx, x(7), y(baseY + 4), 30, 4, PALETTE.PUMPKIN_DARK)
  drawPixelRect(ctx, x(5), y(baseY - 6), 1, 8, PALETTE.PUMPKIN_DARK)
  drawPixelRect(ctx, x(38), y(baseY - 6), 1, 8, PALETTE.PUMPKIN_DARK)
  // Ridges
  const ridges = [12, 19, 26, 32]
  ridges.forEach((rx, idx) => {
    drawPixelRect(ctx, x(rx), y(baseY - 10), 1, 14, PALETTE.PUMPKIN_DARK)
    drawPixelRect(ctx, x(rx + 1), y(baseY - 10 + idx), 1, 14 - idx * 2, PALETTE.PETAL_LIGHT)
  })
  // Top-left shine
  drawPixelRect(ctx, x(8), y(baseY - 9), 3, 1, PALETTE.PETAL_LIGHT)
  drawPixel(ctx, x(7), y(baseY - 8), PALETTE.PETAL_LIGHT)
  // Glowing eyes (triangle)
  const glow = f.shake > 0.2 ? PALETTE.WHITE : PALETTE.PUMPKIN_GLOW
  if (f.eyeClosed > 0.5) {
    drawPixelRect(ctx, x(11), y(baseY - 5), 5, 1, PALETTE.BLACK)
    drawPixelRect(ctx, x(27), y(baseY - 5), 5, 1, PALETTE.BLACK)
  } else {
    drawPixelRect(ctx, x(11), y(baseY - 4), 5, 2, glow)
    drawPixel(ctx, x(12), y(baseY - 6), glow)
    drawPixel(ctx, x(13), y(baseY - 5), glow)
    drawPixelRect(ctx, x(28), y(baseY - 4), 5, 2, glow)
    drawPixel(ctx, x(30), y(baseY - 6), glow)
    drawPixel(ctx, x(29), y(baseY - 5), glow)
  }
  // Jagged glowing mouth grows with bite
  const mo = f.mouthOpen
  const mh = 1 + Math.round(mo * 3)
  const myy = baseY + 1
  drawPixelRect(ctx, x(12), y(myy), 20, mh, PALETTE.BLACK)
  for (let i = 0; i < mh; i++) {
    drawPixelRect(ctx, x(13), y(myy + i), 18, 1, i === 0 ? PALETTE.BLACK : glow)
  }
  // Teeth notches
  for (let i = 0; i < 4; i++) {
    drawPixel(ctx, x(13 + i * 5), y(myy), PALETTE.PUMPKIN)
    drawPixel(ctx, x(15 + i * 5), y(myy + mh - 1), PALETTE.PUMPKIN)
  }
}
