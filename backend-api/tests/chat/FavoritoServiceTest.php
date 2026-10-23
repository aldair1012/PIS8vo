<?php
// tests/chat/FavoritoServiceTest.php — Pruebas del guardado de conversaciones favoritas.

use ZeaSys\Dominios\Chat\Aplicacion\FavoritoService;
use ZeaSys\Dominios\Chat\Dominio\FavoritoRepositoryInterface;
use ZeaSys\Dominios\Lotes\Dominio\CultivoRepositoryInterface;
use ZeaSys\Kernel\Errores\AccesoDenegadoException;
use ZeaSys\Kernel\Errores\ValidacionException;

final class FavoritoRepositorioEspia implements FavoritoRepositoryInterface
{
    /** @var array<int, array<string, mixed>> */
    public array $guardados = [];
    /** @var array<int, array<string, mixed>> */
    public array $recientes = [];
    /** @var array<int, array<string, mixed>> */
    public array $eliminados = [];
    private int $siguienteId = 7;

    public function guardar(int $usuarioId, string $conversacionId, array $datos): int
    {
        $this->guardados[] = ['usuario_id' => $usuarioId, 'conversacion_id' => $conversacionId] + $datos;
        return $this->siguienteId++;
    }

    public function obtenerRecientes(int $usuarioId, ?int $cultivoId, ?int $anio, int $limite = 4): array
    {
        return $this->recientes;
    }

    public function eliminar(int $usuarioId, string $conversacionId): void
    {
        $this->eliminados[] = ['usuario_id' => $usuarioId, 'conversacion_id' => $conversacionId];
    }
}

final class CultivosFavoritosStub implements CultivoRepositoryInterface
{
    /** @param array<int, array<string, mixed>> $parcelas */
    public function __construct(private array $parcelas = [])
    {
    }

    public function crear(array $datos): int { return 0; }

    public function obtenerPorUsuario(int $usuarioId): array { return $this->parcelas; }

    public function obtenerPorId(int $id): ?array { return null; }

    public function obtenerConCoordenadas(int $usuarioId): array { return []; }

    public function actualizar(int $id, array $datos): bool { return true; }

    public function eliminar(int $id): bool { return true; }

    public function contarPorUsuario(int $usuarioId): int { return count($this->parcelas); }

    public function areaTotalPorUsuario(int $usuarioId): float { return 0.0; }
}

test('FavoritoService: guarda la conversación con el título del primer mensaje', function (): void {
    $repositorio = new FavoritoRepositorioEspia();
    $servicio = new FavoritoService($repositorio, new CultivosFavoritosStub([
        ['id' => 195, 'nombre_parcela' => '8vo'],
    ]));

    $resultado = $servicio->guardar(13, [
        'conversacion_id' => 'abc123def456abc123def456abc123de',
        'vista' => 'yield',
        'cultivo_id' => 195,
        'anio' => 2026,
        'mensajes' => [
            ['rol' => 'usuario', 'texto' => '¿Cómo está el clima?'],
            ['rol' => 'asistente', 'texto' => 'Hoy hay 24 °C y 2 mm de lluvia.'],
        ],
        'ignorado' => 'no debe persistirse',
    ]);

    assert_equals(7, $resultado['favorito_id']);
    assert_equals('abc123def456abc123def456abc123de', $resultado['conversacion_id']);
    assert_equals('¿Cómo está el clima?', $resultado['titulo']);
    assert_equals(1, count($repositorio->guardados));
    assert_equals('dashboard', $repositorio->guardados[0]['ambito']);
    assert_equals(195, $repositorio->guardados[0]['cultivo_id']);
    assert_equals(2, count($repositorio->guardados[0]['mensajes']));
    assert_equals('8vo', $repositorio->guardados[0]['contexto']['parcela']);
    assert_true(!array_key_exists('ignorado', $repositorio->guardados[0]), 'No deben persistirse campos ajenos al contrato');
});

