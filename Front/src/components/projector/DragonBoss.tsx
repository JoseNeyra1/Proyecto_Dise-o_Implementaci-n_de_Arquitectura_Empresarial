interface DragonBossProps {
  isWeakened?: boolean
  isDefeated?: boolean
}

export function DragonBoss({ isWeakened = false, isDefeated = false }: DragonBossProps) {
  return (
    <svg
      className={`dragon ${isWeakened ? 'dragon-weakened' : ''} ${isDefeated ? 'dragon-defeated' : ''}`}
      viewBox="0 0 620 430"
      role="img"
      aria-label="Dragón jefe en la arena de batalla"
    >
      <defs>
        <linearGradient id="body" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor={isWeakened ? '#f43f5e' : '#8b5cf6'} />
          <stop offset="1" stopColor={isWeakened ? '#881337' : '#4c1d95'} />
        </linearGradient>
        <linearGradient id="wing" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor={isWeakened ? '#fb7185' : '#c084fc'} />
          <stop offset="1" stopColor={isWeakened ? '#9f1239' : '#6d28d9'} />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <ellipse cx="310" cy="378" rx="190" ry="25" fill="#020617" opacity=".7" />
      <path
        d="M205 230C80 165 82 65 48 42c95-7 170 30 211 91L205 230Z"
        fill="url(#wing)"
        stroke="#d8b4fe"
        strokeWidth="5"
      />
      <path
        d="M415 230C540 165 538 65 572 42c-95-7-170 30-211 91l54 97Z"
        fill="url(#wing)"
        stroke="#d8b4fe"
        strokeWidth="5"
      />
      <path
        d="M98 72c42 20 82 61 111 118M522 72c-42 20-82 61-111 118"
        fill="none"
        stroke="#4c1d95"
        strokeWidth="8"
      />
      <path
        d="M270 108 246 36l55 51M350 108l24-72-55 51"
        fill="#a78bfa"
        stroke="#ddd6fe"
        strokeWidth="5"
      />
      <path
        d="M310 76c-55 0-87 45-74 98-42 34-58 94-26 148 26 44 67 58 100 58s74-14 100-58c32-54 16-114-26-148 13-53-19-98-74-98Z"
        fill="url(#body)"
        stroke="#c4b5fd"
        strokeWidth="7"
      />
      <path
        d="M244 193c32 28 100 28 132 0M261 295c33 26 65 26 98 0"
        fill="none"
        stroke="#c4b5fd"
        strokeWidth="5"
        opacity=".55"
      />
      <circle cx="275" cy="151" r="15" fill="#fef08a" filter="url(#glow)" />
      <circle cx="345" cy="151" r="15" fill="#fef08a" filter="url(#glow)" />
      <path d="m270 151 12-5M350 151l-12-5" stroke="#3b0764" strokeWidth="6" />
      <path d="M279 205c20 12 42 12 62 0-2 44-60 44-62 0Z" fill="#1e1b4b" />
      <path d="m294 218 7 19M326 218l-7 19" stroke="#fff" strokeWidth="7" />
      <path
        d="M229 279c-58 18-102 60-121 99 56-7 99-22 132-60M391 279c58 18 102 60 121 99-56-7-99-22-132-60"
        fill="#6d28d9"
        stroke="#c4b5fd"
        strokeWidth="6"
      />
    </svg>
  )
}
