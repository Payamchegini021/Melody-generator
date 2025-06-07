import type { GeneratedMelody, ExportFormat } from "../types/music"

export class StorageManager {
  private dbName = "MelodyGeneratorDB"
  private version = 1
  private db: IDBDatabase | null = null

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        if (!db.objectStoreNames.contains("melodies")) {
          const melodyStore = db.createObjectStore("melodies", { keyPath: "id" })
          melodyStore.createIndex("createdAt", "createdAt", { unique: false })
          melodyStore.createIndex("name", "name", { unique: false })
        }

        if (!db.objectStoreNames.contains("preferences")) {
          db.createObjectStore("preferences", { keyPath: "key" })
        }
      }
    })
  }

  async saveMelody(melody: GeneratedMelody): Promise<void> {
    if (!this.db) await this.initialize()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["melodies"], "readwrite")
      const store = transaction.objectStore("melodies")
      const request = store.put(melody)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async getMelody(id: string): Promise<GeneratedMelody | null> {
    if (!this.db) await this.initialize()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["melodies"], "readonly")
      const store = transaction.objectStore("melodies")
      const request = store.get(id)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result || null)
    })
  }

  async getAllMelodies(): Promise<GeneratedMelody[]> {
    if (!this.db) await this.initialize()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["melodies"], "readonly")
      const store = transaction.objectStore("melodies")
      const request = store.getAll()

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result || [])
    })
  }

  async deleteMelody(id: string): Promise<void> {
    if (!this.db) await this.initialize()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["melodies"], "readwrite")
      const store = transaction.objectStore("melodies")
      const request = store.delete(id)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async savePreference(key: string, value: any): Promise<void> {
    if (!this.db) await this.initialize()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["preferences"], "readwrite")
      const store = transaction.objectStore("preferences")
      const request = store.put({ key, value })

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async getPreference(key: string): Promise<any> {
    if (!this.db) await this.initialize()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["preferences"], "readonly")
      const store = transaction.objectStore("preferences")
      const request = store.get(key)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result?.value)
    })
  }
}

export class ExportManager {
  static async exportMelody(melody: GeneratedMelody, format: ExportFormat): Promise<Blob> {
    switch (format) {
      case "midi":
        return this.exportToMidi(melody)
      case "wav":
        return this.exportToWav(melody)
      case "mp3":
        return this.exportToMp3(melody)
      case "musicxml":
        return this.exportToMusicXML(melody)
      default:
        throw new Error(`Unsupported export format: ${format}`)
    }
  }

  private static async exportToMidi(melody: GeneratedMelody): Promise<Blob> {
    // Simplified MIDI export - in production, use a proper MIDI library
    const midiData = this.createSimpleMidiData(melody)
    return new Blob([midiData], { type: "audio/midi" })
  }

  private static createSimpleMidiData(melody: GeneratedMelody): Uint8Array {
    // This is a very basic MIDI file structure
    // In production, use a proper MIDI library like 'midi-writer-js'
    const header = new Uint8Array([
      0x4d,
      0x54,
      0x68,
      0x64, // "MThd"
      0x00,
      0x00,
      0x00,
      0x06, // Header length
      0x00,
      0x00, // Format type 0
      0x00,
      0x01, // 1 track
      0x00,
      0x60, // 96 ticks per quarter note
    ])

    const trackData = this.createMidiTrackData(melody)
    const trackHeader = new Uint8Array([
      0x4d,
      0x54,
      0x72,
      0x6b, // "MTrk"
      ...this.numberToBytes(trackData.length, 4),
    ])

    const result = new Uint8Array(header.length + trackHeader.length + trackData.length)
    result.set(header, 0)
    result.set(trackHeader, header.length)
    result.set(trackData, header.length + trackHeader.length)

    return result
  }

  private static createMidiTrackData(melody: GeneratedMelody): Uint8Array {
    const events: number[] = []

    melody.notes.forEach((note, index) => {
      const deltaTime = index === 0 ? 0 : Math.floor((note.startTime - melody.notes[index - 1].startTime) * 96)
      const duration = Math.floor(note.duration * 96)

      // Note on event
      events.push(...this.variableLengthQuantity(deltaTime))
      events.push(0x90) // Note on, channel 0
      events.push(note.pitch)
      events.push(note.velocity)

      // Note off event
      events.push(...this.variableLengthQuantity(duration))
      events.push(0x80) // Note off, channel 0
      events.push(note.pitch)
      events.push(0x40) // Release velocity
    })

    // End of track
    events.push(0x00, 0xff, 0x2f, 0x00)

    return new Uint8Array(events)
  }

  private static variableLengthQuantity(value: number): number[] {
    const bytes: number[] = []
    bytes.unshift(value & 0x7f)
    value >>= 7

    while (value > 0) {
      bytes.unshift((value & 0x7f) | 0x80)
      value >>= 7
    }

    return bytes
  }

  private static numberToBytes(value: number, bytes: number): number[] {
    const result: number[] = []
    for (let i = bytes - 1; i >= 0; i--) {
      result.push((value >> (i * 8)) & 0xff)
    }
    return result
  }

  private static async exportToWav(melody: GeneratedMelody): Promise<Blob> {
    // This would require rendering the audio using the AudioEngine
    // For now, return a placeholder
    const placeholder = new ArrayBuffer(44) // WAV header size
    return new Blob([placeholder], { type: "audio/wav" })
  }

  private static async exportToMp3(melody: GeneratedMelody): Promise<Blob> {
    // This would require MP3 encoding
    // For now, return a placeholder
    const placeholder = new ArrayBuffer(1024)
    return new Blob([placeholder], { type: "audio/mp3" })
  }

  private static async exportToMusicXML(melody: GeneratedMelody): Promise<Blob> {
    const xml = this.createMusicXML(melody)
    return new Blob([xml], { type: "application/vnd.recordare.musicxml+xml" })
  }

  private static createMusicXML(melody: GeneratedMelody): string {
    // Basic MusicXML structure
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1">
      <part-name>Generated Melody</part-name>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <key>
          <fifths>0</fifths>
        </key>
        <time>
          <beats>4</beats>
          <beat-type>4</beat-type>
        </time>
        <clef>
          <sign>G</sign>
          <line>2</line>
        </clef>
      </attributes>
      ${melody.notes
        .map(
          (note) => `
      <note>
        <pitch>
          <step>${this.midiToPitchClass(note.pitch)}</step>
          <octave>${this.midiToOctave(note.pitch)}</octave>
        </pitch>
        <duration>${Math.floor(note.duration * 4)}</duration>
        <type>${this.durationToNoteType(note.duration)}</type>
      </note>`,
        )
        .join("")}
    </measure>
  </part>
</score-partwise>`
  }

  private static midiToPitchClass(midi: number): string {
    const pitchClasses = ["C", "C", "D", "D", "E", "F", "F", "G", "G", "A", "A", "B"]
    return pitchClasses[midi % 12]
  }

  private static midiToOctave(midi: number): number {
    return Math.floor(midi / 12) - 1
  }

  private static durationToNoteType(duration: number): string {
    if (duration >= 2) return "half"
    if (duration >= 1) return "quarter"
    if (duration >= 0.5) return "eighth"
    return "sixteenth"
  }
}
