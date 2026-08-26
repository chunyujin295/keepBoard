import { BrowserWindow, screen } from 'electron'
import { TaskbarInfo, TaskbarEdge } from './taskbar'
import { logSize, rectsClose } from './sizeLog'

export class WindowManager {
  private win: BrowserWindow
  private taskbar: TaskbarInfo
  private canonicalSize: () => number
  private readonly DOCK_MARGIN = 1

  /** `canonicalSize` returns the edge length the window is SUPPOSED to be, read
   *  from settings. Docking must never derive size from getBounds(): on
   *  fractional DPI that measurement is off by a pixel or two, and writing it
   *  back is what let the window creep. */
  constructor(win: BrowserWindow, taskbar: TaskbarInfo, canonicalSize: () => number) {
    this.win = win
    this.taskbar = taskbar
    this.canonicalSize = canonicalSize
  }

  updateTaskbar(taskbar: TaskbarInfo) {
    this.taskbar = taskbar
  }

  getTaskbar(): TaskbarInfo {
    return this.taskbar
  }

  dockToTaskbar() {
    const cur = this.win.getBounds()
    const width = this.canonicalSize()
    const height = width
    const display = screen.getDisplayNearestPoint({
      x: cur.x + width / 2,
      y: cur.y + height / 2
    })
    const workArea = display.workArea
    this.taskbar = this.refreshTaskbar(display)

    const center = {
      x: cur.x + width / 2,
      y: cur.y + height / 2
    }

    const tgt = this.taskbar
    const margin = tgt.autoHide ? 2 : this.DOCK_MARGIN
    let targetX = cur.x
    let targetY = cur.y

    switch (tgt.edge) {
      case 'bottom':
        targetY = tgt.rect.y - height - margin
        targetX = clamp(center.x - width / 2,
          workArea.x, workArea.x + workArea.width - width)
        break
      case 'top':
        targetY = tgt.rect.y + tgt.rect.height + margin
        targetX = clamp(center.x - width / 2,
          workArea.x, workArea.x + workArea.width - width)
        break
      case 'left':
        targetX = tgt.rect.x + tgt.rect.width + margin
        targetY = clamp(center.y - height / 2,
          workArea.y, workArea.y + workArea.height - height)
        break
      case 'right':
        targetX = tgt.rect.x - width - margin
        targetY = clamp(center.y - height / 2,
          workArea.y, workArea.y + workArea.height - height)
        break
    }

    const next = {
      x: Math.round(targetX),
      y: Math.round(targetY),
      width,
      height
    }
    console.log(`[keepBoard] dock: edge=${tgt.edge} cur={${cur.x},${cur.y},${cur.width}x${cur.height}} next={${next.x},${next.y},${next.width}x${next.height}}`)
    if (rectsClose(next, cur)) { console.log('[keepBoard] dock: skip (same pos)'); return }
    // Writes the canonical width/height, so docking also corrects any drift
    // that crept in elsewhere rather than preserving it.
    this.win.setBounds(next)
    logSize('dock', next)
  }

  private refreshTaskbar(d: { bounds: import('electron').Rectangle; workArea: import('electron').Rectangle }): TaskbarInfo {
    const tb = this.taskbar
    const gapTop = d.workArea.y - d.bounds.y
    const gapBottom = d.bounds.y + d.bounds.height - (d.workArea.y + d.workArea.height)
    const gapLeft = d.workArea.x - d.bounds.x
    const gapRight = d.bounds.x + d.bounds.width - (d.workArea.x + d.workArea.width)
    const maxGap = Math.max(gapTop, gapBottom, gapLeft, gapRight)
    if (maxGap <= 0) return { ...tb, autoHide: true, thickness: Math.max(2, tb.thickness) }
    let edge: TaskbarEdge = 'bottom'
    let thickness = 0
    let rect = { x: 0, y: 0, width: 0, height: 0 }
    if (gapTop === maxGap) { edge = 'top'; thickness = gapTop; rect = { x: d.bounds.x, y: d.bounds.y, width: d.bounds.width, height: gapTop } }
    else if (gapBottom === maxGap) { edge = 'bottom'; thickness = gapBottom; rect = { x: d.bounds.x, y: d.bounds.y + d.bounds.height - gapBottom, width: d.bounds.width, height: gapBottom } }
    else if (gapLeft === maxGap) { edge = 'left'; thickness = gapLeft; rect = { x: d.bounds.x, y: d.bounds.y, width: gapLeft, height: d.bounds.height } }
    else { edge = 'right'; thickness = gapRight; rect = { x: d.bounds.x + d.bounds.width - gapRight, y: d.bounds.y, width: gapRight, height: d.bounds.height } }
    return { edge, thickness, rect, autoHide: false }
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}
