import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

export interface PlayerTrack {
  mediaId: number
  mediaLabel: string
  path: string
  name: string
  durationSeconds: number | null
}

interface PlayerState {
  queue: PlayerTrack[]
  currentIndex: number
  isPlaying: boolean
  isBuffering: boolean
  currentTime: number
  duration: number
  volume: number
}

interface PlayerContextValue extends PlayerState {
  currentTrack: PlayerTrack | null
  play: (tracks: PlayerTrack[], startIndex: number) => void
  toggle: () => void
  next: () => void
  previous: () => void
  seek: (seconds: number) => void
  setVolume: (volume: number) => void
  close: () => void
}

const PlayerContext = createContext<PlayerContextValue | null>(null)

function trackUrl(track: PlayerTrack): string {
  return `discdock-media://${track.mediaId}/${encodeURIComponent(track.path)}`
}

export function PlayerProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [state, setState] = useState<PlayerState>({
    queue: [],
    currentIndex: -1,
    isPlaying: false,
    isBuffering: false,
    currentTime: 0,
    duration: 0,
    volume: 1
  })

  if (!audioRef.current && typeof Audio !== 'undefined') {
    audioRef.current = new Audio()
  }

  const currentTrack = state.currentIndex >= 0 ? (state.queue[state.currentIndex] ?? null) : null

  const next = useCallback(() => {
    setState((prev) => {
      if (prev.currentIndex + 1 >= prev.queue.length) return { ...prev, isPlaying: false }
      return { ...prev, currentIndex: prev.currentIndex + 1, currentTime: 0 }
    })
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleTimeUpdate = (): void => setState((prev) => ({ ...prev, currentTime: audio.currentTime }))
    const handleLoadedMetadata = (): void => setState((prev) => ({ ...prev, duration: audio.duration || 0 }))
    const handleEnded = (): void => next()
    const handleWaiting = (): void => setState((prev) => ({ ...prev, isBuffering: true }))
    const handleCanPlay = (): void => setState((prev) => ({ ...prev, isBuffering: false }))

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('waiting', handleWaiting)
    audio.addEventListener('canplay', handleCanPlay)
    audio.addEventListener('playing', handleCanPlay)
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('waiting', handleWaiting)
      audio.removeEventListener('canplay', handleCanPlay)
      audio.removeEventListener('playing', handleCanPlay)
    }
  }, [next])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentTrack) return
    audio.src = trackUrl(currentTrack)
    audio.currentTime = 0
    if (state.isPlaying) void audio.play().catch(() => setState((prev) => ({ ...prev, isPlaying: false })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.mediaId, currentTrack?.path])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (state.isPlaying) void audio.play().catch(() => setState((prev) => ({ ...prev, isPlaying: false })))
    else audio.pause()
  }, [state.isPlaying])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = state.volume
  }, [state.volume])

  const play = useCallback((tracks: PlayerTrack[], startIndex: number) => {
    setState((prev) => ({
      ...prev,
      queue: tracks,
      currentIndex: startIndex,
      currentTime: 0,
      isPlaying: true,
      isBuffering: true
    }))
  }, [])

  const toggle = useCallback(() => {
    setState((prev) => (prev.currentIndex < 0 ? prev : { ...prev, isPlaying: !prev.isPlaying }))
  }, [])

  const previous = useCallback(() => {
    setState((prev) => {
      if (prev.currentIndex <= 0) return { ...prev, currentTime: 0 }
      return { ...prev, currentIndex: prev.currentIndex - 1, currentTime: 0 }
    })
  }, [])

  const seek = useCallback((seconds: number) => {
    if (audioRef.current) audioRef.current.currentTime = seconds
    setState((prev) => ({ ...prev, currentTime: seconds }))
  }, [])

  const setVolume = useCallback((volume: number) => {
    setState((prev) => ({ ...prev, volume }))
  }, [])

  const close = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.removeAttribute('src')
    }
    setState({
      queue: [],
      currentIndex: -1,
      isPlaying: false,
      isBuffering: false,
      currentTime: 0,
      duration: 0,
      volume: state.volume
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = useMemo<PlayerContextValue>(
    () => ({ ...state, currentTrack, play, toggle, next, previous, seek, setVolume, close }),
    [state, currentTrack, play, toggle, next, previous, seek, setVolume, close]
  )

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayer must be used within a PlayerProvider')
  return ctx
}
