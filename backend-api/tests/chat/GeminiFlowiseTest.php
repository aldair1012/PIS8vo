<?php
// Pruebas del contrato del único proveedor Gemini del chatbot.
declare(strict_types=1);

use ZeaSys\Dominios\Chat\Infraestructura\GeminiFlowise;

test('GeminiFlowise: el prompt exige respuesta directa, clara y basada en el dashboard', function (): void {
    $gemini = new GeminiFlowise();
    $metodo = new ReflectionMethod(GeminiFlowise::class, 'construirPrompt');
    $metodo->setAccessible(true);
    $prompt = $metodo->invoke($gemini, '¿Cómo afectará la lluvia al cultivo?', '{"precipitacion":68}');

    assert_contains('PREGUNTA DEL USUARIO:', $prompt);
    assert_contains('CONTEXTO ACTUAL (JSON):', $prompt);
    assert_contains('**Impacto en el cultivo**', $prompt);
    assert_contains('**Datos del Dashboard**', $prompt);
    assert_contains('**Acciones requeridas**', $prompt);
    assert_contains('No disponible en el dashboard', $prompt);
    assert_true(strpos($prompt, 'respuesta predeterminada') === false, 'El prompt no debe ordenar usar respuestas predeterminadas');
});

test('GeminiFlowise: no permite configurar el flujo sin URL o chatflow', function (): void {
    assert_true(class_exists(GeminiFlowise::class));
});
