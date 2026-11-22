<?php
declare(strict_types=1);

namespace ZeaSys\Dominios\Chat\Infraestructura;

use ZeaSys\Kernel\Errores\ServicioExternoException;

/** Decodifica eventos SSE sin asumir que un bloque cURL termina en una línea UTF-8 completa. */
final class FlujoGemini
{
    private string $pendiente = '';
    private array $lineas = [];
    private string $texto = '';
    private ?string $fin = null;
    private array $fuentes = [];
    private bool $busco = false;
    private ?string $sugerencias = null;

    public function recibir(string $bytes, ?callable $emitir): void
    {
        $this->pendiente .= $bytes;
        while (($pos = strpos($this->pendiente, "\n")) !== false) {
            $linea = rtrim(substr($this->pendiente, 0, $pos), "\r");
            $this->pendiente = substr($this->pendiente, $pos + 1);
            if (str_starts_with($linea, 'data:')) {
                $this->lineas[] = ltrim(substr($linea, 5), ' ');
            } elseif ($linea === '' && $this->lineas !== []) {
                $evento = json_decode(implode("\n", $this->lineas), true, 64, JSON_THROW_ON_ERROR);
                $this->lineas = [];
                if (isset($evento['error'])) throw new ServicioExternoException('El proveedor interrumpió la respuesta.');
                $candidato = $evento['candidates'][0] ?? [];
                foreach ($candidato['content']['parts'] ?? [] as $parte) {
                    if (!is_string($parte['text'] ?? null) || !empty($parte['thought'])) continue;
                    $this->texto .= $parte['text'];
                    if ($emitir !== null && $parte['text'] !== '') $emitir($parte['text']);
                }
                $this->fin = $candidato['finishReason'] ?? $this->fin;
                $meta = $candidato['groundingMetadata'] ?? [];
                $this->busco = $this->busco || !empty($meta['webSearchQueries']);
                foreach ($meta['groundingChunks'] ?? [] as $chunk) {
                    $web = $chunk['web'] ?? [];
                    if (is_string($web['uri'] ?? null)) $this->fuentes[$web['uri']] = ['url' => $web['uri'], 'titulo' => $web['title'] ?? null];
                }
                $this->sugerencias = $meta['searchEntryPoint']['renderedContent'] ?? $this->sugerencias;
            }
        }
    }

    public function resultado(): array
    {
        if ($this->fin !== 'STOP' || trim($this->texto) === '' || $this->pendiente !== '' || $this->lineas !== []) {
            throw new ServicioExternoException('Gemini interrumpió la respuesta antes de completarla.');
        }
        return ['texto' => trim($this->texto), 'metadatos' => ['proveedor' => 'Gemini', 'fuentes_web' => array_values($this->fuentes),
            'busqueda_realizada' => $this->busco, 'sugerencias_busqueda_html' => $this->sugerencias]];
    }
}
