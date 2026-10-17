import { useLocation, useNavigate } from 'react-router-dom'
import { AppButton } from './AppButton'

type ScreenRoute = '/play' | '/projector' | '/teacher'

const NAV_ITEMS: [ScreenRoute, string][] = [
  ['/play', 'Alumno'],
  ['/projector', 'Proyector'],
  ['/teacher', 'Profesor'],
]

export function ScreenSwitcher() {
  const location = useLocation()
  const navigate = useNavigate()

  const currentPath =
    location.pathname === '/projector' || location.pathname === '/teacher'
      ? location.pathname
      : '/play'

  return (
    <nav className="screen-switcher" aria-label="Vistas de la aplicación">
      {NAV_ITEMS.map(([route, label]) => (
        <AppButton
          key={route}
          onClick={() => navigate(route)}
          className={currentPath === route ? 'active' : ''}
        >
          {label}
        </AppButton>
      ))}
    </nav>
  )
}
