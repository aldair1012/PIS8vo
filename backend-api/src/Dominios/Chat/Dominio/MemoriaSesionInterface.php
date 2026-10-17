<?php
// src/Dominios/Chat/Dominio/MemoriaSesionInterface.php — Puerto de memoria contextual por sesión.
declare(strict_types=1);

namespace ZeaSys\Dominios\Chat\Dominio;

interface MemoriaSesionInterface
{
    public function registrar(string $rol, string $texto): void;

    /** @return array<int, array{rol: string, texto: string}> */
    public function historial(): array;

    /** @return array<string, mixed> */
    public function contexto(): array;

    /** @return array<string> */
    public function temas(): array;

    public function limpiar(): void;
}