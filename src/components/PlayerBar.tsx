import { Pause, Play, SkipBack, SkipForward, Volume2, X } from 'lucide-react'
import { usePlayer } from '../player/PlayerContext'
import './PlayerBar.css'

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${String(secs).padStart(2, '0')}`
}

export default function PlayerBar(): JSX.Element | null {
  const {
    currentTrack,
    isPlaying,
    isBuffering,
    currentTime,
    duration,
    volume,
    toggle,
    next,
    previous,
    seek,
    setVolume,
    close
  } = usePlayer()

  if (!currentTrack) return null

  return (
    <div className="player-bar" role="region" aria-label="Audio player">
      <div className="player-bar__track">
        <strong className="player-bar__name">{currentTrack.name}</strong>
        <span className="player-bar__media">
          {currentTrack.mediaLabel}
          {isBuffering ? ' · Starting stream…' : ''}
        </span>
      </div>

      <div className="player-bar__controls">
        <button type="button" className="button button--icon-only" onClick={previous} aria-label="Previous track">
          <SkipBack size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="button button--icon-only player-bar__play"
          onClick={toggle}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
        </button>
        <button type="button" className="button button--icon-only" onClick={next} aria-label="Next track">
          <SkipForward size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="player-bar__seek">
        <span className="player-bar__time">{formatTime(currentTime)}</span>
        <input
          type="range"
          min={0}
          max={duration || currentTrack.durationSeconds || 0}
          step={1}
          value={currentTime}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="Seek"
        />
        <span className="player-bar__time">{formatTime(duration || currentTrack.durationSeconds || 0)}</span>
      </div>

      <div className="player-bar__volume">
        <Volume2 size={16} aria-hidden="true" />
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          aria-label="Volume"
        />
      </div>

      <button type="button" className="button button--icon-only" onClick={close} aria-label="Close player">
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  )
}
