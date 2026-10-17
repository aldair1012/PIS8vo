<?php
declare(strict_types=1);

namespace ZeaSys\Kernel;

final class Peticion
{
    private ?array $cuerpo = null;

    public function __construct(private string $metodo)
    {
    }

    public static function desdeGlobal(): self
    {
        return new self($_SERVER['REQUEST_METHOD'] ?? 'GET');
    }

    public function metodo(): string
    {
        return $this->metodo;
    }

    public function cuerpo(): array
    {
        if ($this->cuerpo === null) {
            $raw = file_get_contents('php://input');
            $json = json_decode($raw !== false ? $raw : '', true);
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
        return $_GET[$clave] ?? $defecto;
    }
}
