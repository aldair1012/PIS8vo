<?php
// src/Dominios/Lotes/Dominio/ValidadorLimitesEcuador.php — Validación de coordenadas dentro del cuadrante continental ecuatoriano.
declare(strict_types=1);

namespace ZeaSys\Dominios\Lotes\Dominio;

final class ValidadorLimitesEcuador
{
    public const LAT_MIN = -5.2;
    public const LAT_MAX = 1.6;
    public const LNG_MIN = -81.6;
    public const LNG_MAX = -75.0;
    public const MENSAJE_FUERA_DE_RANGO = 'Las coordenadas del lote están fuera del cuadrante de Ecuador continental (Latitud: [-5.2, 1.6], Longitud: [-81.6, -75.0]). El sistema DSS está restringido únicamente a parcelas dentro del territorio ecuatoriano.';

    /** Crear: exige ambas coordenadas presentes y dentro de rango (port de líneas 72–73). */
    public function validoAlCrear(?float $latitud, ?float $longitud): bool
    {
        return $latitud !== null && $longitud !== null
            && $latitud >= self::LAT_MIN && $latitud <= self::LAT_MAX
            && $longitud >= self::LNG_MIN && $longitud <= self::LNG_MAX;
    }

    /** Actualizar: null = no validar ese campo (port de líneas 146–147, con su precedencia original). */
    public function validoAlActualizar(?float $latitud, ?float $longitud): bool
    {
        return !($latitud !== null && ($latitud < self::LAT_MIN || $latitud > self::LAT_MAX)
            || $longitud !== null && ($longitud < self::LNG_MIN || $longitud > self::LNG_MAX));
    }
}
