import type { Note, MelodyGenerationParams, GeneratedMelody, Scale } from "../types/music"
import { MusicTheory } from "./music-theory"
import { MarkovChain } from "./markov-chain"

export class MelodyGenerator {
  private markovChain: MarkovChain
  private trainingData: Note[][] = []

  constructor() {
    this.markovChain = new MarkovChain(2)
    this.initializeTrainingData()
  }

  private initializeTrainingData(): void {
    // Initialize with some basic melodic patterns
    const basicPatterns = [
      // C major scale ascending
      [60, 62, 64, 65, 67, 69, 71, 72].map((pitch, i) => ({
        pitch,
        duration: 0.5,
        velocity: 64,
        startTime: i * 0.5,
      })),
      // Simple chord arpeggios
      [60, 64, 67, 72, 67, 64].map((pitch, i) => ({
        pitch,
        duration: 0.25,
        velocity: 70,
        startTime: i * 0.25,
      })),
    ]

    basicPatterns.forEach((pattern) => {
      this.markovChain.train(pattern)
    })
  }

  async generateMelody(params: MelodyGenerationParams): Promise<GeneratedMelody> {
    return new Promise((resolve) => {
      // Use Web Worker simulation with setTimeout for non-blocking generation
      setTimeout(() => {
        const notes = this.generateNotes(params)
        const melody: GeneratedMelody = {
          id: crypto.randomUUID(),
          notes,
          params,
          createdAt: new Date(),
          name: `Melody ${new Date().toLocaleTimeString()}`,
        }
        resolve(melody)
      }, 0)
    })
  }

  private generateNotes(params: MelodyGenerationParams): Note[] {
    const notes: Note[] = []
    const beatsPerMeasure = 4
    const totalBeats = params.length * beatsPerMeasure
    let currentTime = 0

    // Generate initial note in scale
    const startNote = this.generateScaleNote(params.scale, params.range)
    notes.push({
      pitch: startNote,
      duration: this.generateDuration(params.rhythmDensity),
      velocity: this.generateVelocity(),
      startTime: currentTime,
    })

    currentTime += notes[0].duration

    // Generate subsequent notes
    while (currentTime < totalBeats) {
      const nextNote = this.generateNextNote(notes, params)
      if (!nextNote || currentTime + nextNote.duration > totalBeats) break

      nextNote.startTime = currentTime
      notes.push(nextNote)
      currentTime += nextNote.duration
    }

    return this.applyMusicTheoryRules(notes, params)
  }

  private generateNextNote(previousNotes: Note[], params: MelodyGenerationParams): Note | null {
    // Try Markov chain first
    const markovNote = this.markovChain.generateNext(previousNotes.slice(-2))

    if (markovNote && this.isValidNote(markovNote, params)) {
      return {
        ...markovNote,
        duration: this.generateDuration(params.rhythmDensity),
        velocity: this.generateVelocity(),
        startTime: 0, // Will be set by caller
      }
    }

    // Fallback to constraint-based generation
    return this.generateConstraintBasedNote(previousNotes, params)
  }

  private generateConstraintBasedNote(previousNotes: Note[], params: MelodyGenerationParams): Note {
    const lastNote = previousNotes[previousNotes.length - 1]
    const complexity = params.complexity

    // Determine interval based on complexity
    const maxInterval = Math.floor(complexity * 12) + 1
    const interval = Math.floor(Math.random() * maxInterval * 2) - maxInterval

    let newPitch = lastNote.pitch + interval

    // Ensure note is in range
    newPitch = Math.max(params.range[0], Math.min(params.range[1], newPitch))

    // Adjust to scale if needed
    if (!MusicTheory.isNoteInScale(newPitch, params.scale)) {
      newPitch = this.findNearestScaleNote(newPitch, params.scale)
    }

    return {
      pitch: newPitch,
      duration: this.generateDuration(params.rhythmDensity),
      velocity: this.generateVelocity(),
      startTime: 0,
    }
  }

  private generateScaleNote(scale: Scale, range: [number, number]): number {
    const scaleNotesInRange: number[] = []

    for (let octave = Math.floor(range[0] / 12); octave <= Math.floor(range[1] / 12); octave++) {
      scale.notes.forEach((note) => {
        const midiNote = octave * 12 + note
        if (midiNote >= range[0] && midiNote <= range[1]) {
          scaleNotesInRange.push(midiNote)
        }
      })
    }

    return scaleNotesInRange[Math.floor(Math.random() * scaleNotesInRange.length)] || range[0]
  }

  private findNearestScaleNote(pitch: number, scale: Scale): number {
    const octave = Math.floor(pitch / 12)
    const noteClass = pitch % 12

    let minDistance = 12
    let nearestNote = pitch

    scale.notes.forEach((scaleNote) => {
      const distance = Math.abs(noteClass - scaleNote)
      if (distance < minDistance) {
        minDistance = distance
        nearestNote = octave * 12 + scaleNote
      }
    })

    return nearestNote
  }

  private generateDuration(rhythmDensity: number): number {
    const durations = [0.25, 0.5, 1, 2]
    const weights = rhythmDensity > 0.5 ? [0.4, 0.4, 0.15, 0.05] : [0.1, 0.3, 0.4, 0.2]

    const random = Math.random()
    let cumulative = 0

    for (let i = 0; i < durations.length; i++) {
      cumulative += weights[i]
      if (random <= cumulative) {
        return durations[i]
      }
    }

    return 0.5
  }

  private generateVelocity(): number {
    return Math.floor(Math.random() * 32) + 64 // 64-96 range
  }

  private isValidNote(note: Note, params: MelodyGenerationParams): boolean {
    return (
      note.pitch >= params.range[0] &&
      note.pitch <= params.range[1] &&
      MusicTheory.isNoteInScale(note.pitch, params.scale)
    )
  }

  private applyMusicTheoryRules(notes: Note[], params: MelodyGenerationParams): Note[] {
    // Apply voice leading rules
    for (let i = 1; i < notes.length; i++) {
      const interval = Math.abs(notes[i].pitch - notes[i - 1].pitch)

      // Avoid large leaps (complexity-based)
      const maxLeap = Math.floor(params.complexity * 12) + 7
      if (interval > maxLeap) {
        notes[i].pitch = notes[i - 1].pitch + (notes[i].pitch > notes[i - 1].pitch ? maxLeap : -maxLeap)
      }
    }

    return notes
  }

  trainFromMelody(melody: GeneratedMelody): void {
    this.markovChain.train(melody.notes)
  }
}
