// Web Audio API RPG Raid Boss Soundtrack & SFX Synthesizer

export type MusicTrack = 'boss' | 'enraged' | 'ambient'

class SoundEngine {
  private ctx: AudioContext | null = null
  private isPlayingMusic = false
  private isSfxEnabled = true
  private volume = 0.35
  private currentTrack: MusicTrack = 'boss'
  private stepIndex = 0
  private timerId: number | null = null
  private listeners = new Set<() => void>()

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AudioCtx) {
        this.ctx = new AudioCtx()
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
    return this.ctx
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify() {
    for (const l of this.listeners) l()
  }

  public getState() {
    return {
      isPlayingMusic: this.isPlayingMusic,
      isSfxEnabled: this.isSfxEnabled,
      volume: this.volume,
      currentTrack: this.currentTrack,
    }
  }

  public setVolume(val: number) {
    this.volume = Math.max(0, Math.min(1, val))
    this.notify()
  }

  public toggleSfx() {
    this.isSfxEnabled = !this.isSfxEnabled
    if (this.isSfxEnabled) {
      this.playUiClick()
    }
    this.notify()
  }

  public setTrack(track: MusicTrack) {
    if (this.currentTrack === track) return
    this.currentTrack = track
    if (this.isPlayingMusic) {
      this.stopScheduler()
      this.startScheduler()
    }
    this.notify()
  }

  public toggleMusic(): boolean {
    if (this.isPlayingMusic) {
      this.stopMusic()
    } else {
      this.startMusic()
    }
    return this.isPlayingMusic
  }

  public startMusic() {
    const ctx = this.ensureContext()
    if (!ctx) return
    if (this.isPlayingMusic) return
    this.isPlayingMusic = true
    this.stepIndex = 0
    this.startScheduler()
    this.notify()
  }

  public stopMusic() {
    this.isPlayingMusic = false
    this.stopScheduler()
    this.notify()
  }

  private stopScheduler() {
    if (this.timerId !== null) {
      window.clearInterval(this.timerId)
      this.timerId = null
    }
  }

  private midiToFreq(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12)
  }

  private startScheduler() {
    this.stopScheduler()
    // 16th-note step duration based on track BPM
    const bpm =
      this.currentTrack === 'enraged' ? 150 : this.currentTrack === 'ambient' ? 96 : 128
    const stepMs = (60 / bpm / 4) * 1000

    this.timerId = window.setInterval(() => {
      if (!this.isPlayingMusic) return
      this.playStep(this.stepIndex)
      this.stepIndex = (this.stepIndex + 1) % 64
    }, stepMs)
  }

  private playStep(step: number) {
    const ctx = this.ensureContext()
    if (!ctx || this.volume <= 0.01) return

    const now = ctx.currentTime

    // D Minor RPG Boss Progression: Dm -> Bb -> Gm -> A7
    const bar = Math.floor(step / 16) % 4
    const stepInBar = step % 16

    const bassRoots = [38, 34, 31, 33] // D2, Bb1, G1, A1
    const rootMidi = bassRoots[bar]

    if (this.currentTrack === 'ambient') {
      // Mystical Dungeon / Study Arp
      const arpOffsets = [0, 7, 12, 15, 12, 7, 3, 7]
      if (step % 2 === 0) {
        const note = rootMidi + 12 + arpOffsets[(step / 2) % arpOffsets.length]
        this.playSynthNote(ctx, this.midiToFreq(note), now, 0.24, 'triangle', 0.16 * this.volume)
      }
      if (stepInBar === 0) {
        this.playSynthNote(ctx, this.midiToFreq(rootMidi), now, 0.9, 'sine', 0.22 * this.volume)
      }
      return
    }

    // Driving Bassline (16th-note galloping RPG boss bass)
    const bassPattern = [0, 0, 12, 0, 7, 0, 12, 0, 0, 0, 12, 0, 10, 0, 7, 0]
    const bassMidi = rootMidi + bassPattern[stepInBar]
    if (stepInBar % 2 === 0 || this.currentTrack === 'enraged') {
      this.playSynthNote(
        ctx,
        this.midiToFreq(bassMidi),
        now,
        0.11,
        'sawtooth',
        0.18 * this.volume,
        750
      )
    }

    // Heroic Minor Melody (64-step loop)
    // 0 means rest
    const bossMelody: number[] = [
      // Bar 1 (Dm)
      62, 0, 65, 0, 69, 0, 67, 65, 64, 0, 62, 0, 60, 0, 62, 0,
      // Bar 2 (Bb)
      58, 0, 62, 0, 65, 0, 69, 0, 67, 0, 65, 64, 62, 0, 0, 0,
      // Bar 3 (Gm)
      55, 0, 58, 0, 62, 0, 67, 0, 65, 0, 64, 0, 62, 0, 58, 0,
      // Bar 4 (A7)
      57, 0, 61, 0, 64, 0, 67, 0, 69, 0, 73, 0, 74, 0, 69, 0,
    ]

    const melodyNote = bossMelody[step]
    if (melodyNote > 0) {
      const pitchShift = this.currentTrack === 'enraged' ? 12 : 0
      this.playSynthNote(
        ctx,
        this.midiToFreq(melodyNote + pitchShift),
        now,
        0.19,
        'square',
        0.14 * this.volume,
        1800
      )
    }

    // Harmony Pad on beat 1 of each bar
    if (stepInBar === 0) {
      const chordThird = bar === 3 ? 4 : 3
      this.playSynthNote(
        ctx,
        this.midiToFreq(rootMidi + 12 + chordThird),
        now,
        0.65,
        'triangle',
        0.1 * this.volume,
        1100
      )
    }

    // Percussion (Kick on 0, 4, 8, 12; Snare on 4, 12; Hi-hat on offbeats)
    if (stepInBar % 4 === 0) {
      this.playKick(ctx, now, 0.28 * this.volume)
    }
    if (stepInBar === 4 || stepInBar === 12) {
      this.playSnare(ctx, now, 0.14 * this.volume)
    } else if (stepInBar % 2 === 1) {
      this.playHiHat(ctx, now, 0.05 * this.volume)
    }
  }

  private playSynthNote(
    ctx: AudioContext,
    freq: number,
    startTime: number,
    duration: number,
    type: OscillatorType,
    gainVal: number,
    filterCutoff = 2000
  ) {
    const osc = ctx.createOscillator()
    const filter = ctx.createBiquadFilter()
    const gain = ctx.createGain()

    osc.type = type
    osc.frequency.setValueAtTime(freq, startTime)

    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(filterCutoff, startTime)
    filter.frequency.exponentialRampToValueAtTime(Math.max(200, filterCutoff * 0.4), startTime + duration)

    gain.gain.setValueAtTime(0.001, startTime)
    gain.gain.linearRampToValueAtTime(gainVal, startTime + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0008, startTime + duration)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)

    osc.start(startTime)
    osc.stop(startTime + duration + 0.02)
  }

  private playKick(ctx: AudioContext, startTime: number, gainVal: number) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(135, startTime)
    osc.frequency.exponentialRampToValueAtTime(36, startTime + 0.12)

    gain.gain.setValueAtTime(gainVal, startTime)
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.14)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(startTime)
    osc.stop(startTime + 0.15)
  }

  private playSnare(ctx: AudioContext, startTime: number, gainVal: number) {
    const bufferSize = ctx.sampleRate * 0.1
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1
    }

    const noise = ctx.createBufferSource()
    noise.buffer = buffer

    const filter = ctx.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.setValueAtTime(700, startTime)

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(gainVal, startTime)
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.1)

    noise.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)
    noise.start(startTime)
  }

  private playHiHat(ctx: AudioContext, startTime: number, gainVal: number) {
    const bufferSize = ctx.sampleRate * 0.04
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1
    }

    const noise = ctx.createBufferSource()
    noise.buffer = buffer

    const filter = ctx.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.setValueAtTime(5500, startTime)

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(gainVal, startTime)
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.04)

    noise.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)
    noise.start(startTime)
  }

  // ==================== SOUND EFFECTS (SFX) ====================

  public playUiClick() {
    if (!this.isSfxEnabled) return
    const ctx = this.ensureContext()
    if (!ctx) return
    this.playSynthNote(ctx, 660, ctx.currentTime, 0.05, 'triangle', 0.12 * this.volume, 2500)
  }

  public playAttackHit() {
    if (!this.isSfxEnabled) return
    const ctx = this.ensureContext()
    if (!ctx) return
    const now = ctx.currentTime
    // Sword slash + hit impact
    this.playSynthNote(ctx, 523.25, now, 0.08, 'sawtooth', 0.22 * this.volume, 2400)
    this.playSynthNote(ctx, 659.25, now + 0.06, 0.1, 'sawtooth', 0.24 * this.volume, 2800)
    this.playSynthNote(ctx, 880, now + 0.12, 0.18, 'square', 0.25 * this.volume, 3200)
    this.playKick(ctx, now + 0.12, 0.35 * this.volume)
  }

  public playShieldUp() {
    if (!this.isSfxEnabled) return
    const ctx = this.ensureContext()
    if (!ctx) return
    const now = ctx.currentTime
    // Crystalline barrier chord
    ;[392, 493.88, 587.33, 783.99].forEach((freq, idx) => {
      this.playSynthNote(
        ctx,
        freq,
        now + idx * 0.045,
        0.25,
        'triangle',
        0.2 * this.volume,
        3000
      )
    })
  }

  public playHealChime() {
    if (!this.isSfxEnabled) return
    const ctx = this.ensureContext()
    if (!ctx) return
    const now = ctx.currentTime
    // Ascending celestial chime
    ;[523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      this.playSynthNote(
        ctx,
        freq,
        now + idx * 0.055,
        0.28,
        'sine',
        0.22 * this.volume,
        4000
      )
    })
  }

  public playCriticalSkill() {
    if (!this.isSfxEnabled) return
    const ctx = this.ensureContext()
    if (!ctx) return
    const now = ctx.currentTime
    // Epic power-up fanfare
    ;[440, 554.37, 659.25, 880, 1108.73].forEach((freq, idx) => {
      this.playSynthNote(
        ctx,
        freq,
        now + idx * 0.05,
        0.3,
        'sawtooth',
        0.26 * this.volume,
        3500
      )
    })
    this.playKick(ctx, now + 0.2, 0.45 * this.volume)
  }

  public playErrorOrFreeze() {
    if (!this.isSfxEnabled) return
    const ctx = this.ensureContext()
    if (!ctx) return
    const now = ctx.currentTime
    this.playSynthNote(ctx, 195, now, 0.18, 'sawtooth', 0.22 * this.volume, 800)
    this.playSynthNote(ctx, 146.83, now + 0.14, 0.28, 'sawtooth', 0.22 * this.volume, 600)
  }

  public playBossRoar() {
    if (!this.isSfxEnabled) return
    const ctx = this.ensureContext()
    if (!ctx) return
    const now = ctx.currentTime
    this.playSynthNote(ctx, 110, now, 0.45, 'sawtooth', 0.3 * this.volume, 500)
    this.playSynthNote(ctx, 82.41, now + 0.1, 0.55, 'sawtooth', 0.3 * this.volume, 400)
    this.playSnare(ctx, now + 0.05, 0.25 * this.volume)
  }
}

export const soundEngine = new SoundEngine()
