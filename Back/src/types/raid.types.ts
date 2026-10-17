export type PlayerRole = 'attacker' | 'defender' | 'healer'

export type IconName =
  | 'sword'
  | 'shield'
  | 'heart'
  | 'flame'
  | 'bolt'
  | 'pause'
  | 'users'
  | 'clock'
  | 'spark'
  | 'target'
  | 'alert'
  | 'play'
  | 'refresh'
  | 'lock'
  | 'check'
  | 'music'
  | 'volume'
  | 'mute'

export interface AnswerOption {
  shape: 'triangle' | 'diamond' | 'circle' | 'square'
  value: string
}

export interface Question {
  id: string
  number: number
  difficulty: 'Nivel básico' | 'Nivel medio' | 'Nivel avanzado'
  topic: string
  prompt: string
  correctAnswer: string
  options: AnswerOption[]
  hint: string
  wrongOptionToEliminate: string
  timeLimitSec: number
}

export interface ComboFeedItem {
  id: string
  name: string
  text: string
  icon: IconName
  color: 'rose' | 'green' | 'blue' | 'amber'
  timestamp: string
}

export interface FloatingCombatText {
  id: string
  text: string
  subtext: string
  type: 'damage' | 'shield' | 'heal'
}

export interface StudentTelemetry {
  id: string
  name: string
  initials: string
  role: string
  roleKey: PlayerRole
  correct: number
  total: number
  avgTimeSec: number
  streak: number
  status: 'Requiere apoyo' | 'Adivinando' | 'Avanzada' | 'Avanzado' | 'Ritmo normal'
  statusClass: 'warning' | 'danger' | 'advanced' | 'good'
  fastErrorsCount: number
  consecutiveErrors: number
  hasActiveHint?: boolean
  hintSender?: string
}

export interface PedagogicalAlert {
  id: string
  studentId: string
  studentName: string
  initials: string
  type: 'critical' | 'support'
  tag: string
  description: string
  cooldownSec?: number
  hintSent?: boolean
}

export interface MissedQuestionStat {
  id: string
  rank: string
  title: string
  subtitle: string
  errorRate: number
}

export type BossPhase = 1 | 'shield' | 2

export interface RaidState {
  roomPin: string
  bossName: string
  bossHp: number
  bossMaxHp: number
  bossPhase: BossPhase
  shieldPhaseProgress: number
  classHp: number
  classMaxHp: number
  connectedCount: number
  isPaused: boolean
  isBossWeakened: boolean
  shieldCharges: number
  maxShieldCharges: number
  bossAttackCountdown: number
  feed: ComboFeedItem[]
  floatingTexts: FloatingCombatText[]
  students: StudentTelemetry[]
  alerts: PedagogicalAlert[]
  missedQuestions: MissedQuestionStat[]
  accuracyPercent: number
  avgResponseSec: number
  lastUpdated: number
}

export interface SubmitAnswerPayload {
  studentId: string
  studentName: string
  role: PlayerRole
  questionId: string
  selectedAnswer: string
  isCorrect: boolean
  responseTimeSec: number
  isGuessing: boolean
}

export interface TelemetryEventRecord extends SubmitAnswerPayload {
  id: string
  timestamp: string
}

export type GameOutcome = 'VICTORIA' | 'DERROTA'

export interface GameResult {
  outcome: GameOutcome
  finalBossHp: number
  finalClassHp: number
  durationMs: number
  sessionStartedAt: number
  accuracyPercent: number
  avgResponseSec: number
  topStudents: Array<{ name: string; correct: number; role: string; initials: string }>
  missedQuestions: MissedQuestionStat[]
}
