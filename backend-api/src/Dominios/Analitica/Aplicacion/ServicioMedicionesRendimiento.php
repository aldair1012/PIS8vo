<?php
declare(strict_types=1);
namespace ZeaSys\Dominios\Analitica\Aplicacion;
use ZeaSys\Dominios\Analitica\Dominio\MedicionesRendimientoRepositoryInterface;
use ZeaSys\Dominios\Lotes\Dominio\CultivoRepositoryInterface;
use ZeaSys\Kernel\Errores\AccesoDenegadoException;
use ZeaSys\Kernel\Errores\ValidacionException;

final class ServicioMedicionesRendimiento
{
    public const ETAPAS = ['VE' => 'Emergencia', 'V2-V8' => 'Vegetativo V2–V8', 'V9-VT' => 'Vegetativo avanzado', 'VT-R1' => 'Floración / polinización', 'R2-R5' => 'Formación y llenado de grano', 'R6' => 'Madurez fisiológica'];
    public function __construct(private CultivoRepositoryInterface $cultivos, private MedicionesRendimientoRepositoryInterface $repositorio) {}
    private function lote(int $usuarioId, int $cultivoId): array
    {
        $lote = $this->cultivos->obtenerPorId($cultivoId);
        if (!$lote || (int) $lote['usuario_id'] !== $usuarioId || !(bool) ($lote['activo'] ?? true)) throw new AccesoDenegadoException('La parcela no está disponible para este usuario.');
        return $lote;
    }
    public function obtener(int $usuarioId, int $cultivoId): array
    {
        $this->lote($usuarioId, $cultivoId);
        $registro = $this->repositorio->obtener($usuarioId, $cultivoId);
        $datos = $registro['datos'] ?? [];
        $registro['indicadores'] = self::calcular($datos);
        return $registro;
    }
    public static function calcular(array $datos): array
    {
        $salida = [];
        $fuente = ['fuente' => 'Mediciones ingresadas por el productor', 'tipo' => 'calculo_desde_medicion_declarada'];
        if (isset($datos['grano_seco_kg'], $datos['biomasa_seca_kg']) && $datos['grano_seco_kg'] >= 0 && $datos['biomasa_seca_kg'] > 0 && $datos['grano_seco_kg'] <= $datos['biomasa_seca_kg']) {
            $salida['indice_cosecha'] = $fuente + ['valor' => round($datos['grano_seco_kg'] / $datos['biomasa_seca_kg'], 4), 'unidad' => '', 'fecha' => $datos['fecha_cosecha'] ?? null, 'nota' => 'Masa seca de grano / biomasa aérea seca total (incluye el grano), de la misma parcela y muestra. Registro del productor, sin auditoría independiente.'];
        }
        if (isset($datos['capacidad_campo_pct'], $datos['marchitez_pct'], $datos['profundidad_cm']) && $datos['capacidad_campo_pct'] > $datos['marchitez_pct'] && $datos['profundidad_cm'] > 0) {
            $salida['agua_medida'] = $fuente + ['valor' => round(($datos['capacidad_campo_pct'] - $datos['marchitez_pct']) / 100 * $datos['profundidad_cm'] * 10, 1), 'unidad' => 'mm', 'fecha' => $datos['fecha_suelo'] ?? null, 'nota' => 'Capacidad de agua disponible = (CC − PMP) × profundidad. No representa humedad actual ni lluvia del ciclo.'];
        }
        if (isset(self::ETAPAS[$datos['etapa'] ?? ''])) $salida['etapa_observada'] = $fuente + ['valor' => self::ETAPAS[$datos['etapa']], 'unidad' => '', 'fecha' => $datos['fecha_observacion'] ?? null, 'nota' => 'Etapa que el productor declara haber observado en la fecha indicada. No se actualiza automáticamente como si fuera una observación de hoy.'];
        if (isset($datos['incidencia_pct']) && !empty($datos['plaga'])) $salida['incidencia_plaga'] = $fuente + ['valor' => $datos['incidencia_pct'], 'unidad' => '%', 'fecha' => $datos['fecha_observacion'] ?? null, 'nota' => $datos['plaga'] . ': porcentaje de plantas afectadas declarado por el productor. No es una probabilidad futura ni un diagnóstico automático.'];
        return $salida;
    }
    public function guardar(int $usuarioId, int $cultivoId, array $entrada): array
    {
        $lote = $this->lote($usuarioId, $cultivoId);
        $registro = $this->repositorio->obtener($usuarioId, $cultivoId);
        $datos = $registro['datos'] ?? [];
        foreach (['grano_seco_kg' => [0, 1e9], 'biomasa_seca_kg' => [0.000001, 1e9], 'capacidad_campo_pct' => [0, 100], 'marchitez_pct' => [0, 100], 'profundidad_cm' => [0.1, 200], 'incidencia_pct' => [0, 100]] as $campo => [$min, $max]) {
            if (!array_key_exists($campo, $entrada)) continue;
            $valor = $entrada[$campo];
            if ($valor === null || $valor === '') { unset($datos[$campo]); continue; }
            if (is_bool($valor) || !is_scalar($valor) || !is_numeric($valor) || !is_finite((float) $valor) || (float) $valor < $min || (float) $valor > $max) throw new ValidacionException('El valor de ' . $campo . ' está fuera del rango permitido.');
            $datos[$campo] = (float) $valor;
        }
        foreach (['fecha_cosecha', 'fecha_suelo', 'fecha_observacion'] as $campo) {
            if (!array_key_exists($campo, $entrada)) continue;
            if ($entrada[$campo] === null || $entrada[$campo] === '') { unset($datos[$campo]); continue; }
            if (!is_string($entrada[$campo]) || !preg_match('/^\d{4}-\d{2}-\d{2}$/D', $entrada[$campo])) throw new ValidacionException('La fecha no es válida.');
            $fecha = \DateTimeImmutable::createFromFormat('!Y-m-d', $entrada[$campo], new \DateTimeZone('America/Guayaquil'));
            if (!$fecha || $fecha->format('Y-m-d') !== $entrada[$campo] || $fecha > new \DateTimeImmutable('today', new \DateTimeZone('America/Guayaquil'))) throw new ValidacionException('La fecha debe existir y no puede ser futura.');
            $datos[$campo] = $fecha->format('Y-m-d');
        }
        foreach (['etapa', 'plaga'] as $campo) {
            if (!array_key_exists($campo, $entrada)) continue;
            if ($entrada[$campo] === null || $entrada[$campo] === '') { unset($datos[$campo]); continue; }
            if (!is_string($entrada[$campo]) || strlen($entrada[$campo]) > 150) throw new ValidacionException('El texto de la observación no es válido.');
            $datos[$campo] = trim($entrada[$campo]);
            if ($datos[$campo] === '') unset($datos[$campo]);
        }
        if (isset($datos['etapa']) && !isset(self::ETAPAS[$datos['etapa']])) throw new ValidacionException('La etapa seleccionada no es válida.');
        foreach ([['grano_seco_kg', 'biomasa_seca_kg', 'fecha_cosecha'], ['capacidad_campo_pct', 'marchitez_pct', 'profundidad_cm', 'fecha_suelo']] as $grupo) {
            $presentes = array_intersect($grupo, array_keys($datos));
            if ($presentes && count($presentes) !== count($grupo)) throw new ValidacionException('Completa todos los valores y la fecha del grupo de medición.');
        }
        if (isset($datos['grano_seco_kg']) && $datos['grano_seco_kg'] > $datos['biomasa_seca_kg']) throw new ValidacionException('El grano seco no puede superar la biomasa aérea seca total que lo incluye.');
        if (isset($datos['capacidad_campo_pct']) && $datos['capacidad_campo_pct'] <= $datos['marchitez_pct']) throw new ValidacionException('La capacidad de campo debe superar el punto de marchitez.');
        if ((isset($datos['etapa']) || isset($datos['plaga']) || isset($datos['incidencia_pct'])) && !isset($datos['fecha_observacion'])) throw new ValidacionException('Registra la fecha de la observación de campo.');
        if (isset($datos['plaga']) !== isset($datos['incidencia_pct'])) throw new ValidacionException('La plaga y el porcentaje de incidencia deben registrarse juntos.');
        foreach (['fecha_cosecha', 'fecha_observacion'] as $fecha) {
            if (isset($datos[$fecha], $lote['fecha_siembra']) && $datos[$fecha] < substr($lote['fecha_siembra'], 0, 10)) throw new ValidacionException('Una observación del cultivo o cosecha no puede ser anterior a la siembra registrada.');
        }
        if (!$datos) throw new ValidacionException('Registra al menos un grupo completo de mediciones.');
        $this->repositorio->guardar($usuarioId, $cultivoId, $datos);
        return $this->obtener($usuarioId, $cultivoId);
    }
}
