import { databaseRepository } from '../repositories/databaseRepository.js'
import type {
  GameOutcome,
  GameResult,
  MissedQuestionStat,
  PlayerRole,
  Question,
  RaidState,
  SubmitAnswerPayload,
  TelemetryEventRecord,
} from '../types/raid.types.js'

export class RaidEngineService {
  private state: RaidState
  private telemetryHistory: TelemetryEventRecord[] = []
  private sessionStartedAt: number = Date.now()
  private lastGameResult: GameResult | null = null

  constructor() {
    this.state = databaseRepository.getInitialRaidState()
    this.telemetryHistory = databaseRepository.getTelemetryHistory()
  }

  public getState(): RaidState {
    return this.state
  }

  public getQuestions(): Question[] {
    return databaseRepository.getQuestions()
  }

  public getTelemetryHistory(): TelemetryEventRecord[] {
    return this.telemetryHistory
  }

  public getLastGameResult(): GameResult | null {
    return this.lastGameResult
  }

  private flushSnapshot() {
    databaseRepository.persistSnapshot(this.state, this.telemetryHistory)
  }

  // ─── Calcula las preguntas con mayor tasa de error desde la telemetría en memoria ───
  private computeMissedQuestions(): MissedQuestionStat[] {
    const questions = databaseRepository.getQuestions()
    const questionMap = new Map<string, { title: string; subtitle: string; total: number; errors: number }>()

    for (const event of this.telemetryHistory) {
      const question = questions.find((q) => q.id === event.questionId)
      if (!question) continue

      const entry = questionMap.get(event.questionId) ?? {
        title: question.topic,
        subtitle: question.prompt.slice(0, 50),
        total: 0,
        errors: 0,
      }
      entry.total++
      if (!event.isCorrect) entry.errors++
      questionMap.set(event.questionId, entry)
    }

    return [...questionMap.entries()]
      .map(([id, data], i) => ({
        id,
        rank: String(i + 1).padStart(2, '0'),
        title: data.title,
        subtitle: data.subtitle,
        errorRate: data.total > 0 ? Math.round((data.errors / data.total) * 100) : 0,
      }))
      .filter((mq) => mq.errorRate > 0)
      .sort((a, b) => b.errorRate - a.errorRate)
      .slice(0, 5)
  }

  // ─── Genera alertas de apoyo automáticas para alumnos con errores consecutivos ───
  private computeSupportAlerts(
    students: RaidState['students'],
    existingAlerts: RaidState['alerts']
  ): RaidState['alerts'] {
    const alerts = [...existingAlerts]

    for (const stu of students) {
      if (stu.consecutiveErrors >= 2 && stu.statusClass === 'warning') {
        const existingIdx = alerts.findIndex(
          (a) => a.studentId === stu.id && a.type === 'support'
        )
        const supportAlert = {
          id: `al-support-${stu.id}`,
          studentId: stu.id,
          studentName: stu.name,
          initials: stu.initials,
          type: 'support' as const,
          tag: 'Requiere apoyo',
          description: `${stu.consecutiveErrors} errores consecutivos · Tiempo prom: ${stu.avgTimeSec.toFixed(1)} s`,
          hintSent: existingIdx >= 0 ? (alerts[existingIdx].hintSent ?? false) : false,
        }
        if (existingIdx >= 0) {
          alerts[existingIdx] = supportAlert
        } else {
          alerts.push(supportAlert)
        }
      } else if (stu.consecutiveErrors === 0) {
        // Limpiar alerta de apoyo si el alumno ya se recuperó
        const idx = alerts.findIndex((a) => a.studentId === stu.id && a.type === 'support')
        if (idx >= 0) alerts.splice(idx, 1)
      }
    }

    return alerts
  }

  // ─── Lógica de fin de juego ───
  private checkGameOver(state: RaidState): RaidState {
    const alreadyOver = this.lastGameResult !== null
    if (alreadyOver) return state
    if (state.bossHp <= 0) return this.endGame('VICTORIA', state)
    if (state.classHp <= 0) return this.endGame('DERROTA', state)
    return state
  }

