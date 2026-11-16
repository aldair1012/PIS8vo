<?php
// Pruebas del controlador del chat: la vista del asistente se valida contra el
// conjunto canónico de vistas donde el widget está disponible.
declare(strict_types=1);

use ZeaSys\Dominios\Chat\Http\ChatController;

test('ChatController: la vista indicada se valida contra el conjunto canónico', function (): void {
    $controlador = (new ReflectionClass(ChatController::class))->newInstanceWithoutConstructor();
    $metodo = new ReflectionMethod(ChatController::class, 'esVistaValida');
    $metodo->setAccessible(true);

    foreach (['yield', 'scenarios', 'climate', 'finance', 'map', 'simular', 'history'] as $vista) {
        assert_true($metodo->invoke($controlador, $vista), "La vista {$vista} debe aceptarse.");
    }
});

test('ChatController: rechaza vistas ajenas o con nombres internos', function (): void {
    $controlador = (new ReflectionClass(ChatController::class))->newInstanceWithoutConstructor();
    $metodo = new ReflectionMethod(ChatController::class, 'esVistaValida');
    $metodo->setAccessible(true);

    foreach (['dashboard-financial', 'cultivos', 'configuracion', 'admin', 'yield-superfuerte', ''] as $vista) {
        assert_true(!$metodo->invoke($controlador, $vista), "La vista {$vista} debe rechazarse.");
    }
});
