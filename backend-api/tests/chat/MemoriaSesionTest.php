<?php
// tests/chat/MemoriaSesionTest.php — Pruebas de la memoria de sesión del chat (TDD: RED → GREEN).

use ZeaSys\Dominios\Chat\Infraestructura\MemoriaSesion;

test('MemoriaSesion: registro añade al historial', function (): void {
    $memoria = new MemoriaSesion();
    $memoria->limpiar();
    $memoria->registrar('usuario', 'hola');
    $memoria->registrar('asistente', 'hola, ¿cómo estás?');
    $historial = $memoria->historial();
    assert_equals(2, count($historial), 'El historial debe tener 2 mensajes');
    assert_equals('usuario', $historial[0]['rol']);
    assert_equals('hola', $historial[0]['texto']);
});

test('MemoriaSesion: historial limitado a 20 mensajes', function (): void {
    $memoria = new MemoriaSesion();
    $memoria->limpiar();
    for ($i = 0; $i < 25; $i++) {
        $memoria->registrar('usuario', "mensaje $i");
    }
    $historial = $memoria->historial();
    assert_equals(20, count($historial), 'El historial debe estar limitado a 20');
    assert_equals('mensaje 24', $historial[19]['texto'], 'El último mensaje debe ser el más reciente');
});

test('MemoriaSesion: contexto se puede establecer y obtener', function (): void {
    $memoria = new MemoriaSesion();
    $memoria->limpiar();
    $memoria->establecerContexto(['cultivo_id' => 1, 'nombre_parcela' => 'Lote Norte']);
    $contexto = $memoria->contexto();
    assert_equals('Lote Norte', $contexto['nombre_parcela']);
});

test('MemoriaSesion: temas se pueden registrar y obtener', function (): void {
    $memoria = new MemoriaSesion();
    $memoria->limpiar();
    $memoria->registrarTema('indicador');
    $memoria->registrarTema('clima');
    $temas = $memoria->temas();
    assert_equals(2, count($temas), 'Debe haber 2 temas');
    assert_true(in_array('indicador', $temas, true));
    assert_true(in_array('clima', $temas, true));
});

test('MemoriaSesion: limpiar elimina todo', function (): void {
    $memoria = new MemoriaSesion();
    $memoria->registrar('usuario', 'hola');
    $memoria->registrarTema('indicador');
    $memoria->limpiar();
    assert_equals(0, count($memoria->historial()));
    assert_equals(0, count($memoria->temas()));
    assert_equals(0, count($memoria->contexto()));
});

test('MemoriaSesion: conserva el id de Flowise y lo renueva al limpiar', function (): void {
    $memoria = new MemoriaSesion();
    $memoria->limpiar();
    $primera = $memoria->identificadorConversacion();
    $segunda = $memoria->identificadorConversacion();
    assert_true($primera !== '', 'El id de conversación no debe estar vacío');
    assert_equals($primera, $segunda, 'La misma conversación debe conservar su id');

    $memoria->limpiar();
    $tercera = $memoria->identificadorConversacion();
    assert_true($tercera !== $primera, 'Limpiar debe aislar la siguiente conversación');
});
