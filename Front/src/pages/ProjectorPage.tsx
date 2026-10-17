import { useEffect, useRef, useState } from 'react'
import { AmbientParticles } from '../components/common/AmbientParticles'
import { AppButton } from '../components/common/AppButton'
import { Icon } from '../components/common/Icon'
import { Logo } from '../components/common/Logo'
import { DragonBoss } from '../components/projector/DragonBoss'
import { useRaidSocket } from '../hooks/useRaidSocket'
import { soundEngine } from '../services/soundEngine'

export function ProjectorPage() {
  const { raidState, tickBossTimer, submitAnswer } = useRaidSocket()
  const [isHit, setIsHit] = useState(false)
  const prevBossHpRef = useRef(raidState.bossHp)

  useEffect(() => {
    const interval = window.setInterval(() => {
      tickBossTimer()
    }, 1000)
    return () => window.clearInterval(interval)
  }, [tickBossTimer])

  // Trigger Dragon hit animation and sound when Boss HP drops
  useEffect(() => {
    if (raidState.bossHp < prevBossHpRef.current) {
      setIsHit(true)
      const t = window.setTimeout(() => setIsHit(false), 450)
      prevBossHpRef.current = raidState.bossHp
      return () => window.clearTimeout(t)
    }
    prevBossHpRef.current = raidState.bossHp
  }, [raidState.bossHp])

  // Automatically shift music to Enraged track when Boss enters Final Phase (<25% HP)
  useEffect(() => {
    if (raidState.bossPhase === 2 && soundEngine.getState().isPlayingMusic) {
      soundEngine.setTrack('enraged')
    }
  }, [raidState.bossPhase])

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
    id: 'ft-1',
    text: '−150 PV',
    subtext: 'Mateo',
  }
  const shieldFloat = raidState.floatingTexts[1] ?? {
    id: 'ft-2',
    text: '+Escudo',
    subtext: 'Lucía',
  }
  const healFloat = raidState.floatingTexts[2] ?? {
    id: 'ft-3',
    text: '+200 PV',
    subtext: 'Curación del salón',
  }

  const isChargingAttack = raidState.bossAttackCountdown <= 6
  const isEnraged = raidState.bossPhase === 2 || isChargingAttack

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

  const triggerDemoVolley = () => {
    soundEngine.playAttackHit()
    const squad = [
      { id: 'stu-sofia', name: 'Sofía R.', role: 'attacker' as const },
      { id: 'stu-lucia', name: 'Lucía V.', role: 'defender' as const },
      { id: 'stu-diego', name: 'Diego T.', role: 'healer' as const },
    ]
    const randomMember = squad[Math.floor(Math.random() * squad.length)]
    submitAnswer({
      studentId: randomMember.id,
      studentName: randomMember.name,
      role: randomMember.role,
      questionId: 'q-4',
      selectedAnswer: '1',
      isCorrect: true,
      responseTimeSec: 4.2,
      isGuessing: false,
    })
  }

  return (
    <main className={`projector-screen ${isEnraged ? 'projector-enraged' : ''}`}>
      <AmbientParticles variant={isEnraged ? 'enraged' : 'default'} showRunes={true} />

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
        <section className={`arena ${isChargingAttack ? 'arena-danger-pulse' : ''}`}>
          <div className="arena-grid" />
          <div className="moon" />
          <p className="arena-label">
            <span /> Cavernas de fracciones <span />
          </p>

          <AppButton
            className="arena-demo-btn"
            onClick={triggerDemoVolley}
            title="Simular impacto cooperativo de alumnos en la arena"
          >
            <Icon name="bolt" size={14} /> Simular Impacto Grupal
          </AppButton>

          {raidState.isPaused && (
            <div className="projector-pause-banner">
              <Icon name="pause" size={20} />
              <span>Partida en pausa por el Profesor · Atención a la explicación</span>
            </div>
          )}

          {/* Spell energy beams connecting squad orbs to Dragon */}
          <svg className="arena-spell-beams" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
            <line
              x1="160"
              y1="500"
              x2="490"
              y2="260"
              className={`spell-beam beam-rose ${isHit ? 'beam-active' : ''}`}
            />
            <line
              x1="860"
              y1="470"
              x2="520"
              y2="290"
              className="spell-beam beam-green"
            />
            <line
              x1="740"
              y1="530"
              x2="500"
              y2="340"
              className="spell-beam beam-blue"
            />
          </svg>

          <DragonBoss
            isWeakened={raidState.isBossWeakened}
            isDefeated={raidState.bossHp <= 0}
            isChargingAttack={isChargingAttack}
            isShieldPhase={raidState.bossPhase === 'shield'}
            isHit={isHit}
          />

          <div className="float-damage float-animated" key={damageFloat.id}>
            {damageFloat.text}
            <small>{damageFloat.subtext}</small>
          </div>
          <div className="float-shield float-animated" key={shieldFloat.id}>
            <Icon name="shield" size={21} /> {shieldFloat.text}
            <small>{shieldFloat.subtext}</small>
          </div>
          <div className="float-heal float-animated" key={healFloat.id}>
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

          <div className={`attack-timer ${isChargingAttack ? 'timer-critical' : ''}`}>
            <div className="attack-title">
              <Icon name="flame" size={22} />
              <span>Ataque del jefe en camino</span>
            </div>
            <strong>{countdownFormatted}</strong>
            <div className="count-track">
              <span style={{ width: `${countdownProgress}%` }} />
            </div>
            <p>
              Ola de fuego · Escudo grupal:{' '}
              <b>
                {raidState.shieldCharges}/{raidState.maxShieldCharges}
              </b>{' '}
              ¡Levanten escudos!
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
