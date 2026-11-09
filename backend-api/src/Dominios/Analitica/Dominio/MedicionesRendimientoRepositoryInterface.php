<?php
declare(strict_types=1);
namespace ZeaSys\Dominios\Analitica\Dominio;
interface MedicionesRendimientoRepositoryInterface
{
    public function obtener(int $usuarioId, int $cultivoId): array;
    public function guardar(int $usuarioId, int $cultivoId, array $datos): void;
}
