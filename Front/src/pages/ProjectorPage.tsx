import { useEffect } from 'react'
import { Icon } from '../components/common/Icon'
import { Logo } from '../components/common/Logo'
import { DragonBoss } from '../components/projector/DragonBoss'
import { useRaidSocket } from '../hooks/useRaidSocket'

export function ProjectorPage() {
  const { raidState, tickBossTimer } = useRaidSocket()

  useEffect(() => {
    const interval = window.setInterval(() => {
      tickBossTimer()
    }, 1000)
    return () => window.clearInterval(interval)
  }, [tickBossTimer])

  const bossHpPercent = Math.max(
    0,
    Math.min(100, Number(((raidState.bossHp / raidState.bossMaxHp) * 100).toFixed(1)))
  )
  const classHpPercent = Math.max(
    0,
    Math.min(100, Math.round((raidState.classHp / raidState.classMaxHp) * 100))
  )

  const formatNumber = (num: number) => num.toLocaleString('es-PE')
  const countdownFormatted = `00:${String(Math.max(0, raidState.bossAttackCountdown)).padStart(2, '0')}`
  const countdownProgress = Math.min(
    100,
    Math.round(((45 - raidState.bossAttackCountdown) / 45) * 100)
  )

  const damageFloat = raidState.floatingTexts[0] ?? {
    text: '−150 PV',
    subtext: 'Mateo',
  }
  const shieldFloat = raidState.floatingTexts[1] ?? {
    text: '+Escudo',
    subtext: 'Lucía',
  }
  const healFloat = raidState.floatingTexts[2] ?? {
    text: '+200 PV',
    subtext: 'Curación del salón',
  }

  const phaseText =
    raidState.bossHp <= 0
      ? '🏆 ¡Jefe Derrotado por el Salón!'
      : raidState.bossPhase === 'shield'
        ? '🛡️ Fase de Escudo Grupal (50%)'
        : raidState.bossPhase === 2
          ? '🔥 Fase Final · Daño Duplicado'
          : raidState.isBossWeakened
            ? '⚡ Fase 1 de 2 · Jefe Debilitado ×2'
            : 'Fase 1 de 2'

  return (
    <main className="projector-screen">
      <header className="projector-header">
        <Logo />
        <section className="boss-health">
          <div className="boss-heading">
            <span>
              {raidState.bossName}{' '}
              {raidState.isBossWeakened && <em className="boss-debuff-pill">Daño ×2</em>}
            </span>
            <strong>
              {formatNumber(raidState.bossHp)}{' '}
              <small>/ {formatNumber(raidState.bossMaxHp)} PV</small>
            </strong>
          </div>
          <div className="boss-track">
            <span style={{ width: `${bossHpPercent}%` }} />
          </div>
          <div className="phase-label">{phaseText}</div>
        </section>
        <section className="pin-card">
          <span>PIN de sala</span>
          <strong>{raidState.roomPin}</strong>
        </section>
      </header>

      <div className="projector-body">
        <section className="arena">
          <div className="arena-grid" />
          <div className="moon" />
          <p className="arena-label">
            <span /> Cavernas de fracciones <span />
          </p>

          {raidState.isPaused && (
            <div className="projector-pause-banner">
              <Icon name="pause" size={20} />
              <span>Partida en pausa por el Profesor · Atención a la explicación</span>
            </div>
          )}

          <DragonBoss
            isWeakened={raidState.isBossWeakened}
            isDefeated={raidState.bossHp <= 0}
          />

          <div className="float-damage" key={damageFloat.id}>
            {damageFloat.text}
            <small>{damageFloat.subtext}</small>
          </div>
          <div className="float-shield" key={shieldFloat.id}>
            <Icon name="shield" size={21} /> {shieldFloat.text}
            <small>{shieldFloat.subtext}</small>
          </div>
          <div className="float-heal" key={healFloat.id}>
            {healFloat.text}
            <small>{healFloat.subtext}</small>
          </div>

          <div className="player-orb orb-one" title="Escuadrón Atacante (DPS)">
            <Icon name="sword" size={20} />
          </div>
          <div className="player-orb orb-two" title="Escuadrón Sanador (Soporte)">
            <Icon name="heart" size={20} />
          </div>
          <div className="player-orb orb-three" title="Escuadrón Defensor (Tanques)">
            <Icon name="shield" size={20} />
          </div>
        </section>

        <aside className="live-sidebar">
          <div className="sidebar-heading">
            <div>
              <p>Actividad en vivo</p>
              <h2>Registro de combos</h2>
            </div>
            <span className="live-dot">En vivo</span>
          </div>
          <div className="feed-list">
            {raidState.feed.slice(0, 4).map((item) => (
              <div className="feed-item" key={item.id}>
                <span className={`feed-icon ${item.color}`}>
                  <Icon name={item.icon} size={18} />
                </span>
                <p>
                  <strong>{item.name}</strong>
                  <br />
                  {item.text}
                </p>
                <time>{item.timestamp}</time>
              </div>
            ))}
          </div>

          <div className="attack-timer">
            <div className="attack-title">
              <Icon name="flame" size={22} />
              <span>Ataque del jefe en camino</span>
            </div>
            <strong>{countdownFormatted}</strong>
            <div className="count-track">
              <span style={{ width: `${countdownProgress}%` }} />
            </div>
            <p>
              Ola de fuego · Escudo grupal: <b>{raidState.shieldCharges}/{raidState.maxShieldCharges}</b> ¡Levanten escudos!
            </p>
          </div>
        </aside>
      </div>

      <footer className="class-health">
        <div className="health-icon">
          <Icon name="heart" size={24} />
        </div>
        <div className="health-copy">
          <span>Vida del salón</span>
          <strong>
            {formatNumber(raidState.classHp)} / {formatNumber(raidState.classMaxHp)}
          </strong>
        </div>
        <div className="class-track">
          <span style={{ width: `${classHpPercent}%` }} />
        </div>
        <strong className="health-percent">{classHpPercent}%</strong>
        <div className="connected">
          <Icon name="users" size={20} />
          <span>
            <b>{raidState.connectedCount}</b> conectados
          </span>
        </div>
      </footer>
    </main>
  )
}
