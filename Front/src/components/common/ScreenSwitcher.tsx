import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { soundEngine, type MusicTrack } from '../../services/soundEngine'
import { AppButton } from './AppButton'
import { Icon } from './Icon'

type ScreenRoute = '/play' | '/projector' | '/teacher'

const NAV_ITEMS: [ScreenRoute, string][] = [
  ['/play', 'Alumno'],
  ['/projector', 'Proyector'],
  ['/teacher', 'Profesor'],
]

const TRACK_LABELS: Record<MusicTrack, string> = {
  boss: '🐉 Batalla Jefe',
  enraged: '🔥 Fase Final',
  ambient: '🌌 Caverna',
}

export function ScreenSwitcher() {
  const location = useLocation()
  const navigate = useNavigate()
  const [audioState, setAudioState] = useState(() => soundEngine.getState())

  useEffect(() => {
    return soundEngine.subscribe(() => {
      setAudioState({ ...soundEngine.getState() })
    })
  }, [])

  const currentPath =
    location.pathname === '/projector' || location.pathname === '/teacher'
      ? location.pathname
      : '/play'

  const cycleTrack = () => {
    const order: MusicTrack[] = ['boss', 'enraged', 'ambient']
    const next = order[(order.indexOf(audioState.currentTrack) + 1) % order.length]
    soundEngine.setTrack(next)
    if (!audioState.isPlayingMusic) {
      soundEngine.startMusic()
    }
  }

  return (
    <nav className="screen-switcher" aria-label="Vistas y música de la aplicación">
      <div className="switcher-tabs">
        {NAV_ITEMS.map(([route, label]) => (
          <AppButton
            key={route}
            onClick={() => {
              soundEngine.playUiClick()
              navigate(route)
            }}
            className={currentPath === route ? 'active' : ''}
          >
            {label}
          </AppButton>
        ))}
      </div>

      <div className="switcher-divider" />

      <div className="audio-hud-controls">
        <AppButton
          onClick={() => soundEngine.toggleMusic()}
          className={`music-toggle-btn ${audioState.isPlayingMusic ? 'playing' : ''}`}
          title={
            audioState.isPlayingMusic
              ? 'Pausar banda sonora de incursión'
              : 'Reproducir banda sonora RPG de incursión'
          }
        >
          <Icon name="music" size={14} />
          <span>{audioState.isPlayingMusic ? 'Música ON' : 'Música RPG'}</span>
          {audioState.isPlayingMusic && (
            <span className="eq-bars" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          )}
        </AppButton>

        <AppButton
          onClick={cycleTrack}
          className="track-selector-btn"
          title="Cambiar pista musical (Batalla Jefe / Fase Final / Caverna)"
        >
          {TRACK_LABELS[audioState.currentTrack]}
        </AppButton>

        <AppButton
          onClick={() => soundEngine.toggleSfx()}
          className={`sfx-toggle-btn ${audioState.isSfxEnabled ? 'on' : 'off'}`}
          title={
            audioState.isSfxEnabled
              ? 'Efectos de sonido activados (clic para silenciar)'
              : 'Efectos de sonido silenciados (clic para activar)'
          }
        >
          <Icon name={audioState.isSfxEnabled ? 'volume' : 'mute'} size={14} />
        </AppButton>
      </div>
    </nav>
  )
}
