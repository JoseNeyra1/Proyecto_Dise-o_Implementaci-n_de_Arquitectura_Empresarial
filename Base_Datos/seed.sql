-- ============================================================================
-- DATOS SEMILLA (SEED): JEFE DE INCURSIÓN EDUCATIVO — "CAVERNAS DE FRACCIONES"
-- ============================================================================

-- 1. Docente del Aula
INSERT INTO docentes (id_docente, nombre_completo, correo, institucion)
VALUES (
    'doc-01',
    'Prof. José Ingeniero',
    'docente@colegio-ingenieria.edu.pe',
    'Colegio Experimental de Ingeniería — 5to Primaria'
);

-- 2. Jefe de Incursión: Dragón de las Fracciones
INSERT INTO jefes_incursion (
    id_jefe, nombre, tema_curricular, grado_objetivo,
    vida_maxima, intervalo_ataque_seg, dano_ataque_base, escudos_requeridos, sprite_key
)
VALUES (
    'boss-dragon-01',
    'Jefe Dragón',
    'Operaciones con Fracciones (Homogéneas y Heterogéneas)',
    '5to de Primaria',
    10000, 45, 600, 5, 'dragon_fracciones'
);

-- 3. Banco de Preguntas Pedagógicas
INSERT INTO preguntas (
    id_pregunta, id_jefe, numero_orden, topico_especifico, nivel_dificultad,
    enunciado, respuesta_correcta, pista_pedagogica, opcion_eliminar_pista, tiempo_limite_seg
) VALUES
('q-4', 'boss-dragon-01', 4, 'Forja de fracciones', 'Nivel medio',
 '¿Cuánto es ¾ + ¼ en su forma más simple?', '1',
 'Como ambas fracciones tienen denominador 4, suma los numeradores (3 + 1 = 4) y divide 4/4.', '3/8', 25),
('q-5', 'boss-dragon-01', 5, 'Equivalencia arcana', 'Nivel básico',
 '¿Cuál fracción equivale exactamente a la mitad (0,5)?', '2/4',
 'Busca la fracción donde el número de arriba (numerador) sea la mitad del número de abajo (denominador).', '1/4', 25),
('q-6', 'boss-dragon-01', 6, 'Suma heterogénea', 'Nivel medio',
 '¿Cuánto es ⅔ + ⅙ simplificado?', '5/6',
 'Convierte 2/3 a sextos multiplicando arriba y abajo por 2 (4/6), y luego súmale 1/6.', '3/9', 30),
('q-7', 'boss-dragon-01', 7, 'Simplificación de runas', 'Nivel medio',
 'Al simplificar la fracción 12/16 al máximo, ¿qué obtenemos?', '3/4',
 'Divide tanto el 12 como el 16 entre su máximo común divisor, que es 4.', '4/5', 25),
('q-8', 'boss-dragon-01', 8, 'Resta heterogénea', 'Nivel avanzado',
 'Resuelve el hechizo: ¾ − ½', '1/4',
 'Recuerda que 1/2 equivale a 2/4. Ahora resta: 3/4 menos 2/4.', '2/2', 30),
('q-9', 'boss-dragon-01', 9, 'Comparación de escudos', 'Nivel básico',
 '¿Cuál de estas fracciones es MAYOR que ½?', '3/4',
 'Piensa en una pizza dividida en 4 partes: 3 pedazos de 4 superan la mitad de la pizza.', '2/6', 25),
('q-10', 'boss-dragon-01', 10, 'Golpe final de incursión', 'Nivel avanzado',
 'Convierte el número mixto 1 ½ en fracción impropia:', '3/2',
 'Un entero tiene 2 medios (2/2). Si le sumas 1/2 más, obtienes 3/2.', '2/3', 25);

