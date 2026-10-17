<?php
// src/Dominios/Simulaciones/Explicacion/Dominio/ExplicadorInterface.php — Contrato de las estrategias explicadoras del catálogo (46).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Dominio;

interface ExplicadorInterface
{
    /** @param array<string, mixed> $contexto  @return list<array{titulo: string, tipo: string, contenido: string}> */
    public function construir(array $contexto): array;
}
