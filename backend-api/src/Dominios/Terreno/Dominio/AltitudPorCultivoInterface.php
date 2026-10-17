<?php
// src/Dominios/Terreno/Dominio/AltitudPorCultivoInterface.php — Contrato de recuperación de altitud desde la BD.
declare(strict_types=1);

namespace ZeaSys\Dominios\Terreno\Dominio;

interface AltitudPorCultivoInterface
{
    /**
     * Port de ClimateController::consultarDatosApiPrecision() líneas 47–60 ("si no se pasó la altitud,
     * intentar recuperarla del cultivo en la BD usando coordenadas aproximadas"): la fila sale de
     * `WHERE ROUND(latitud, 3) = ROUND(:lat, 3) AND ROUND(longitud, 3) = ROUND(:lng, 3) LIMIT 1`,
     * es decir por COORDENADA APROXIMADA y no por id (puede devolver la altitud de otra parcela).
     *
     * @return float|null  floatval(altitud) de la primera fila coincidente (el legacy castea con
     *                     floatval(), por eso float y no string); null si no hay fila, la altitud
     *                     está vacía (legacy: `!empty`) o la consulta falla (legacy: catch ignorado).
     */
    public function altitudPorCoordenadas(float $latitud, float $longitud): ?float;
}
