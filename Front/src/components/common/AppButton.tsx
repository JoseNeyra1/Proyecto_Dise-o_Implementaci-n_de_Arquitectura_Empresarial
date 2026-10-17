import type { ReactNode } from 'react'

interface AppButtonProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  disabled?: boolean
  title?: string
  type?: 'button' | 'submit' | 'reset'
}

export function AppButton({
  children,
  className = '',
  onClick,
  disabled = false,
  title,
  type = 'button',
}: AppButtonProps) {
  return (
    <button
      type={type}
      className={className}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  )
}
