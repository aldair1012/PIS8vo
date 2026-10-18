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

    /**
     * Identificador estable del chat actual para la memoria de Flowise.
     * Se renueva al limpiar la conversación.
     */
    public function identificadorConversacion(): string;

    public function limpiar(): void;
}
