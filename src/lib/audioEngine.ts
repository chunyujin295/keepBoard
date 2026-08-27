// Procedural input-sound engine — no audio files, everything is synthesised
// live with the Web Audio API. Each theme is a set of synthesis parameters;
// click/key/wheel all draw from the SAME instrument voice per theme (a short
// pluck, a sustained note, and a pitch sweep), so a theme reads as one coherent
// sound rather than three unrelated noises.
//
// The engine is data-driven: `note()` takes an intensity (0–1, driven by the
// input "combo") that lifts the pitch as you type faster, so a hard-working day
// sounds more excited than an idle one.

export type AudioTheme = 'none' | 'ghost' | 'robot' | '8bit' | 'droplet' | 'choir'

type ImpulseKind = 'key' | 'click' | 'wheel'

interface Theme {
  id: Exclude<AudioTheme, 'none'>
  label: string
  icon: string
  scale: number[]
  roots: number[]
  octSpread: number
  intensityBoost: number
  wave: OscillatorType
  waves?: OscillatorType[]
  keyDurMin: number
  keyDurMax: number
  attack: number
  glide: boolean
  vibrato: boolean
  vibratoDepth: number
  vibratoRate: number
  clickOct: number
  clickDur: number
  clickDrop: number
  wheelSweepMin: number
  wheelSweepMax: number
  breath: boolean
  harmony: boolean
  echo: boolean
  vowel: boolean
  formants?: [number, number]
}

