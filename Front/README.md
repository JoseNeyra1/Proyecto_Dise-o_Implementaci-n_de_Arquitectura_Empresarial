# Jefe de Incursión Educativo — Frontend (`/Front`)

Aplicación web interactiva gamificada en tiempo real (**Raid Boss Cooperativo para el Salón de Clases**) diseñada para transformar la evaluación escolar en una experiencia cooperativa con telemetría docente en vivo.

## Arquitectura de Vistas (Rutas)

El sistema divide la experiencia en **3 interfaces conectadas simultáneamente**:

1. **`/play` — Controlador Táctil del Alumno (`StudentPage.tsx`)**
   - Selección de rol asimétrico (**Atacante / DPS**, **Defensor / Tanque**, **Sanador / Soporte**) e ingreso con código PIN de sala (`4829`).
   - Banco de retos de fracciones con barra de tiempo en vivo y soporte de teclado (`A`, `B`, `C`, `D`).
   - **Detección de Adivinadores (Cooldown Anti-Adivinación):** Bloqueo automático de 4 segundos con pista pedagógica progresiva cuando se detectan respuestas al azar en menos de `1.8 s`.
   - **Asistencia de Sanador / Profesor:** Eliminación visual de una opción incorrecta cuando un compañero Sanador o el Docente envía una pista.
   - **Pausa Congelada:** Superposición en vivo cuando el docente pausa las pantallas desde su panel.
   - **Barra de Habilidad Especial:** Se carga con aciertos (`3/3`) para desatar Golpe Crítico, Escudo Reflector o Curación Grupal + Pista.

2. **`/projector` — Escenario de Combate del Aula (`ProjectorPage.tsx`)**
   - Barra gigante de vida del Jefe Dragón con fases dinámicas y tarjeta de PIN de sala (`4829`).
   - Arena de batalla 2D con el Dragón animado, textos de combate flotantes en tiempo real (`-150 PV`, `+Escudo`, `+200 PV`) y orbes del escuadrón.
   - Panel lateral con registro de combos en vivo y temporizador de cuenta regresiva del próximo ataque del Jefe + estado del escudo grupal (`3/5`).
   - Barra colectiva de vida del salón y contador de alumnos conectados.

3. **`/teacher` — Dashboard Analítico y Control "Game Master" (`TeacherPage.tsx`)**
   - **Controles Game Master en vivo:** `Pausar pantallas` (congela `/play` al instante) y `Debilitar jefe ×2` (duplica el daño del salón).
   - **4 Tarjetas KPI** con anillos de progreso: Precisión del salón, Respuesta promedio, Alertas de adivinación y Vida del jefe.
   - **Alertas Pedagógicas con IA/Reglas:** Detección de adivinación en tiempo real y botón interactivo `Enviar pista` para desbloquear una ayuda en la pantalla del alumno.
   - **Gráfico de Preguntas con Más Fallos** y **Tabla de Telemetría Estudiantil en Vivo**.

## Estructura de Carpetas

```text
Front/
├── src/
│   ├── components/
│   │   ├── common/          # Icon, Logo, AppButton, ScreenSwitcher
│   │   └── projector/       # DragonBoss (SVG animado reactivo)
│   ├── data/
│   │   └── mockRaidData.ts  # Banco de preguntas, configuración de roles y estado inicial
│   ├── hooks/
│   │   └── useRaidSocket.ts # Custom hook de estado y eventos en tiempo real
│   ├── pages/
│   │   ├── StudentPage.tsx  # Ruta /play
│   │   ├── ProjectorPage.tsx# Ruta /projector
│   │   └── TeacherPage.tsx  # Ruta /teacher
│   ├── services/
│   │   └── raidSyncService.ts # Motor híbrido: Socket.io-client + BroadcastChannel multi-pestaña
│   └── types/
│       └── raid.types.ts    # Contratos e interfaces TypeScript
```

## Cómo Ejecutar

```bash
cd Front
npm install
npm run dev
```

> **Modo Híbrido (Multi-Pestaña + Socket.io):** Puedes abrir `/play`, `/projector` y `/teacher` en distintas pestañas del navegador (o alternar con la barra superior) y todas las acciones se sincronizarán en tiempo real incluso antes de encender el servidor backend. Para conectar al servidor `Socket.io`, define `VITE_SOCKET_URL=http://localhost:3001` en un archivo `.env`.
