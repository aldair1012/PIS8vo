<?php
// Pruebas unitarias mínimas del kernel HTTP, sin dependencias externas.
declare(strict_types=1);

require_once __DIR__ . '/../../src/Kernel/AutoloaderPsr4.php';
ZeaSys\Kernel\AutoloaderPsr4::registrar(__DIR__ . '/../../src');

use ZeaSys\Kernel\AutenticacionMiddleware;
use ZeaSys\Kernel\Container;
use ZeaSys\Kernel\Peticion;
use ZeaSys\Kernel\Router;

final class ControladorPrueba
{
    public int $llamadas = 0;

    public function ejecutar(Peticion $peticion): void
    {
        $this->llamadas++;
        echo '{"ok":true}';
    }
}

function comprobar(bool $condicion, string $mensaje): void
{
    if (!$condicion) {
        throw new RuntimeException($mensaje);
    }
}

$pruebas = [];
$pruebas['rechaza método no permitido antes de construir el controlador'] = static function (): void {
    $contenedor = new Container();
    $construcciones = 0;
    $contenedor->registrar('controlador', static function () use (&$construcciones): ControladorPrueba {
        $construcciones++;
        return new ControladorPrueba();
    });
    $router = new Router($contenedor, [
        'api/prueba' => [
            'controlador' => 'controlador',
            'accion' => 'ejecutar',
            'metodos' => ['POST'],
            'publica' => true,
        ],
    ], new AutenticacionMiddleware());

    http_response_code(200);
    ob_start();
    $router->despachar(new Peticion('get'), 'api/prueba');
    $salida = ob_get_clean();

    comprobar(http_response_code() === 405, 'Se esperaba HTTP 405.');
    comprobar($construcciones === 0, 'El controlador no debe construirse para un método inválido.');
    comprobar(json_decode((string) $salida, true) === ['error' => 'Método no permitido.'], 'Respuesta 405 inválida.');
};

$pruebas['despacha método permitido'] = static function (): void {
    $contenedor = new Container();
    $controlador = new ControladorPrueba();
    $contenedor->registrar('controlador', static fn (): ControladorPrueba => $controlador);
    $router = new Router($contenedor, [
        'api/prueba' => [
            'controlador' => 'controlador',
            'accion' => 'ejecutar',
            'metodos' => ['POST'],
            'publica' => true,
        ],
    ], new AutenticacionMiddleware());

    http_response_code(200);
    ob_start();
    $router->despachar(new Peticion('post'), 'api/prueba');
    $salida = ob_get_clean();

    comprobar(http_response_code() === 200, 'Se esperaba HTTP 200.');
    comprobar($controlador->llamadas === 1, 'La acción debía ejecutarse una vez.');
    comprobar($salida === '{"ok":true}', 'Respuesta del controlador inesperada.');
};

$pruebas['HEAD usa la acción GET'] = static function (): void {
    $contenedor = new Container();
    $controlador = new ControladorPrueba();
    $contenedor->registrar('controlador', static fn (): ControladorPrueba => $controlador);
    $router = new Router($contenedor, [
        'api/prueba' => [
            'controlador' => 'controlador',
            'accion' => 'ejecutar',
            'metodos' => ['GET'],
            'publica' => true,
        ],
    ], new AutenticacionMiddleware());

    http_response_code(200);
    ob_start();
    $router->despachar(new Peticion('HEAD'), 'api/prueba');
    ob_end_clean();

    comprobar(http_response_code() === 200, 'HEAD debe aceptarse cuando GET está permitido.');
    comprobar($controlador->llamadas === 1, 'HEAD debe despachar la misma acción que GET.');
};

$pruebas['valida enteros de query sin coerción silenciosa'] = static function (): void {
    $_GET = ['cultivo_id' => 'abc'];
    $peticion = Peticion::desdeGlobal('api/prueba');
    try {
        $peticion->queryEntero('cultivo_id', null, 1);
        throw new RuntimeException('Se aceptó un ID no numérico.');
    } catch (ZeaSys\Kernel\Errores\ValidacionException) {
        // Resultado esperado.
    } finally {
        $_GET = [];
    }
};

$fallos = 0;
foreach ($pruebas as $nombre => $prueba) {
    try {
        $prueba();
        echo "[OK] {$nombre}\n";
    } catch (Throwable $e) {
        $fallos++;
        echo "[FAIL] {$nombre}: {$e->getMessage()}\n";
    }
}

echo sprintf("\n%d passed, %d failed\n", count($pruebas) - $fallos, $fallos);
exit($fallos === 0 ? 0 : 1);
