<?php
// src/Dominios/Analitica/Aplicacion/ServicioPrecioMaiz.php — Precio oficial de referencia del maíz.
declare(strict_types=1);

namespace ZeaSys\Dominios\Analitica\Aplicacion;

/**
 * Lee la franja oficial vigente publicada por el MAGP. No simula una
 * cotización de mercado: la fuente, la fecha y el tipo de precio son parte
 * del contrato para que el chatbot no presente el dato como tiempo real.
 */
final class ServicioPrecioMaiz
{
    public function __construct(private ?string $ruta = null)
    {
    }

    /**
     * @return array<string, mixed>
     */
    public function obtener(): array
    {
        $ruta = $this->ruta ?? __DIR__ . '/../../../../data/precio_maiz_referencia.json';
        if (!is_file($ruta)) {
            return [
                'disponible' => false,
                'fuente' => 'MAGP',
                'mensaje' => 'No hay un precio de referencia configurado.',
            ];
        }

        $contenido = file_get_contents($ruta);
        $datos = $contenido !== false ? json_decode($contenido, true) : null;
        if (!is_array($datos) || !isset($datos['piso'], $datos['techo'], $datos['promedio'])) {
            return [
                'disponible' => false,
                'fuente' => 'MAGP',
                'mensaje' => 'El archivo de precio de referencia no es válido.',
            ];
        }

        $promedio = (float) $datos['promedio'];
        $datos['disponible'] = true;
        $datos['piso'] = round((float) $datos['piso'], 2);
        $datos['techo'] = round((float) $datos['techo'], 2);
        $datos['promedio'] = round($promedio, 2);
        $datos['equivalente_usd_tonelada'] = round($promedio * 22.0462, 2);
        $datos['es_referencia_oficial'] = true;

        return $datos;
    }
}
