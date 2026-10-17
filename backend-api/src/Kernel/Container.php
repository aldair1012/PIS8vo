<?php
declare(strict_types=1);

namespace ZeaSys\Kernel;

final class Container
{
    /** @var array<string, mixed> */
    private array $instancias = [];

    /** @var array<string, callable> */
    private array $fabricas = [];

    public function registrar(string $id, callable $fabrica): void
    {
        $this->fabricas[$id] = $fabrica;
    }

    public function get(string $id): mixed
    {
        if (array_key_exists($id, $this->instancias)) {
            return $this->instancias[$id];
        }
        if (!isset($this->fabricas[$id])) {
            throw new \RuntimeException("No hay definición en el contenedor para: {$id}");
        }
        return $this->instancias[$id] = ($this->fabricas[$id])($this);
    }

    public function tiene(string $id): bool
    {
        return isset($this->fabricas[$id]) || array_key_exists($id, $this->instancias);
    }
}
