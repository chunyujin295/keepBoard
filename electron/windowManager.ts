import { BrowserWindow, screen } from 'electron'
import { TaskbarInfo, TaskbarEdge } from './taskbar'

export interface WindowSize {
  width: number
  height: number
}

export class WindowManager {
  private win: BrowserWindow
  private size: WindowSize
  private taskbar: TaskbarInfo
  private readonly DOCK_MARGIN = 4

  constructor(win: BrowserWindow, size: WindowSize, taskbar: TaskbarInfo) {
    this.win = win
    this.size = size
    this.taskbar = taskbar
  }

  updateTaskbar(taskbar: TaskbarInfo) {
    this.taskbar = taskbar
  }

  getTaskbar(): TaskbarInfo {
    return this.taskbar
  }

  dockToTaskbar() {
    const currentBounds = this.win.getBounds()
    const display = screen.getDisplayNearestPoint({
      x: currentBounds.x + this.size.width / 2,
      y: currentBounds.y + this.size.height / 2
    })
    const workArea = display.workArea
    this.taskbar = this.refreshTaskbar(display)

    const center = {
      x: currentBounds.x + this.size.width / 2,
      y: currentBounds.y + this.size.height / 2
    }

    const tgt = this.taskbar
    const margin = tgt.autoHide ? 2 : this.DOCK_MARGIN
    let targetX = currentBounds.x
    let targetY = currentBounds.y

    switch (tgt.edge) {
      case 'bottom':
        targetY = tgt.rect.y - this.size.height - margin
        targetX = clamp(center.x - this.size.width / 2,
          workArea.x, workArea.x + workArea.width - this.size.width)
        break
      case 'top':
        targetY = tgt.rect.y + tgt.rect.height + margin
        targetX = clamp(center.x - this.size.width / 2,
          workArea.x, workArea.x + workArea.width - this.size.width)
        break
      case 'left':
        targetX = tgt.rect.x + tgt.rect.width + margin
        targetY = clamp(center.y - this.size.height / 2,
          workArea.y, workArea.y + workArea.height - this.size.height)
        break
      case 'right':
        targetX = tgt.rect.x - this.size.width - margin
        targetY = clamp(center.y - this.size.height / 2,
          workArea.y, workArea.y + workArea.height - this.size.height)
        break
    }

    this.win.setBounds({
      x: Math.round(targetX),
      y: Math.round(targetY),
      width: this.size.width,
      height: this.size.height
    })
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
