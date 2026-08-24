import { Rectangle } from 'electron'

export type TaskbarEdge = 'top' | 'bottom' | 'left' | 'right'

export interface TaskbarInfo {
  edge: TaskbarEdge
  rect: Rectangle
  thickness: number
  autoHide: boolean
}

export function detectTaskbar(
  displayBounds: Rectangle,
  workArea: Rectangle
): TaskbarInfo {
  const tb: TaskbarInfo = {
    edge: 'bottom',
    rect: { x: 0, y: 0, width: 0, height: 0 },
    thickness: 0,
    autoHide: false
  }

  const x = workArea.x - displayBounds.x
  const y = workArea.y - displayBounds.y
  const r =
    displayBounds.x + displayBounds.width - (workArea.x + workArea.width)
  const b =
    displayBounds.y + displayBounds.height - (workArea.y + workArea.height)

  const maxGap = Math.max(x, y, r, b)
  if (maxGap <= 0) {
    tb.edge = 'bottom'
    tb.thickness = 40
    tb.rect = {
      x: displayBounds.x,
      y: displayBounds.y + displayBounds.height - 40,
      width: displayBounds.width,
      height: 40
    }
    return tb
  }

  if (y === maxGap) {
    tb.edge = 'top'
    tb.thickness = y
    tb.rect = {
      x: displayBounds.x,
      y: displayBounds.y,
      width: displayBounds.width,
      height: y
    }
  } else if (b === maxGap) {
    tb.edge = 'bottom'
    tb.thickness = b
    tb.rect = {
      x: displayBounds.x,
      y: displayBounds.y + displayBounds.height - b,
      width: displayBounds.width,
      height: b
    }
  } else if (x === maxGap) {
    tb.edge = 'left'
    tb.thickness = x
    tb.rect = {
      x: displayBounds.x,
      y: displayBounds.y,
      width: x,
      height: displayBounds.height
    }
  } else {
    tb.edge = 'right'
    tb.thickness = r
    tb.rect = {
      x: displayBounds.x + displayBounds.width - r,
      y: displayBounds.y,
      width: r,
      height: displayBounds.height
    }
  }
  return tb
}
