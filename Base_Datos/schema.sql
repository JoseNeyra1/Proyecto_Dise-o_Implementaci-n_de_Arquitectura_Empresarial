-- ============================================================================
-- PROYECTO: JEFE DE INCURSIÓN EDUCATIVO (RAID BOSS COOPERATIVO)
-- MOTOR: PostgreSQL 15+ (Compatible con SQL Estándar)
-- DESCRIPCIÓN: Esquema relacional para gestión de bancos de preguntas,
--              sesiones cooperativas en tiempo real, telemetría estudiantil
--              y detección temprana de patrones pedagógicos (adivinación/apoyo).
-- ============================================================================

-- Limpieza previa (opcional para entornos de desarrollo)
DROP VIEW IF EXISTS vw_resumen_telemetria_sesion;
DROP VIEW IF EXISTS vw_preguntas_mayor_error;
DROP TABLE IF EXISTS alertas_pedagogicas CASCADE;
DROP TABLE IF EXISTS respuestas_telemetria CASCADE;
DROP TABLE IF EXISTS participantes_sesion CASCADE;
DROP TABLE IF EXISTS sesiones_aula CASCADE;
DROP TABLE IF EXISTS opciones_pregunta CASCADE;
DROP TABLE IF EXISTS preguntas CASCADE;
DROP TABLE IF EXISTS jefes_incursion CASCADE;
DROP TABLE IF EXISTS docentes CASCADE;

