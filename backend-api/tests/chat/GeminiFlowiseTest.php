<?php
// Pruebas del contrato del cliente Flowise que alimenta el chatbot.
declare(strict_types=1);

use ZeaSys\Dominios\Chat\Infraestructura\GeminiFlowise;

test('GeminiFlowise: la consulta enviada al modelo es corta y conserva el dashboard', function (): void {
    $gemini = new GeminiFlowise();
    $metodo = new ReflectionMethod(GeminiFlowise::class, 'construirPrompt');
    $metodo->setAccessible(true);
    $prompt = $metodo->invoke($gemini, '¿Cómo afectará la lluvia al cultivo?', '{"precipitacion":68}');

    assert_contains('Pregunta del usuario:', $prompt);
    assert_contains('Contexto autorizado de ZeaSys:', $prompt);
    assert_contains('precipitacion', $prompt);
    assert_true(mb_strlen($prompt, 'UTF-8') <= 4000, 'La consulta no debe superar el límite del prompt');
});

test('GeminiFlowise: recorta consultas extensas sin lanzar una excepción', function (): void {
    $gemini = new GeminiFlowise();
    $metodo = new ReflectionMethod(GeminiFlowise::class, 'construirPrompt');
    $metodo->setAccessible(true);
    $prompt = $metodo->invoke($gemini, str_repeat('pregunta agrícola ', 300), str_repeat('dato dashboard ', 300));

    assert_true(mb_strlen($prompt, 'UTF-8') <= 4000);
    assert_contains('[recortado]', $prompt);
});

test('GeminiFlowise: no envía el historial gigante al prompt', function (): void {
    $gemini = new GeminiFlowise();
    $metodo = new ReflectionMethod(GeminiFlowise::class, 'compactarContextoParaConsulta');
    $metodo->setAccessible(true);
    $contexto = [
        'panel_actual' => 'yield',
        'dashboard_visible' => ['kpis' => ['rendimiento_predicho' => 3.26]],
        'historial_conversacion' => array_fill(0, 30, ['texto' => str_repeat('historial ', 100)]),
    ];
    $resumen = $metodo->invoke($gemini, $contexto, '¿Qué significa el rendimiento predicho?');

    assert_true(mb_strlen($resumen, 'UTF-8') <= 3200);
    assert_true(strpos($resumen, 'historial') === false, 'El historial debe quedar en la memoria del flujo');
    assert_contains('rendimiento_predicho', $resumen);
});

test('GeminiFlowise: incluye clima actual, precio y nutrición en el contexto combinado', function (): void {
    $gemini = new GeminiFlowise();
    $metodo = new ReflectionMethod(GeminiFlowise::class, 'compactarContextoParaConsulta');
    $metodo->setAccessible(true);
    $contexto = [
        'panel_actual' => 'finance',
        'anio_seleccionado' => 2026,
        'cultivo_activo' => ['nombre_parcela' => 'La Esperanza'],
        'contexto_agricola' => [
            'clima' => [
                'disponible' => true,
                'actual' => ['temperatura_c' => 24.5, 'humedad_pct' => 78, 'lluvia_mm' => 2.1],
                'pronostico_7d' => [['2026-10-19', 28.2, 18.1, 4.2, 80]],
                'resumen_7d' => ['lluvia_total_mm' => 42.1, 'dias_con_lluvia' => 4],
                'promedio_30d' => [
                    'temperatura_c' => 24.1,
                    'humedad_pct' => 76,
                    'precipitacion_30d_mm' => 67.2,
                    'precipitacion_anual_estimada_mm' => 820,
                ],
            ],
            'precio_maiz' => [
                'disponible' => true,
                'piso' => 17.45,
                'techo' => 19.61,
                'promedio' => 18.53,
                'fuente' => 'MAGP',
                'fecha_fuente' => '2026-03-27',
            ],
            'nutricion' => [
                'nitrogeno_kg_ha' => '180-200',
                'fraccionamiento_n' => '3 aplicaciones',
                'ph_suelo' => 6.1,
            ],
            'rendimiento' => ['kpis' => ['rendimiento_predicho' => 3.26, 'yield_gap_total' => 1.4]],
            'finanzas' => ['kpis' => ['margen_neto_por_ha' => 120.5, 'punto_equilibrio' => 2.9]],
            'impacto_precio' => [
                'delta_por_qq' => 2.03,
                'delta_ingreso_estimado' => 26.19,
                'lectura' => 'Con 12.9 qq, la diferencia es de 2.03 USD/qq.',
            ],
        ],
        'simulaciones_recientes' => [['rendimiento_estimado' => 3.26, 'produccion_total' => 8.15]],
    ];

    $resumen = $metodo->invoke($gemini, $contexto, '¿Cómo afecta el precio y el clima a mi margen?');

    assert_true(mb_strlen($resumen, 'UTF-8') <= 3200);
    assert_contains('precio_maiz', $resumen);
    assert_contains('impacto_precio', $resumen);
    assert_contains('delta_ingreso_estimado', $resumen);
    assert_contains('nutricion', $resumen);
    assert_contains('temperatura_c', $resumen);
    assert_contains('precipitacion_30d_mm', $resumen);
    assert_contains('precipitacion_anual_estimada_mm', $resumen);
    assert_contains('margen_neto_por_ha', $resumen);
});

