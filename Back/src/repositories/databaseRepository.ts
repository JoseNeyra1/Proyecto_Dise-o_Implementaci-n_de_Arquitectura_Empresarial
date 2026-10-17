import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import type {
  GameOutcome,
  MissedQuestionStat,
  PedagogicalAlert,
  Question,
  RaidState,
  StudentTelemetry,
  TelemetryEventRecord,
} from '../types/raid.types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SEED_FILE_PATH = path.resolve(__dirname, '../../../Base_Datos/raid_boss_seed.json')
const SNAPSHOT_FILE_PATH = path.resolve(__dirname, '../../../Base_Datos/runtime_snapshot.json')

interface SeedDatabaseFile extends Omit<RaidState, 'lastUpdated'> {
  questions: Question[]
  telemetryHistory: TelemetryEventRecord[]
}

export class DatabaseRepository {
  private pgPool: pg.Pool | null = null
  private seedCache: SeedDatabaseFile

  constructor() {
    this.seedCache = this.readSeedFile()
    this.initPostgresIfConfigured()
  }

  private initPostgresIfConfigured() {
    const dbUrl = process.env.DATABASE_URL
    if (!dbUrl) return

    try {
      this.pgPool = new pg.Pool({ connectionString: dbUrl })
      this.pgPool.on('error', (err) => {
        console.warn('[PostgreSQL Pool Warning]', err.message)
      })
      console.log('[Base_Datos] Pool PostgreSQL configurado con URL:', dbUrl.replace(/:[^:@]+@/, ':***@'))
    } catch (err) {
      console.warn('[Base_Datos] Usando persistencia local en runtime_snapshot.json', err)
    }
  }

  private readSeedFile(): SeedDatabaseFile {
    const raw = fs.readFileSync(SEED_FILE_PATH, 'utf-8')
    return JSON.parse(raw) as SeedDatabaseFile
  }

  public getInitialRaidState(): RaidState {
    const freshSeed = this.readSeedFile()
    const { questions: _q, telemetryHistory: _t, ...stateFields } = freshSeed
    return {
      ...stateFields,
      lastUpdated: Date.now(),
    }
  }

  public getQuestions(): Question[] {
    return this.seedCache.questions
  }

