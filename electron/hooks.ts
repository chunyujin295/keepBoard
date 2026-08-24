import EventEmitter from 'node:events'
import { ipcMain } from 'electron'
import { InputEventType } from './types'
import { classifyKey } from './statsUtils'

export interface HookEvent {
  type: InputEventType
  subtype?: string
  ts: number
}

// Reverse map: uiohook keycode -> constant name (e.g. 30 -> "A", 28 -> "ENTER")
let keyCodeRev: Map<number, string> | null = null
function reverseKeyMap(): Map<number, string> {
  if (keyCodeRev) return keyCodeRev
  keyCodeRev = new Map()
  try {
    const { UiohookKey } = require('uiohook-napi')
    for (const [name, code] of Object.entries(UiohookKey)) {
      if (typeof code === 'number') keyCodeRev.set(code, name)
    }
  } catch { /* ignore */ }
  return keyCodeRev
}

/**
 * Translate a raw uiohook keycode into a classifier-friendly key name.
 * Produces Electron-style codes: KeyA, Digit5, F12, Control, ArrowLeft, Enter...
 */
export function normalizeKeyCode(code: number): string {
  const name = reverseKeyMap().get(code)
  if (!name) return String(code ?? '')
  if (/^[A-Z]$/.test(name)) return 'Key' + name
  if (/^[0-9]$/.test(name)) return 'Digit' + name
  if (/^NUMPAD[0-9]$/.test(name)) return 'Numpad' + name.slice(6)
  if (/^F[0-9]+$/.test(name)) return name
  if (/CTRL|CONTROL/.test(name)) return 'Control'
  if (/SHIFT/.test(name)) return 'Shift'
  if (/^ALT/.test(name)) return 'Alt'
  if (/META|CMD|WIN/.test(name)) return 'Meta'
  switch (name) {
    case 'UP': return 'ArrowUp'
    case 'DOWN': return 'ArrowDown'
    case 'LEFT': return 'ArrowLeft'
    case 'RIGHT': return 'ArrowRight'
    case 'ENTER': return 'Enter'
    case 'SPACE': return 'Space'
    case 'BACKSPACE': return 'Backspace'
    case 'TAB': return 'Tab'
    default: return name
  }
}

/**
 * Global input hooker.
 * Uses the bundled N-API native module `uiohook-napi` (prebuilt binaries,
 * no node-gyp required). If it cannot be loaded, falls back to counting
 * only input that happens inside keepBoard's own window — it NEVER
 * registers global shortcuts or intercepts system-wide keystrokes.
 */
export class GlobalHooker extends EventEmitter {
  private running = false
  private nativeModule: any = null

  get nativeActive(): boolean {
    return !!this.nativeModule
  }

  start() {
    if (this.running) return
    this.running = true
    try {
      const m = require('uiohook-napi')
      const hook = m?.uIOhook
      if (hook && typeof hook.start === 'function') {
        hook.on('keydown', (e: any) => this.emitEvent({
          type: 'keypress',
          subtype: normalizeKeyCode(e?.keycode ?? 0),
          ts: Date.now()
        }))
        hook.on('mousedown', (e: any) => {
          // libuiohook buttons: 1=left, 2=middle, 3=right
          const map: Record<number, InputEventType> = {
            1: 'mousedown-left', 2: 'mousedown-middle', 3: 'mousedown-right'
          }
          this.emitEvent({ type: map[e?.button] ?? 'mousedown-left', ts: Date.now() })
        })
        hook.on('wheel', () => this.emitEvent({ type: 'wheel', ts: Date.now() }))
        hook.start()
        this.nativeModule = m
        return
      }
    } catch { /* fall through */ }

    console.warn('[keepBoard] uiohook-napi unavailable, stats limited to in-app input.')
    this.registerInAppForwarding()
  }

  stop() {
    this.running = false
    if (this.nativeModule?.uIOhook) {
      try { this.nativeModule.uIOhook.stop() } catch { /* ignore */ }
    }
    this.nativeModule = null
  }

  emitEvent(e: HookEvent) { this.emit('event', e) }

  /**
   * Fallback mode: renderer forwards keydown/mousedown that occur while the
   * pet window is focused. Registered ONLY in fallback mode so that events
   * are never double-counted when the native hook is active.
   */
  private registerInAppForwarding() {
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
