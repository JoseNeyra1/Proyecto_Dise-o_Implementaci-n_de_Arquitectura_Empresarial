import { useEffect, useRef, useState } from 'react'
import { AmbientParticles } from '../components/common/AmbientParticles'
import { AppButton } from '../components/common/AppButton'
import { Icon } from '../components/common/Icon'
import { Logo } from '../components/common/Logo'
import { QUESTION_BANK, ROLE_CONFIG } from '../data/mockRaidData'
import { useRaidSocket } from '../hooks/useRaidSocket'
import { soundEngine } from '../services/soundEngine'
import type { PlayerRole } from '../types/raid.types'

export function StudentPage() {
  const { raidState, joinRaid, submitAnswer, useSkill } = useRaidSocket()

  // Student identity & role state
  const [studentId] = useState<string>(() => {
    const cached = localStorage.getItem('raid_student_id')
    if (cached) return cached
    const generated = `stu-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    localStorage.setItem('raid_student_id', generated)
    return generated
  })
  const [studentName, setStudentName] = useState('Mateo L.')
  const [role, setRole] = useState<PlayerRole>('attacker')
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [pinInput, setPinInput] = useState(raidState.roomPin)
  const [nameInput, setNameInput] = useState('Mateo L.')
  const [joinError, setJoinError] = useState('')

  // Question & gameplay state
  const [questions, setQuestions] = useState(QUESTION_BANK)
  const [questionIndex, setQuestionIndex] = useState(0)
  const currentQuestion = questions[questionIndex % questions.length]
  const [answer, setAnswer] = useState<string | null>(null)
  const [streak, setStreak] = useState(3)
  const [skillCharges, setSkillCharges] = useState(2)
  const [timeLeft, setTimeLeft] = useState(currentQuestion.timeLimitSec)
  const [localHintActive, setLocalHintActive] = useState(false)
  const [cooldownSec, setCooldownSec] = useState(0)
  const [projectileBurst, setProjectileBurst] = useState<number | null>(null)
  const questionStartRef = useRef<number>(Date.now())

  useEffect(() => {
    fetch('/api/raid/questions')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setQuestions(data)
        }
      })
      .catch(() => {})
  }, [])

  const activeRoleConfig = ROLE_CONFIG[role]
  const classHpPercent = Math.round((raidState.classHp / raidState.classMaxHp) * 100)

  const studentRecord = raidState.students.find(
    (s) => s.id === studentId || s.name.toLowerCase() === studentName.toLowerCase()
  )
  const hasHint = localHintActive || Boolean(studentRecord?.hasActiveHint)
  const hintSender = studentRecord?.hintSender || 'Diego (Sanador)'

  useEffect(() => {
    setTimeLeft(currentQuestion.timeLimitSec)
    questionStartRef.current = Date.now()
  }, [questionIndex, currentQuestion.timeLimitSec])

  useEffect(() => {
    if (raidState.isPaused || answer !== null || cooldownSec > 0) return
    const timer = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          return currentQuestion.timeLimitSec
        }
        return prev - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [raidState.isPaused, answer, cooldownSec, currentQuestion.timeLimitSec])

  useEffect(() => {
    if (cooldownSec <= 0) return
    const timer = window.setInterval(() => {
      setCooldownSec((prev) => {
        if (prev <= 1) {
          setAnswer(null)
          questionStartRef.current = Date.now()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [cooldownSec])

  const handleSelectAnswer = (selectedValue: string, forceFastGuess = false) => {
    if (raidState.isPaused || cooldownSec > 0) return
    if (hasHint && selectedValue === currentQuestion.wrongOptionToEliminate) return

    const elapsedSec = forceFastGuess
      ? 0.9
      : Math.max(0.5, (Date.now() - questionStartRef.current) / 1000)
    const isCorrect = selectedValue === currentQuestion.correctAnswer
    const isGuessing = !isCorrect && (elapsedSec < 1.8 || forceFastGuess)

    setAnswer(selectedValue)

    if (isCorrect) {
      setStreak((prev) => prev + 1)
      setSkillCharges((prev) => Math.min(3, prev + 1))
      setProjectileBurst(Date.now())
      if (role === 'attacker') soundEngine.playAttackHit()
      else if (role === 'defender') soundEngine.playShieldUp()
      else soundEngine.playHealChime()

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(100)
      }
    } else {
      setStreak(0)
      soundEngine.playErrorOrFreeze()
      if (isGuessing) {
        setCooldownSec(4)
      }
    }

    submitAnswer({
      studentId,
      studentName,
      role,
      questionId: currentQuestion.id,
      selectedAnswer: selectedValue,
      isCorrect,
      responseTimeSec: elapsedSec,
      isGuessing,
    })
  }

  const handleNextQuestion = () => {
    soundEngine.playUiClick()
    setAnswer(null)
    setLocalHintActive(false)
    setQuestionIndex((prev) => (prev + 1) % questions.length)
  }

  const handleTriggerSkill = () => {
    if (skillCharges < 3 || raidState.isPaused) return
    soundEngine.playCriticalSkill()
    setProjectileBurst(Date.now())
    useSkill(studentName, role)
    setSkillCharges(0)
    if (role === 'healer') {
      setLocalHintActive(true)
    }
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (showJoinModal || raidState.isPaused || cooldownSec > 0) return
      const key = e.key.toUpperCase()
      const idx = ['A', 'B', 'C', 'D'].indexOf(key)
      if (idx !== -1 && currentQuestion.options[idx]) {
        handleSelectAnswer(currentQuestion.options[idx].value)
      } else if (e.key === 'Enter' && answer !== null) {
        handleNextQuestion()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nameInput.trim()) {
      setJoinError('Ingresa tu nombre para entrar al escuadrón.')
      return
    }
    const ok = joinRaid(nameInput.trim(), role, pinInput)
    if (!ok) {
      soundEngine.playErrorOrFreeze()
      setJoinError(`PIN incorrecto. El PIN del aula actual es ${raidState.roomPin}.`)
      return
    }
    soundEngine.playHealChime()
    setStudentName(nameInput.trim())
    setJoinError('')
    setShowJoinModal(false)
  }

  const timerPercent = Math.max(8, Math.round((timeLeft / currentQuestion.timeLimitSec) * 100))

  return (
    <main className={`student-screen theme-${role}`}>
      <div className="mobile-noise" />
      <AmbientParticles variant={role} showRunes={true} />

      {/* Upward Spell Projectile Animation when answering right or using skill */}
      {projectileBurst && (
        <div
          key={projectileBurst}
          className={`spell-projectile-launch projectile-${role}`}
          aria-hidden="true"
        >
          <span className="projectile-orb">
            <Icon name={activeRoleConfig.icon} size={22} />
          </span>
          <i className="projectile-trail" />
        </div>
      )}

      {/* Pause Overlay when Teacher freezes screens */}
      {raidState.isPaused && (
        <div className="pause-overlay" role="alert" aria-live="assertive">
          <div className="pause-modal-card">
            <span className="pause-badge-icon">
              <Icon name="pause" size={28} />
            </span>
            <h2>¡Tiempo fuera del Profesor!</h2>
            <p>
              Las pantallas del salón están en pausa para una explicación rápida. Levanta la mirada
              hacia la pizarra; el combate continuará en unos instantes.
            </p>
            <div className="pause-meta-pill">
              PIN de Sala: <b>{raidState.roomPin}</b> · Tu progreso y racha están protegidos
            </div>
          </div>
        </div>
      )}

      {/* Join / Role & PIN Configuration Modal */}
      {showJoinModal && (
        <div className="pause-overlay" role="dialog" aria-modal="true">
          <form className="join-modal-card" onSubmit={handleJoinSubmit}>
            <div className="join-modal-header">
              <Logo />
              <AppButton className="close-modal-btn" onClick={() => setShowJoinModal(false)}>
                ✕
              </AppButton>
            </div>
            <h2>Unirse a la Incursión del Aula</h2>
            <p>Ingresa el código PIN proyectado en la pizarra y elige tu rol asimétrico.</p>

            <div className="join-field-group">
              <label>
                <span>PIN de la Sala</span>
                <input
                  type="text"
                  maxLength={6}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="4829"
                />
              </label>
              <label>
                <span>Tu Nombre / Apodo</span>
                <input
                  type="text"
                  maxLength={24}
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Ej. Mateo L."
                />
              </label>
            </div>

            <div className="join-role-picker">
              <span>Selecciona tu Rol de Combate</span>
              <div className="join-role-grid">
                {(['attacker', 'defender', 'healer'] as PlayerRole[]).map((rKey) => {
                  const cfg = ROLE_CONFIG[rKey]
                  return (
                    <AppButton
                      key={rKey}
                      onClick={() => {
                        soundEngine.playUiClick()
                        setRole(rKey)
                      }}
                      className={`join-role-card ${cfg.className} ${role === rKey ? 'selected' : ''}`}
                    >
                      <Icon name={cfg.icon} size={20} />
                      <strong>{cfg.name}</strong>
                      <small>{cfg.skillName}</small>
                    </AppButton>
                  )
                })}
              </div>
            </div>

            {joinError && <p className="join-error-msg">{joinError}</p>}

            <div className="join-modal-actions">
              <AppButton type="submit" className="join-submit-btn">
                Entrar al Combate
              </AppButton>
            </div>
          </form>
        </div>
      )}

      <header className="student-header">
        <Logo />
        <div className="student-status">
          <AppButton
            onClick={() => {
              soundEngine.playUiClick()
              const order: PlayerRole[] = ['attacker', 'defender', 'healer']
              const next = order[(order.indexOf(role) + 1) % order.length]
              setRole(next)
            }}
            title="Haz clic para cambiar de rol (Atacante / Defensor / Sanador)"
            className={`role-badge ${activeRoleConfig.className} interactive-badge`}
          >
            <Icon name={activeRoleConfig.icon} size={15} /> {activeRoleConfig.name}
          </AppButton>
          <div className="status-chip streak">
            <Icon name="flame" size={16} />
            <span>
              racha <b>×{streak}</b>
            </span>
          </div>
          <div className="status-chip">
            <Icon name="heart" size={16} />
            <span>
              <b>{classHpPercent}%</b> equipo
            </span>
          </div>
        </div>
      </header>

      <div className="student-desktop-grid">
        <section className="challenge-panel">
          <div className={`question-card ${cooldownSec > 0 ? 'card-cooldown' : ''}`}>
            <div className="question-meta">
              <span>Reto 0{currentQuestion.number}</span>
              <span>{currentQuestion.difficulty}</span>
            </div>
            <div className="timer-track">
              <span style={{ width: `${timerPercent}%` }} />
            </div>

            {hasHint && (
              <div className="healer-hint-pill">
                <Icon name="spark" size={14} />
                <span>✨ ¡Pista de {hintSender} activa! (1 opción falsa eliminada)</span>
              </div>
            )}

            <p className="eyebrow">{currentQuestion.topic}</p>
            <h1>{currentQuestion.prompt}</h1>
            <p className="question-hint">
              {cooldownSec > 0
                ? `❄️ Botones bloqueados por ${cooldownSec} s · Lee la pista antes de responder`
                : `Elige antes de que termine el tiempo (${timeLeft} s)`}
            </p>

            {(cooldownSec > 0 || hasHint) && (
              <div className="pedagogical-hint-box">
                <strong>💡 Pista pedagógica:</strong> {currentQuestion.hint}
              </div>
            )}
          </div>

          <section className="answer-grid" aria-label="Opciones de respuesta">
            {currentQuestion.options.map(({ shape, value }, index) => {
              const isEliminated = hasHint && value === currentQuestion.wrongOptionToEliminate
              const isSelected = answer === value
              const isCorrectOption = value === currentQuestion.correctAnswer

              return (
                <AppButton
                  key={value}
                  disabled={cooldownSec > 0 || isEliminated || raidState.isPaused}
                  onClick={() => handleSelectAnswer(value)}
                  className={`answer-button answer-${index + 1} ${isSelected ? 'selected' : ''} ${
                    answer && isCorrectOption ? 'correct' : ''
                  } ${isSelected && !isCorrectOption ? 'wrong' : ''} ${
                    isEliminated ? 'eliminated-option' : ''
                  } ${cooldownSec > 0 ? 'cooldown-locked' : ''}`}
                >
                  <span className={`shape ${shape}`} />
                  <span>{isEliminated ? 'Eliminada' : value}</span>
                  <small>
                    <i>Tecla</i>
                    {String.fromCharCode(65 + index)}
                  </small>
                </AppButton>
              )
            })}
          </section>

          <div
            className={`answer-feedback ${
              cooldownSec > 0
                ? 'cooldown-state'
                : answer === currentQuestion.correctAnswer
                  ? 'success'
                  : answer
                    ? 'retry'
                    : ''
            }`}
          >
            <span>
              <Icon
                name={
                  cooldownSec > 0
                    ? 'alert'
                    : answer === currentQuestion.correctAnswer
                      ? 'spark'
                      : answer
                        ? 'target'
                        : 'bolt'
                }
                size={20}
              />
            </span>
            <div className="feedback-copy-wrap">
              <div>
                <strong>
                  {cooldownSec > 0
                    ? `¡Recargando energía! (${cooldownSec} s)`
                    : answer === currentQuestion.correctAnswer
                      ? '¡Respuesta correcta!'
                      : answer
                        ? '¡Casi lo tienes!'
                        : 'Tu misión'}
                </strong>
                <p>
                  {cooldownSec > 0
                    ? 'Se detectó una respuesta demasiado rápida (< 1,8 s). Revisa la pista iluminada arriba.'
                    : answer === currentQuestion.correctAnswer
                      ? `Aportaste como ${activeRoleConfig.name} y cargaste tu habilidad especial.`
                      : answer
                        ? currentQuestion.hint
                        : 'Elige una respuesta o presiona A, B, C o D en tu teclado.'}
                </p>
              </div>
              {answer !== null && cooldownSec === 0 && (
                <AppButton className="next-question-btn" onClick={handleNextQuestion}>
                  Siguiente reto →
                </AppButton>
              )}
            </div>
          </div>
        </section>

        <aside className="student-raid-panel">
          <div className="raid-panel-heading">
            <div>
              <p>Escuadrón conectado · PIN {raidState.roomPin}</p>
              <h2>Equipo de incursión</h2>
            </div>
            <AppButton
              className="pin-join-trigger"
              onClick={() => {
                soundEngine.playUiClick()
                setShowJoinModal(true)
              }}
            >
              PIN / Rol
            </AppButton>
          </div>

          <div className="role-switcher-row" aria-label="Cambiar rol de prueba">
            {(['attacker', 'defender', 'healer'] as PlayerRole[]).map((rKey) => {
              const cfg = ROLE_CONFIG[rKey]
              return (
                <AppButton
                  key={rKey}
                  onClick={() => {
                    soundEngine.playUiClick()
                    setRole(rKey)
                  }}
                  className={`role-mini-pill ${cfg.className} ${role === rKey ? 'active' : ''}`}
                >
                  <Icon name={cfg.icon} size={13} />
                  <span>{cfg.name}</span>
                </AppButton>
              )
            })}
          </div>

          <div className="party-list">
            <div className="party-member">
              <span className={`party-avatar ${role}`}>
                <Icon name={activeRoleConfig.icon} size={18} />
              </span>
              <div>
                <strong>Tú ({studentName})</strong>
                <small>
                  {activeRoleConfig.name} · Combo ×{streak}
                </small>
              </div>
              <b>{classHpPercent}%</b>
            </div>
            <div className="party-member">
              <span className="party-avatar defender">
                <Icon name="shield" size={18} />
              </span>
              <div>
                <strong>Lucía</strong>
                <small>
                  Defensora · Escudo {raidState.shieldCharges}/{raidState.maxShieldCharges}
                </small>
              </div>
              <b>92%</b>
            </div>
            <div className="party-member">
              <span className="party-avatar healer">
                <Icon name="heart" size={18} />
              </span>
              <div>
                <strong>Diego</strong>
                <small>Sanador · {hasHint ? 'Pista activa' : 'Habilidad cargando'}</small>
              </div>
              <b>76%</b>
            </div>
          </div>

          <div className="round-progress">
            <div>
              <span>Progreso de incursión</span>
              <strong>Pregunta {currentQuestion.number} de 10</strong>
            </div>
            <div className="round-track">
              <span style={{ width: `${currentQuestion.number * 10}%` }} />
            </div>
          </div>

          <div className="ux-sim-controls">
            <AppButton
              className={`sim-chip ${hasHint ? 'active' : ''}`}
              onClick={() => {
                soundEngine.playHealChime()
                setLocalHintActive((prev) => !prev)
              }}
              title="Simular recepción de pista de un compañero Sanador"
            >
              ✨ {hasHint ? 'Pista activa' : 'Simular pista'}
            </AppButton>
            <AppButton
              className="sim-chip warn"
              onClick={() => {
                const wrongOpt =
                  currentQuestion.options.find((o) => o.value !== currentQuestion.correctAnswer)
                    ?.value || '2/4'
                handleSelectAnswer(wrongOpt, true)
              }}
              title="Simular respuesta al azar en < 1.8s para activar Cooldown y alerta docente"
            >
              ❄️ Simular adivinación
            </AppButton>
          </div>

          <div className="keyboard-hint">
            <span className="keycap">A</span>
            <span className="keycap">B</span>
            <span className="keycap">C</span>
            <span className="keycap">D</span>
            <p>Usa el teclado para responder</p>
          </div>
        </aside>
      </div>

      <section className={`skill-card desktop-skill ${skillCharges >= 3 ? 'skill-ready' : ''}`}>
        <div className="skill-row">
          <span className="skill-icon">
            <Icon name={activeRoleConfig.icon} size={20} />
          </span>
          <div>
            <p>Habilidad especial · {activeRoleConfig.name}</p>
            <strong>{activeRoleConfig.skillName}</strong>
          </div>
          {skillCharges >= 3 ? (
            <AppButton className="unleash-skill-btn" onClick={handleTriggerSkill}>
              <Icon name="bolt" size={15} /> {activeRoleConfig.actionLabel}
            </AppButton>
          ) : (
            <span className="skill-count">{skillCharges} / 3</span>
          )}
        </div>
        <div className="charge-track">
          {[0, 1, 2].map((slot) =>
            slot < skillCharges ? <span key={slot} /> : <i key={slot} />
          )}
        </div>
        <p className="charge-copy">
          {skillCharges >= 3
            ? `¡Habilidad cargada al 100%! Haz clic para activar: ${activeRoleConfig.skillDescription}`
            : `Falta ${3 - skillCharges} acierto${3 - skillCharges === 1 ? '' : 's'} para desatarla`}
        </p>
      </section>
    </main>
  )
}