-- 4. Opciones de cada Pregunta (Cuadrícula 2x2)
INSERT INTO opciones_pregunta (id_pregunta, figura_geometrica, valor_mostrado, es_correcta, tecla_atajo) VALUES
-- Pregunta 4
('q-4', 'triangle', '2/4', FALSE, 'A'),
('q-4', 'diamond',  '1',   TRUE,  'B'),
('q-4', 'circle',   '4/8', FALSE, 'C'),
('q-4', 'square',   '3/8', FALSE, 'D'),
-- Pregunta 5
('q-5', 'triangle', '1/4', FALSE, 'A'),
('q-5', 'diamond',  '2/4', TRUE,  'B'),
('q-5', 'circle',   '1/3', FALSE, 'C'),
('q-5', 'square',   '3/5', FALSE, 'D'),
-- Pregunta 6
('q-6', 'triangle', '3/9', FALSE, 'A'),
('q-6', 'diamond',  '5/6', TRUE,  'B'),
('q-6', 'circle',   '4/6', FALSE, 'C'),
('q-6', 'square',   '1/2', FALSE, 'D'),
-- Pregunta 7
('q-7', 'triangle', '6/8', FALSE, 'A'),
('q-7', 'diamond',  '3/4', TRUE,  'B'),
('q-7', 'circle',   '2/3', FALSE, 'C'),
('q-7', 'square',   '4/5', FALSE, 'D'),
-- Pregunta 8
('q-8', 'triangle', '1/4', TRUE,  'A'),
('q-8', 'diamond',  '2/2', FALSE, 'B'),
('q-8', 'circle',   '1/2', FALSE, 'C'),
('q-8', 'square',   '2/4', FALSE, 'D'),
-- Pregunta 9
('q-9', 'triangle', '1/3', FALSE, 'A'),
('q-9', 'diamond',  '2/5', FALSE, 'B'),
('q-9', 'circle',   '3/4', TRUE,  'C'),
('q-9', 'square',   '2/6', FALSE, 'D'),
-- Pregunta 10
('q-10', 'triangle', '2/3', FALSE, 'A'),
('q-10', 'diamond',  '3/2', TRUE,  'B'),
('q-10', 'circle',   '4/2', FALSE, 'C'),
('q-10', 'square',   '1/2', FALSE, 'D');

-- 5. Sesión Activa del Salón (PIN: 4829)
INSERT INTO sesiones_aula (
    id_sesion, pin_sala, id_docente, id_jefe, nombre_aula,
    vida_jefe_actual, vida_salon_actual, vida_salon_maxima,
    fase_jefe, escudos_activos, esta_pausada, jefe_debilitado_x2, estado_partida
) VALUES (
    'ses-4829', '4829', 'doc-01', 'boss-dragon-01',
    'Cavernas de fracciones • 5to de Primaria',
    6450, 8800, 10000, '1', 3, FALSE, FALSE, 'EN_CURSO'
);

-- 6. Participantes Conectados y su Telemetría en Vivo
INSERT INTO participantes_sesion (
    id_participante, id_sesion, nombre_alumno, iniciales, rol_combate, nombre_rol,
    aciertos_totales, intentos_totales, tiempo_promedio_seg, racha_actual,
    errores_rapidos_azar, errores_consecutivos, estado_pedagogico, clase_estado, pista_activa
) VALUES
('stu-ana',     'ses-4829', 'Ana P.',     'AP', 'healer',   'Sanadora',  2,  7, 19.2, 0, 0, 3, 'Requiere apoyo', 'warning',  FALSE),
('stu-carlos',  'ses-4829', 'Carlos M.',  'CM', 'attacker', 'Atacante',  1,  7,  1.2, 0, 4, 4, 'Adivinando',     'danger',   FALSE),
('stu-sofia',   'ses-4829', 'Sofía R.',   'SR', 'attacker', 'Atacante', 11, 11,  5.4, 5, 0, 0, 'Avanzada',       'advanced', FALSE),
('stu-mateo',   'ses-4829', 'Mateo L.',   'ML', 'attacker', 'Atacante',  8, 10,  6.8, 3, 0, 0, 'Ritmo normal',   'good',     FALSE),
('stu-lucia',   'ses-4829', 'Lucía V.',   'LV', 'defender', 'Defensora', 7,  8,  9.1, 2, 0, 0, 'Ritmo normal',   'good',     FALSE),
('stu-diego',   'ses-4829', 'Diego T.',   'DT', 'healer',   'Sanador',   6,  8,  7.5, 2, 0, 0, 'Ritmo normal',   'good',     FALSE),
('stu-valeria', 'ses-4829', 'Valeria G.', 'VG', 'defender', 'Defensora', 9, 10,  6.2, 4, 0, 0, 'Avanzada',       'advanced', FALSE);

-- 7. Alertas Pedagógicas Activas
INSERT INTO alertas_pedagogicas (
    id_alerta, id_sesion, id_participante, tipo_alerta, etiqueta, descripcion, cooldown_aplicado_seg, pista_enviada
) VALUES
('al-carlos', 'ses-4829', 'stu-carlos', 'critical', 'Adivinación detectada',
 '4 fallos seguidos, cada respuesta en menos de 1,5 segundos.', 4, FALSE),
('al-ana',    'ses-4829', 'stu-ana',    'support',  'Requiere apoyo',
 'Dificultad con denominadores distintos · Promedio de 19,2 segundos.', 0, FALSE);
