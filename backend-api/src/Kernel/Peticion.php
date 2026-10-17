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
            // Paridad: si el body no es un JSON-objeto, se cae a $_POST (form-urlencoded), igual que el controlador legacy.
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
}
