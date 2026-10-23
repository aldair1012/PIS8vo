<?php
// src/Dominios/Chat/Aplicacion/FavoritoService.php — Guarda y recupera conversaciones favoritas del chat.
declare(strict_types=1);

namespace ZeaSys\Dominios\Chat\Aplicacion;

use ZeaSys\Dominios\Chat\Dominio\FavoritoRepositoryInterface;
use ZeaSys\Dominios\Lotes\Dominio\CultivoRepositoryInterface;
use ZeaSys\Kernel\Errores\AccesoDenegadoException;
use ZeaSys\Kernel\Errores\ValidacionException;

/**
 * Una conversación favorita es un registro propiedad del usuario: conserva los
 * mensajes visibles y una fotografía mínima del contexto (parcela, año, panel).
 * El asistente sólo la usa cuando la pregunta se refiere a conversaciones
 * guardadas o a lo hablado antes.
 */
final class FavoritoService
{
    private const MAX_MENSAJES = 30;
    private const MAX_TEXTO_MENSAJE = 4000;
    private const MAX_TITULO = 160;

    public function __construct(
        private FavoritoRepositoryInterface $favoritos,
        private CultivoRepositoryInterface $cultivos,
    ) {
    }

    /**
     * @param array<string, mixed> $datos
     * @return array{favorito_id:int,conversacion_id:string,titulo:string}
     */
    public function guardar(int $usuarioId, array $datos): array
    {
        if ($usuarioId <= 0) {
            throw new AccesoDenegadoException('Inicia sesión para guardar la conversación.');
        }

        $conversacionId = is_string($datos['conversacion_id'] ?? null)
            ? trim($datos['conversacion_id'])
            : '';
        if (preg_match('/^[A-Za-z0-9_-]{8,128}$/', $conversacionId) !== 1) {
            throw new ValidacionException('El identificador de la conversación no es válido.');
        }

        $vista = is_string($datos['vista'] ?? null) && trim($datos['vista']) !== ''
            ? mb_substr(trim($datos['vista']), 0, 50, 'UTF-8')
            : null;
        // El ámbito reproduce el alcance de la memoria: los dashboards comparten
        // una conversación y Nueva Simulación mantiene la suya.
        $ambito = $vista === 'simular' ? 'simulacion' : 'dashboard';
        $anio = $this->enteroOpcional($datos['anio'] ?? null, 'anio', 2000, 2100);
        $cultivoId = $this->enteroOpcional($datos['cultivo_id'] ?? null, 'cultivo_id', 1, PHP_INT_MAX);

        $cultivo = null;
        if ($cultivoId !== null) {
            foreach ($this->cultivos->obtenerPorUsuario($usuarioId) as $registro) {
                if ((int) ($registro['id'] ?? 0) === $cultivoId) {
                    $cultivo = is_array($registro) ? $registro : null;
                    break;
                }
            }
            if ($cultivo === null) {
                throw new AccesoDenegadoException('La parcela indicada no pertenece a tu cuenta.');
            }
        }

        $mensajes = $this->normalizarMensajes($datos['mensajes'] ?? null);
        if ($mensajes === []) {
            throw new ValidacionException('La conversación no contiene mensajes para guardar.');
        }

        $titulo = 'Conversación guardada';
        foreach ($mensajes as $mensaje) {
            if ($mensaje['rol'] === 'usuario') {
                $titulo = mb_substr($mensaje['texto'], 0, self::MAX_TITULO, 'UTF-8');
                break;
            }
        }

        $favoritoId = $this->favoritos->guardar($usuarioId, $conversacionId, [
            'cultivo_id' => $cultivoId,
            'anio' => $anio,
            'ambito' => $ambito,
            'vista' => $vista,
            'titulo' => $titulo,
            'mensajes' => $mensajes,
            'contexto' => [
                'parcela' => is_array($cultivo) ? ($cultivo['nombre_parcela'] ?? null) : null,
                'anio' => $anio,
                'ambito' => $ambito,
                'vista' => $vista,
                'guardado_en' => date('c'),
            ],
        ]);

        return [
            'favorito_id' => $favoritoId,
            'conversacion_id' => $conversacionId,
            'titulo' => $titulo,
        ];
    }

