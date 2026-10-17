# Capa de Persistencia y Base de Datos (`/Base_Datos`)

Diseño de ingeniería de datos para la plataforma **Jefe de Incursión Educativo (Raid Boss Cooperativo)**.

## 1. Arquitectura de Persistencia en Dos Capas (RAM + Relacional)

Para soportar a **30 alumnos respondiendo de forma concurrente en el mismo segundo** sin generar cuellos de botella por bloqueos de escritura en disco, el sistema implementa un patrón **Write-Behind / Estado en Memoria + Volcado Persistente**:

1. **Capa Caliente en Memoria RAM (Servidor Node.js):** Mantiene el diccionario de estado en vivo de la partida (`bossHp`, `classHp`, `shieldCharges`, rachas y temporizadores) para responder vía WebSockets (`Socket.io`) en `< 20 ms`.
2. **Capa Relacional Persistente (`PostgreSQL` / Almacén Transaccional):** Registra el catálogo de preguntas, las sesiones de aula, la telemetría histórica de cada respuesta y las alertas pedagógicas para el Dashboard del Profesor.

## 2. Diagrama Entidad-Relación (DER)

```mermaid
erDiagram
    DOCENTES ||--o{ SESIONES_AULA : "dirige (Game Master)"
    JEFES_INCURSION ||--o{ SESIONES_AULA : "aparece en"
    JEFES_INCURSION ||--o{ PREGUNTAS : "contiene retos"
    PREGUNTAS ||--o{ OPCIONES_PREGUNTA : "tiene 4 opciones"
    SESIONES_AULA ||--o{ PARTICIPANTES_SESION : "conecta alumnos"
    PARTICIPANTES_SESION ||--o{ RESPUESTAS_TELEMETRIA : "envía clic"
    PREGUNTAS ||--o{ RESPUESTAS_TELEMETRIA : "evalúa"
    PARTICIPANTES_SESION ||--o{ ALERTAS_PEDAGOGICAS : "dispara alerta IA/Reglas"

    DOCENTES {
        varchar id_docente PK
        varchar nombre_completo
        varchar correo
    }
    JEFES_INCURSION {
        varchar id_jefe PK
        varchar nombre
        int vida_maxima
        int intervalo_ataque_seg
    }
    PREGUNTAS {
        varchar id_pregunta PK
        varchar id_jefe FK
        varchar nivel_dificultad
        text enunciado
        text pista_pedagogica
    }
    SESIONES_AULA {
        varchar id_sesion PK
        varchar pin_sala UK
        int vida_jefe_actual
        int vida_salon_actual
        boolean esta_pausada
    }
    PARTICIPANTES_SESION {
        varchar id_participante PK
        varchar id_sesion FK
        varchar nombre_alumno
        varchar rol_combate
        numeric tiempo_promedio_seg
        varchar estado_pedagogico
    }
    RESPUESTAS_TELEMETRIA {
        serial id_respuesta PK
        varchar id_participante FK
        varchar id_pregunta FK
        boolean fue_correcta
        numeric tiempo_respuesta_seg
        boolean fue_adivinacion_azar
    }
    ALERTAS_PEDAGOGICAS {
        varchar id_alerta PK
        varchar id_participante FK
        varchar tipo_alerta
        int cooldown_aplicado_seg
        boolean pista_enviada
    }
```

## 3. Archivos Incluidos

- [`schema.sql`](./schema.sql): Script DDL completo en PostgreSQL con las 8 tablas normalizadas, restricciones `CHECK`, índices de rendimiento y 2 vistas analíticas (`vw_preguntas_mayor_error` y `vw_resumen_telemetria_sesion`).
- [`seed.sql`](./seed.sql): Datos iniciales del **Dragón de las Fracciones**, banco de preguntas con pistas, sesión activa `PIN: 4829` y los 7 perfiles estudiantiles iniciales.
- [`docker-compose.yml`](./docker-compose.yml): Levanta PostgreSQL 16 e inyecta automáticamente `schema.sql` y `seed.sql`.
- [`raid_boss_seed.json`](./raid_boss_seed.json): Base de datos embebida sincronizada automáticamente con el Backend en `/Back` para permitir ejecución inmediata sin requerir Docker instalado durante una demostración rápida.
