export type { PiranhaFrame as PetFrame } from './piranha'

export const PET_CANVAS_W = 220
export const PET_CANVAS_H = 240
export const PET_PIXEL = 4

/**
 * Draw a user-uploaded sprite with the shared procedural life-motion:
 * hover bob, bite squash, frenzy jitter. Bottom-anchored.
 */
export function drawCustomSprite(
  ctx: CanvasRenderingContext2D,
  frame: { leafSway: number; neckExtend: number; mouthOpen: number; shake: number },
  img: HTMLImageElement | null
) {
  if (!img || !img.width || !img.height) return
  const ox = (Math.random() - 0.5) * 4 * frame.shake
  const oy = (Math.random() - 0.5) * 4 * frame.shake
  const maxH = PET_CANVAS_H * 0.68
  const maxW = PET_CANVAS_W * 0.55
  let scale = Math.min(maxH / img.height, maxW / img.width)
  scale = Math.max(scale, 0.05)
  const w = img.width * scale
  const h = img.height * scale
  const bob = Math.sin(frame.leafSway * 1.5) * 3 - frame.neckExtend * 6
  const squashX = 1 + frame.mouthOpen * 0.07
  const squashY = 1 - frame.mouthOpen * 0.07
  ctx.save()
  ctx.imageSmoothingEnabled = false
  ctx.translate(PET_CANVAS_W / 2 + ox, PET_CANVAS_H - 34 + oy)
  ctx.scale(squashX, squashY)
  ctx.drawImage(img, -w / 2, -h + bob, w, h)
  ctx.restore()
}
