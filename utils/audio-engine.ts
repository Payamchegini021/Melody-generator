import * as Tone from "tone"
import type { Note, AudioSettings, InstrumentType, TransportState } from "../types/music"

export class AudioEngine {
  private synth: Tone.PolySynth | null = null
  private reverb: Tone.Reverb | null = null
  private volume: Tone.Volume | null = null
  private compressor: Tone.Compressor | null = null
  private currentInstrument: InstrumentType = "piano"
  private isInitialized = false
  private scheduledEvents: number[] = []

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      await Tone.start()

      // Create effects chain
      this.reverb = new Tone.Reverb({
        decay: 2.0,
        wet: 0.1,
      })

      this.volume = new Tone.Volume(-12)
      this.compressor = new Tone.Compressor(-30, 3)

      // Create initial synth
      this.createSynth("piano")

      // Connect effects chain
      this.synth!.chain(this.compressor, this.reverb, this.volume, Tone.Destination)

      this.isInitialized = true
    } catch (error) {
      console.error("Failed to initialize audio engine:", error)
      throw new Error("Audio initialization failed")
    }
  }

  private createSynth(instrumentType: InstrumentType): void {
    // Dispose of existing synth
    if (this.synth) {
      this.synth.dispose()
    }

    switch (instrumentType) {
      case "piano":
        this.synth = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: "sine" },
          envelope: {
            attack: 0.01,
            decay: 0.2,
            sustain: 0.3,
            release: 0.8,
          },
        })
        break

      case "strings":
        this.synth = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: "sawtooth" },
          envelope: {
            attack: 0.3,
            decay: 0.1,
            sustain: 0.8,
            release: 1.2,
          },
          filter: {
            frequency: 800,
            type: "lowpass",
            rolloff: -24,
          },
        })
        break

      case "synth":
        this.synth = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: "square" },
          envelope: {
            attack: 0.05,
            decay: 0.1,
            sustain: 0.4,
            release: 0.3,
          },
        })
        break

      case "electric-piano":
        this.synth = new Tone.PolySynth(Tone.FMSynth, {
          harmonicity: 2,
          modulationIndex: 12,
          envelope: {
            attack: 0.01,
            decay: 0.2,
            sustain: 0.1,
            release: 0.8,
          },
        })
        break
    }
  }

  async changeInstrument(instrumentType: InstrumentType): Promise<void> {
    if (!this.isInitialized) await this.initialize()

    this.currentInstrument = instrumentType
    this.createSynth(instrumentType)

    // Reconnect to effects chain
    if (this.synth && this.compressor && this.reverb && this.volume) {
      this.synth.chain(this.compressor, this.reverb, this.volume, Tone.Destination)
    }
  }

  async playNote(note: Note): Promise<void> {
    if (!this.isInitialized) await this.initialize()
    if (!this.synth) return

    const frequency = Tone.Frequency(note.pitch, "midi").toFrequency()
    const velocity = note.velocity / 127

    this.synth.triggerAttackRelease(frequency, note.duration, "+0", velocity)
  }

  async playMelody(notes: Note[], bpm = 120): Promise<void> {
    if (!this.isInitialized) await this.initialize()
    if (!this.synth) return

    // Clear any existing scheduled events
    this.stopMelody()

    Tone.Transport.bpm.value = bpm

    notes.forEach((note) => {
      const frequency = Tone.Frequency(note.pitch, "midi").toFrequency()
      const velocity = note.velocity / 127
      const startTime = `${note.startTime}n`
      const duration = `${note.duration}n`

      const eventId = Tone.Transport.schedule((time) => {
        this.synth!.triggerAttackRelease(frequency, duration, time, velocity)
      }, startTime)

      this.scheduledEvents.push(eventId as number)
    })

    Tone.Transport.start()
  }

  stopMelody(): void {
    Tone.Transport.stop()
    Tone.Transport.cancel()
    this.scheduledEvents = []
  }

  pauseMelody(): void {
    Tone.Transport.pause()
  }

  resumeMelody(): void {
    Tone.Transport.start()
  }

  updateAudioSettings(settings: Partial<AudioSettings>): void {
    if (!this.isInitialized || !this.synth) return

    if (settings.volume !== undefined && this.volume) {
      this.volume.volume.value = Tone.gainToDb(settings.volume)
    }

    if (settings.reverb !== undefined && this.reverb) {
      this.reverb.wet.value = settings.reverb
    }

    if (settings.instrument !== undefined) {
      this.changeInstrument(settings.instrument)
    }

    // Update envelope settings
    if (this.synth instanceof Tone.PolySynth) {
      const envelope = (this.synth as any).options.envelope
      if (settings.attack !== undefined) envelope.attack = settings.attack
      if (settings.decay !== undefined) envelope.decay = settings.decay
      if (settings.sustain !== undefined) envelope.sustain = settings.sustain
      if (settings.release !== undefined) envelope.release = settings.release
    }
  }

  getTransportState(): TransportState {
    return {
      isPlaying: Tone.Transport.state === "started",
      isPaused: Tone.Transport.state === "paused",
      currentTime: Tone.Transport.seconds,
      bpm: Tone.Transport.bpm.value,
      loop: Tone.Transport.loop as boolean,
    }
  }

  setBPM(bpm: number): void {
    Tone.Transport.bpm.value = bpm
  }

  setLoop(loop: boolean): void {
    Tone.Transport.loop = loop
  }

  dispose(): void {
    this.stopMelody()
    if (this.synth) this.synth.dispose()
    if (this.reverb) this.reverb.dispose()
    if (this.volume) this.volume.dispose()
    if (this.compressor) this.compressor.dispose()
    this.isInitialized = false
  }
}
