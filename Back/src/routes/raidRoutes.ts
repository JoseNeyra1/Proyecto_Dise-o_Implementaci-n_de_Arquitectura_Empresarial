import { Router } from 'express'
import type { Server as SocketIOServer } from 'socket.io'
import { raidEngineService } from '../services/raidEngineService.js'
import type { PlayerRole, SubmitAnswerPayload } from '../types/raid.types.js'

export function createRaidRouter(io: SocketIOServer): Router {
  const router = Router()

  router.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'raid-boss-educativo-backend',
      roomPin: raidEngineService.getState().roomPin,
      timestamp: new Date().toISOString(),
    })
  })

  router.get('/raid/state', (_req, res) => {
    res.json(raidEngineService.getState())
  })

  router.get('/raid/questions', (_req, res) => {
    res.json(raidEngineService.getQuestions())
  })

  router.get('/raid/telemetry', (_req, res) => {
    res.json({
      students: raidEngineService.getState().students,
      alerts: raidEngineService.getState().alerts,
      missedQuestions: raidEngineService.getState().missedQuestions,
      historyCount: raidEngineService.getTelemetryHistory().length,
      recentEvents: raidEngineService.getTelemetryHistory().slice(-30),
    })
  })

  router.post('/raid/join', (req, res) => {
    const { studentName, role, pin } = req.body as {
      studentName: string
      role: PlayerRole
      pin: string
    }
    const result = raidEngineService.joinRaid(studentName || 'Alumno', role || 'attacker', pin || '')
    if (!result.ok) {
      res.status(400).json({ error: 'PIN de sala inválido', expectedPin: result.state.roomPin })
      return
    }
    io.emit('boss_state_update', result.state)
    res.json(result.state)
  })

  router.post('/raid/answer', (req, res) => {
    const payload = req.body as SubmitAnswerPayload
    const nextState = raidEngineService.submitAnswer(payload)
    io.emit('boss_state_update', nextState)
    res.json(nextState)
  })

  router.post('/raid/skill', (req, res) => {
    const { studentName, role } = req.body as { studentName: string; role: PlayerRole }
    const nextState = raidEngineService.useSkill(studentName || 'Alumno', role || 'attacker')
    io.emit('boss_state_update', nextState)
    res.json(nextState)
  })

  router.post('/raid/teacher-action', (req, res) => {
    const { action, value, studentId, senderName } = req.body as {
      action: 'toggle_pause' | 'toggle_weaken' | 'send_hint' | 'reset'
      value?: boolean
      studentId?: string
      senderName?: string
    }

    let nextState = raidEngineService.getState()
    if (action === 'toggle_pause') {
      nextState = raidEngineService.togglePause(value)
      io.emit('game_paused', nextState.isPaused)
    } else if (action === 'toggle_weaken') {
      nextState = raidEngineService.toggleWeaken(value)
    } else if (action === 'send_hint') {
      nextState = raidEngineService.sendHint(studentId, senderName)
    } else if (action === 'reset') {
      nextState = raidEngineService.resetSession()
    }

    io.emit('boss_state_update', nextState)
    res.json(nextState)
  })

  router.post('/raid/reset', (_req, res) => {
    const nextState = raidEngineService.resetSession()
    io.emit('boss_state_update', nextState)
    res.json(nextState)
  })

  return router
}