  private endGame(outcome: GameOutcome, state: RaidState): RaidState {
    this.lastGameResult = {
      outcome,
      finalBossHp: state.bossHp,
      finalClassHp: state.classHp,
      durationMs: Date.now() - this.sessionStartedAt,
      sessionStartedAt: this.sessionStartedAt,
      accuracyPercent: state.accuracyPercent,
      avgResponseSec: state.avgResponseSec,
      topStudents: [...state.students]
        .sort((a, b) => b.correct - a.correct)
        .slice(0, 3)
        .map((s) => ({ name: s.name, correct: s.correct, role: s.role, initials: s.initials })),
      missedQuestions: state.missedQuestions,
    }
    // Persistir resultado en PG si está disponible (no bloqueante)
    void databaseRepository.finalizeSession(`ses-${state.roomPin}`, outcome, state)
    console.log(`[RaidEngine] 🏁 Partida finalizada: ${outcome}`)
    // Congelar juego
    return { ...state, isPaused: true }
  }

  public joinRaid(studentName: string, role: PlayerRole, pin: string): { ok: boolean; state: RaidState } {
    if (pin.trim() !== this.state.roomPin) {
      return { ok: false, state: this.state }
    }

    const roleLabel =
      role === 'attacker' ? 'Atacante' : role === 'defender' ? 'Defensor' : 'Sanador'
    const initials =
      studentName
        .trim()
        .split(/\s+/)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('')
        .slice(0, 2) || 'AL'

    const existingIdx = this.state.students.findIndex(
      (s) => s.name.toLowerCase() === studentName.trim().toLowerCase()
    )

    const updatedStudents = [...this.state.students]
    if (existingIdx >= 0) {
      updatedStudents[existingIdx] = {
        ...updatedStudents[existingIdx],
        role: roleLabel,
        roleKey: role,
      }
    } else {
      updatedStudents.unshift({
        id: `stu-${Date.now()}`,
        name: studentName.trim(),
        initials,
        role: roleLabel,
        roleKey: role,
        correct: 0,
        total: 0,
        avgTimeSec: 0,
        streak: 0,
        status: 'Ritmo normal',
        statusClass: 'good',
        fastErrorsCount: 0,
        consecutiveErrors: 0,
      })
    }

    this.state = {
      ...this.state,
      connectedCount: existingIdx >= 0 ? this.state.connectedCount : this.state.connectedCount + 1,
      students: updatedStudents,
      lastUpdated: Date.now(),
    }

    const joinedStudent = existingIdx >= 0 ? updatedStudents[existingIdx] : updatedStudents[0]
    if (joinedStudent) {
      void databaseRepository.upsertParticipant(`ses-${this.state.roomPin}`, joinedStudent)
    }

    this.flushSnapshot()
    return { ok: true, state: this.state }
  }