const THEMES: Record<Exclude<AudioTheme, 'none'>, Theme> = {
  ghost: {
    id: 'ghost',
    label: '宇宙幽灵',
    icon: '👻',
    scale: [0, 3, 5, 7, 10],
    roots: [45, 57, 69],
    octSpread: 1,
    intensityBoost: 0,
    wave: 'triangle',
    waves: ['sine', 'triangle'],
    keyDurMin: 0.32,
    keyDurMax: 0.6,
    attack: 0.01,
    glide: true,
    vibrato: true,
    vibratoDepth: 0.04,
    vibratoRate: 5,
    clickOct: 12,
    clickDur: 0.14,
    clickDrop: 0.55,
    wheelSweepMin: 300,
    wheelSweepMax: 900,
    breath: true,
    harmony: false,
    echo: true,
    vowel: false
  },
  robot: {
    id: 'robot',
    label: '机器人',
    icon: '🤖',
    scale: [0, 12, 24],
    roots: [36],
    octSpread: 0,
    intensityBoost: 0,
    wave: 'square',
    keyDurMin: 0.06,
    keyDurMax: 0.12,
    attack: 0.005,
    glide: false,
    vibrato: false,
    vibratoDepth: 0,
    vibratoRate: 0,
    clickOct: 12,
    clickDur: 0.08,
    clickDrop: 0.8,
    wheelSweepMin: 150,
    wheelSweepMax: 300,
    breath: false,
    harmony: false,
    echo: false,
    vowel: false
  },
  '8bit': {
    id: '8bit',
    label: '8-bit 芯片',
    icon: '👾',
    scale: [0, 4, 7, 12],
    roots: [60],
    octSpread: 0,
    intensityBoost: 12,
    wave: 'square',
    keyDurMin: 0.04,
    keyDurMax: 0.09,
    attack: 0.002,
    glide: false,
    vibrato: false,
    vibratoDepth: 0,
    vibratoRate: 0,
    clickOct: 12,
    clickDur: 0.06,
    clickDrop: 0.5,
    wheelSweepMin: 400,
    wheelSweepMax: 1200,
    breath: false,
    harmony: false,
    echo: false,
    vowel: false
  },
  droplet: {
    id: 'droplet',
    label: '水滴',
    icon: '💧',
    scale: [0, 2, 4, 7, 9, 12],
    roots: [72],
    octSpread: 0,
    intensityBoost: 12,
    wave: 'sine',
    keyDurMin: 0.2,
    keyDurMax: 0.4,
    attack: 0.01,
    glide: false,
    vibrato: false,
    vibratoDepth: 0,
    vibratoRate: 0,
    clickOct: 12,
    clickDur: 0.1,
    clickDrop: 0.4,
    wheelSweepMin: 500,
    wheelSweepMax: 1500,
    breath: false,
    harmony: false,
    echo: true,
    vowel: false
  },
  choir: {
    id: 'choir',
    label: '圣歌人声',
    icon: '😇',
    scale: [0, 2, 4, 7, 9],
    roots: [52, 57, 64],
    octSpread: 0,
    intensityBoost: 12,
    wave: 'sawtooth',
    keyDurMin: 0.5,
    keyDurMax: 0.9,
    attack: 0.1,
    glide: false,
    vibrato: true,
    vibratoDepth: 0.03,
    vibratoRate: 4.5,
    clickOct: 12,
    clickDur: 0.18,
    clickDrop: 0.9,
    wheelSweepMin: 400,
    wheelSweepMax: 900,
    breath: false,
    harmony: false,
    echo: true,
    vowel: true,
    formants: [730, 1090]
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
  private enabled = false
  private volume = 0.5
  private lastAt = 0

  setTheme(v: AudioTheme) {
    if (v === 'none') {
      this.enabled = false
      this.ctx?.suspend().catch(() => {})
      return
    }
    this.theme = v
    this.enabled = true
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

    // Feedback echo — gives ghost/droplet/choir a floating, cavernous tail.
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
    if (!this.enabled) return
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
    if (!this.enabled) return
    this.ensure()
    if (!this.ctx || !this.master) return
    const th = THEMES[this.theme]
    const t = this.ctx.currentTime
    // A quick rising arpeggio over the theme's scale — the milestone chorus.
    th.scale.slice(0, 4).forEach((step, i) => {
      const f = midiToFreq(th.roots[0] + step + 12)
      if (th.vowel) this.vowel(f, f, t + i * 0.08, 0.2, 0.3, 0.03, 0)
      else this.voice(th.wave, f, f, t + i * 0.08, 0.16, 0.3, 0)
    })
  }

  private key(intensity: number) {
    const th = THEMES[this.theme]
    const boost = Math.min(2, Math.floor(intensity * 3)) * th.intensityBoost
    const root = randOf(th.roots)
    const oct = Math.floor(Math.random() * (th.octSpread + 1)) * 12
    const f0 = midiToFreq(root + randOf(th.scale) + oct + boost)
    const f1 = th.glide ? f0 * (Math.random() < 0.5 ? 1.06 : 0.94) : f0
    const dur = th.keyDurMin + Math.random() * (th.keyDurMax - th.keyDurMin)
    const wave = th.waves ? randOf(th.waves) : th.wave
    if (th.vowel) this.vowel(f0, f1, 0, dur, 0.4, th.attack, th.vibrato ? th.vibratoRate : 0)
    else this.voice(wave, f0, f1, 0, dur, 0.4, th.vibrato ? th.vibratoDepth : 0, th.vibrato ? th.vibratoRate : 0)
    if (th.harmony) this.voice(th.wave, f0 * 1.5, f0 * 1.5, 0.01, dur * 0.7, 0.16, 0)
    if (th.breath) this.breath(900, 300, dur * 0.7, 0.14)
  }

  private click() {
    const th = THEMES[this.theme]
    const f0 = midiToFreq(randOf(th.roots) + th.clickOct + randOf(th.scale))
    const f1 = f0 * th.clickDrop
    const wave = th.waves ? randOf(th.waves) : th.wave
    if (th.vowel) this.vowel(f0, f1, 0, th.clickDur, 0.35, 0.02, 0)
    else this.voice(wave, f0, f1, 0, th.clickDur, 0.3, 0)
    if (th.breath) this.breath(1400, 700, 0.09, 0.06)
  }

  private wheel() {
    const th = THEMES[this.theme]
    const up = Math.random() < 0.5
    const f0 = up ? th.wheelSweepMin : th.wheelSweepMax
    const f1 = up ? th.wheelSweepMax : th.wheelSweepMin
    if (th.vowel) this.vowel(f0, f1, 0, 0.28, 0.35, 0.03, 0)
    else this.voice(th.wave, f0, f1, 0, 0.28, 0.35, 0)
    if (th.breath) this.breath(up ? 800 : 500, up ? 1500 : 250, 0.28, 0.1)
  }

  /** One oscillator voice: start at f0, glide to f1, with an attack/decay
   *  envelope, optional vibrato, random stereo pan and an optional echo send. */
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

    osc.connect(env)

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

  /** Human-vowel ("ah") voice: two slightly detuned saw carriers pass through
   *  two band-pass formants and a little dry blend, so it keeps the note pitch
   *  while reading as a sung vowel — short = "啊", sustained = choir. */
  private vowel(f0: number, f1: number, at: number, dur: number, level: number, attack: number, vibRate = 0) {
    const ctx = this.ctx!
    const t = ctx.currentTime + at
    const [F1, F2] = THEMES[this.theme].formants ?? [730, 1090]

    const mk = (det: number) => {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.setValueAtTime(Math.max(1, f0), t)
      o.detune.value = det
      if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur)
      return o
    }
    const o1 = mk(-6)
    const o2 = mk(6)

    const bp1 = ctx.createBiquadFilter()
    bp1.type = 'bandpass'
    bp1.frequency.value = F1
    bp1.Q.value = 3
    const bp2 = ctx.createBiquadFilter()
    bp2.type = 'bandpass'
    bp2.frequency.value = F2
    bp2.Q.value = 4
    const g2 = ctx.createGain()
    g2.gain.value = 0.7
    const dry = ctx.createGain()
    dry.gain.value = 0.12
    const sum = ctx.createGain()

    o1.connect(bp1); o2.connect(bp1); bp1.connect(sum)
    o1.connect(bp2); o2.connect(bp2); bp2.connect(g2); g2.connect(sum)
    o1.connect(dry); o2.connect(dry); dry.connect(sum)

    const env = ctx.createGain()
    env.gain.setValueAtTime(0, t)
    env.gain.linearRampToValueAtTime(level, t + attack)
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.4)
    sum.connect(env)

    if (vibRate > 0) {
      const lfo = ctx.createOscillator()
      lfo.frequency.value = vibRate
      const lfoGain = ctx.createGain()
      lfoGain.gain.value = f0 * 0.03
      lfo.connect(lfoGain)
      lfoGain.connect(o1.frequency)
      lfoGain.connect(o2.frequency)
      lfo.start(t)
      lfo.stop(t + dur + 0.5)
    }

    this.route(env)
    o1.start(t); o2.start(t)
    o1.stop(t + dur + 0.5); o2.stop(t + dur + 0.5)
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
