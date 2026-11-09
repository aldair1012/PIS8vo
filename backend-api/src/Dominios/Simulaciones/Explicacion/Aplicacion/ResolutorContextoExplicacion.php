<?php
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Aplicacion;

use ZeaSys\Dominios\Lotes\Dominio\CultivoRepositoryInterface;
use ZeaSys\Dominios\Simulaciones\Dominio\SimulacionRepositoryInterface;
use ZeaSys\Dominios\Simulaciones\Explicacion\Dominio\EntradaExplicacion;

/** Normaliza evidencia; la ausencia permanece null y nunca genera mediciones de respaldo. */
final class ResolutorContextoExplicacion
{
    public function __construct(
        private CultivoRepositoryInterface $cultivos,
        private SimulacionRepositoryInterface $simulaciones,
    ) {}

    public function construir(array $data): array
    {
        $data = EntradaExplicacion::validar($data);
        $cultivoId = $data['cultivo_id'];
        $año = $data['año'];
        $cultivo = $cultivoId !== null ? $this->cultivos->obtenerPorId($cultivoId) : null;
        $simulacion = $cultivoId !== null ? $this->simulaciones->obtenerUltimaPorCultivo($cultivoId, $año) : null;
        // La consulta debe respetar el año; tampoco usamos una fila incoherente devuelta por un adapter.
        if ($simulacion !== null && $año !== null && isset($simulacion['fecha']) && substr((string) $simulacion['fecha'], 0, 4) !== (string) $año) $simulacion = null;
        $escenarios = $simulacion['escenarios_json'] ?? null;
        if (is_string($escenarios)) $escenarios = json_decode($escenarios, true);
        $meta = is_array($escenarios) && is_array($escenarios['_zeasys_modelo'] ?? null) ? $escenarios['_zeasys_modelo'] : [];
        // Una lectura actual puede pertenecer a otra ejecución incluso dentro del mismo año.
        // No completar su incertidumbre, aportes o trazabilidad con metadatos de otra simulación.
        $metaCompatible = array_key_exists('valor', $data) || array_key_exists('rendimiento_estimado', $data) || array_key_exists('rend_predicho', $data) ? [] : $meta;
        $numero = static function (mixed $valor): ?float {
            return (is_int($valor) || is_float($valor) || (is_string($valor) && is_numeric($valor))) && is_finite((float) $valor) ? (float) $valor : null;
        };
        $campo = static function (string $clave) use ($data, $simulacion, $numero): ?float {
            // Un null explícito también significa ausencia: no reemplazarlo con una simulación anterior.
            return array_key_exists($clave, $data) ? $data[$clave] : $numero($simulacion[$clave] ?? null);
        };
        $nombre = $data['nombre'] ?? $data['titulo'] ?? 'Indicador';
        if ($nombre === '') $nombre = 'Indicador';
        $valor = $data['valor'] ?? null;
        $unidad = $data['unidad'] ?? '';
        $estado = $data['estado'] ?? $data['nivel'] ?? '';
        $nivel = in_array(mb_strtolower($estado), ['bajo', 'alto', 'riesgoso', 'riesgo', 'critico', 'malo', 'desfavorable', 'level-danger'], true) ? 'riesgoso' : 'regular';
        if (in_array(mb_strtolower($estado), ['optimo', 'ideal', 'bueno', 'excelente', 'favorable', 'adecuado', 'level-success'], true)) $nivel = 'favorable';
        $modelo = array_key_exists('explicacion_modelo', $data) ? $data['explicacion_modelo'] : ($metaCompatible['explicacion_modelo'] ?? null);
        $intervalo = array_key_exists('intervalo_rendimiento', $data) ? $data['intervalo_rendimiento'] : ($metaCompatible['intervalo_rendimiento'] ?? null);
        $trace = array_key_exists('trazabilidad', $data) ? $data['trazabilidad'] : ($metaCompatible['trazabilidad'] ?? null);
        return [
            'entrada' => $data, 'simulacion' => $simulacion, 'metadatos_modelo' => $metaCompatible,
            'nombre_parcela' => is_string($cultivo['nombre_parcela'] ?? null) ? $cultivo['nombre_parcela'] : null,
            'variedad_maiz' => is_string($cultivo['variedad_maiz'] ?? null) ? $cultivo['variedad_maiz'] : null,
            'ubicacion' => is_string($cultivo['ubicacion'] ?? null) ? $cultivo['ubicacion'] : null,
            'area_ha' => array_key_exists('area_ha', $data) ? $data['area_ha'] : ($campo('area_simulada') ?? $numero($cultivo['area'] ?? null)),
            'ph_suelo' => $campo('ph_suelo'), 'fertilizante' => $campo('fertilizante'),
            'temperatura' => $campo('temperatura'), 'precipitacion' => $campo('precipitacion'), 'humedad' => $campo('humedad'),
            'tipo_suelo' => array_key_exists('tipo_suelo', $data) ? $data['tipo_suelo'] : ($simulacion['tipo_suelo'] ?? null),
            'rend_predicho' => array_key_exists('rend_predicho', $data) ? $data['rend_predicho'] : $campo('rendimiento_estimado'),
            'potencial_max' => $data['potencial_max'] ?? $data['rendimiento_maximo_catalogo'] ?? null,
            'loss_n' => $data['loss_n'] ?? null, 'loss_water' => $data['loss_water'] ?? null,
            'loss_ph' => $data['loss_ph'] ?? null, 'loss_temp' => $data['loss_temp'] ?? null,
            'principal_nombre' => $data['principal_nombre'] ?? null,
            'principal_perdida' => $data['principal_perdida'] ?? null,
            'perdida_dolares_ha' => $data['perdida_dolares_ha'] ?? null,
            'nombre' => $nombre, 'valor' => $valor, 'unidad' => $unidad, 'estado' => $estado,
            'valor_con_unidad' => $valor === null ? '' : trim((string) $valor . ' ' . $unidad),
            'rango_ideal' => $data['rango_ideal'] ?? '', 'descripcion_tecnica' => $data['descripcion_tecnica'] ?? '',
            'impacto_base' => $data['impacto_base'] ?? '', 'recomendacion_base' => $data['recomendacion_base'] ?? '',
            'nivel_text' => $nivel, 'nombre_lower' => mb_strtolower($nombre, 'UTF-8'),
            'datos_grafico' => $data['datos_grafico'] ?? null,
            'es_grafico' => in_array(mb_strtolower($data['tipo_elemento'] ?? ''), ['grafico', 'gráfico'], true) || isset($data['datos_grafico']),
            'explicacion_modelo' => is_array($modelo) ? $modelo : null,
            'intervalo_rendimiento' => is_array($intervalo) ? $intervalo : null,
            'trazabilidad' => is_array($trace) ? $trace : null,
            'periodo_precipitacion' => $data['periodo_precipitacion'] ?? (is_string($trace['periodo_precipitacion'] ?? null) ? $trace['periodo_precipitacion'] : null),
        ];
    }
}