  public submitAnswer(payload: SubmitAnswerPayload): RaidState {
    const prev = this.state
    const multiplier = prev.isBossWeakened ? 2 : 1
    let bossHp = prev.bossHp
    let classHp = prev.classHp
    let shieldCharges = prev.shieldCharges
    const feed = [...prev.feed]
    const floatingTexts = [...prev.floatingTexts]
    const alerts = [...prev.alerts]

    const isGuessingDetected =
      payload.isGuessing || (!payload.isCorrect && payload.responseTimeSec < 1.8)

    const students = prev.students.map((stu) => {
      if (stu.id !== payload.studentId && stu.name !== payload.studentName) return stu
      const total = stu.total + 1
      const correct = stu.correct + (payload.isCorrect ? 1 : 0)
      const streak = payload.isCorrect ? stu.streak + 1 : 0
      const consecutiveErrors = payload.isCorrect ? 0 : stu.consecutiveErrors + 1
      const fastErrorsCount = isGuessingDetected
        ? stu.fastErrorsCount + 1
        : payload.isCorrect
          ? Math.max(0, stu.fastErrorsCount - 1)
          : stu.fastErrorsCount
      const avgTimeSec = Number(
        ((stu.avgTimeSec * stu.total + payload.responseTimeSec) / total).toFixed(1)
      )

      let status = stu.status
      let statusClass = stu.statusClass
      if (isGuessingDetected || fastErrorsCount >= 2) {
        status = 'Adivinando'
        statusClass = 'danger'
      } else if (consecutiveErrors >= 2) {
        status = 'Requiere apoyo'
        statusClass = 'warning'
      } else if (streak >= 4) {
        status = 'Avanzado'
        statusClass = 'advanced'
      } else {
        status = 'Ritmo normal'
        statusClass = 'good'
      }

      return {
        ...stu,
        total,
        correct,
        streak,
        consecutiveErrors,
        fastErrorsCount,
        avgTimeSec,
        status,
        statusClass,
        hasActiveHint: payload.isCorrect ? false : stu.hasActiveHint,
      }
    })

    if (payload.isCorrect) {
      if (payload.role === 'attacker') {
        const baseDamage = 150 * multiplier
        bossHp = Math.max(0, bossHp - baseDamage)
        floatingTexts[0] = {
          id: `ft-${Date.now()}`,
          text: `−${baseDamage} PV`,
          subtext: payload.studentName,
          type: 'damage',
        }
        feed.unshift({
          id: `feed-${Date.now()}`,
          name: payload.studentName,
          text: `causó ${baseDamage} de daño al jefe`,
          icon: 'sword',
          color: 'rose',
          timestamp: 'ahora',
        })
      } else if (payload.role === 'defender') {
        const dmg = 80 * multiplier
        bossHp = Math.max(0, bossHp - dmg)
        shieldCharges = Math.min(prev.maxShieldCharges, shieldCharges + 1)
        floatingTexts[1] = {
          id: `ft-${Date.now()}`,
          text: '+Escudo',
          subtext: payload.studentName,
          type: 'shield',
        }
        feed.unshift({
          id: `feed-${Date.now()}`,
          name: payload.studentName,
          text: 'reforzó el escudo grupal (+1)',
          icon: 'shield',
          color: 'blue',
          timestamp: 'ahora',
        })
      } else {
        const healAmount = 200
        const dmg = 60 * multiplier
        bossHp = Math.max(0, bossHp - dmg)
        classHp = Math.min(prev.classMaxHp, classHp + healAmount)
        floatingTexts[2] = {
          id: `ft-${Date.now()}`,
          text: `+${healAmount} PV`,
          subtext: `Curación (${payload.studentName})`,
          type: 'heal',
        }
        feed.unshift({
          id: `feed-${Date.now()}`,
          name: payload.studentName,
          text: `curó +${healAmount} PV al salón`,
          icon: 'heart',
          color: 'green',
          timestamp: 'ahora',
        })
      }
    } else {
      classHp = Math.max(0, classHp - 100)
      if (isGuessingDetected) {
        const existingAlertIdx = alerts.findIndex(
          (a) => a.studentName === payload.studentName && a.type === 'critical'
        )
        const newAlert = {
          id: `al-${Date.now()}`,
          studentId: payload.studentId,
          studentName: payload.studentName,
          initials: payload.studentName.slice(0, 2).toUpperCase(),
          type: 'critical' as const,
          tag: 'Adivinación detectada',
          description: `Respuesta errónea en ${payload.responseTimeSec.toFixed(1)} s (< 1,8 s). Cooldown de 4 s activado.`,
          cooldownSec: 4,
        }
        if (existingAlertIdx >= 0) {
          alerts[existingAlertIdx] = newAlert
        } else {
          alerts.unshift(newAlert)
        }
      }
    }

    const bossPercent = (bossHp / prev.bossMaxHp) * 100
    const bossPhase =
      bossPercent <= 25 ? 2 : bossPercent <= 55 && bossPercent >= 45 ? 'shield' : 1

    const totalCorrect = students.reduce((acc, s) => acc + s.correct, 0)
    const totalAttempts = Math.max(1, students.reduce((acc, s) => acc + s.total, 0))
    const accuracyPercent = Math.round((totalCorrect / totalAttempts) * 100)

    // Calcular avgResponseSec ponderado sobre todos los alumnos
    const weightedSum = students.reduce((acc, s) => acc + s.avgTimeSec * s.total, 0)
    const avgResponseSec = totalAttempts > 0
      ? Number((weightedSum / totalAttempts).toFixed(1))
      : prev.avgResponseSec

    // Alertas combinadas: críticas (adivinación) + apoyo (errores consecutivos)
    const combinedAlerts = this.computeSupportAlerts(students, alerts)

    this.state = {
      ...prev,
      bossHp,
      bossPhase,
      classHp,
      shieldCharges,
      feed: feed.slice(0, 6),
      floatingTexts,
      students,
      alerts: combinedAlerts.slice(0, 6),
      accuracyPercent,
      avgResponseSec,
      missedQuestions: this.computeMissedQuestions(),
      lastUpdated: Date.now(),
    }

    const telemetryRecord: TelemetryEventRecord = {
      ...payload,
      isGuessing: isGuessingDetected,
      id: `tel-${Date.now()}`,
      timestamp: new Date().toISOString(),
    }
    this.telemetryHistory.push(telemetryRecord)
    const sessionId = `ses-${this.state.roomPin}`
    void databaseRepository.recordTelemetryEvent(telemetryRecord, this.state)
    void databaseRepository.syncSessionHp(sessionId, this.state)

    const answeredStudent = students.find(
      (s) => s.id === payload.studentId || s.name === payload.studentName
    )
    if (answeredStudent) {
      void databaseRepository.upsertParticipant(sessionId, answeredStudent)
    }

    for (const alert of combinedAlerts) {
      void databaseRepository.upsertPedagogicalAlert(sessionId, alert)
    }

    this.flushSnapshot()

    // Verificar fin de juego (no bloqueante)
    this.state = this.checkGameOver(this.state)
    return this.state
  }

