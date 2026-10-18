<?php
// src/Dominios/Chat/Infraestructura/MemoriaSesion.php — Memoria contextual por sesión (historial + contexto + temas).
declare(strict_types=1);

namespace ZeaSys\Dominios\Chat\Infraestructura;

use ZeaSys\Dominios\Chat\Dominio\MemoriaSesionInterface;

final class MemoriaSesion implements MemoriaSesionInterface
{
    private const CLAVE = 'chat';
    private const MAX_HISTORIAL = 20;

    public function registrar(string $rol, string $texto): void
    {
        if (!isset($_SESSION[self::CLAVE])) {
            $_SESSION[self::CLAVE] = ['historial' => [], 'contexto' => [], 'temas' => []];
        }
        $_SESSION[self::CLAVE]['historial'][] = ['rol' => $rol, 'texto' => $texto];
        // Mantener solo los últimos 20 mensajes
        if (count($_SESSION[self::CLAVE]['historial']) > self::MAX_HISTORIAL) {
            $_SESSION[self::CLAVE]['historial'] = array_slice(
                $_SESSION[self::CLAVE]['historial'],
                -self::MAX_HISTORIAL
            );
        }
    }

    public function historial(): array
    {
        return $_SESSION[self::CLAVE]['historial'] ?? [];
    }

    public function contexto(): array
    {
        return $_SESSION[self::CLAVE]['contexto'] ?? [];
    }

    public function temas(): array
    {
        return $_SESSION[self::CLAVE]['temas'] ?? [];
    }

    public function identificadorConversacion(): string
    {
        if (!isset($_SESSION[self::CLAVE])) {
            $_SESSION[self::CLAVE] = ['historial' => [], 'contexto' => [], 'temas' => []];
        }
        if (!isset($_SESSION[self::CLAVE]['flowise_session_id'])) {
            $_SESSION[self::CLAVE]['flowise_session_id'] = bin2hex(random_bytes(16));
        }

        return (string) $_SESSION[self::CLAVE]['flowise_session_id'];
    }

    public function establecerContexto(array $contexto): void
    {
        $this->registrarContexto($contexto);
    }

    public function registrarContexto(array $contexto): void
    {
        if (!isset($_SESSION[self::CLAVE])) {
            $_SESSION[self::CLAVE] = ['historial' => [], 'contexto' => [], 'temas' => []];
        }
        $_SESSION[self::CLAVE]['contexto'] = array_merge($_SESSION[self::CLAVE]['contexto'], $contexto);
    }

    public function registrarTema(string $tema): void
    {
        if (!isset($_SESSION[self::CLAVE])) {
            $_SESSION[self::CLAVE] = ['historial' => [], 'contexto' => [], 'temas' => []];
        }
        if (!in_array($tema, $_SESSION[self::CLAVE]['temas'], true)) {
            $_SESSION[self::CLAVE]['temas'][] = $tema;
        }
    }

    public function limpiar(): void
    {
        unset($_SESSION[self::CLAVE]);
    }
}
