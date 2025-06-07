import type { Note } from "../types/music"

export class MarkovChain {
  private transitions: Map<string, Map<string, number>> = new Map()
  private order: number

  constructor(order = 2) {
    this.order = order
  }

  train(notes: Note[]): void {
    if (notes.length < this.order + 1) return

    for (let i = 0; i < notes.length - this.order; i++) {
      const state = this.createState(notes.slice(i, i + this.order))
      const nextNote = this.noteToString(notes[i + this.order])

      if (!this.transitions.has(state)) {
        this.transitions.set(state, new Map())
      }

      const stateTransitions = this.transitions.get(state)!
      stateTransitions.set(nextNote, (stateTransitions.get(nextNote) || 0) + 1)
    }

    // Normalize probabilities
    this.transitions.forEach((transitions) => {
      const total = Array.from(transitions.values()).reduce((sum, count) => sum + count, 0)
      transitions.forEach((count, note) => {
        transitions.set(note, count / total)
      })
    })
  }

  generateNext(previousNotes: Note[]): Note | null {
    if (previousNotes.length < this.order) return null

    const state = this.createState(previousNotes.slice(-this.order))
    const transitions = this.transitions.get(state)

    if (!transitions || transitions.size === 0) return null

    const random = Math.random()
    let cumulative = 0

    for (const [noteString, probability] of transitions) {
      cumulative += probability
      if (random <= cumulative) {
        return this.stringToNote(noteString)
      }
    }

    return null
  }

  private createState(notes: Note[]): string {
    return notes.map((note) => this.noteToString(note)).join("|")
  }

  private noteToString(note: Note): string {
    return `${note.pitch},${note.duration}`
  }

  private stringToNote(noteString: string): Note {
    const [pitch, duration] = noteString.split(",").map(Number)
    return {
      pitch,
      duration,
      velocity: 64,
      startTime: 0,
    }
  }

  clear(): void {
    this.transitions.clear()
  }

  getStateCount(): number {
    return this.transitions.size
  }
}