  public getTelemetryHistory(): TelemetryEventRecord[] {
    try {
      if (fs.existsSync(SNAPSHOT_FILE_PATH)) {
        const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_FILE_PATH, 'utf-8'))
        return snapshot.telemetryHistory ?? []
      }
    } catch {
      // Fallback
    }
    return this.seedCache.telemetryHistory ?? []
  }

  public persistSnapshot(state: RaidState, telemetryHistory: TelemetryEventRecord[]) {
    try {
      const payload = {
        ...state,
        questions: this.seedCache.questions,
        telemetryHistory: telemetryHistory.slice(-200),
      }
      fs.writeFileSync(SNAPSHOT_FILE_PATH, JSON.stringify(payload, null, 2), 'utf-8')
    } catch (err) {
      console.error('[Base_Datos] Error guardando snapshot:', err)
    }
  }

  // ─── SESIONES EN POSTGRESQL ───

  public async createOrUpdateSession(state: RaidState) {
    if (!this.pgPool) return
    const sessionId = `ses-${state.roomPin}`
    const docenteId = process.env.DOCENTE_ID || 'doc-01'
    const bossId = process.env.BOSS_ID || 'boss-dragon-01'
    const faseStr = String(state.bossPhase)

    try {
      await this.pgPool.query(
        `INSERT INTO sesiones_aula
          (id_sesion, pin_sala, id_docente, id_jefe, nombre_aula, vida_jefe_actual,
           vida_salon_actual, vida_salon_maxima, fase_jefe, escudos_activos, esta_pausada,
           jefe_debilitado_x2, estado_partida, fecha_inicio)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
         ON CONFLICT (id_sesion) DO UPDATE SET
           vida_jefe_actual   = EXCLUDED.vida_jefe_actual,
           vida_salon_actual  = EXCLUDED.vida_salon_actual,
           fase_jefe          = EXCLUDED.fase_jefe,
           escudos_activos    = EXCLUDED.escudos_activos,
           esta_pausada       = EXCLUDED.esta_pausada,
           jefe_debilitado_x2 = EXCLUDED.jefe_debilitado_x2,
           estado_partida     = EXCLUDED.estado_partida`,
        [
          sessionId,
          state.roomPin,
          docenteId,
          bossId,
          '5to Primaria - Sección A',
          state.bossHp,
          state.classHp,
          state.classMaxHp,
          faseStr,
          state.shieldCharges,
          state.isPaused,
          state.isBossWeakened,
          state.isPaused ? 'PAUSADA' : 'EN_CURSO',
        ]
      )
      console.log(`[Base_Datos] Sesión ${sessionId} sincronizada en PostgreSQL`)
    } catch (err: unknown) {
      console.warn('[Base_Datos] No se pudo crear/actualizar sesión en PG:', (err as Error).message)
    }
  }

  public async syncSessionHp(sessionId: string, state: RaidState) {
    if (!this.pgPool) return
    try {
      await this.pgPool.query(
        `UPDATE sesiones_aula
         SET vida_jefe_actual   = $1,
             vida_salon_actual  = $2,
             fase_jefe          = $3,
             escudos_activos    = $4,
             esta_pausada       = $5,
             jefe_debilitado_x2 = $6
         WHERE id_sesion = $7`,
        [
          state.bossHp,
          state.classHp,
          String(state.bossPhase),
          state.shieldCharges,
          state.isPaused,
          state.isBossWeakened,
          sessionId,
        ]
      )
    } catch {
      // Non-blocking
    }
  }

  public async finalizeSession(
    sessionId: string,
    outcome: GameOutcome,
    state: RaidState
  ) {
    if (!this.pgPool) return
    const pgEstado = outcome === 'VICTORIA' ? 'VICTORIA' : 'FINALIZADA'
    try {
      await this.pgPool.query(
        `UPDATE sesiones_aula
         SET estado_partida    = $1,
             vida_jefe_actual  = $2,
             vida_salon_actual = $3,
             fecha_fin         = NOW()
         WHERE id_sesion = $4`,
        [pgEstado, state.bossHp, state.classHp, sessionId]
      )
      console.log(`[Base_Datos] Sesión ${sessionId} finalizada como ${outcome} (${pgEstado})`)
    } catch (err: unknown) {
      console.warn('[Base_Datos] No se pudo finalizar sesión en PG:', (err as Error).message)
    }
  }

  // ─── PARTICIPANTES EN POSTGRESQL ───

  public async upsertParticipant(sessionId: string, student: StudentTelemetry) {
    if (!this.pgPool) return
    try {
      await this.pgPool.query(
        `INSERT INTO participantes_sesion
          (id_participante, id_sesion, nombre_alumno, iniciales, rol_combate, nombre_rol,
           aciertos_totales, intentos_totales, tiempo_promedio_seg, racha_actual,
           errores_rapidos_azar, errores_consecutivos, estado_pedagogico, clase_estado,
           pista_activa, remitente_pista, ultima_actividad)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
         ON CONFLICT (id_participante) DO UPDATE SET
           aciertos_totales     = EXCLUDED.aciertos_totales,
           intentos_totales     = EXCLUDED.intentos_totales,
           tiempo_promedio_seg  = EXCLUDED.tiempo_promedio_seg,
           racha_actual         = EXCLUDED.racha_actual,
           errores_rapidos_azar = EXCLUDED.errores_rapidos_azar,
           errores_consecutivos = EXCLUDED.errores_consecutivos,
           estado_pedagogico    = EXCLUDED.estado_pedagogico,
           clase_estado         = EXCLUDED.clase_estado,
           pista_activa         = EXCLUDED.pista_activa,
           remitente_pista      = EXCLUDED.remitente_pista,
           ultima_actividad     = NOW()`,
        [
          student.id,
          sessionId,
          student.name,
          student.initials,
          student.roleKey,
          student.role,
          student.correct,
          student.total,
          student.avgTimeSec,
          student.streak,
          student.fastErrorsCount,
          student.consecutiveErrors,
          student.status,
          student.statusClass,
          student.hasActiveHint ?? false,
          student.hintSender ?? null,
        ]
      )
    } catch {
      // Non-blocking
    }
  }

  // ─── TELEMETRÍA Y ALERTAS EN POSTGRESQL ───

  public async recordTelemetryEvent(event: TelemetryEventRecord, state: RaidState) {
    if (!this.pgPool) return
    const sessionId = `ses-${state.roomPin}`
    try {
      await this.pgPool.query(
        `INSERT INTO respuestas_telemetria
          (id_sesion, id_participante, id_pregunta, respuesta_seleccionada,
           fue_correcta, tiempo_respuesta_seg, fue_adivinacion_azar, dano_o_aporte)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          sessionId,
          event.studentId,
          event.questionId,
          event.selectedAnswer,
          event.isCorrect,
          event.responseTimeSec,
          event.isGuessing,
          event.isCorrect ? 150 : 0,
        ]
      )
    } catch {
      // Non-blocking
    }
  }

  public async upsertPedagogicalAlert(sessionId: string, alert: PedagogicalAlert) {
    if (!this.pgPool) return
    try {
      await this.pgPool.query(
        `INSERT INTO alertas_pedagogicas
          (id_alerta, id_sesion, id_participante, tipo_alerta, etiqueta,
           descripcion, cooldown_aplicado_seg, pista_enviada, fecha_creacion)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         ON CONFLICT (id_alerta) DO UPDATE SET
           pista_enviada = EXCLUDED.pista_enviada`,
        [
          alert.id,
          sessionId,
          alert.studentId,
          alert.type,
          alert.tag,
          alert.description,
          alert.cooldownSec ?? 0,
          alert.hintSent ?? false,
        ]
      )
    } catch {
      // Non-blocking
    }
  }

  // ─── CONSULTAS ANALÍTICAS Y CARGA DE DATOS ───

  public async loadQuestionsFromDB(bossId = 'boss-dragon-01'): Promise<Question[]> {
    if (!this.pgPool) return this.seedCache.questions

    try {
      const res = await this.pgPool.query<Question>(
        `SELECT
           p.id_pregunta               AS id,
           p.numero_orden              AS number,
           p.nivel_dificultad          AS difficulty,
           p.topico_especifico         AS topic,
           p.enunciado                 AS prompt,
           p.respuesta_correcta        AS "correctAnswer",
           p.pista_pedagogica          AS hint,
           p.opcion_eliminar_pista     AS "wrongOptionToEliminate",
           p.tiempo_limite_seg         AS "timeLimitSec",
           json_agg(
             json_build_object('shape', o.figura_geometrica, 'value', o.valor_mostrado)
             ORDER BY o.tecla_atajo
           ) AS options
         FROM preguntas p
         JOIN opciones_pregunta o ON p.id_pregunta = o.id_pregunta
         WHERE p.id_jefe = $1
         GROUP BY p.id_pregunta, p.numero_orden, p.nivel_dificultad,
                  p.topico_especifico, p.enunciado, p.respuesta_correcta,
                  p.pista_pedagogica, p.opcion_eliminar_pista, p.tiempo_limite_seg
         ORDER BY p.numero_orden`,
        [bossId]
      )
      if (res.rows.length > 0) {
        this.seedCache.questions = res.rows
        console.log(`[Base_Datos] ${res.rows.length} preguntas cargadas desde PostgreSQL`)
      }
      return this.seedCache.questions
    } catch (err: unknown) {
      console.warn('[Base_Datos] Usando banco de preguntas local (fallback):', (err as Error).message)
      return this.seedCache.questions
    }
  }

  public async getMissedQuestionsFromDB(sessionId?: string): Promise<MissedQuestionStat[]> {
    if (!this.pgPool) return []

    try {
      // Si se proporciona sessionId, filtra solo por la sesión activa.
      // De lo contrario, agrega todas las sesiones históricas.
      const whereClause = sessionId ? 'WHERE rt.id_sesion = $1' : ''
      const queryParams = sessionId ? [sessionId] : []

      const res = await this.pgPool.query<{
        id: string
        rank: string
        title: string
        subtitle: string
        errorRate: number
      }>(
        `SELECT
           p.id_pregunta AS id,
           LPAD(p.numero_orden::text, 2, '0') AS rank,
           p.topico_especifico AS title,
           p.enunciado AS subtitle,
           COALESCE(
             ROUND(
               (SUM(CASE WHEN rt.fue_correcta = FALSE THEN 1 ELSE 0 END)::NUMERIC /
                NULLIF(COUNT(rt.id_respuesta), 0)) * 100,
               0
             ), 0
           )::int AS "errorRate"
         FROM preguntas p
         JOIN respuestas_telemetria rt ON p.id_pregunta = rt.id_pregunta
         ${whereClause}
         GROUP BY p.id_pregunta, p.numero_orden, p.topico_especifico, p.enunciado
         HAVING COUNT(rt.id_respuesta) > 0
         ORDER BY "errorRate" DESC
         LIMIT 5`,
        queryParams
      )
      return res.rows
    } catch {
      return []
    }
  }

  public async getSessionHistory() {
    if (!this.pgPool) return []

    try {
      const res = await this.pgPool.query(
        `SELECT
           s.id_sesion        AS "sessionId",
           s.pin_sala          AS "roomPin",
           s.nombre_aula       AS "roomName",
           s.estado_partida    AS "status",
           s.vida_jefe_actual  AS "bossHp",
           j.nombre            AS "bossName",
           j.tema_curricular   AS "topic",
           s.fecha_inicio      AS "startedAt",
           s.fecha_fin         AS "endedAt"
         FROM sesiones_aula s
         JOIN jefes_incursion j ON s.id_jefe = j.id_jefe
         ORDER BY s.fecha_inicio DESC
         LIMIT 20`
      )
      return res.rows
    } catch {
      return []
    }
  }

  public async getAvailableBosses() {
    if (!this.pgPool) {
      return [
        {
          id: 'boss-dragon-01',
          name: 'Jefe Dragón',
          topic: 'Operaciones con Fracciones',
          grade: '5to de Primaria',
          maxHp: 10000,
          attackIntervalSec: 45,
          baseDamage: 600,
          shieldsRequired: 5,
          spriteKey: 'dragon_fracciones',
        },
      ]
    }

    try {
      const res = await this.pgPool.query(
        `SELECT
           id_jefe               AS id,
           nombre                AS name,
           tema_curricular       AS topic,
           grado_objetivo        AS grade,
           vida_maxima           AS "maxHp",
           intervalo_ataque_seg  AS "attackIntervalSec",
           dano_ataque_base      AS "baseDamage",
           escudos_requeridos    AS "shieldsRequired",
           sprite_key            AS "spriteKey"
         FROM jefes_incursion
         ORDER BY id_jefe`
      )
      return res.rows
    } catch {
      return [
        {
          id: 'boss-dragon-01',
          name: 'Jefe Dragón',
          topic: 'Operaciones con Fracciones',
          grade: '5to de Primaria',
          maxHp: 10000,
          attackIntervalSec: 45,
          baseDamage: 600,
          shieldsRequired: 5,
          spriteKey: 'dragon_fracciones',
        },
      ]
    }
  }
}

export const databaseRepository = new DatabaseRepository()
