<?php
// src/Dominios/Simulaciones/Dominio/MotorPrediccionInterface.php — Puerto de predicción del motor ML (rompe el DIP del modelo legacy).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Dominio;

interface MotorPrediccionInterface
{
    /** @param array<string, mixed> $datos @return array<string, mixed>   respuesta cruda del motor (con success/error) */
    public function predecir(array $datos): array;
}
