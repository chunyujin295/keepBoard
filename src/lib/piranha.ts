import { PALETTE } from './palette'

export const PIXEL = 4
export const CANVAS_W = 220
export const CANVAS_H = 240

export interface PiranhaFrame {
  neckExtend: number
  mouthOpen: number
  eyeClosed: number
  leafSway: number
  shake: number
}

export function drawPixel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  size = PIXEL
) {
  ctx.fillStyle = color
  ctx.fillRect(x * size, y * size, size, size)
}

export function drawPixelRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  size = PIXEL
) {
  ctx.fillStyle = color
  ctx.fillRect(x * size, y * size, w * size, h * size)
}

export function drawPiranha(
  ctx: CanvasRenderingContext2D,
  frame: PiranhaFrame
) {
  const shakeX = (Math.random() - 0.5) * PIXEL * 2 * frame.shake
  const shakeY = (Math.random() - 0.5) * PIXEL * 2 * frame.shake

  const extendPx = frame.neckExtend * 8 * PIXEL

  const potY = 48
  const groundY = potY + 5

  // Pot body
  drawPixelRect(ctx, 9 + shakeX / PIXEL, potY + shakeY / PIXEL, 24, 3, PALETTE.POT_LIGHT)
  drawPixelRect(ctx, 8 + shakeX / PIXEL, potY + 3 + shakeY / PIXEL, 26, 8, PALETTE.POT)
  drawPixelRect(ctx, 9 + shakeX / PIXEL, potY + 11 + shakeY / PIXEL, 24, 3, PALETTE.POT_DARK)
  // Pot rim
  drawPixelRect(ctx, 7 + shakeX / PIXEL, potY - 1 + shakeY / PIXEL, 28, 1, PALETTE.POT_DARK)
  // Dirt
  drawPixelRect(ctx, 10 + shakeX / PIXEL, potY + 1 + shakeY / PIXEL, 22, 1, PALETTE.DIRT)

  const swayL = Math.sin(frame.leafSway) * 1
  const swayR = Math.sin(frame.leafSway + Math.PI) * 1

  // Stem bottom
  const stemBaseY = potY
  const stemTopY = stemBaseY - 12 - extendPx / PIXEL
  for (let y = stemBaseY; y >= stemTopY; y--) {
    const wobble = Math.sin((stemBaseY - y) * 0.4 + frame.leafSway * 2) * 0.5
    const x1 = 21 + wobble + shakeX / PIXEL
    drawPixel(ctx, x1, y, PALETTE.STEM_DARK)
    drawPixel(ctx, x1 + 1, y, PALETTE.STEM)
    drawPixel(ctx, x1 + 2, y, PALETTE.STEM)
    drawPixel(ctx, x1 + 3, y, PALETTE.LEAF_LIGHT)
  }

  // Leaf left
  const leafCX = 17 + swayL + shakeX / PIXEL
  const leafCY = stemTopY + 6 + shakeY / PIXEL
  ;[
    [0, 2, PALETTE.STEM_DARK],
    [-1, 1, PALETTE.STEM_DARK], [-2, 1, PALETTE.STEM], [-3, 1, PALETTE.LEAF],
    [0, 1, PALETTE.STEM], [-1, 0, PALETTE.STEM], [-2, 0, PALETTE.LEAF], [-3, 0, PALETTE.LEAF], [-4, 0, PALETTE.LEAF_LIGHT],
    [-2, 2, PALETTE.LEAF], [-1, 3, PALETTE.LEAF_LIGHT]
  ].forEach(([x, y, c]) => drawPixel(ctx, leafCX + (x as number), leafCY + (y as number), c as string))

  // Leaf right
  const leafRX = 28 + swayR + shakeX / PIXEL
  const leafRY = stemTopY + 4 + shakeY / PIXEL
  ;[
    [0, 2, PALETTE.STEM_DARK],
    [1, 1, PALETTE.STEM_DARK], [2, 1, PALETTE.STEM], [3, 1, PALETTE.LEAF],
    [0, 1, PALETTE.STEM], [1, 0, PALETTE.STEM], [2, 0, PALETTE.LEAF], [3, 0, PALETTE.LEAF], [4, 0, PALETTE.LEAF_LIGHT],
    [2, 2, PALETTE.LEAF], [1, 3, PALETTE.LEAF_LIGHT]
  ].forEach(([x, y, c]) => drawPixel(ctx, leafRX + (x as number), leafRY + (y as number), c as string))

  // Head center (above stem top)
  const headY = stemTopY - 10
  const headX = 19 + shakeX / PIXEL
  const headYF = headY + shakeY / PIXEL

  // Sepals (back leaves)
  drawPixelRect(ctx, headX + 1, headYF + 10, 2, 2, PALETTE.STEM_DARK)
  drawPixelRect(ctx, headX + 10, headYF + 10, 2, 2, PALETTE.STEM_DARK)
  drawPixelRect(ctx, headX + 4, headYF + 11, 6, 2, PALETTE.STEM)

  // Head petals outer dark
  drawPixelRect(ctx, headX + 2, headYF + 3, 10, 1, PALETTE.PETAL_DARK)
  drawPixelRect(ctx, headX + 1, headYF + 4, 12, 1, PALETTE.PETAL_DARK)
  drawPixelRect(ctx, headX, headYF + 5, 14, 1, PALETTE.PETAL_DARK)
  drawPixelRect(ctx, headX, headYF + 6, 14, 3, PALETTE.PETAL_DARK)
  drawPixelRect(ctx, headX + 1, headYF + 9, 12, 1, PALETTE.PETAL_DARK)
  // Head petals main
  drawPixelRect(ctx, headX + 2, headYF + 4, 10, 1, PALETTE.PETAL)
  drawPixelRect(ctx, headX + 1, headYF + 5, 12, 1, PALETTE.PETAL)
  drawPixelRect(ctx, headX + 1, headYF + 6, 12, 3, PALETTE.PETAL)
  // Head highlight
  drawPixelRect(ctx, headX + 3, headYF + 5, 3, 1, PALETTE.PETAL_LIGHT)
  drawPixelRect(ctx, headX + 2, headYF + 6, 2, 1, PALETTE.PETAL_LIGHT)

  // Mouth open amount
  const openRows = Math.round(frame.mouthOpen * 6)
  const mouthY = headYF + 6

  // Mouth interior
  drawPixelRect(ctx, headX + 3, mouthY, 8, 1 + openRows, PALETTE.BLACK)

  // Upper teeth
  for (let i = 0; i < 4; i++) {
    const tx = headX + 3 + i * 2
    drawPixel(ctx, tx, mouthY, PALETTE.TEETH)
    drawPixel(ctx, tx + 1, mouthY, PALETTE.TEETH)
    drawPixel(ctx, tx + 1, mouthY + 1, PALETTE.TEETH)
  }
  // Lower teeth (when mouth open)
  if (openRows >= 2) {
    for (let i = 0; i < 4; i++) {
      const tx = headX + 3 + i * 2
      drawPixel(ctx, tx, mouthY + openRows, PALETTE.TEETH)
      drawPixel(ctx, tx + 1, mouthY + openRows, PALETTE.TEETH)
      drawPixel(ctx, tx, mouthY + openRows - 1, PALETTE.TEETH)
    }
  }

  // Eyes
  const eyeClosed = frame.eyeClosed
  const eyeY = headYF + 2
  if (eyeClosed > 0.5) {
    drawPixel(ctx, headX + 3, eyeY + 1, PALETTE.BLACK)
    drawPixel(ctx, headX + 4, eyeY + 1, PALETTE.BLACK)
    drawPixel(ctx, headX + 10, eyeY + 1, PALETTE.BLACK)
    drawPixel(ctx, headX + 11, eyeY + 1, PALETTE.BLACK)
  } else {
    // Eye whites
    drawPixelRect(ctx, headX + 3, eyeY, 3, 3, PALETTE.WHITE)
    drawPixelRect(ctx, headX + 10, eyeY, 3, 3, PALETTE.WHITE)
    // Pupils
    drawPixel(ctx, headX + 4, eyeY + 1, PALETTE.BLACK)
    drawPixel(ctx, headX + 11, eyeY + 1, PALETTE.BLACK)
    // Eye shine
    drawPixel(ctx, headX + 5, eyeY, PALETTE.WHITE)
    drawPixel(ctx, headX + 12, eyeY, PALETTE.WHITE)
  }

  // Cheeks
  drawPixel(ctx, headX + 1, headYF + 5, PALETTE.CHEEK)
  drawPixel(ctx, headX + 13, headYF + 5, PALETTE.CHEEK)

  // Ground grass tufts
  for (let i = 0; i < 6; i++) {
    const gx = 6 + i * 6 + shakeX / PIXEL
    drawPixel(ctx, gx, groundY + 2, PALETTE.LEAF)
    drawPixel(ctx, gx + 1, groundY + 1, PALETTE.LEAF_LIGHT)
    drawPixel(ctx, gx + 2, groundY + 2, PALETTE.LEAF)
  }
}
