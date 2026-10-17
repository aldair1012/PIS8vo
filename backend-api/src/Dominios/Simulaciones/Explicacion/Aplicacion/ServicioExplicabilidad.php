<?php
// src/Dominios/Simulaciones/Explicacion/Aplicacion/ServicioExplicabilidad.php — Orquestador: contexto → primer match → ensamblado verbatim de la respuesta (legacy 913–929).
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Aplicacion;

use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\EvaluadorCondiciones;

final class ServicioExplicabilidad
{
    public function __construct(
        private EvaluadorCondiciones $evaluador,
        private RegistroExplicadores $registro,
        private ResolutorContextoExplicacion $resolutor,
    ) {
    }

    /**
     * Puerto de SimulacionController::explain(): catálogo Strategy en lugar de la
     * cadena if/elseif. Primer match gana, igual que el original; el ensamblado
     * final (líneas 913–929) es verbatim.
     *
     * @param array<string, mixed> $contextoBruto Cuerpo de la petición de la tarjeta.
     * @return array<string, mixed>
     */
    public function explicar(array $contextoBruto): array
    {
        $contexto    = $this->resolutor->construir($contextoBruto);
        $nombreLower = $contexto['nombre_lower'];
        $secciones   = [];

        foreach ($this->registro->reglas() as $regla) {
            if (($regla['grafico'] ?? false) && !isset($contexto['datos_grafico'])) {
                continue; // paridad: el bloque gráfico original solo corre con datos_grafico
            }
            if (isset($regla['extra']) && !($regla['extra'])($contexto)) {
                continue; // p. ej. ExplicadorCurvaTemporal exige $dg['labels']
            }
            if (isset($regla['condicion']) && !$this->evaluador->cumple($regla['condicion'], $nombreLower)) {
                continue; // ExplicadorDefault no tiene condición: fallback final
            }
            $clase     = $regla['explicador'];
            $secciones = (new $clase())->construir($contexto);
            break; // primer match gana, igual que if/elseif
        }

        // Construir respuesta (verbatim líneas 913–929)
        $nombre    = $contexto['nombre'];
        $nivelText = $contexto['nivel_text'];
        $data      = $contextoBruto;

        $mappedResponse = [
            'titulo' => $nombre,
            'nivel' => $nivelText,
            'nivel_del_resultado' => $nivelText,
            'secciones' => $secciones,
            'que_significa' => $secciones[0]['contenido'] ?? '',
            'por_que_pudo_pasar' => $secciones[1]['contenido'] ?? '',
            'como_mejorarlo' => $secciones[2]['contenido'] ?? ($secciones[count($secciones)-1]['contenido'] ?? ''),
            'alerta_clave' => $data['alerta_clave'] ?? $data['alerta'] ?? 'Revisar recomendaciones.',
            'source' => 'Intérprete Agrícola ZeaSys',
            'offline' => true
        ];

        return $mappedResponse;
    }
}
