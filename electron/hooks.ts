import EventEmitter from 'node:events'
import { BrowserWindow, globalShortcut, ipcMain } from 'electron'
import { InputEventType } from './types'
import { classifyKey } from './statsUtils'

export interface HookEvent {
  type: InputEventType
  subtype?: string
  ts: number
}

/**
 * Lightweight global input hooker.
 * Priority: Node addon (uiohook-napi) if installed & loadable.
 * Falls back to Electron globalShortcut (only catches registered hotkeys) +
 * WebContents 'input-event' for keyboard events routed to the window.
 * For accurate global tracking users should install the optional native addon:
 *   npm i uiohook-napi
 */
export class GlobalHooker extends EventEmitter {
  private running = false
  private nativeModule: any = null
  private pollingTimer: NodeJS.Timeout | null = null
  private lastWindowsHookState: Record<string, boolean> = {}

  start() {
    if (this.running) return
    this.running = true
    // Attempt native addon
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const m = require('uiohook-napi')
      if (m && m.UioHook) {
        m.UioHook.start()
        m.UioHook.on('keydown', (e: any) => this.emitEvent({
          type: 'keypress',
          subtype: String(e.keycode ?? ''),
          ts: Date.now()
        }))
        m.UioHook.on('mousedown', (e: any) => {
          const map: Record<number, InputEventType> = {
            1: 'mousedown-left', 2: 'mousedown-middle', 3: 'mousedown-right'
          }
          const t = map[e.button] || 'mousedown-left'
          this.emitEvent({ type: t, ts: Date.now() })
        })
        m.UioHook.on('wheel', (_e: any) => this.emitEvent({
          type: 'wheel', ts: Date.now()
        }))
        this.nativeModule = m
        return
      }
    } catch { /* ignore */ }

    // Fallback: poll keyboard state via Electron (best-effort) + window listeners
    this.startBestEffort()
  }

  stop() {
    this.running = false
    if (this.nativeModule?.UioHook) {
      try { this.nativeModule.UioHook.stop() } catch { /* ignore */ }
    }
    this.nativeModule = null
    if (this.pollingTimer) { clearInterval(this.pollingTimer); this.pollingTimer = null }
  }

  emitEvent(e: HookEvent) { this.emit('event', e) }

  private startBestEffort() {
    // Register a sample of common keys as global shortcuts so that even without
    // the native addon we can approximate typing in the global scope.
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
    const digits = '0123456789'.split('')
    const extras = ['Space', 'Enter', 'Backspace', 'Tab', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']
    const candidates = [...letters.map((l) => `CommandOrControl+${l}`), ...letters, ...digits, ...extras]
    candidates.forEach((accel) => {
      try {
        const ok = globalShortcut.register(accel, () => {
          const subtype = accel.includes('+') ? accel.split('+').slice(-1)[0] : accel
          this.emitEvent({ type: 'keypress', subtype, ts: Date.now() })
        })
        if (ok) this.lastWindowsHookState[accel] = true
      } catch { /* ignore */ }
    })
    // Also listen for uncaught key events through focused webcontents
    ipcMain.on('stats:key-via-web', (_e, code: string) => {
      this.emitEvent({ type: 'keypress', subtype: code, ts: Date.now() })
    })
    ipcMain.on('stats:click-via-web', (_e, btn: number) => {
      const map: Record<number, InputEventType> = {
        0: 'mousedown-left', 1: 'mousedown-middle', 2: 'mousedown-right'
      }
      this.emitEvent({ type: map[btn] ?? 'mousedown-left', ts: Date.now() })
    })
  }
}

export { classifyKey }
