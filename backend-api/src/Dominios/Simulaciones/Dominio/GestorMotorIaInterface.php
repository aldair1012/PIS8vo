<?php
// src/Dominios/Simulaciones/Dominio/GestorMotorIaInterface.php — Puerto de salud/arranque del servidor Flask de simulación.
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Dominio;

interface GestorMotorIaInterface
{
    public function estaActivo(): bool;

    /** @return array<string, mixed>|null */
    public function detallesSalud(): ?array;

    public function iniciar(): bool;

    /** @return array{running: bool, message: string, ...} */
    public function asegurarActivo(int $maxWaitSeconds = 15): array;

    /** @return array<string, mixed> */
    public function estado(bool $tryStart = false): array;
}
