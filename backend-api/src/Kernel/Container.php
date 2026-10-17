<?php
// src/Kernel/Container.php — Contenedor DI liviano: fábricas por id, instancias cacheadas y detección de ciclos.
declare(strict_types=1);

namespace ZeaSys\Kernel;

final class Container
{
    /** @var array<string, mixed> */
    private array $instancias = [];

    /** @var array<string, callable> */
    private array $fabricas = [];

    /** @var array<string, true> Ids en plena resolución (detector de dependencias circulares). */
    private array $resolviendo = [];

    public function registrar(string $id, callable $fabrica): void
    {
        $this->fabricas[$id] = $fabrica;
    }

    public function get(string $id): mixed
    {
        if (array_key_exists($id, $this->instancias)) {
            return $this->instancias[$id];
        }
        if (isset($this->resolviendo[$id])) {
            throw new \RuntimeException("Dependencia circular: {$id}");
        }
        if (!isset($this->fabricas[$id])) {
            throw new \RuntimeException("No hay definición en el contenedor para: {$id}");
        }

        $this->resolviendo[$id] = true;
        try {
            return $this->instancias[$id] = ($this->fabricas[$id])($this);
        } finally {
            unset($this->resolviendo[$id]);
        }
    }

    public function tiene(string $id): bool
    {
        return isset($this->fabricas[$id]) || array_key_exists($id, $this->instancias);
    }
}