  public useSkill(studentName: string, role: PlayerRole): RaidState {
    const prev = this.state
    const multiplier = prev.isBossWeakened ? 2 : 1
    let bossHp = prev.bossHp
    let classHp = prev.classHp
    let shieldCharges = prev.shieldCharges
    const feed = [...prev.feed]
    const floatingTexts = [...prev.floatingTexts]
    let students = [...prev.students]

    if (role === 'attacker') {
      const critDamage = 450 * multiplier
      bossHp = Math.max(0, bossHp - critDamage)
      floatingTexts[0] = {
        id: `ft-${Date.now()}`,
        text: `💥 −${critDamage} PV`,
        subtext: `${studentName} (Crítico)`,
        type: 'damage',
      }
      feed.unshift({
        id: `feed-${Date.now()}`,
        name: studentName,
        text: `desató GOLPE CRÍTICO (−${critDamage} PV)`,
        icon: 'bolt',
        color: 'amber',
        timestamp: 'ahora',
      })
    } else if (role === 'defender') {
      shieldCharges = prev.maxShieldCharges
      const reflectDmg = 200 * multiplier
      bossHp = Math.max(0, bossHp - reflectDmg)
      floatingTexts[1] = {
        id: `ft-${Date.now()}`,
        text: '🛡️ Escudo Total',
        subtext: studentName,
        type: 'shield',
      }
      feed.unshift({
        id: `feed-${Date.now()}`,
        name: studentName,
        text: 'completó el Escudo Grupal (5/5)',
        icon: 'shield',
        color: 'blue',
        timestamp: 'ahora',
      })
    } else {
      classHp = Math.min(prev.classMaxHp, classHp + 350)
      floatingTexts[2] = {
        id: `ft-${Date.now()}`,
        text: '+350 PV + Pista',
        subtext: studentName,
        type: 'heal',
      }
      feed.unshift({
        id: `feed-${Date.now()}`,
        name: studentName,
        text: 'curó +350 PV y envió pista al equipo',
        icon: 'heart',
        color: 'green',
        timestamp: 'ahora',
      })
      students = students.map((s) => ({
        ...s,
        hasActiveHint: true,
        hintSender: studentName,
      }))
    }

    this.state = {
      ...prev,
      bossHp,
      classHp,
      shieldCharges,
      feed: feed.slice(0, 6),
      floatingTexts,
      students,
      lastUpdated: Date.now(),
    }

    this.flushSnapshot()
    this.state = this.checkGameOver(this.state)
    return this.state
  }