    public function eliminar(int $usuarioId, string $conversacionId): void
    {
        if ($usuarioId <= 0) {
            throw new AccesoDenegadoException('Inicia sesión para modificar tus favoritos.');
        }

        $conversacionId = trim($conversacionId);
        if (preg_match('/^[A-Za-z0-9_-]{8,128}$/', $conversacionId) !== 1) {
            throw new ValidacionException('El identificador de la conversación no es válido.');
        }

        $this->favoritos->eliminar($usuarioId, $conversacionId);
    }

    /**
     * Versión compacta para el contexto del asistente: título y última
     * respuesta, sin enviar la conversación completa al proveedor.
     *
     * @return array<int, array{titulo:string,respuesta_clave:string,guardado_en:?string}>
     */
    public function recientesParaContexto(int $usuarioId, ?int $cultivoId, ?int $anio, int $limite = 4): array
    {
        $filas = $this->favoritos->obtenerRecientes($usuarioId, $cultivoId, $anio, $limite);
        $salida = [];
        foreach ($filas as $fila) {
            if (!is_array($fila)) {
                continue;
            }
            $salida[] = [
                'titulo' => mb_substr((string) ($fila['titulo'] ?? 'Conversación guardada'), 0, self::MAX_TITULO, 'UTF-8'),
                'respuesta_clave' => $this->ultimaRespuesta($fila['mensajes_json'] ?? null),
                'guardado_en' => isset($fila['actualizado_en']) && is_string($fila['actualizado_en'])
                    ? $fila['actualizado_en']
                    : null,
            ];
        }

        return $salida;
    }

    /**
     * @param mixed $entrada
     * @return array<int, array{rol:string,texto:string}>
     */
    private function normalizarMensajes(mixed $entrada): array
    {
        if (!is_array($entrada)) {
            return [];
        }

        $salida = [];
        foreach (array_slice($entrada, -self::MAX_MENSAJES) as $mensaje) {
            if (!is_array($mensaje)) {
                continue;
            }
            $rol = $mensaje['rol'] ?? '';
            $texto = $mensaje['texto'] ?? '';
            if (!in_array($rol, ['usuario', 'asistente'], true) || !is_string($texto)) {
                continue;
            }
            $texto = trim($texto);
            if ($texto === '') {
                continue;
            }
            $salida[] = [
                'rol' => $rol,
                'texto' => mb_substr($texto, 0, self::MAX_TEXTO_MENSAJE, 'UTF-8'),
            ];
        }

        return $salida;
    }

    private function ultimaRespuesta(mixed $mensajesJson): string
    {
        if (!is_string($mensajesJson) || $mensajesJson === '') {
            return '';
        }
        $mensajes = json_decode($mensajesJson, true);
        if (!is_array($mensajes)) {
            return '';
        }

        $respuesta = '';
        foreach ($mensajes as $mensaje) {
            if (!is_array($mensaje) || ($mensaje['rol'] ?? '') !== 'asistente') {
                continue;
            }
            if (is_string($mensaje['texto'] ?? null) && trim($mensaje['texto']) !== '') {
                $respuesta = trim($mensaje['texto']);
            }
        }

        return mb_substr($respuesta, 0, 320, 'UTF-8');
    }

    private function enteroOpcional(mixed $valor, string $campo, int $minimo, int $maximo): ?int
    {
        if ($valor === null || $valor === '') {
            return null;
        }
        if (!is_scalar($valor)) {
            throw new ValidacionException("El campo {$campo} no es válido.");
        }
        $entero = filter_var($valor, FILTER_VALIDATE_INT);
        if ($entero === false || $entero < $minimo || $entero > $maximo) {
            throw new ValidacionException("El campo {$campo} no es válido.");
        }

        return $entero;
    }
}
