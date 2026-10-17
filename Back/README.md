# Servidor Backend en Tiempo Real (`/Back`)

Servidor **Node.js + Express + Socket.io + TypeScript** para el sistema educativo gamificado **Jefe de Incursión Educativo (Raid Boss Cooperativo)**.

## 1. Arquitectura de Ingeniería de Sistemas

```text
Back/
├── src/
│   ├── server.ts                      # Punto de entrada HTTP + Express + Socket.io (Puerto 3001)
│   ├── types/
│   │   └── raid.types.ts              # Contratos de datos tipados
│   ├── repositories/
│   │   └── databaseRepository.ts      # Persistencia híbrida (PostgreSQL + Base_Datos/raid_boss_seed.json)
│   ├── services/
│   │   └── raidEngineService.ts       # Motor de estado en memoria RAM, detección de adivinación y roles
│   ├── routes/
│   │   └── raidRoutes.ts              # Endpoints REST API (/api/health, /api/raid/*)
│   └── sockets/
│       └── raidSocketHandler.ts       # Orquestador WebSockets en tiempo real (< 20 ms)
```

## 2. Eventos WebSocket (`Socket.io`)

- **Eventos recibidos desde clientes (`/play`, `/teacher`):**
  - `join_raid`: Registra un alumno con su PIN (`4829`) y rol asimétrico (`attacker`, `defender`, `healer`).
  - `submit_answer`: Evalúa el reto, calcula el tiempo de respuesta, detecta adivinación al azar (`< 1.8 s` con fallo), aplica daño/escudo/curación y actualiza métricas.
  - `use_skill`: Ejecuta la habilidad especial cargada (`3/3`) del rol activo.
  - `teacher_action`: Ejecuta controles Game Master (`toggle_pause`, `toggle_weaken`, `send_hint`, `reset`).
  - `reset_raid`: Restaura la sesión a sus valores iniciales de demostración.
- **Eventos emitidos a las 3 pantallas (`/play`, `/projector`, `/teacher`):**
  - `boss_state_update`: Difunde el estado sincronizado de la incursión y telemetría.
  - `game_paused`: Congela o reanuda inmediatamente los dispositivos de los alumnos.

## 3. Endpoints REST API (`http://localhost:3001/api`)

- `GET /api/health` — Estado del servidor y PIN activo.
- `GET /api/raid/state` — Estado completo de la sesión en memoria RAM.
- `GET /api/raid/questions` — Catálogo de retos de fracciones y pistas pedagógicas.
- `GET /api/raid/telemetry` — Métricas detalladas, alertas y registro histórico de clics.
- `POST /api/raid/join` — Unirse a la sala vía HTTP.
- `POST /api/raid/answer` — Enviar respuesta vía HTTP.
- `POST /api/raid/teacher-action` — Ejecutar acción del profesor (`toggle_pause`, `toggle_weaken`, `send_hint`).
- `POST /api/raid/reset` — Reiniciar sesión.

## 4. Cómo Ejecutar

```powershell
cd Back
npm install
npm run dev
```
