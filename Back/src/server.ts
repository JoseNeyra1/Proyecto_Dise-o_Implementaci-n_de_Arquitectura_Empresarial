import http from 'node:http'
import cors from 'cors'
import express from 'express'
import { Server as SocketIOServer } from 'socket.io'
import { createRaidRouter } from './routes/raidRoutes.js'
import { raidEngineService } from './services/raidEngineService.js'
import { registerRaidSockets } from './sockets/raidSocketHandler.js'

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
registerRaidSockets(io)

// Global Boss Attack Countdown Loop (1 tick per second)
setInterval(() => {
  const prevCountdown = raidEngineService.getState().bossAttackCountdown
  const nextState = raidEngineService.tickBossTimer()
  // Broadcast when boss attacks or every 5 seconds to keep projectors in sync
  if (nextState.bossAttackCountdown === 45 || nextState.bossAttackCountdown !== prevCountdown) {
    io.emit('boss_state_update', nextState)
  }
}, 1000)

httpServer.listen(PORT, () => {
  console.log(`=============================================================`)
  console.log(`🐉 Servidor Jefe de Incursión Educativo (Backend + Socket.io)`)
  console.log(`🌐 REST API:    http://localhost:${PORT}/api/health`)
  console.log(`⚡ WebSockets:  ws://localhost:${PORT}`)
  console.log(`🔑 PIN de Sala: ${raidEngineService.getState().roomPin}`)
  console.log(`=============================================================`)
})
