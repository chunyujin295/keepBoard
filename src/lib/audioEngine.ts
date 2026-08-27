// Procedural input-sound engine — no audio files, everything is synthesised
// live with the Web Audio API. Each "theme" is a set of synthesis parameters;
// the same player turns key/click/wheel events into a voice that matches the
// theme's character (a wailing theremin ghost, a blippy robot, a game-like
// 8-bit chip, a clear water drop).
//
// The engine is data-driven: `note()` takes an intensity (0–1, driven by the
// input "combo") that lifts the pitch as you type faster, so a hard-working day
// sounds more excited than an idle one.

export type AudioTheme = 'none' | 'ghost' | 'robot' | '8bit' | 'droplet'

type ImpulseKind = 'key' | 'click' | 'wheel'

// Semitone offsets for the random note picker. Minor pentatonic = floaty/spooky,
// major pentatonic = clear, the robot's sparse set keeps it mechanical.
interface Theme {
  id: Exclude<AudioTheme, 'none'>
  label: string
  icon: string
  scale: number[]
  root: number
  waves: OscillatorType[]
  keyDurMin: number
  keyDurMax: number
  vibrato: boolean
  vibratoDepth: number
  clickWave: OscillatorType
  clickFreqMin: number
  clickFreqMax: number
  clickDrop: number
  wheelWave: OscillatorType
  wheelSweepMin: number
  wheelSweepMax: number
  breath: boolean
  harmony: boolean
  echo: boolean
  filterCutoff: number
}

const THEMES: Record<Exclude<AudioTheme, 'none'>, Theme> = {
  ghost: {
    id: 'ghost',
    label: '宇宙幽灵',
    icon: '👻',
    scale: [0, 3, 5, 7, 10],
    root: 45,
    waves: ['sine', 'triangle'],
    keyDurMin: 0.32,
    keyDurMax: 0.6,
    vibrato: true,
    vibratoDepth: 0.04,
    clickWave: 'triangle',
    clickFreqMin: 500,
    clickFreqMax: 900,
    clickDrop: 0.55,
    wheelWave: 'sine',
    wheelSweepMin: 300,
    wheelSweepMax: 900,
    breath: true,
    harmony: true,
    echo: true,
    filterCutoff: 4000
  },
  robot: {
    id: 'robot',
    label: '机器人',
    icon: '🤖',
    scale: [0, 12, 24],
    root: 36,
    waves: ['square'],
    keyDurMin: 0.06,
    keyDurMax: 0.12,
    vibrato: false,
    vibratoDepth: 0,
    clickWave: 'square',
    clickFreqMin: 200,
    clickFreqMax: 400,
    clickDrop: 0.8,
    wheelWave: 'square',
    wheelSweepMin: 150,
    wheelSweepMax: 300,
    breath: false,
    harmony: false,
    echo: false,
    filterCutoff: 2000
  },
  '8bit': {
    id: '8bit',
    label: '8-bit 芯片',
    icon: '👾',
    scale: [0, 4, 7, 12],
    root: 60,
    waves: ['square'],
    keyDurMin: 0.05,
    keyDurMax: 0.1,
    vibrato: false,
    vibratoDepth: 0,
    clickWave: 'square',
    clickFreqMin: 800,
    clickFreqMax: 1400,
    clickDrop: 0.5,
    wheelWave: 'square',
    wheelSweepMin: 400,
    wheelSweepMax: 1200,
    breath: false,
    harmony: true,
    echo: false,
    filterCutoff: 8000
  },
  droplet: {
    id: 'droplet',
    label: '水滴',
    icon: '💧',
    scale: [0, 2, 4, 7, 9, 12],
    root: 72,
    waves: ['sine'],
    keyDurMin: 0.2,
    keyDurMax: 0.4,
    vibrato: false,
    vibratoDepth: 0,
    clickWave: 'sine',
    clickFreqMin: 900,
    clickFreqMax: 1500,
    clickDrop: 0.4,
    wheelWave: 'sine',
    wheelSweepMin: 500,
    wheelSweepMax: 1500,
    breath: false,
    harmony: false,
    echo: true,
    filterCutoff: 12000
  }
}

export const AUDIO_THEMES: { id: AudioTheme; label: string; icon: string }[] = [
  { id: 'none', label: '不启用音效', icon: '🔇' },
  ...Object.values(THEMES).map((t) => ({ id: t.id as AudioTheme, label: t.label, icon: t.icon }))
]

const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

function randOf<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

class AudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private delaySend: GainNode | null = null
  private noise: AudioBuffer | null = null
  private theme: Exclude<AudioTheme, 'none'> = 'ghost'
  private volume = 0.5
  private lastAt = 0

  setTheme(v: AudioTheme) {
    if (v === 'none') {
      this.ctx?.suspend().catch(() => {})
      return
    }
    this.theme = v
    this.ensure()
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

    // Feedback echo — gives ghost/droplet a floating, cavernous tail.
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

  note(kind: ImpulseKind, intensity = 0) {
    const now = performance.now()
    if (now - this.lastAt < 50) return // throttle fast typing into a chorus
    this.lastAt = now
    this.ensure()
    if (!this.ctx || !this.master) return
    if (kind === 'key') this.key(intensity)
    else if (kind === 'click') this.click()
    else this.wheel()
  }

  celebrate() {
    this.ensure()
    if (!this.ctx || !this.master) return
    const th = THEMES[this.theme]
    const t = this.ctx.currentTime
    // A quick rising arpeggio over the theme's scale — the milestone chorus.
    th.scale.slice(0, 4).forEach((step, i) => {
      const f = midiToFreq(th.root + step + 12)
      this.voice(th.waves[0], f, f, t + i * 0.08, 0.16, 0.3, 0)
    })
  }

  private key(intensity: number) {
    const th = THEMES[this.theme]
    const boost = Math.min(2, Math.floor(intensity * 3)) * 12
    const f0 = midiToFreq(th.root + randOf(th.scale) + boost)
    const f1 = f0 * (Math.random() < 0.5 ? 1.06 : 0.94)
    const dur = th.keyDurMin + Math.random() * (th.keyDurMax - th.keyDurMin)
    const wave = randOf(th.waves)
    this.voice(wave, f0, f1, 0, dur, 0.4, th.vibrato ? th.vibratoDepth : 0, th.vibrato ? 4 + Math.random() * 3 : 0)
    if (th.harmony) this.voice(th.waves[0], f0 * 1.5, f0 * 1.5, 0.01, dur * 0.7, 0.16, 0)
    if (th.breath) this.breath(900, 300, dur * 0.7, 0.14)
  }

  private click() {
    const th = THEMES[this.theme]
    const f0 = th.clickFreqMin + Math.random() * (th.clickFreqMax - th.clickFreqMin)
    this.voice(th.clickWave, f0, f0 * th.clickDrop, 0, 0.14, 0.3, 0)
    if (th.breath) this.breath(1400, 700, 0.09, 0.06)
  }

  private wheel() {
    const th = THEMES[this.theme]
    const up = Math.random() < 0.5
    const f0 = up ? th.wheelSweepMin : th.wheelSweepMax
    const f1 = up ? th.wheelSweepMax : th.wheelSweepMin
    this.voice(th.wheelWave, f0, f1, 0, 0.28, 0.35, 0)
    if (th.breath) this.breath(up ? 800 : 500, up ? 1500 : 250, 0.28, 0.1)
  }

  /** One oscillator voice: start at f0, glide to f1, with an attack/decay
   *  envelope, optional vibrato, a low-pass for timbre, random stereo pan and
   *  an optional echo send. */
  private voice(wave: OscillatorType, f0: number, f1: number, at: number, dur: number, level: number, vibDepth: number, vibRate = 0) {
    const ctx = this.ctx!
    const t = ctx.currentTime + at
    const osc = ctx.createOscillator()
    osc.type = wave
    osc.frequency.setValueAtTime(Math.max(1, f0), t)
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur)

    const env = ctx.createGain()
    env.gain.setValueAtTime(0, t)
    env.gain.linearRampToValueAtTime(level, t + 0.01)
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.4)

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = THEMES[this.theme].filterCutoff

    osc.connect(filter)
    filter.connect(env)

    if (vibDepth > 0) {
      const lfo = ctx.createOscillator()
      lfo.frequency.value = vibRate
      const lfoGain = ctx.createGain()
      lfoGain.gain.value = f0 * vibDepth
      lfo.connect(lfoGain)
      lfoGain.connect(osc.frequency)
      lfo.start(t)
      lfo.stop(t + dur + 0.5)
    }

    this.route(env)
    osc.start(t)
    osc.stop(t + dur + 0.5)
  }

  /** Route a node to the master with random stereo pan and optional echo. */
  private route(node: AudioNode) {
    const ctx = this.ctx!
    let out: AudioNode = node
    let panner: StereoPannerNode | null = null
    try {
      panner = ctx.createStereoPanner()
      panner.pan.value = Math.random() * 1.2 - 0.6
      node.connect(panner)
      out = panner
    } catch { /* StereoPanner unsupported — fall through to mono */ }
    out.connect(this.master!)
    if (THEMES[this.theme].echo && this.delaySend) node.connect(this.delaySend)
  }

  // Breath layer: white noise through a sweeping band-pass, reading as a
  // vowel-ish "whoo" that drops in pitch.
  private breath(from: number, to: number, dur: number, level: number) {
    if (!this.noise) return
    const ctx = this.ctx!
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noise
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
    this.route(env)
    src.start(t)
    src.stop(t + dur + 0.05)
  }
}

export const audioEngine = new AudioEngine()
