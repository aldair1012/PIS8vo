<?php
// src/Dominios/Simulaciones/Dominio/MotorPrediccionInterface.php — Puerto de predicción del motor ML (rompe el DIP del modelo legacy).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Dominio;

interface MotorPrediccionInterface
{
    /**
     * Contrato de claves posicionales (asumidas por el adapter, verbatim del modelo legacy):
     * ph/temperatura/precipitacion/radiacion/viento/humedad... — un caller que omita una clave
     * recibe advertencia PHP y 0.0 (misma semántica legacy; no validar aquí por paridad).
     * @param array<string, mixed> $datos @return array<string, mixed>   respuesta cruda del motor (con success/error)
     */
    public function predecir(array $datos): array;
}