  public togglePause(value?: boolean): RaidState {
    const nextPaused = typeof value === 'boolean' ? value : !this.state.isPaused
    this.state = {
      ...this.state,
      isPaused: nextPaused,
      lastUpdated: Date.now(),
    }
    void databaseRepository.syncSessionHp(`ses-${this.state.roomPin}`, this.state)
    this.flushSnapshot()
    return this.state
  }

  public toggleWeaken(value?: boolean): RaidState {
    const nextWeakened = typeof value === 'boolean' ? value : !this.state.isBossWeakened
    const nextBossHp = nextWeakened
      ? Math.max(500, this.state.bossHp - 650)
      : Math.min(this.state.bossMaxHp, this.state.bossHp + 650)

    this.state = {
      ...this.state,
      isBossWeakened: nextWeakened,
      bossHp: nextBossHp,
      lastUpdated: Date.now(),
    }
    void databaseRepository.syncSessionHp(`ses-${this.state.roomPin}`, this.state)
    this.flushSnapshot()
    return this.state
  }

  public sendHint(studentId?: string, senderName = 'Profesor'): RaidState {
    const students = this.state.students.map((s) =>
      !studentId || s.id === studentId
        ? { ...s, hasActiveHint: true, hintSender: senderName }
        : s
    )

    const alerts = this.state.alerts.map((a) =>
      !studentId || a.studentId === studentId ? { ...a, hintSent: true } : a
    )

    const feed = [
      {
        id: `feed-${Date.now()}`,
        name: senderName,
        text: 'envió una pista pedagógica silenciosa',
        icon: 'spark' as const,
        color: 'green' as const,
        timestamp: 'ahora',
      },
      ...this.state.feed,
    ].slice(0, 6)

    this.state = {
      ...this.state,
      students,
      alerts,
      feed,
      lastUpdated: Date.now(),
    }
    this.flushSnapshot()
    return this.state
  }

  public tickBossTimer(): RaidState {
    if (this.state.isPaused || this.state.bossHp <= 0) return this.state

    let nextCountdown = this.state.bossAttackCountdown - 1
    let classHp = this.state.classHp
    let shieldCharges = this.state.shieldCharges
    const feed = [...this.state.feed]

    if (nextCountdown <= 0) {
      if (shieldCharges >= this.state.maxShieldCharges) {
        feed.unshift({
          id: `feed-${Date.now()}`,
          name: 'Escuadrón Defensor',
          text: '¡bloqueó el ataque de fuego del Dragón!',
          icon: 'shield',
          color: 'blue',
          timestamp: 'ahora',
        })
      } else {
        const unblockedRatio =
          (this.state.maxShieldCharges - shieldCharges) / this.state.maxShieldCharges
        const bossDmg = Math.round(600 * unblockedRatio)
        classHp = Math.max(0, classHp - bossDmg)
        feed.unshift({
          id: `feed-${Date.now()}`,
          name: 'Jefe Dragón',
          text: `lanzó Ola de Fuego (−${bossDmg} PV al salón)`,
          icon: 'flame',
          color: 'rose',
          timestamp: 'ahora',
        })
      }
      nextCountdown = 45
      shieldCharges = Math.max(1, shieldCharges - 2)
    }

    this.state = {
      ...this.state,
      bossAttackCountdown: nextCountdown,
      classHp,
      shieldCharges,
      feed: feed.slice(0, 6),
      lastUpdated: Date.now(),
    }

    void databaseRepository.syncSessionHp(`ses-${this.state.roomPin}`, this.state)
    // Verificar fin de juego tras ataque del jefe
    this.state = this.checkGameOver(this.state)
    return this.state
  }

  public resetSession(): RaidState {
    this.state = databaseRepository.getInitialRaidState()
    this.telemetryHistory = []
    this.lastGameResult = null
    this.sessionStartedAt = Date.now()
    void databaseRepository.createOrUpdateSession(this.state)
    this.flushSnapshot()
    return this.state
  }
}

export const raidEngineService = new RaidEngineService()
