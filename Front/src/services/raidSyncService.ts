import { io, type Socket } from 'socket.io-client'
import { INITIAL_RAID_STATE } from '../data/mockRaidData'
import type { RaidState, SubmitAnswerPayload, PlayerRole, GameResult } from '../types/raid.types'

const STORAGE_KEY = 'raid_boss_shared_state_v1'
const CHANNEL_NAME = 'raid_boss_sync_channel_v1'

type StateListener = (state: RaidState) => void

class RaidSyncService {
  private socket: Socket | null = null
  private channel: BroadcastChannel | null = null
  private listeners = new Set<StateListener>()
  private state: RaidState
  private isSocketConnected = false
  private lastGameResult: GameResult | null = null

  constructor() {
    this.state = this.loadInitialState()
    this.initBroadcastChannel()
    this.initSocket()
  }

  private loadInitialState(): RaidState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as RaidState
        if (parsed && typeof parsed.bossHp === 'number') {
          return parsed
        }
      }
    } catch {
      // Fallback to initial state
    }
    return { ...INITIAL_RAID_STATE }
  }

  private initBroadcastChannel() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel(CHANNEL_NAME)
      this.channel.onmessage = (event) => {
        if (event.data && event.data.type === 'RAID_STATE_SYNC') {
          this.state = event.data.payload
          this.notifyListeners()
        } else if (event.data && event.data.type === 'GAME_OVER_SYNC') {
          this.lastGameResult = event.data.payload
          this.notifyListeners()
        }
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY && e.newValue) {
          try {
            this.state = JSON.parse(e.newValue) as RaidState
            this.notifyListeners()
          } catch {
            // Ignore malformed storage event
          }
        }
      })
    }
  }

  private initSocket() {
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001'

    try {
      this.socket = io(socketUrl, {
        autoConnect: true,
        reconnectionAttempts: 5,
        timeout: 2000,
      })

      this.socket.on('connect', () => {
        this.isSocketConnected = true
        this.notifyListeners()
      })

      this.socket.on('disconnect', () => {
        this.isSocketConnected = false
        this.notifyListeners()
      })

      this.socket.on('boss_state_update', (serverState: Partial<RaidState>) => {
        this.updateState({ ...this.state, ...serverState, lastUpdated: Date.now() }, false)
      })

      this.socket.on('game_paused', (paused: boolean) => {
        this.updateState({ ...this.state, isPaused: paused, lastUpdated: Date.now() }, false)
      })

      this.socket.on('game_over', (result: GameResult) => {
        this.lastGameResult = result
        if (this.channel) {
          this.channel.postMessage({
            type: 'GAME_OVER_SYNC',
            payload: result,
          })
        }
        this.notifyListeners()
      })
    } catch {
      this.isSocketConnected = false
    }
  }

  public getState(): RaidState {
    return this.state
  }

  public getLastGameResult(): GameResult | null {
    return this.lastGameResult
  }

  public getConnectionMode(): 'socket' | 'local-sync' {
    return this.isSocketConnected ? 'socket' : 'local-sync'
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener)
    listener(this.state)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notifyListeners() {
    for (const listener of this.listeners) {
      listener(this.state)
    }
  }

  public updateState(nextState: RaidState, broadcast = true) {
    this.state = nextState
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState))
    } catch {
      // Ignore quota errors
    }

    if (broadcast && this.channel) {
      this.channel.postMessage({
        type: 'RAID_STATE_SYNC',
        payload: nextState,
      })
    }

    this.notifyListeners()
  }

  public emitJoinRaid(studentName: string, role: PlayerRole, pin: string): boolean {
    if (pin.trim() !== this.state.roomPin) {
      return false
    }

    if (this.socket && this.isSocketConnected) {
      this.socket.emit('join_raid', { studentName, role, pin })
    }

    const roleLabel =
      role === 'attacker' ? 'Atacante' : role === 'defender' ? 'Defensor' : 'Sanador'
    const initials = studentName
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

    this.updateState({
      ...this.state,
      connectedCount: existingIdx >= 0 ? this.state.connectedCount : this.state.connectedCount + 1,
      students: updatedStudents,
      lastUpdated: Date.now(),
    })

    return true
  }

  public emitSubmitAnswer(payload: SubmitAnswerPayload) {
    if (this.socket && this.isSocketConnected) {
      this.socket.emit('submit_answer', payload)
    }

    const prev = this.state
    const multiplier = prev.isBossWeakened ? 2 : 1
    let bossHp = prev.bossHp
    let classHp = prev.classHp
    let shieldCharges = prev.shieldCharges
    const feed = [...prev.feed]
    const floatingTexts = [...prev.floatingTexts]
    const alerts = [...prev.alerts]

    // Update student telemetry
    const students = prev.students.map((stu) => {
      if (stu.id !== payload.studentId && stu.name !== payload.studentName) return stu
      const total = stu.total + 1
      const correct = stu.correct + (payload.isCorrect ? 1 : 0)
      const streak = payload.isCorrect ? stu.streak + 1 : 0
      const consecutiveErrors = payload.isCorrect ? 0 : stu.consecutiveErrors + 1
      const fastErrorsCount = payload.isGuessing
        ? stu.fastErrorsCount + 1
        : payload.isCorrect
          ? Math.max(0, stu.fastErrorsCount - 1)
          : stu.fastErrorsCount
      const avgTimeSec = Number(
        ((stu.avgTimeSec * stu.total + payload.responseTimeSec) / total).toFixed(1)
      )

      let status = stu.status
      let statusClass = stu.statusClass
      if (payload.isGuessing || fastErrorsCount >= 2) {
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
      // Incorrect answer
      classHp = Math.max(0, classHp - 100)
      if (payload.isGuessing) {
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

    this.updateState({
      ...prev,
      bossHp,
      bossPhase,
      classHp,
      shieldCharges,
      feed: feed.slice(0, 6),
      floatingTexts,
      students,
      alerts: alerts.slice(0, 4),
      accuracyPercent,
      lastUpdated: Date.now(),
    })
  }

  public emitUseSkill(studentName: string, role: PlayerRole) {
    if (this.socket && this.isSocketConnected) {
      this.socket.emit('use_skill', { studentName, role })
    }

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

    this.updateState({
      ...prev,
      bossHp,
      classHp,
      shieldCharges,
      feed: feed.slice(0, 6),
      floatingTexts,
      students,
      lastUpdated: Date.now(),
    })
  }

  public emitTeacherTogglePause() {
    const nextPaused = !this.state.isPaused
    if (this.socket && this.isSocketConnected) {
      this.socket.emit('teacher_action', { action: 'toggle_pause', value: nextPaused })
    }
    this.updateState({
      ...this.state,
      isPaused: nextPaused,
      lastUpdated: Date.now(),
    })
  }

  public emitTeacherToggleWeaken() {
    const nextWeakened = !this.state.isBossWeakened
    if (this.socket && this.isSocketConnected) {
      this.socket.emit('teacher_action', { action: 'toggle_weaken', value: nextWeakened })
    }
    const nextBossHp = nextWeakened
      ? Math.max(500, this.state.bossHp - 650)
      : Math.min(this.state.bossMaxHp, this.state.bossHp + 650)

    this.updateState({
      ...this.state,
      isBossWeakened: nextWeakened,
      bossHp: nextBossHp,
      lastUpdated: Date.now(),
    })
  }

  public emitTeacherSendHint(studentId?: string, senderName = 'Profesor') {
    if (this.socket && this.isSocketConnected) {
      this.socket.emit('teacher_action', { action: 'send_hint', studentId })
    }

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

    this.updateState({
      ...this.state,
      students,
      alerts,
      feed,
      lastUpdated: Date.now(),
    })
  }

  public tickBossTimer() {
    // Si el socket está conectado, el servidor maneja el tick vía boss_state_update.
    // Hacer tick local causaría que el countdown avance el doble de rápido.
    if (this.isSocketConnected) return

    if (this.state.isPaused || this.state.bossHp <= 0) return

    let nextCountdown = this.state.bossAttackCountdown - 1
    let classHp = this.state.classHp
    let shieldCharges = this.state.shieldCharges
    const feed = [...this.state.feed]

    if (nextCountdown <= 0) {
      // Boss unleashes fire wave
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

    this.updateState({
      ...this.state,
      bossAttackCountdown: nextCountdown,
      classHp,
      shieldCharges,
      feed: feed.slice(0, 6),
      lastUpdated: Date.now(),
    })
  }

  public resetRaidSession() {
    this.lastGameResult = null
    if (this.socket && this.isSocketConnected) {
      this.socket.emit('reset_raid')
    }
    const fresh = {
      ...INITIAL_RAID_STATE,
      lastUpdated: Date.now(),
    }
    this.updateState(fresh)
  }
}

export const raidSyncService = new RaidSyncService()
