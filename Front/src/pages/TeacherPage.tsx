import { useState, type CSSProperties } from 'react'
import { AppButton } from '../components/common/AppButton'
import { Icon } from '../components/common/Icon'
import { Logo } from '../components/common/Logo'
import { useRaidSocket } from '../hooks/useRaidSocket'
import type { IconName } from '../types/raid.types'

export function TeacherPage() {
  const {
    raidState,
    togglePause,
    toggleWeakenBoss,
    sendHintToStudent,
    resetRaid,
  } = useRaidSocket()

  const [showAllStudents, setShowAllStudents] = useState(false)
  const [selectedStudentDetail, setSelectedStudentDetail] = useState<string | null>(null)

  const bossHpPercent = Math.max(
    0,
    Math.min(100, Math.round((raidState.bossHp / raidState.bossMaxHp) * 100))
  )

  const criticalAlertsCount = raidState.alerts.filter((a) => a.type === 'critical').length
  const visibleStudents = showAllStudents
    ? raidState.students
    : raidState.students.slice(0, 5)

  const kpis: {
    label: string
    value: string
    meta: string
    icon: IconName
    color: string
    ring: string
  }[] = [
    {
      label: 'Precisión del salón',
      value: `${raidState.accuracyPercent}%`,
      meta: '↑ 6% en esta ronda',
      icon: 'target',
      color: 'purple',
      ring: String(raidState.accuracyPercent),
    },
    {
      label: 'Respuesta promedio',
      value: `${raidState.avgResponseSec.toFixed(1).replace('.', ',')} s`,
      meta: '1,2 s más rápido',
      icon: 'clock',
      color: 'blue',
      ring: '63',
    },
    {
      label: 'Alertas de adivinación',
      value: String(criticalAlertsCount),
      meta: criticalAlertsCount === 1 ? 'Alumno señalado' : 'Alumnos señalados',
      icon: 'alert',
      color: 'amber',
      ring: String(Math.min(100, criticalAlertsCount * 18)),
    },
    {
      label: 'Vida del jefe',
      value: `${bossHpPercent}%`,
      meta: raidState.isBossWeakened
        ? 'Debilitado ×2'
        : `Quedan ${raidState.bossHp.toLocaleString('es-PE')} PV`,
      icon: 'flame',
      color: 'rose',
      ring: String(bossHpPercent),
    },
  ]

  return (
    <main className="teacher-screen">
      <header className="teacher-header">
        <div>
          <Logo />
          <p>
            Panel del maestro <span>•</span> Cavernas de fracciones <span>•</span> PIN{' '}
            <b>{raidState.roomPin}</b>
          </p>
        </div>
        <div className="master-actions">
          <AppButton
            className={`gm-button ${raidState.isPaused ? 'active' : ''}`}
            onClick={togglePause}
          >
            <Icon name="pause" size={18} />
            {raidState.isPaused ? 'Reanudar pantallas' : 'Pausar pantallas'}
          </AppButton>
          <AppButton
            className={`gm-button weaken ${raidState.isBossWeakened ? 'active' : ''}`}
            onClick={toggleWeakenBoss}
          >
            <Icon name="bolt" size={18} />
            {raidState.isBossWeakened ? 'Jefe debilitado' : 'Debilitar jefe ×2'}
          </AppButton>
          <AppButton
            className="gm-button"
            onClick={resetRaid}
            title="Restaurar los datos iniciales de la demostración"
          >
            <Icon name="refresh" size={16} />
            Reiniciar
          </AppButton>
        </div>
      </header>

      <section className="kpi-grid">
        {kpis.map((kpi) => (
          <article className="kpi-card" key={kpi.label}>
            <div className={`kpi-icon ${kpi.color}`}>
              <Icon name={kpi.icon} size={20} />
            </div>
            <div>
              <p>{kpi.label}</p>
              <strong>{kpi.value}</strong>
              <span className={kpi.color}>{kpi.meta}</span>
            </div>
            <div
              className={`mini-ring ${kpi.color}`}
              style={{ '--value': kpi.ring } as CSSProperties}
            />
          </article>
        ))}
      </section>

      <div className="analytics-grid">
        <div className="analytics-left">
          <section className="panel alert-panel">
            <div className="panel-heading">
              <div>
                <span className="heading-icon red">
                  <Icon name="spark" size={18} />
                </span>
                <div>
                  <p>Análisis con IA</p>
                  <h2>Alertas pedagógicas</h2>
                </div>
              </div>
              <span className="live-dot">{raidState.alerts.length} activas</span>
            </div>

            {raidState.alerts.map((alert) =>
              alert.type === 'critical' ? (
                <article className="student-alert critical" key={alert.id}>
                  <div className="avatar">{alert.initials}</div>
                  <div className="alert-copy">
                    <div>
                      <strong>{alert.studentName}</strong>
                      <span className="tag">{alert.tag}</span>
                    </div>
                    <p>{alert.description}</p>
                    <div className="cooldown">
                      <span>Espera activa</span>
                      <div>
                        <i />
                      </div>
                      <b>0{alert.cooldownSec ?? 4} s</b>
                    </div>
                    {selectedStudentDetail === alert.id && (
                      <p className="alert-expanded-note">
                        El sistema aplicó un bloqueo temporal de 4 s con pista automática en el
                        dispositivo de {alert.studentName}.
                      </p>
                    )}
                  </div>
                  <AppButton
                    className="text-action"
                    onClick={() =>
                      setSelectedStudentDetail((prev) =>
                        prev === alert.id ? null : alert.id
                      )
                    }
                  >
                    {selectedStudentDetail === alert.id ? 'Ocultar' : 'Revisar'}
                  </AppButton>
                </article>
              ) : (
                <article className="student-alert support" key={alert.id}>
                  <div className="avatar">{alert.initials}</div>
                  <div className="alert-copy">
                    <div>
                      <strong>{alert.studentName}</strong>
                      <span className="tag">{alert.tag}</span>
                    </div>
                    <p>{alert.description}</p>
                  </div>
                  <AppButton
                    className={`hint-action ${alert.hintSent ? 'sent' : ''}`}
                    onClick={() => sendHintToStudent(alert.studentId, 'Profesor')}
                  >
                    {alert.hintSent ? '✓ Pista enviada' : 'Enviar pista'}
                  </AppButton>
                </article>
              )
            )}
          </section>

          <section className="panel missed-panel">
            <div className="panel-heading">
              <div>
                <span className="heading-icon purple">
                  <Icon name="target" size={18} />
                </span>
                <div>
                  <p>Patrones del salón</p>
                  <h2>Preguntas con más fallos</h2>
                </div>
              </div>
              <span className="round-label">Ronda 4</span>
            </div>
            <div className="bar-chart">
              {raidState.missedQuestions.map((mq) => (
                <div className="bar-row" key={mq.id}>
                  <div>
                    <span>{mq.rank}</span>
                    <p>
                      <strong>{mq.title}</strong>
                      <small>{mq.subtitle}</small>
                    </p>
                  </div>
                  <div className="bar-track">
                    <span style={{ width: `${mq.errorRate}%` }} />
                  </div>
                  <b>{mq.errorRate}%</b>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="panel telemetry">
          <div className="panel-heading">
            <div>
              <span className="heading-icon blue">
                <Icon name="users" size={18} />
              </span>
              <div>
                <p>{raidState.connectedCount} conectados</p>
                <h2>Telemetría estudiantil en vivo</h2>
              </div>
            </div>
            <span className="live-dot">En vivo</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Alumno</th>
                  <th>Rol</th>
                  <th>Aciertos</th>
                  <th>Prom.</th>
                  <th>Estado pedagógico</th>
                </tr>
              </thead>
              <tbody>
                {visibleStudents.map((student) => (
                  <tr key={student.id}>
                    <td>
                      <div className="student-cell">
                        <span className={`avatar ${student.roleKey}`}>{student.initials}</span>
                        <strong>{student.name}</strong>
                      </div>
                    </td>
                    <td>
                      <span className={`table-role ${student.roleKey}`}>{student.role}</span>
                    </td>
                    <td>
                      <strong>
                        {student.correct} / {student.total}
                      </strong>
                    </td>
                    <td>{student.avgTimeSec.toFixed(1).replace('.', ',')} s</td>
                    <td>
                      <span className={`status-pill ${student.statusClass}`}>
                        <i />
                        {student.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="telemetry-footer">
            <span>
              {showAllStudents
                ? `Mostrando ${visibleStudents.length} alumnos registrados en telemetría`
                : 'Mostrando alumnos prioritarios'}
            </span>
            <AppButton
              className="text-action"
              onClick={() => setShowAllStudents((prev) => !prev)}
            >
              {showAllStudents ? 'Ver prioritarios' : `Ver los ${raidState.connectedCount}`}
            </AppButton>
          </div>
        </section>
      </div>
    </main>
  )
}
