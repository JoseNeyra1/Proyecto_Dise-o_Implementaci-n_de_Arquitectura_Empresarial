import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import type { Question, RaidState, TelemetryEventRecord } from '../types/raid.types.js'

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
      console.log('[Base_Datos] Pool PostgreSQL inicializado desde DATABASE_URL')
    } catch (err) {
      console.warn('[Base_Datos] Usando persistencia local en Base_Datos/runtime_snapshot.json', err)
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

  public async recordTelemetryEvent(event: TelemetryEventRecord, state: RaidState) {
    if (!this.pgPool) return
    try {
      await this.pgPool.query(
        `INSERT INTO respuestas_telemetria
          (id_sesion, id_participante, id_pregunta, respuesta_seleccionada, fue_correcta, tiempo_respuesta_seg, fue_adivinacion_azar, dano_o_aporte)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          `ses-${state.roomPin}`,
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
      // Non-blocking if PostgreSQL container is offline
    }
  }
}

export const databaseRepository = new DatabaseRepository()
