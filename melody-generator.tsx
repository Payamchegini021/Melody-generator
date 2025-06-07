"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Piano } from "./components/Piano"
import { PianoRoll } from "./components/PianoRoll"
import { TransportControls } from "./components/TransportControls"
import { ParameterControls } from "./components/ParameterControls"
import { SaveExportControls } from "./components/SaveExportControls"
import { MelodyGenerator } from "./utils/melody-generator"
import { AudioEngine } from "./utils/audio-engine"
import { StorageManager } from "./utils/storage"
import { MusicTheory } from "./utils/music-theory"
import type { Note, GeneratedMelody, MelodyGenerationParams, AudioSettings, TransportState } from "./types/music"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Music } from "lucide-react"

interface AppState {
  currentMelody: GeneratedMelody | null
  savedMelodies: GeneratedMelody[]
  isGenerating: boolean
  isPlaying: boolean
  playbackPosition: number
  error: string | null
  isAudioInitialized: boolean
}

export default function MelodyGeneratorApp() {
  // Core state
  const [state, setState] = useState<AppState>({
    currentMelody: null,
    savedMelodies: [],
    isGenerating: false,
    isPlaying: false,
    playbackPosition: 0,
    error: null,
    isAudioInitialized: false,
  })

  // Generation parameters
  const [generationParams, setGenerationParams] = useState<MelodyGenerationParams>({
    length: 4,
    complexity: 0.5,
    rhythmDensity: 0.6,
    range: [60, 84], // C4 to C6
    scale: MusicTheory.createScale(0, "major"),
  })

  // Audio settings
  const [audioSettings, setAudioSettings] = useState<AudioSettings>({
    instrument: "piano",
    volume: 0.8,
    reverb: 0.2,
    attack: 0.01,
    decay: 0.2,
    sustain: 0.3,
    release: 0.8,
  })

  // Transport state
  const [transportState, setTransportState] = useState<TransportState>({
    isPlaying: false,
    isPaused: false,
    currentTime: 0,
    bpm: 120,
    loop: false,
  })

  // Core instances
  const melodyGenerator = useRef<MelodyGenerator>(new MelodyGenerator())
  const audioEngine = useRef<AudioEngine>(new AudioEngine())
  const storageManager = useRef<StorageManager>(new StorageManager())
  const playbackInterval = useRef<NodeJS.Timeout | null>(null)

  // Error handling
  const handleError = useCallback((error: Error, context: string) => {
    console.error(`Error in ${context}:`, error)
    setState((prev) => ({ ...prev, error: `${context}: ${error.message}` }))
  }, [])

  // Initialize application
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize storage
        await storageManager.current.initialize()

        // Load saved melodies
        const savedMelodies = await storageManager.current.getAllMelodies()
        setState((prev) => ({ ...prev, savedMelodies }))

        // Load user preferences
        const savedParams = await storageManager.current.getPreference("generationParams")
        if (savedParams) {
          setGenerationParams(savedParams)
        }

        const savedAudioSettings = await storageManager.current.getPreference("audioSettings")
        if (savedAudioSettings) {
          setAudioSettings(savedAudioSettings)
        }
      } catch (error) {
        handleError(error as Error, "App initialization")
      }
    }

    initializeApp()
  }, [handleError])

  // Initialize audio on first user interaction
  const initializeAudio = useCallback(async () => {
    if (state.isAudioInitialized) return

    try {
      await audioEngine.current.initialize()
      await audioEngine.current.changeInstrument(audioSettings.instrument)
      audioEngine.current.updateAudioSettings(audioSettings)
      setState((prev) => ({ ...prev, isAudioInitialized: true }))
    } catch (error) {
      handleError(error as Error, "Audio initialization")
    }
  }, [state.isAudioInitialized, audioSettings, handleError])

  // Generate melody
  const generateMelody = useCallback(async () => {
    setState((prev) => ({ ...prev, isGenerating: true, error: null }))

    try {
      const melody = await melodyGenerator.current.generateMelody(generationParams)
      setState((prev) => ({ ...prev, currentMelody: melody, isGenerating: false }))

      // Save parameters
      await storageManager.current.savePreference("generationParams", generationParams)
    } catch (error) {
      setState((prev) => ({ ...prev, isGenerating: false }))
      handleError(error as Error, "Melody generation")
    }
  }, [generationParams, handleError])

  // Play melody
  const playMelody = useCallback(async () => {
    if (!state.currentMelody || !state.isAudioInitialized) return

    try {
      await audioEngine.current.playMelody(state.currentMelody.notes, transportState.bpm)
      setTransportState((prev) => ({ ...prev, isPlaying: true, isPaused: false }))

      // Start playback position tracking
      playbackInterval.current = setInterval(() => {
        const newState = audioEngine.current.getTransportState()
        setTransportState((prev) => ({ ...prev, currentTime: newState.currentTime }))
        setState((prev) => ({ ...prev, playbackPosition: newState.currentTime }))
      }, 50)
    } catch (error) {
      handleError(error as Error, "Melody playback")
    }
  }, [state.currentMelody, state.isAudioInitialized, transportState.bpm, handleError])

  // Stop melody
  const stopMelody = useCallback(() => {
    audioEngine.current.stopMelody()
    setTransportState((prev) => ({ ...prev, isPlaying: false, isPaused: false, currentTime: 0 }))
    setState((prev) => ({ ...prev, playbackPosition: 0 }))

    if (playbackInterval.current) {
      clearInterval(playbackInterval.current)
      playbackInterval.current = null
    }
  }, [])

  // Pause melody
  const pauseMelody = useCallback(() => {
    audioEngine.current.pauseMelody()
    setTransportState((prev) => ({ ...prev, isPlaying: false, isPaused: true }))

    if (playbackInterval.current) {
      clearInterval(playbackInterval.current)
      playbackInterval.current = null
    }
  }, [])

  // Resume melody
  const resumeMelody = useCallback(() => {
    audioEngine.current.resumeMelody()
    setTransportState((prev) => ({ ...prev, isPlaying: true, isPaused: false }))

    // Restart playback tracking
    playbackInterval.current = setInterval(() => {
      const newState = audioEngine.current.getTransportState()
      setTransportState((prev) => ({ ...prev, currentTime: newState.currentTime }))
      setState((prev) => ({ ...prev, playbackPosition: newState.currentTime }))
    }, 50)
  }, [])

  // Handle transport controls
  const handlePlay = useCallback(async () => {
    await initializeAudio()
    if (transportState.isPaused) {
      resumeMelody()
    } else {
      await playMelody()
    }
  }, [initializeAudio, transportState.isPaused, resumeMelody, playMelody])

  const handlePause = useCallback(() => {
    pauseMelody()
  }, [pauseMelody])

  const handleStop = useCallback(() => {
    stopMelody()
  }, [stopMelody])

  const handleReset = useCallback(() => {
    stopMelody()
  }, [stopMelody])

  const handleBpmChange = useCallback((bpm: number) => {
    setTransportState((prev) => ({ ...prev, bpm }))
    audioEngine.current.setBPM(bpm)
  }, [])

  const handleLoopToggle = useCallback(() => {
    const newLoop = !transportState.loop
    setTransportState((prev) => ({ ...prev, loop: newLoop }))
    audioEngine.current.setLoop(newLoop)
  }, [transportState.loop])

  // Handle parameter changes
  const handleParamsChange = useCallback((newParams: Partial<MelodyGenerationParams>) => {
    setGenerationParams((prev) => ({ ...prev, ...newParams }))
  }, [])

  const handleAudioSettingsChange = useCallback(
    async (newSettings: Partial<AudioSettings>) => {
      const updatedSettings = { ...audioSettings, ...newSettings }
      setAudioSettings(updatedSettings)

      if (state.isAudioInitialized) {
        audioEngine.current.updateAudioSettings(updatedSettings)

        if (newSettings.instrument) {
          await audioEngine.current.changeInstrument(newSettings.instrument)
        }
      }

      // Save settings
      await storageManager.current.savePreference("audioSettings", updatedSettings)
    },
    [audioSettings, state.isAudioInitialized],
  )

  // Handle piano interactions
  const handleNotePlay = useCallback(
    async (note: Note) => {
      await initializeAudio()
      await audioEngine.current.playNote(note)
    },
    [initializeAudio],
  )

  const handleChordPlay = useCallback(
    async (notes: Note[]) => {
      await initializeAudio()
      for (const note of notes) {
        await audioEngine.current.playNote(note)
      }
    },
    [initializeAudio],
  )

  // Handle melody editing
  const handleNotesChange = useCallback(
    (notes: Note[]) => {
      if (!state.currentMelody) return

      const updatedMelody: GeneratedMelody = {
        ...state.currentMelody,
        notes,
      }

      setState((prev) => ({ ...prev, currentMelody: updatedMelody }))
    },
    [state.currentMelody],
  )

  // Handle save/load operations
  const handleSaveMelody = useCallback(async (melody: GeneratedMelody) => {
    await storageManager.current.saveMelody(melody)
    const savedMelodies = await storageManager.current.getAllMelodies()
    setState((prev) => ({ ...prev, savedMelodies }))
  }, [])

  const handleLoadMelody = useCallback((melody: GeneratedMelody) => {
    setState((prev) => ({ ...prev, currentMelody: melody }))
    setGenerationParams(melody.params)
  }, [])

  const handleDeleteMelody = useCallback(async (id: string) => {
    await storageManager.current.deleteMelody(id)
    const savedMelodies = await storageManager.current.getAllMelodies()
    setState((prev) => ({ ...prev, savedMelodies }))
  }, [])

  const handleShareMelody = useCallback(async (melody: GeneratedMelody): Promise<string> => {
    // In a real application, this would upload the melody to a server
    // For now, we'll create a shareable URL with the melody data
    const melodyData = btoa(JSON.stringify(melody))
    const url = `${window.location.origin}${window.location.pathname}?melody=${melodyData}`
    return url
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (playbackInterval.current) {
        clearInterval(playbackInterval.current)
      }
      audioEngine.current.dispose()
    }
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <header className="text-center py-6">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Music className="h-8 w-8 text-indigo-600" />
            <h1 className="text-4xl font-bold text-gray-900">Melody Generator</h1>
          </div>
          <p className="text-gray-600 text-lg">
            Create beautiful melodies with AI-powered generation and real-time audio synthesis
          </p>
        </header>

        {/* Error Display */}
        {state.error && (
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              {state.error}
              <button
                onClick={() => setState((prev) => ({ ...prev, error: null }))}
                className="ml-2 text-red-600 hover:text-red-800 underline"
              >
                Dismiss
              </button>
            </AlertDescription>
          </Alert>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Controls */}
          <div className="space-y-6">
            <ParameterControls
              params={generationParams}
              audioSettings={audioSettings}
              onParamsChange={handleParamsChange}
              onAudioSettingsChange={handleAudioSettingsChange}
              onGenerate={generateMelody}
              isGenerating={state.isGenerating}
            />

            <TransportControls
              transportState={transportState}
              onPlay={handlePlay}
              onPause={handlePause}
              onStop={handleStop}
              onReset={handleReset}
              onBpmChange={handleBpmChange}
              onLoopToggle={handleLoopToggle}
              disabled={!state.currentMelody || !state.isAudioInitialized}
            />

            <SaveExportControls
              currentMelody={state.currentMelody}
              savedMelodies={state.savedMelodies}
              onSave={handleSaveMelody}
              onLoad={handleLoadMelody}
              onDelete={handleDeleteMelody}
              onShare={handleShareMelody}
            />
          </div>

          {/* Center Column - Piano Roll */}
          <div className="lg:col-span-2 space-y-6">
            <PianoRoll
              notes={state.currentMelody?.notes || []}
              onNotesChange={handleNotesChange}
              playbackPosition={state.playbackPosition}
              editable={!!state.currentMelody}
              measures={generationParams.length}
              minNote={generationParams.range[0]}
              maxNote={generationParams.range[1]}
            />

            <Piano onNotePlay={handleNotePlay} onChordPlay={handleChordPlay} octaves={3} startOctave={4} />
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center py-6 text-gray-600 border-t border-gray-200">
          <p className="mb-2">Built with React, TypeScript, Tone.js, and Web Audio API</p>
          <p className="text-sm">
            Use headphones for the best audio experience • Compatible with Chrome, Firefox, Safari, and Edge
          </p>
        </footer>
      </div>
    </div>
  )
}
