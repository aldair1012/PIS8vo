<?php
// src/Dominios/Chat/Dominio/RedactorInterface.php — Puerto de redacción en lenguaje natural.
declare(strict_types=1);

namespace ZeaSys\Dominios\Chat\Dominio;

interface RedactorInterface
{
    /**
     * Redacta una respuesta natural a partir de las secciones del explicador + contexto + memoria.
     * @param array<int, array<string, mixed>> $secciones
     * @param array<string, mixed> $contexto
     * @param array<string, mixed> $memoria
     */
    public function redactar(array $secciones, array $contexto, array $memoria): string;
}