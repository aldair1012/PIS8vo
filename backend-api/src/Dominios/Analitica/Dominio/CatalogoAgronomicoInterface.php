<?php
// src/Dominios/Analitica/Dominio/CatalogoAgronomicoInterface.php — Interfaz para el catálogo agronómico compartido por 4 dashboards.
declare(strict_types=1);

namespace ZeaSys\Dominios\Analitica\Dominio;

/** Lee agronomía_data.json y devuelve su contenido. El cache está en memoria por request (static). */
interface CatalogoAgronomicoInterface
{
    public function cargar(): array;
}