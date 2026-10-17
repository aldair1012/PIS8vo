<?php
// src/Dominios/Chat/Dominio/RouterChatInterface.php — Puerto de enrutamiento semántico del chatbot.
declare(strict_types=1);

namespace ZeaSys\Dominios\Chat\Dominio;

interface RouterChatInterface
{
    /**
     * Clasifica la intención de una pregunta del usuario.
     * @return array{intencion: string, confianza: float, parametros: array<string, mixed>}
     */
    public function classificar(string $pregunta, ?string $vista = null): array;
}