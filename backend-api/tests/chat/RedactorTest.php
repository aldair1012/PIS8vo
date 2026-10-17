<?php
// tests/chat/RedactorTest.php — Pruebas del redactor de texto natural (TDD: RED → GREEN).

use ZeaSys\Dominios\Chat\Infraestructura\Redactor;

test('Redactor: texto natural contiene nombre del indicador, datos inyectados y acción de cierre', function (): void {
    $redactor = new Redactor();
    $secciones = [
        ['titulo' => '1. ¿Qué significa?', 'tipo' => 'info', 'contenido' => 'El rendimiento es **8.1 t/ha**.'],
        ['titulo' => '2. ¿Cómo mejorar?', 'tipo' => 'success', 'contenido' => 'Aumenta el fertilizante.'],
    ];
    $contexto = [
        'nombre' => 'Rendimiento',
        'rend_predicho' => 8.1,
        'nombre_parcela' => 'Lote Norte',
        'como_mejorarlo' => 'Aumenta el fertilizante a 180 kg/ha.',
    ];
    $texto = $redactor->redactar($secciones, $contexto, [], 12345);

    assert_contains('Rendimiento', $texto, 'El texto debe contener el nombre del indicador');
    assert_contains('8.1', $texto, 'El texto debe contener los datos inyectados');
    assert_contains('Aumenta el fertilizante', $texto, 'El texto debe contener la acción de cierre');
});

test('Redactor: variación por hash (mismo contexto → texto diferente con diferente hash)', function (): void {
    $redactor = new Redactor();
    $secciones = [
        ['titulo' => '1. ¿Qué significa?', 'tipo' => 'info', 'contenido' => 'El rendimiento es **8.1 t/ha**.'],
    ];
    $contexto = [
        'nombre' => 'Rendimiento',
        'rend_predicho' => 8.1,
        'como_mejorarlo' => 'Aumenta el fertilizante.',
    ];

    $texto1 = $redactor->redactar($secciones, $contexto, [], 11111);
    $texto2 = $redactor->redactar($secciones, $contexto, [], 22222);

    assert_true($texto1 !== $texto2, 'El texto debe variar con diferente hash');
});
