<?php
// src/Kernel/Peticion.php — Envoltorio de la petición HTTP (método, ruta resuelta, snapshot de query y cuerpo perezoso).
declare(strict_types=1);

namespace ZeaSys\Kernel;

final class Peticion
{
    private ?array $cuerpo = null;
    private string $ruta = '';
    /** @var array<string, mixed> Snapshot de $_GET capturado en desdeGlobal(). */
    private array $consulta = [];

    public function __construct(private string $metodo)
    {
        $this->metodo = strtoupper($metodo);
    }

    public static function desdeGlobal(?string $ruta = null): self
    {
        $peticion          = new self($_SERVER['REQUEST_METHOD'] ?? 'GET');
        $peticion->ruta    = $ruta ?? Router::resolverRutaActual();
        $peticion->consulta = $_GET;
        return $peticion;
    }

    public function metodo(): string
    {
        return $this->metodo;
    }

    public function ruta(): string
    {
        return $this->ruta;
    }

    public function cuerpo(): array
    {
        if ($this->cuerpo === null) {
            $raw = file_get_contents('php://input');
            $json = json_decode($raw !== false ? $raw : '', true);
            $contentType = strtolower(trim(explode(';', (string) ($_SERVER['CONTENT_TYPE'] ?? ''))[0]));
            if ($contentType === 'application/json' && $raw !== false && trim($raw) !== '' && json_last_error() !== JSON_ERROR_NONE) {
                throw new \ZeaSys\Kernel\Errores\ValidacionException('El cuerpo JSON de la petición no es válido.');
            }
            // Los formularios tradicionales siguen disponibles para endpoints multipart/urlencoded.
            $this->cuerpo = is_array($json) ? $json : $_POST;
        }
        return $this->cuerpo;
    }

    public function campo(string $clave, mixed $defecto = null): mixed
    {
        return $this->cuerpo()[$clave] ?? $defecto;
    }

    public function query(string $clave, mixed $defecto = null): mixed
    {
        return $this->consulta[$clave] ?? $defecto;
    }

    public function queryEntero(string $clave, ?int $defecto = null, ?int $minimo = null, ?int $maximo = null): ?int
    {
        $valor = $this->query($clave);
        if ($valor === null || $valor === '') {
            return $defecto;
        }
        $entero = filter_var($valor, FILTER_VALIDATE_INT);
        if ($entero === false || ($minimo !== null && $entero < $minimo) || ($maximo !== null && $entero > $maximo)) {
            throw new \ZeaSys\Kernel\Errores\ValidacionException("El parámetro {$clave} no es válido.");
        }
        return $entero;
    }
}