-- 1. TABLA: DOCENTES (Game Masters)
CREATE TABLE docentes (
    id_docente VARCHAR(36) PRIMARY KEY,
    nombre_completo VARCHAR(120) NOT NULL,
    correo VARCHAR(150) UNIQUE NOT NULL,
    institucion VARCHAR(150) DEFAULT 'Institución Educativa Primaria',
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABLA: JEFES DE INCURSIÓN (Configuración de Monstruos por Tema)
CREATE TABLE jefes_incursion (
    id_jefe VARCHAR(36) PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    tema_curricular VARCHAR(120) NOT NULL,
    grado_objetivo VARCHAR(60) NOT NULL,
    vida_maxima INT NOT NULL CHECK (vida_maxima > 0),
    intervalo_ataque_seg INT NOT NULL DEFAULT 45,
    dano_ataque_base INT NOT NULL DEFAULT 600,
    escudos_requeridos INT NOT NULL DEFAULT 5,
    sprite_key VARCHAR(60) DEFAULT 'dragon_fracciones'
);

-- 3. TABLA: CATÁLOGO DE PREGUNTAS (Retos con Dificultad Adaptativa y Pistas)
CREATE TABLE preguntas (
    id_pregunta VARCHAR(36) PRIMARY KEY,
    id_jefe VARCHAR(36) NOT NULL REFERENCES jefes_incursion(id_jefe) ON DELETE CASCADE,
    numero_orden INT NOT NULL,
    topico_especifico VARCHAR(100) NOT NULL,
    nivel_dificultad VARCHAR(30) NOT NULL CHECK (nivel_dificultad IN ('Nivel básico', 'Nivel medio', 'Nivel avanzado')),
    enunciado TEXT NOT NULL,
    respuesta_correcta VARCHAR(100) NOT NULL,
    pista_pedagogica TEXT NOT NULL,
    opcion_eliminar_pista VARCHAR(100) NOT NULL,
    tiempo_limite_seg INT NOT NULL DEFAULT 25
);

-- 4. TABLA: OPCIONES DE PREGUNTA (Cuadrícula 2x2 con Figuras Geométricas)
CREATE TABLE opciones_pregunta (
    id_opcion SERIAL PRIMARY KEY,
    id_pregunta VARCHAR(36) NOT NULL REFERENCES preguntas(id_pregunta) ON DELETE CASCADE,
    figura_geometrica VARCHAR(20) NOT NULL CHECK (figura_geometrica IN ('triangle', 'diamond', 'circle', 'square')),
    valor_mostrado VARCHAR(100) NOT NULL,
    es_correcta BOOLEAN NOT NULL DEFAULT FALSE,
    tecla_atajo CHAR(1) NOT NULL CHECK (tecla_atajo IN ('A', 'B', 'C', 'D'))
);

-- 5. TABLA: SESIONES DE AULA (Partidas en Vivo y Volcado de Estado en Memoria)
CREATE TABLE sesiones_aula (
    id_sesion VARCHAR(36) PRIMARY KEY,
    pin_sala VARCHAR(10) UNIQUE NOT NULL,
    id_docente VARCHAR(36) NOT NULL REFERENCES docentes(id_docente),
    id_jefe VARCHAR(36) NOT NULL REFERENCES jefes_incursion(id_jefe),
    nombre_aula VARCHAR(120) NOT NULL,
    vida_jefe_actual INT NOT NULL,
    vida_salon_actual INT NOT NULL DEFAULT 10000,
    vida_salon_maxima INT NOT NULL DEFAULT 10000,
    fase_jefe VARCHAR(20) NOT NULL DEFAULT '1' CHECK (fase_jefe IN ('1', 'shield', '2')),
    escudos_activos INT NOT NULL DEFAULT 0,
    esta_pausada BOOLEAN NOT NULL DEFAULT FALSE,
    jefe_debilitado_x2 BOOLEAN NOT NULL DEFAULT FALSE,
    estado_partida VARCHAR(20) NOT NULL DEFAULT 'EN_CURSO' CHECK (estado_partida IN ('ESPERANDO', 'EN_CURSO', 'PAUSADA', 'VICTORIA', 'FINALIZADA')),
    fecha_inicio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_fin TIMESTAMP NULL
);

-- 6. TABLA: PARTICIPANTES DE LA SESIÓN (Alumnos y su Rol Asimétrico)
CREATE TABLE participantes_sesion (
    id_participante VARCHAR(36) PRIMARY KEY,
    id_sesion VARCHAR(36) NOT NULL REFERENCES sesiones_aula(id_sesion) ON DELETE CASCADE,
    nombre_alumno VARCHAR(100) NOT NULL,
    iniciales VARCHAR(4) NOT NULL,
    rol_combate VARCHAR(20) NOT NULL CHECK (rol_combate IN ('attacker', 'defender', 'healer')),
    nombre_rol VARCHAR(30) NOT NULL,
    aciertos_totales INT NOT NULL DEFAULT 0,
    intentos_totales INT NOT NULL DEFAULT 0,
    tiempo_promedio_seg NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    racha_actual INT NOT NULL DEFAULT 0,
    errores_rapidos_azar INT NOT NULL DEFAULT 0,
    errores_consecutivos INT NOT NULL DEFAULT 0,
    estado_pedagogico VARCHAR(30) NOT NULL DEFAULT 'Ritmo normal',
    clase_estado VARCHAR(20) NOT NULL DEFAULT 'good' CHECK (clase_estado IN ('good', 'warning', 'danger', 'advanced')),
    pista_activa BOOLEAN NOT NULL DEFAULT FALSE,
    remitente_pista VARCHAR(60) NULL,
    ultima_actividad TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. TABLA: TELEMETRÍA DE RESPUESTAS (Historial Granular Clic por Clic)
CREATE TABLE respuestas_telemetria (
    id_respuesta SERIAL PRIMARY KEY,
    id_sesion VARCHAR(36) NOT NULL REFERENCES sesiones_aula(id_sesion) ON DELETE CASCADE,
    id_participante VARCHAR(36) NOT NULL REFERENCES participantes_sesion(id_participante) ON DELETE CASCADE,
    id_pregunta VARCHAR(36) NOT NULL REFERENCES preguntas(id_pregunta) ON DELETE CASCADE,
    respuesta_seleccionada VARCHAR(100) NOT NULL,
    fue_correcta BOOLEAN NOT NULL,
    tiempo_respuesta_seg NUMERIC(5,2) NOT NULL,
    fue_adivinacion_azar BOOLEAN NOT NULL DEFAULT FALSE,
    dano_o_aporte INT NOT NULL DEFAULT 0,
    fecha_evento TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. TABLA: ALERTAS PEDAGÓGICAS (Generadas por Motor de Reglas / IA en Vivo)
CREATE TABLE alertas_pedagogicas (
    id_alerta VARCHAR(36) PRIMARY KEY,
    id_sesion VARCHAR(36) NOT NULL REFERENCES sesiones_aula(id_sesion) ON DELETE CASCADE,
    id_participante VARCHAR(36) NOT NULL REFERENCES participantes_sesion(id_participante) ON DELETE CASCADE,
    tipo_alerta VARCHAR(20) NOT NULL CHECK (tipo_alerta IN ('critical', 'support')),
    etiqueta VARCHAR(60) NOT NULL,
    descripcion TEXT NOT NULL,
    cooldown_aplicado_seg INT DEFAULT 0,
    pista_enviada BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- ÍNDICES DE RENDIMIENTO PARA CONSULTAS ANALÍTICAS DEL DASHBOARD DOCENTE
-- ============================================================================
CREATE INDEX idx_sesiones_pin ON sesiones_aula(pin_sala);
CREATE INDEX idx_participantes_sesion ON participantes_sesion(id_sesion, estado_pedagogico);
CREATE INDEX idx_telemetria_pregunta ON respuestas_telemetria(id_sesion, id_pregunta, fue_correcta);
CREATE INDEX idx_alertas_sesion ON alertas_pedagogicas(id_sesion, tipo_alerta);

-- ============================================================================
-- VISTAS ANALÍTICAS PARA EL REPORTE EN VIVO Y POST-PARTIDA DEL PROFESOR
-- ============================================================================

-- Vista 1: Top de preguntas con mayor tasa de error en el salón
CREATE VIEW vw_preguntas_mayor_error AS
SELECT
    p.id_pregunta,
    p.numero_orden,
    p.topico_especifico AS titulo,
    p.enunciado AS subtitulo,
    COUNT(rt.id_respuesta) AS total_intentos,
    SUM(CASE WHEN rt.fue_correcta = FALSE THEN 1 ELSE 0 END) AS total_fallos,
    ROUND(
        (SUM(CASE WHEN rt.fue_correcta = FALSE THEN 1 ELSE 0 END)::NUMERIC /
         NULLIF(COUNT(rt.id_respuesta), 0)) * 100,
        0
    ) AS porcentaje_error
FROM preguntas p
LEFT JOIN respuestas_telemetria rt ON p.id_pregunta = rt.id_pregunta
GROUP BY p.id_pregunta, p.numero_orden, p.topico_especifico, p.enunciado
ORDER BY porcentaje_error DESC NULLS LAST;

-- Vista 2: Resumen global de KPIs de la sesión activa
CREATE VIEW vw_resumen_telemetria_sesion AS
SELECT
    s.id_sesion,
    s.pin_sala,
    s.nombre_aula,
    s.vida_jefe_actual,
    j.vida_maxima AS vida_jefe_maxima,
    s.vida_salon_actual,
    COUNT(DISTINCT ps.id_participante) AS alumnos_conectados,
    ROUND(
        (SUM(ps.aciertos_totales)::NUMERIC / NULLIF(SUM(ps.intentos_totales), 0)) * 100,
        0
    ) AS precision_global_porcentaje,
    ROUND(AVG(NULLIF(ps.tiempo_promedio_seg, 0)), 1) AS tiempo_respuesta_promedio_seg,
    SUM(CASE WHEN ps.clase_estado = 'danger' THEN 1 ELSE 0 END) AS total_alertas_adivinacion
FROM sesiones_aula s
JOIN jefes_incursion j ON s.id_jefe = j.id_jefe
LEFT JOIN participantes_sesion ps ON s.id_sesion = ps.id_sesion
GROUP BY s.id_sesion, s.pin_sala, s.nombre_aula, s.vida_jefe_actual, j.vida_maxima, s.vida_salon_actual;
