# Proyecto de Diseño e Implementación de Arquitectura Empresarial
## Jefe de Incursión Educativo ("Raid Boss" Cooperativo para el Salón de Clases)

Plataforma educativa gamificada en tiempo real diseñada desde la Ingeniería de Sistemas para reemplazar las evaluaciones pasivas por una experiencia multijugador cooperativa en el aula con telemetría analítica para el docente.

---

## Arquitectura del Sistema (3 Capas)

1. **[`/Front`](./Front) — Capa de Presentación Interactiva (React 19 + Vite + TypeScript + Tailwind CSS v4 + Web Audio API)**
   - `/play` ([`StudentPage.tsx`](./Front/src/pages/StudentPage.tsx)): Controlador táctil del alumno con roles asimétricos (**Atacante**, **Defensor**, **Sanador**), bloqueo anti-adivinación (Cooldown 4 s), pistas cooperativas y habilidades especiales.
   - `/projector` ([`ProjectorPage.tsx`](./Front/src/pages/ProjectorPage.tsx)): Escenario de combate proyectado en el aula con el Dragón de las Fracciones animado, textos de daño flotantes, rayos de hechizo y reloj de ataque del Jefe.
   - `/teacher` ([`TeacherPage.tsx`](./Front/src/pages/TeacherPage.tsx)): Dashboard analítico del docente con controles *Game Master* en vivo (`Pausar pantallas`, `Debilitar jefe ×2`, `Enviar pista`), KPIs y tabla de telemetría estudiantil.
   - Motor de banda sonora RPG y efectos de sonido generados en tiempo real ([`soundEngine.ts`](./Front/src/services/soundEngine.ts)).

2. **[`/Back`](./Back) — Capa de Lógica de Negocio y Tiempo Real (Node.js + Express + Socket.io + TypeScript)**
   - Servidor WebSocket de baja latencia (`< 20 ms`) con gestión de estado en memoria RAM ([`raidEngineService.ts`](./Back/src/services/raidEngineService.ts)).
   - Algoritmo detector de respuestas al azar (*Guessing Detection* `< 1.8 s` con fallo) y cálculo de daño/escudo/curación por rol.
   - API REST en `http://localhost:3001/api` ([`raidRoutes.ts`](./Back/src/routes/raidRoutes.ts)) y eventos `Socket.io` ([`raidSocketHandler.ts`](./Back/src/sockets/raidSocketHandler.ts)).

3. **[`/Base_Datos`](./Base_Datos) — Capa de Persistencia e Ingeniería de Datos (PostgreSQL + Almacén Local JSON)**
   - Esquema relacional normalizado de 8 tablas y 2 vistas analíticas ([`schema.sql`](./Base_Datos/schema.sql)).
   - Datos semilla del *Dragón de las Fracciones* y sesión `PIN: 4829` ([`seed.sql`](./Base_Datos/seed.sql) y [`raid_boss_seed.json`](./Base_Datos/raid_boss_seed.json)).
   - Contenedor listo para despliegue con [`docker-compose.yml`](./Base_Datos/docker-compose.yml).

---

## Ejecución Rápida para Demostración

### 1. Iniciar el Servidor Backend (Puerto `3001`)
```powershell
cd Back
npm install
npm run dev
```

### 2. Iniciar la Aplicación Frontend (Puerto `5173`)
```powershell
cd Front
npm install
npm run dev
```

### 3. (Opcional) Levantar PostgreSQL con Docker
```powershell
cd Base_Datos
docker compose up -d
```
*(El Backend funciona de inmediato sin requerir Docker gracias a la persistencia híbrida integrada con `Base_Datos/raid_boss_seed.json`).*
