import type { Server as SocketIOServer, Socket } from 'socket.io'
import { raidEngineService } from '../services/raidEngineService.js'
import type { PlayerRole, SubmitAnswerPayload } from '../types/raid.types.js'

export function registerRaidSockets(io: SocketIOServer) {
  io.on('connection', (socket: Socket) => {
    // Send current state immediately on connect
    socket.emit('boss_state_update', raidEngineService.getState())

    socket.on(
      'join_raid',
      (data: { studentName: string; role: PlayerRole; pin: string }) => {
        const result = raidEngineService.joinRaid(
          data.studentName || 'Alumno',
          data.role || 'attacker',
          data.pin || ''
        )
        if (result.ok) {
          io.emit('boss_state_update', result.state)
        }
      }
    )

    socket.on('submit_answer', (payload: SubmitAnswerPayload) => {
      const nextState = raidEngineService.submitAnswer(payload)
      io.emit('boss_state_update', nextState)
    })

    socket.on('use_skill', (data: { studentName: string; role: PlayerRole }) => {
      const nextState = raidEngineService.useSkill(
        data.studentName || 'Alumno',
        data.role || 'attacker'
      )
      io.emit('boss_state_update', nextState)
    })

    socket.on(
      'teacher_action',
      (data: {
        action: 'toggle_pause' | 'toggle_weaken' | 'send_hint' | 'reset'
        value?: boolean
        studentId?: string
        senderName?: string
      }) => {
        let nextState = raidEngineService.getState()
        if (data.action === 'toggle_pause') {
          nextState = raidEngineService.togglePause(data.value)
          io.emit('game_paused', nextState.isPaused)
        } else if (data.action === 'toggle_weaken') {
          nextState = raidEngineService.toggleWeaken(data.value)
        } else if (data.action === 'send_hint') {
          nextState = raidEngineService.sendHint(data.studentId, data.senderName)
        } else if (data.action === 'reset') {
          nextState = raidEngineService.resetSession()
        }
        io.emit('boss_state_update', nextState)
      }
    )

    socket.on('reset_raid', () => {
      const nextState = raidEngineService.resetSession()
      io.emit('boss_state_update', nextState)
    })
  })
}
