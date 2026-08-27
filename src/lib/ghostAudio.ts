// Procedural "cosmic ghost" sound engine — no audio files, everything is
// synthesised live with the Web Audio API.
//
// Each input kind gets its own character:
//   key   — a theremin-ish sine/triangle note that wails a little, on a random
//           minor-pentatonic pitch, so no two presses sound the same.
//   click — a short "boop" with a downward pitch.
//   wheel — a slide-whistle sweep, up or down at random.
// A breathy filtered-noise "syllable" (a sweeping band-pass over white noise)
// rides under every note to give it that hollow, ghostly "whoo", and a short
// feedback delay makes the whole thing float in a void.

type ImpulseKind = 'key' | 'click' | 'wheel'

// Minor pentatonic — floaty and spooky, and avoids the dissonance of pure
// random frequencies so bursts of typing stay musical instead of clashing.
const SCALE = [0, 3, 5, 7, 10]
const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

function randNote(): number {
  const root = 45 + Math.floor(Math.random() * 3) * 12 // A2 / A3 / A4
  const degree = SCALE[Math.floor(Math.random() * SCALE.length)]
  const oct = Math.floor(Math.random() * 2) * 12
  return midiToFreq(root + degree + oct)
}

class GhostAudio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private delaySend: GainNode | null = null
  private noise: AudioBuffer | null = null
  private enabled = false
  private volume = 0.5
  private lastAt = 0

  setEnabled(v: boolean) {
    this.enabled = v
    if (v) this.ensure()
    else this.ctx?.suspend().catch(() => {})
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v ?? 0.5))
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02)
    }
  }

  private ensure() {
    if (this.ctx) {
      this.resume()
      return
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    this.ctx = ctx

    const master = ctx.createGain()
    master.gain.value = this.volume
    master.connect(ctx.destination)
    this.master = master

    // Cosmic echo: a short feedback delay gives the "ghost floating in a void"
    // tail without a full reverb.
    const delay = ctx.createDelay(1.0)
    delay.delayTime.value = 0.23
    const feedback = ctx.createGain()
    feedback.gain.value = 0.34
    const wet = ctx.createGain()
    wet.gain.value = 0.35
    delay.connect(feedback)
    feedback.connect(delay)
    delay.connect(wet)
    wet.connect(master)
    const send = ctx.createGain()
    send.gain.value = 1
    send.connect(delay)
    this.delaySend = send

    // Shared white-noise buffer for the breathy "syllable" layer.
    const len = Math.floor(ctx.sampleRate * 0.5)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    this.noise = buf

    this.resume()
  }

  private resume() {
    if (this.ctx && this.ctx.state !== 'running') this.ctx.resume().catch(() => {})
  }

  note(kind: ImpulseKind) {
    if (!this.enabled) return
    const now = performance.now()
    if (now - this.lastAt < 50) return // throttle fast typing into a chorus, not a machine gun
    this.lastAt = now
    this.ensure()
    if (!this.ctx || !this.master || !this.noise) return
    if (kind === 'key') this.key()
    else if (kind === 'click') this.click()
    else this.wheel()
  }

  private key() {
    const ctx = this.ctx!
    const t = ctx.currentTime
    const f0 = randNote()
    const f1 = f0 * (Math.random() < 0.5 ? 1.06 : 0.94) // gentle wail up/down
    const dur = 0.32 + Math.random() * 0.28

    const osc = ctx.createOscillator()
    osc.type = Math.random() < 0.5 ? 'sine' : 'triangle'
    osc.frequency.setValueAtTime(f0, t)
    osc.frequency.exponentialRampToValueAtTime(f1, t + dur)

    // Slow vibrato — the wobble is what makes it sound alive and spooky.
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 4 + Math.random() * 3
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = f0 * 0.04
    lfo.connect(lfoGain)
    lfoGain.connect(osc.frequency)

    const env = ctx.createGain()
    env.gain.setValueAtTime(0, t)
    env.gain.linearRampToValueAtTime(0.4, t + 0.01)
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.4)

    osc.connect(env)
    env.connect(this.master!)
    env.connect(this.delaySend!)
    osc.start(t)
    osc.stop(t + dur + 0.5)
    lfo.start(t)
    lfo.stop(t + dur + 0.5)

    this.syllable(t, 900, 300, dur * 0.7, 0.14)
  }

  private click() {
    const ctx = this.ctx!
    const t = ctx.currentTime
    const f0 = 500 + Math.random() * 400
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(f0, t)
    osc.frequency.exponentialRampToValueAtTime(f0 * 0.55, t + 0.12)
    const env = ctx.createGain()
    env.gain.setValueAtTime(0, t)
    env.gain.linearRampToValueAtTime(0.3, t + 0.008)
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
    osc.connect(env)
    env.connect(this.master!)
    env.connect(this.delaySend!)
    osc.start(t)
    osc.stop(t + 0.2)
    this.syllable(t, 1400, 700, 0.09, 0.06)
  }

  private wheel() {
    const ctx = this.ctx!
    const t = ctx.currentTime
    const up = Math.random() < 0.5
    const f0 = up ? 300 : 900
    const f1 = up ? 900 : 300
    const dur = 0.28
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(f0, t)
    osc.frequency.exponentialRampToValueAtTime(f1, t + dur)
    const env = ctx.createGain()
    env.gain.setValueAtTime(0, t)
    env.gain.linearRampToValueAtTime(0.35, t + 0.02)
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.1)
    osc.connect(env)
    env.connect(this.master!)
    env.connect(this.delaySend!)
    osc.start(t)
    osc.stop(t + dur + 0.15)
    this.syllable(t, up ? 800 : 500, up ? 1500 : 250, dur, 0.1)
  }

  // Breath of the ghost: white noise through a sweeping band-pass, reading as
  // a vowel-ish "whoo" that drops in pitch.
  private syllable(t: number, from: number, to: number, dur: number, level: number) {
    const ctx = this.ctx!
    const src = ctx.createBufferSource()
    src.buffer = this.noise!
    src.loop = true
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 1.2
    bp.frequency.setValueAtTime(from, t)
    bp.frequency.exponentialRampToValueAtTime(to, t + dur)
    const env = ctx.createGain()
    env.gain.setValueAtTime(0, t)
    env.gain.linearRampToValueAtTime(level, t + 0.02)
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(bp)
    bp.connect(env)
    env.connect(this.master!)
    env.connect(this.delaySend!)
    src.start(t)
    src.stop(t + dur + 0.05)
  }
}

export const ghostAudio = new GhostAudio()
