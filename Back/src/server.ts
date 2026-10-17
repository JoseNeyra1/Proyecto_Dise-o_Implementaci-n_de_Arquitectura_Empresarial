import http from 'node:http'
import cors from 'cors'
import express from 'express'
import { Server as SocketIOServer } from 'socket.io'
import { databaseRepository } from './repositories/databaseRepository.js'
import { createRaidRouter } from './routes/raidRoutes.js'
import { raidEngineService } from './services/raidEngineService.js'
import { registerRaidSockets } from './sockets/raidSocketHandler.js'
import { errorHandler } from './middleware/errorHandler.js'

try {
  // @ts-ignore Node 20.6+
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile()
  }
} catch {
  // No .env or already loaded
}

const PORT = Number(process.env.PORT || 3001)

const app = express()
app.use(cors({ origin: '*' }))
app.use(express.json())

const httpServer = http.createServer(app)
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})

// Register REST API & WebSockets
app.use('/api', createRaidRouter(io))
app.use(errorHandler)
registerRaidSockets(io)

// Global Boss Attack Countdown Loop (1 tick per second)
setInterval(() => {
  const prevHp = raidEngineService.getState().bossHp
  const prevClassHp = raidEngineService.getState().classHp
  const prevCountdown = raidEngineService.getState().bossAttackCountdown
  const nextState = raidEngineService.tickBossTimer()

  if ((prevHp > 0 && nextState.bossHp <= 0) || (prevClassHp > 0 && nextState.classHp <= 0)) {
    const result = raidEngineService.getLastGameResult()
    if (result) {
      io.emit('game_over', result)
    }
  }

  // Broadcast when boss attacks or every 5 seconds to keep projectors in sync
  if (nextState.bossAttackCountdown === 45 || nextState.bossAttackCountdown !== prevCountdown) {
    io.emit('boss_state_update', nextState)
  }
}, 1000)

httpServer.listen(PORT, async () => {
  await databaseRepository.loadQuestionsFromDB(process.env.BOSS_ID || 'boss-dragon-01')
  await databaseRepository.createOrUpdateSession(raidEngineService.getState())
  console.log(`=============================================================`)
  console.log(`🐉 Servidor Jefe de Incursión Educativo (Backend + Socket.io)`)
  console.log(`🌐 REST API:    http://localhost:${PORT}/api/health`)
  console.log(`⚡ WebSockets:  ws://localhost:${PORT}`)
  console.log(`🔑 PIN de Sala: ${raidEngineService.getState().roomPin}`)
  console.log(`=============================================================`)
})
