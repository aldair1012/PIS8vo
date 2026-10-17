<?php
// src/Dominios/Analitica/Infraestructura/RepositorioCatalogoAgronomico.php — Implementación que lee el JSON compartido.
declare(strict_types=1);

namespace ZeaSys\Dominios\Analitica\Infraestructura;

use ZeaSys\Dominios\Analitica\Dominio\CatalogoAgronomicoInterface;

class RepositorioCatalogoAgronomico implements CatalogoAgronomicoInterface
{
    private static ?array $cache = null;

    public function cargar(): array
    {
        if (self::$cache !== null) {
            return self::$cache;
        }

        $ruta = __DIR__ . '/../../../../data/agronomia_data.json';
        if (!file_exists($ruta)) {
            return [];
        }

        $contenido = file_get_contents($ruta);
        if ($contenido === false) {
            return [];
        }

        self::$cache = json_decode($contenido, true) ?? [];
        return self::$cache;
    }
}