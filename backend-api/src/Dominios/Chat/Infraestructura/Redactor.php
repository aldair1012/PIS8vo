<?php
// src/Dominios/Chat/Infraestructura/Redactor.php — Redactor natural del chatbot (sin LLM).
// Ensambla secciones del explicador en texto natural con plantillas variadas + datos en vivo + cierre con acción.
declare(strict_types=1);

namespace ZeaSys\Dominios\Chat\Infraestructura;

use ZeaSys\Dominios\Chat\Dominio\RedactorInterface;

final class Redactor implements RedactorInterface
{
    public function redactar(array $secciones, array $contexto, array $memoria): string
    {
        $nombre = $contexto['nombre'] ?? 'indicador';
        $valor = $contexto['valor'] ?? '';
        $valorConUnidad = $contexto['valor_con_unidad'] ?? $valor;
        $nombreParcela = $contexto['nombre_parcela'] ?? 'tu parcela';
        $variedad = $contexto['variedad_maiz'] ?? '';
        $ubicacion = $contexto['ubicacion'] ?? '';
        $rendPredicho = $contexto['rend_predicho'] ?? 0;
        $principalNombre = $contexto['principal_nombre'] ?? '';
        $principalPerdida = $contexto['principal_perdida'] ?? 0;
        $principalDetalle = $contexto['principal_detalle'] ?? '';
        $recomendacion = $contexto['recomendacion_base'] ?? '';

        // Hash de sesión para variación
        $seed = crc32(implode('|', array_column($memoria['temas'] ?? [], 'tema') ?: [session_id()]));
        $variante = $seed % 3;

        $partes = [];

        // Apertura personalizada
        $aperturas = [
            "Sobre **$nombre** en tu parcela *$nombreParcela*:",
            "Analizando **$nombre** para *$nombreParcela*:",
            "En tu parcela *$nombreParcela*, el indicador **$nombre** ($valorConUnidad) dice lo siguiente:",
        ];
        $partes[] = $aperturas[$variante % count($aperturas)];

        // Redactar cada sección como párrafo natural
        foreach ($secciones as $seccion) {
            $titulo = $seccion['titulo'] ?? '';
            $contenido = $seccion['contenido'] ?? '';
            if (trim($contenido) === '') continue;

            // Limpiar markdown ** para texto natural (conservar énfasis)
            $contenido = trim($contenido);

            // Eliminar prefijo numérico del título si existe (ej. "1. ¿Qué significa...?")
            $tituloClean = preg_replace('/^\d+\.\s*/', '', $titulo);

            $partes[] = "**$tituloClean** — $contenido";
        }

        // Datos en vivo inyectados
        $datosEnVivo = [];
        if (!empty($rendPredicho) && $rendPredicho > 0) {
            $datosEnVivo[] = "Tu rendimiento estimado actual es **$rendPredicho t/ha**";
        }
        if (!empty($principalNombre) && $principalPerdida > 0) {
            $datosEnVivo[] = "el factor que más te resta es **$principalNombre** (pérdida ~$principalPerdida t/ha)";
        }
        if (!empty($datosEnVivo)) {
            $partes[] = "📊 *En tu situación:* " . implode(', ', $datosEnVivo) . ".";
        }

        // Cierre con acción
        if (!empty($recomendacion)) {
            $cierres = [
                "💡 *Próximo paso:* $recomendacion",
                "👉 *Acción recomendada:* $recomendacion",
                "📌 *Para mejorar:* $recomendacion",
            ];
            $partes[] = $cierres[$variante % count($cierres)];
        } elseif (!empty($principalDetalle)) {
            $partes[] = "💡 *Próximo paso:* atiende primero $principalNombre ($principalDetalle), que es tu principal limitante.";
        }

        return implode("\n\n", $partes);
    }
}