<?php
// tests/chat/RouterChatTest.php — Pruebas del clasificador semántico RouterChat (TDD: RED → GREEN).

use ZeaSys\Dominios\Chat\Infraestructura\MemoriaSesion;
use ZeaSys\Dominios\Chat\Infraestructura\RouterChat;
use ZeaSys\Kernel\Errores\ValidacionException;

test('RouterChat: "¿Qué significa mi ROI?" → indicador con confianza > 0.5', function (): void {
    $router = new RouterChat(new MemoriaSesion());
    $resultado = $router->classificar('¿Qué significa mi ROI?', null);
    assert_equals('indicador', $resultado['intencion'], 'La intención debe ser indicador');
    assert_true($resultado['confianza'] > 0.5, 'La confianza debe ser > 0.5, obtenida: ' . $resultado['confianza']);
});

test('RouterChat: "¿Dónde está mi parcela?" → ubicacion', function (): void {
    $router = new RouterChat(new MemoriaSesion());
    $resultado = $router->classificar('¿Dónde está mi parcela?', null);
    assert_equals('ubicacion', $resultado['intencion']);
});

test('RouterChat: "¿Qué clima hace?" → clima', function (): void {
    $router = new RouterChat(new MemoriaSesion());
    $resultado = $router->classificar('¿Qué clima hace?', null);
    assert_equals('clima', $resultado['intencion']);
});

test('RouterChat: "¿Cuál es mi margen?" → financiero', function (): void {
    $router = new RouterChat(new MemoriaSesion());
    $resultado = $router->classificar('¿Cuál es mi margen?', null);
    assert_equals('financiero', $resultado['intencion']);
});

test('RouterChat: "¿Qué plaga tiene el maíz?" → plaga', function (): void {
    $router = new RouterChat(new MemoriaSesion());
    $resultado = $router->classificar('¿Qué plaga tiene el maíz?', null);
    assert_equals('plaga', $resultado['intencion']);
});

test('RouterChat: "hola" → general', function (): void {
    $router = new RouterChat(new MemoriaSesion());
    $resultado = $router->classificar('hola', null);
    assert_equals('general', $resultado['intencion']);
});

test('RouterChat: pregunta vacía → ValidacionException', function (): void {
    $router = new RouterChat(new MemoriaSesion());
    assert_throws(ValidacionException::class, static function () use ($router): void {
        $router->classificar('', null);
    });
});

test('RouterChat: follow-up "¿y eso?" con memoria de tema indicador → indicador', function (): void {
    $memoria = new MemoriaSesion();
    $memoria->limpiar();
    $memoria->registrarTema('indicador');
    $router  = new RouterChat($memoria);
    $resultado = $router->classificar('¿y eso?', null);
    assert_equals('indicador', $resultado['intencion']);
});
