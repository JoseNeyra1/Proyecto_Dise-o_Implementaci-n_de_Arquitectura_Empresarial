interface AmbientParticlesProps {
  variant?: 'default' | 'enraged' | 'attacker' | 'defender' | 'healer'
  showRunes?: boolean
}

const PARTICLES = [
  { id: 1, left: '6%', size: 5, delay: '0s', duration: '9s', rune: '¾' },
  { id: 2, left: '14%', size: 4, delay: '1.8s', duration: '11s', rune: '✦' },
  { id: 3, left: '23%', size: 6, delay: '0.7s', duration: '8.5s', rune: '½' },
  { id: 4, left: '34%', size: 3, delay: '2.9s', duration: '12s', rune: '•' },
  { id: 5, left: '46%', size: 5, delay: '1.2s', duration: '9.5s', rune: '⅚' },
  { id: 6, left: '57%', size: 4, delay: '3.4s', duration: '10.5s', rune: '✦' },
  { id: 7, left: '68%', size: 6, delay: '0.4s', duration: '8.8s', rune: '⅔' },
  { id: 8, left: '79%', size: 4, delay: '2.1s', duration: '11.2s', rune: '¼' },
  { id: 9, left: '88%', size: 5, delay: '1.5s', duration: '9.2s', rune: '✦' },
  { id: 10, left: '94%', size: 3, delay: '3.8s', duration: '10s', rune: '⅛' },
]

export function AmbientParticles({
  variant = 'default',
  showRunes = true,
}: AmbientParticlesProps) {
  return (
    <div className={`ambient-atmosphere variant-${variant}`} aria-hidden="true">
      <div className="ambient-aurora aurora-1" />
      <div className="ambient-aurora aurora-2" />
      <div className="ambient-vignette" />
      <div className="ember-field">
        {PARTICLES.map((p) => (
          <span
            key={p.id}
            className="ambient-ember"
            style={{
              left: p.left,
              animationDelay: p.delay,
              animationDuration: p.duration,
            }}
          >
            {showRunes && p.id % 2 === 1 ? (
              <i className="floating-rune">{p.rune}</i>
            ) : (
              <b
                className="ember-dot"
                style={{ width: `${p.size}px`, height: `${p.size}px` }}
              />
            )}
          </span>
        ))}
      </div>
    </div>
  )
}
