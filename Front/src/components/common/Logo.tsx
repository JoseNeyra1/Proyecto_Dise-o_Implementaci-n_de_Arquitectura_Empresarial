import { Icon } from './Icon'

export function Logo() {
  return (
    <div className="logo">
      <span className="logo-mark">
        <Icon name="sword" size={18} />
      </span>
      <span>
        Jefe de Incursión <b>Educativo</b>
      </span>
    </div>
  )
}