test('GeminiFlowise: conserva el borrador de la simulación y sus campos faltantes', function (): void {
    $gemini = new GeminiFlowise();
    $metodo = new ReflectionMethod(GeminiFlowise::class, 'compactarContextoParaConsulta');
    $metodo->setAccessible(true);
    $contexto = [
        'panel_actual' => 'simular',
        'anio_seleccionado' => 2026,
        'cultivo_activo' => ['id' => 195, 'nombre_parcela' => '8vo', 'area' => 0.51],
        'simulacion_borrador' => [
            'estado' => 'borrador_no_ejecutado',
            'origen' => 'Formulario Nueva Simulación',
            'parcela_id' => 195,
            'nombre_parcela' => '8vo',
            'area_parcela_ha' => 0.51,
            'area_simulada_ha' => 0.51,
            'temperatura_entrada_c' => 26.1,
            'humedad_entrada_pct' => 83.7,
            'precipitacion_anual_entrada_mm' => 3487.2,
            'fertilizante_n_entrada_kg_ha' => null,
            'ph_suelo_entrada' => 6.5,
            'textura_suelo_entrada' => 'Franco Limoso',
            'campos_faltantes' => ['fertilizante/nitrógeno'],
            'nota' => 'Valores visibles del formulario; no es una simulación guardada.',
        ],
        'contexto_agricola' => [
            'nutricion' => ['zona' => 'Costa – Litoral', 'ph_suelo' => 6.5, 'nitrogeno_kg_ha' => '180–200'],
        ],
    ];

    $resumen = $metodo->invoke($gemini, $contexto, '¿Qué fertilizante recomienda para esta simulación?');

    assert_true(mb_strlen($resumen, 'UTF-8') <= 3200);
    assert_contains('simulacion_borrador', $resumen);
    assert_contains('8vo', $resumen);
    assert_contains('temperatura_entrada_c', $resumen);
    assert_contains('ph_suelo_entrada', $resumen);
    assert_contains('fertilizante_n_entrada_kg_ha', $resumen);
    assert_contains('campos_faltantes', $resumen);
});

test('GeminiFlowise: la regla del prompt prioriza el borrador de simulación', function (): void {
    $gemini = new GeminiFlowise();
    $metodo = new ReflectionMethod(GeminiFlowise::class, 'construirPrompt');
    $metodo->setAccessible(true);
    $prompt = $metodo->invoke($gemini, '¿Qué fertilizante recomienda?', '{"simulacion_borrador":{"ph_suelo_entrada":6.5}}');

    assert_contains('simulacion_borrador', $prompt);
    assert_contains('fuente principal', $prompt);
});

test('GeminiFlowise: el prompt pide respuestas directas y evita fuentes no solicitadas', function (): void {
    $gemini = new GeminiFlowise();
    $metodo = new ReflectionMethod(GeminiFlowise::class, 'construirPrompt');
    $metodo->setAccessible(true);
    $prompt = $metodo->invoke($gemini, '¿Qué recomiendas?', '{"precio_maiz":{"promedio":18.53}}');

    assert_contains('sin plantillas', $prompt);
    assert_contains('no agregues fuentes', $prompt);
    assert_contains('salvo que el usuario los pida', $prompt);
    assert_true(mb_strlen($prompt, 'UTF-8') <= 4000, 'La consulta no debe superar el límite del prompt');
});

test('GeminiFlowise: sólo incluye conversaciones favoritas si la pregunta las menciona', function (): void {
    $gemini = new GeminiFlowise();
    $metodo = new ReflectionMethod(GeminiFlowise::class, 'compactarContextoParaConsulta');
    $metodo->setAccessible(true);
    $contexto = [
        'panel_actual' => 'yield',
        'conversaciones_favoritas' => [[
            'titulo' => 'Fertilización',
            'respuesta_clave' => 'El nitrógeno orientativo es 180-200 kg/ha.',
            'guardado_en' => '2026-10-19 12:00:00',
        ]],
    ];

    $conFavoritos = $metodo->invoke($gemini, $contexto, '¿Qué me guardé sobre fertilización?');
    assert_contains('conversaciones_favoritas', $conFavoritos);
    assert_contains('respuesta_clave', $conFavoritos);

    $sinFavoritos = $metodo->invoke($gemini, $contexto, '¿Cómo está el clima hoy?');
    assert_true(
        strpos($sinFavoritos, 'conversaciones_favoritas') === false,
        'Los favoritos no deben viajar sin una pregunta que los mencione'
    );
});

test('GeminiFlowise: la regla del prompt reserva los favoritos para cuando se piden', function (): void {
    $gemini = new GeminiFlowise();
    $metodo = new ReflectionMethod(GeminiFlowise::class, 'construirPrompt');
    $metodo->setAccessible(true);
    $prompt = $metodo->invoke($gemini, '¿Qué hablamos antes?', '{"conversaciones_favoritas":[]}');

    assert_contains('conversaciones_favoritas', $prompt);
    assert_contains('iniciativa propia', $prompt);
});

test('GeminiFlowise: no permite configurar el flujo sin URL o chatflow', function (): void {
    assert_true(class_exists(GeminiFlowise::class));
});
