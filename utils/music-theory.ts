import type { Scale, Chord, ChordType, ScaleType } from "../types/music"

export class MusicTheory {
  static readonly SCALE_PATTERNS: Record<ScaleType, number[]> = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    aeolian: [0, 2, 3, 5, 7, 8, 10],
    locrian: [0, 1, 3, 5, 6, 8, 10],
  }

  static readonly CHORD_PATTERNS: Record<ChordType, number[]> = {
    major: [0, 4, 7],
    minor: [0, 3, 7],
    diminished: [0, 3, 6],
    augmented: [0, 4, 8],
    sus2: [0, 2, 7],
    sus4: [0, 5, 7],
    maj7: [0, 4, 7, 11],
    min7: [0, 3, 7, 10],
    dom7: [0, 4, 7, 10],
  }

  static readonly NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

  static createScale(root: number, type: ScaleType): Scale {
    const pattern = this.SCALE_PATTERNS[type]
    const notes = pattern.map((interval) => (root + interval) % 12)
    return { root, type, notes }
  }

  static createChord(root: number, type: ChordType, inversion = 0): Chord {
    return { root, type, inversion }
  }

  static getChordNotes(chord: Chord): number[] {
    const pattern = this.CHORD_PATTERNS[chord.type]
    const notes = pattern.map((interval) => chord.root + interval)

    // Apply inversion
    for (let i = 0; i < chord.inversion; i++) {
      const note = notes.shift()
      if (note !== undefined) {
        notes.push(note + 12)
      }
    }

    return notes
  }

  static isNoteInScale(note: number, scale: Scale): boolean {
    const noteClass = note % 12
    return scale.notes.includes(noteClass)
  }

  static getScaleDegree(note: number, scale: Scale): number {
    const noteClass = note % 12
    return scale.notes.indexOf(noteClass)
  }

  static midiToNoteName(midi: number): string {
    const octave = Math.floor(midi / 12) - 1
    const noteIndex = midi % 12
    return `${this.NOTE_NAMES[noteIndex]}${octave}`
  }

  static noteNameToMidi(noteName: string): number {
    const match = noteName.match(/^([A-G]#?)(\d+)$/)
    if (!match) throw new Error(`Invalid note name: ${noteName}`)

    const [, note, octave] = match
    const noteIndex = this.NOTE_NAMES.indexOf(note)
    return (Number.parseInt(octave) + 1) * 12 + noteIndex
  }

  static getNextScaleNote(currentNote: number, scale: Scale, direction: 1 | -1): number {
    const currentDegree = this.getScaleDegree(currentNote, scale)
    if (currentDegree === -1) return currentNote // Note not in scale

    const nextDegree = (currentDegree + direction + scale.notes.length) % scale.notes.length
    const octaveChange =
      direction > 0 && nextDegree < currentDegree ? 12 : direction < 0 && nextDegree > currentDegree ? -12 : 0

    return Math.floor(currentNote / 12) * 12 + scale.notes[nextDegree] + octaveChange
  }
}
