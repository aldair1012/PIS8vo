<?php
// Contexto validado → estrategia con evidencia → respuesta compatible con el modal.
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
     * Selecciona la definición específica y conserva las claves públicas del modal.
     * Cada estrategia usa requisitos y evidencia de su indicador; la ausencia de
     * una simulación no impide interpretar una medición explícita de clima o suelo.
     *
     * @param array<string, mixed> $contextoBruto Cuerpo de la petición de la tarjeta.
     * @return array<string, mixed>
     */
    public function explicar(array $contextoBruto): array
    {
        $contexto    = $this->resolutor->construir($contextoBruto);
        $nombreLower = strtr($contexto['nombre_lower'], ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ñ' => 'n']);
        $secciones   = [];

        foreach ($this->registro->reglas() as $regla) {
            if (isset($regla['condicion']) && !$this->evaluador->cumple($regla['condicion'], $nombreLower)) {
                continue; // ExplicadorDefault no tiene condición: fallback final
            }
            $clase     = $regla['explicador'];
            $secciones = (new $clase())->construir($contexto);
            break; // primer match gana, igual que if/elseif
        }

        // Conserva las claves consumidas por usarExplicacionIA y el modal.
        $nombre    = $contexto['nombre'];
        $sinDatos = str_starts_with($secciones[0]['contenido'] ?? '', 'No hay un dato disponible');
        $nivelText = $sinDatos ? 'regular' : $contexto['nivel_text'];
        $data      = $contexto['entrada'];

        $mappedResponse = [
            'titulo' => $nombre,
            'nivel' => $nivelText,
            'nivel_del_resultado' => $nivelText,
            'secciones' => $secciones,
            'que_significa' => $secciones[0]['contenido'] ?? '',
            'por_que_pudo_pasar' => $secciones[1]['contenido'] ?? '',
            'como_mejorarlo' => $secciones[2]['contenido'] ?? ($secciones[count($secciones)-1]['contenido'] ?? ''),
            'alerta_clave' => $sinDatos ? 'Dato no disponible.' : ($data['alerta_clave'] ?? $data['alerta'] ?? 'Revisar la fuente y el alcance del indicador.'),
            'source' => 'Intérprete Agrícola ZeaSys',
            'offline' => true
        ];

        return $mappedResponse;
    }
}
