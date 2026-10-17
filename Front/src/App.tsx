import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ScreenSwitcher } from './components/common/ScreenSwitcher'
import { ProjectorPage } from './pages/ProjectorPage'
import { StudentPage } from './pages/StudentPage'
import { TeacherPage } from './pages/TeacherPage'

function AppLayout() {
  const location = useLocation()
  const activeView =
    location.pathname === '/projector'
      ? 'projector'
      : location.pathname === '/teacher'
        ? 'teacher'
        : 'play'

  const defaultRoute =
    typeof window !== 'undefined' && window.innerWidth < 700 ? '/play' : '/teacher'

  return (
    <div className={`app-shell view-${activeView}`}>
      <ScreenSwitcher />
      <Routes>
        <Route path="/" element={<Navigate to={defaultRoute} replace />} />
        <Route path="/play" element={<StudentPage />} />
        <Route path="/projector" element={<ProjectorPage />} />
        <Route path="/teacher" element={<TeacherPage />} />
        <Route path="*" element={<Navigate to={defaultRoute} replace />} />
      </Routes>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  )
}