test('FavoritoService: en Nueva Simulación el ámbito es simulacion', function (): void {
    $repositorio = new FavoritoRepositorioEspia();
    $servicio = new FavoritoService($repositorio, new CultivosFavoritosStub([
        ['id' => 195, 'nombre_parcela' => '8vo'],
    ]));

    $servicio->guardar(13, [
        'conversacion_id' => 'abc123def456abc123def456abc123de',
        'vista' => 'simular',
        'cultivo_id' => 195,
        'anio' => 2026,
        'mensajes' => [['rol' => 'usuario', 'texto' => '¿Qué fertilizante?']],
    ]);

    assert_equals('simulacion', $repositorio->guardados[0]['ambito']);
    assert_equals('simular', $repositorio->guardados[0]['vista']);
});

test('FavoritoService: rechaza una parcela que no pertenece al usuario', function (): void {
    $servicio = new FavoritoService(new FavoritoRepositorioEspia(), new CultivosFavoritosStub([
        ['id' => 195, 'nombre_parcela' => '8vo'],
    ]));

    assert_throws(AccesoDenegadoException::class, static function () use ($servicio): void {
        $servicio->guardar(13, [
            'conversacion_id' => 'abc123def456abc123def456abc123de',
            'cultivo_id' => 999,
            'mensajes' => [['rol' => 'usuario', 'texto' => 'hola']],
        ]);
    }, 'No debe aceptar parcelas ajenas');
});

test('FavoritoService: rechaza conversaciones sin mensajes válidos', function (): void {
    $servicio = new FavoritoService(new FavoritoRepositorioEspia(), new CultivosFavoritosStub());

    assert_throws(ValidacionException::class, static function () use ($servicio): void {
        $servicio->guardar(13, [
            'conversacion_id' => 'abc123def456abc123def456abc123de',
            'mensajes' => [
                ['rol' => 'sistema', 'texto' => 'no permitido'],
                ['rol' => 'usuario', 'texto' => '   '],
            ],
        ]);
    }, 'Sólo se guardan mensajes de usuario o asistente con texto');
});

test('FavoritoService: rechaza identificadores de conversación inválidos', function (): void {
    $servicio = new FavoritoService(new FavoritoRepositorioEspia(), new CultivosFavoritosStub());

    assert_throws(ValidacionException::class, static function () use ($servicio): void {
        $servicio->guardar(13, [
            'conversacion_id' => 'corto',
            'mensajes' => [['rol' => 'usuario', 'texto' => 'hola']],
        ]);
    });
});

test('FavoritoService: compacta las conversaciones guardadas para el contexto', function (): void {
    $repositorio = new FavoritoRepositorioEspia();
    $repositorio->recientes = [[
        'titulo' => 'Fertilización',
        'mensajes_json' => json_encode([
            ['rol' => 'usuario', 'texto' => '¿Qué fertilizante?'],
            ['rol' => 'asistente', 'texto' => 'El nitrógeno orientativo es 180-200 kg/ha.'],
        ], JSON_UNESCAPED_UNICODE),
        'actualizado_en' => '2026-10-19 12:00:00',
    ]];
    $servicio = new FavoritoService($repositorio, new CultivosFavoritosStub());

    $contexto = $servicio->recientesParaContexto(13, 195, 2026);

    assert_equals(1, count($contexto));
    assert_equals('Fertilización', $contexto[0]['titulo']);
    assert_contains('180-200', $contexto[0]['respuesta_clave']);
    assert_equals('2026-10-19 12:00:00', $contexto[0]['guardado_en']);
});

test('FavoritoService: eliminar delega con el usuario correcto', function (): void {
    $repositorio = new FavoritoRepositorioEspia();
    $servicio = new FavoritoService($repositorio, new CultivosFavoritosStub());

    $servicio->eliminar(13, 'abc123def456abc123def456abc123de');

    assert_equals(1, count($repositorio->eliminados));
    assert_equals(13, $repositorio->eliminados[0]['usuario_id']);
    assert_equals('abc123def456abc123def456abc123de', $repositorio->eliminados[0]['conversacion_id']);
});
