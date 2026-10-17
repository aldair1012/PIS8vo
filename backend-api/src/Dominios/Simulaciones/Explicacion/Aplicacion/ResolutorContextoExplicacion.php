<?php
// src/Dominios/Simulaciones/Explicacion/Aplicacion/ResolutorContextoExplicacion.php — Preprocesamiento de explain() (legacy 238–344) empaquetado como contexto.
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Aplicacion;

use ZeaSys\Dominios\Lotes\Dominio\CultivoRepositoryInterface;
use ZeaSys\Dominios\Simulaciones\Dominio\SimulacionRepositoryInterface;

final class ResolutorContextoExplicacion
{
    public function __construct(
        private CultivoRepositoryInterface $cultivos,
        private SimulacionRepositoryInterface $simulaciones,
    ) {
    }

    /**
     * Port del preprocesamiento de SimulacionController::explain() (líneas 238–344):
     * obtener cultivo y simulación por año, calcular datos derivados, normalizar
     * `datos_grafico`, etc. Los cálculos intermedios NO se alteran; solo se empaquetan.
     *
     * @param array<string, mixed> $data Cuerpo de la petición (contexto bruto de la tarjeta).
     * @return array<string, mixed> Contexto con TODAS las claves que los explicadores consumen.
     */
    public function construir(array $data): array
    {
        // Obtener cultivo_id y anio
        $cultivoId = isset($data['cultivo_id']) && $data['cultivo_id'] !== '' ? intval($data['cultivo_id']) : null;
        $anio = isset($data['anio']) && $data['anio'] !== '' ? intval($data['anio']) : null;

        $cultivoInfo = null;
        $simulacionInfo = null;

        if ($cultivoId) {
            $cultivoInfo = $this->cultivos->obtenerPorId($cultivoId);
            // SELECT * ... BY fecha DESC LIMIT 1 con fallback sin año: ver
            // SimulacionRepositoryMysql::obtenerUltimaPorCultivo() (SQL legacy líneas 249–265).
            $simulacionInfo = $this->simulaciones->obtenerUltimaPorCultivo($cultivoId, $anio);
        }

        $nombreParcela = !empty($cultivoInfo['nombre_parcela']) ? $cultivoInfo['nombre_parcela'] : 'tu parcela';
        $variedadMaiz = !empty($cultivoInfo['variedad_maiz']) ? $cultivoInfo['variedad_maiz'] : 'Híbrido Convencional';
        $ubicacionRaw = !empty($cultivoInfo['ubicacion']) ? $cultivoInfo['ubicacion'] : 'tu zona';

        // Limpiar ubicacion
        $ubicacionPartes = preg_split('/[\-\|]/', $ubicacionRaw);
        $ubicacion = trim($ubicacionPartes[0]);
        if (empty($ubicacion)) $ubicacion = 'tu zona';

        $areaHa = !empty($cultivoInfo['area']) ? floatval($cultivoInfo['area']) : 1.0;

        $phSuelo = floatval($simulacionInfo['ph_suelo'] ?? ($data['ph_suelo'] ?? 6.2));
        $fertilizanteVal = floatval($simulacionInfo['fertilizante'] ?? ($data['fertilizante'] ?? 150));
        $temperaturaVal = floatval($simulacionInfo['temperatura'] ?? ($data['temperatura'] ?? 24.5));
        $precipitacionVal = floatval($simulacionInfo['precipitacion'] ?? ($data['precipitacion'] ?? 800));
        $humedadVal = floatval($simulacionInfo['humedad'] ?? ($data['humedad'] ?? 70));
        $tipoSuelo = !empty($simulacionInfo['tipo_suelo']) ? $simulacionInfo['tipo_suelo'] : 'franco';
        $rendPredichoVal = round(floatval($simulacionInfo['rendimiento_estimado'] ?? ($data['rendimiento_estimado'] ?? 7.5)), 2);

        // Campos enviados por la tarjeta
        $nombre = trim($data['nombre'] ?? ($data['titulo'] ?? 'Indicador'));
        $valor = isset($data['valor']) ? trim((string)$data['valor']) : '';
        $unidad = isset($data['unidad']) ? trim((string)$data['unidad']) : '';
        $estado = trim($data['estado'] ?? ($data['nivel'] ?? 'normal'));
        $rangoIdeal = trim($data['rango_ideal'] ?? '');
        $descripcionTecnica = trim($data['descripcion_tecnica'] ?? '');
        $impactoBase = trim($data['impacto_base'] ?? '');
        $recomendacionBase = trim($data['recomendacion_base'] ?? '');

        // Armar valor con unidad sin duplicar
        if (!empty($unidad) && strpos($valor, $unidad) !== false) {
            $valorConUnidad = $valor;
        } else {
            $valorConUnidad = trim("$valor $unidad");
        }

        // Nivel del resultado
        $nivelText = 'regular';
        $estadoLower = mb_strtolower($estado, 'UTF-8');
        if (in_array($estadoLower, ['bajo', 'alto', 'riesgoso', 'riesgo', 'critico', 'malo', 'desfavorable', 'level-danger', 'insuficiente'])) {
            $nivelText = 'riesgoso';
        } elseif (in_array($estadoLower, ['optimo', 'ideal', 'bueno', 'excelente', 'favorable', 'adecuado', 'level-success'])) {
            $nivelText = 'favorable';
        }

        // Calcular factor limitante para tarjetas que lo necesiten
        $potencialMax = 11.2;
        $lossN = max(0, round(((180 - $fertilizanteVal) / 180) * 2.8, 2));
        $lossWater = max(0, round(((750 - $precipitacionVal) / 750) * 2.5, 2));

        $lossPh = 0;
        if ($phSuelo < 5.8) {
            $lossPh = round((5.8 - $phSuelo) * 1.4, 2);
        } elseif ($phSuelo > 7.2) {
            $lossPh = round(($phSuelo - 7.2) * 1.1, 2);
        }

        $lossTemp = 0;
        if ($temperaturaVal > 30.0) {
            $lossTemp = round(($temperaturaVal - 30.0) * 0.4, 2);
        }

        $losses = [
            'nitrogeno' => ['nombre' => 'Nitrógeno', 'perdida' => $lossN, 'detalle' => "$fertilizanteVal kg/ha aplicados vs 180 kg/ha recomendados"],
            'agua' => ['nombre' => 'Lluvia', 'perdida' => $lossWater, 'detalle' => "$precipitacionVal mm/año registrados vs 750 mm/año óptimo"],
            'ph' => ['nombre' => 'pH del Suelo', 'perdida' => $lossPh, 'detalle' => "pH $phSuelo vs rango ideal 5.8 - 6.8"],
            'temperatura' => ['nombre' => 'Temperatura', 'perdida' => $lossTemp, 'detalle' => "$temperaturaVal °C vs rango ideal 21 - 27 °C"]
        ];
        uasort($losses, function($a, $b) { return $b['perdida'] <=> $a['perdida']; });
        $principalItem = current($losses);
        $principalNombre = $principalItem['nombre'];
        $principalPerdida = max(0.4, $principalItem['perdida']);
        $principalDetalle = $principalItem['detalle'];

        $perdidaDolaresHa = round($principalPerdida * 22 * 16.50, 2);

        // El nombre se normaliza UNA vez, igual que hoy (legacy línea 344).
        $nombreLower = mb_strtolower($nombre, 'UTF-8');

        $contexto = [
            'nombre_parcela'        => $nombreParcela,
            'variedad_maiz'         => $variedadMaiz,
            'ubicacion'             => $ubicacion,
            'area_ha'               => $areaHa,
            'ph_suelo'              => $phSuelo,
            'fertilizante'          => $fertilizanteVal,
            'temperatura'           => $temperaturaVal,
            'precipitacion'         => $precipitacionVal,
            'humedad'               => $humedadVal,
            'tipo_suelo'            => $tipoSuelo,
            'rend_predicho'         => $rendPredichoVal,
            'nombre'                => $nombre,
            'valor'                 => $valor,
            'unidad'                => $unidad,
            'estado'                => $estado,
            'rango_ideal'           => $rangoIdeal,
            'descripcion_tecnica'   => $descripcionTecnica,
            'impacto_base'          => $impactoBase,
            'recomendacion_base'    => $recomendacionBase,
            'valor_con_unidad'      => $valorConUnidad,
            'nivel_text'            => $nivelText,
            'potencial_max'         => $potencialMax,
            'loss_n'                => $lossN,
            'loss_water'            => $lossWater,
            'loss_ph'               => $lossPh,
            'loss_temp'             => $lossTemp,
            'principal_nombre'      => $principalNombre,
            'principal_perdida'     => $principalPerdida,
            'principal_detalle'     => $principalDetalle,
            'perdida_dolares_ha'    => $perdidaDolaresHa,
            'nombre_lower'          => $nombreLower,
        ];

        // Normalización de datos_grafico ($dg): solo existe la clave si la envió la tarjeta
        // (paridad con isset($data['datos_grafico']) del bloque gráfico, línea 350).
        if (isset($data['datos_grafico'])) {
            $contexto['datos_grafico'] = $data['datos_grafico'];
        }

        return $contexto;
    }
}
