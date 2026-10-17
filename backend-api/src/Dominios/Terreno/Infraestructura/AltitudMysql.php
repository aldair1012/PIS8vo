<?php
/**
 * Puerto de altitud: AltitudMysql
 * ===============================
 * Port verbatim de ClimateController::consultarDatosApiPrecision() líneas 47–60: MISMA SQL,
 * mismo try/catch que ignora el error y misma devolución cuando no hay fila o la altitud está vacía.
 * PDO inyectada en el constructor (el binding pasa getConnection(), puente transitorio legacy
 * registrado como deuda ADR-07 — fuera en F06), igual que UsuarioRepositoryMysql/CultivoRepositoryMysql.
 */

declare(strict_types=1);

namespace ZeaSys\Dominios\Terreno\Infraestructura;

use ZeaSys\Dominios\Terreno\Dominio\AltitudPorCultivoInterface;

final class AltitudMysql implements AltitudPorCultivoInterface
{
    public function __construct(private \PDO $db)
    {
    }

    public function altitudPorCoordenadas(float $latitud, float $longitud): ?float
    {
        // Si no se pasó la altitud, intentar recuperarla del cultivo en la BD usando coordenadas aproximadas
        try {
            $sentencia = $this->db->prepare("SELECT altitud FROM cultivos WHERE ROUND(latitud, 3) = ROUND(:lat, 3) AND ROUND(longitud, 3) = ROUND(:lng, 3) LIMIT 1");
            $sentencia->execute(['lat' => $latitud, 'lng' => $longitud]);
            $cultivoBd = $sentencia->fetch(\PDO::FETCH_ASSOC);
            if ($cultivoBd && !empty($cultivoBd['altitud'])) {
                return floatval($cultivoBd['altitud']);
            }
        } catch (\Exception $e) {
            // Ignorar
        }

        return null;
    }
}
