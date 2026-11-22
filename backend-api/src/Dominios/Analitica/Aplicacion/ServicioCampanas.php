<?php
declare(strict_types=1);
namespace ZeaSys\Dominios\Analitica\Aplicacion;

use ZeaSys\Dominios\Analitica\Infraestructura\CampanasRepository;
use ZeaSys\Kernel\Errores\ValidacionException;

final class ServicioCampanas
{
    public function __construct(private CampanasRepository $repo) {}

    public function historial(int $usuario, int $parcela): array
    {
        $this->repo->comprobarParcela($usuario, $parcela);
        $cosechas = $this->repo->cosechas($parcela);
        $grupos = [];
        foreach ($cosechas as &$fila) {
            $fila['observado_t_ha'] = (float) $fila['produccion_seca_kg'] / 1000 / (float) $fila['area_cosechada_ha'];
            $pred = json_decode($fila['prediccion_json'] ?? 'null', true, 512, JSON_THROW_ON_ERROR);
            unset($fila['prediccion_json']);
            $fila['prediccion'] = $pred;
            $fila['base_comparable'] = (bool) $fila['base_comparable'];
            if ($pred && $fila['base_comparable']) $grupos[$pred['version_modelo']][] = $fila;
        }
        unset($fila);
        $metricas = [];
        foreach ($grupos as $version => $filas) {
            $absoluto = $cuadrado = $sesgo = 0.0;
            $dentro = $rangos = 0;
            foreach ($filas as $fila) {
                $pred = $fila['prediccion'];
                $obs = $fila['observado_t_ha'];
                $error = $pred['rendimiento_t_ha'] - $obs;
                $absoluto += abs($error);
                $cuadrado += $error ** 2;
                $sesgo += $error;
                if ($pred['intervalo'] !== null) {
                    $rangos++;
                    if ($pred['intervalo']['min'] <= $obs && $obs <= $pred['intervalo']['max']) $dentro++;
                }
            }
            $n = count($filas);
            $metricas[] = ['version_modelo' => (string) $version, 'n' => $n, 'mae' => $absoluto / $n,
                'rmse' => sqrt($cuadrado / $n), 'sesgo' => $sesgo / $n, 'rangos' => $rangos, 'dentro' => $dentro];
        }
        return ['cosechas' => $cosechas, 'observaciones' => $this->repo->observaciones($parcela), 'metricas' => $metricas];
    }

    public function cosechar(int $usuario, int $parcela, array $datos): void
    {
        $this->repo->comprobarParcela($usuario, $parcela);
        $siembra = self::fecha($datos['fecha_siembra'] ?? null);
        $fecha = self::fecha($datos['fecha_cosecha'] ?? null, $siembra);
        $kg = self::decimal($datos['produccion_seca_kg'] ?? null, 0, 1e9, 4, 'producción');
        $area = self::decimal($datos['area_cosechada_ha'] ?? null, 0.000001, 1e7, 6, 'superficie');
        $humedad = self::decimal($datos['humedad_grano_pct'] ?? null, 0, 99.99, 2, 'humedad del grano');
        $fuente = self::texto($datos['fuente'] ?? null, 255, 'fuente');
        $pred = null;
        $comparable = false;
        if (($datos['simulacion_id'] ?? '') !== '') {
            $id = filter_var($datos['simulacion_id'], FILTER_VALIDATE_INT);
            if (!$id || $id < 1) throw new ValidacionException('Selecciona una simulación guardada.');
            $run = $this->repo->simulacion($usuario, $parcela, $id);
            $modelo = json_decode($run['escenarios_json'] ?? '', true)['_zeasys_modelo'] ?? [];
            $version = $modelo['version_modelo'] ?? null;
            if (!is_string($version) || trim($version) === '' || !is_numeric($run['rendimiento_estimado'] ?? null)
                || (float) $run['rendimiento_estimado'] < 0 || empty($run['fecha'])
                || substr($run['fecha'], 0, 10) >= $fecha || ($modelo['parcela_ejecucion']['fecha_siembra'] ?? null) !== $siembra) {
                throw new ValidacionException('Se necesita una simulación de esta parcela y siembra, con versión y fecha anterior al día de cosecha.');
            }
            $rango = $modelo['intervalo_rendimiento'] ?? null;
            $intervalo = null;
            if (is_numeric($rango['min'] ?? null) && is_numeric($rango['max'] ?? null)
                && $rango['min'] >= 0 && $rango['max'] >= $rango['min']) {
                $intervalo = ['min' => (float) $rango['min'], 'max' => (float) $rango['max']];
            }
            $pred = ['id' => $id, 'fecha' => $run['fecha'], 'version_modelo' => $version,
                'rendimiento_t_ha' => (float) $run['rendimiento_estimado'], 'area_ha' => (float) $run['area_simulada'], 'intervalo' => $intervalo];
            $comparable = ($datos['base_comparable'] ?? false) === true;
            if ($comparable && abs($pred['area_ha'] - $area) > 0.005) {
                throw new ValidacionException('Las áreas simulada y cosechada difieren. Guarda la cosecha sin marcarla como comparable.');
            }
        }
        if ($pred === null && ($datos['base_comparable'] ?? false) === true) {
            throw new ValidacionException('Selecciona la simulación cuya superficie y humedad confirmas.');
        }
        $this->repo->insertarCosecha([$parcela, $siembra, $fecha, $kg, $area, $humedad, $fuente,
            $pred ? json_encode($pred, JSON_THROW_ON_ERROR) : null, (int) $comparable]);
    }

    public function observar(int $usuario, int $parcela, array $datos, ?array $archivo): void
    {
        $this->repo->comprobarParcela($usuario, $parcela);
        $siembra = self::fecha($datos['fecha_siembra'] ?? null);
        $fecha = self::fecha($datos['fecha'] ?? null, $siembra);
        $fuente = self::texto($datos['fuente'] ?? null, 255, 'fuente');
        $nota = ($datos['nota'] ?? '') !== '' ? self::texto($datos['nota'], 500, 'nota') : null;
        $ndvi = ($datos['ndvi'] ?? '') !== '' ? self::decimal($datos['ndvi'], -1, 1, 5, 'NDVI') : null;
        [$tipo, $binario] = self::leerAdjunto($archivo);
        if ($ndvi === null && $nota === null && $tipo === null) throw new ValidacionException('Ingresa una observación, un NDVI o un adjunto.');
        $huella = hash('sha256', json_encode([$fuente, $nota, $ndvi, $tipo, $binario === null ? null : hash('sha256', $binario)], JSON_THROW_ON_ERROR));
        $this->repo->insertarObservacion([$parcela, $siembra, $fecha, $fuente, $ndvi, $nota, $huella, $tipo, $binario]);
    }

    private static function leerAdjunto(?array $archivo): array
    {
        if ($archivo === null || ($archivo['error'] ?? null) === UPLOAD_ERR_NO_FILE) return [null, null];
        if (($archivo['error'] ?? null) !== UPLOAD_ERR_OK || !is_uploaded_file($archivo['tmp_name'])
            || filesize($archivo['tmp_name']) > 2 * 1024 * 1024) throw new ValidacionException('El adjunto debe pesar como máximo 2 MiB.');
        $tipo = (new \finfo(FILEINFO_MIME_TYPE))->file($archivo['tmp_name']);
        $tipos = ['image/jpeg', 'image/png', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a'];
        if (!in_array($tipo, $tipos, true)) throw new ValidacionException('Adjunta una imagen JPEG o PNG, o audio MP3, OGG, M4A o WAV.');
        $binario = file_get_contents($archivo['tmp_name']);
        if ($binario === false || $binario === '') throw new ValidacionException('El archivo está vacío o incompleto.');
        return [$tipo, $binario];
    }

    private static function fecha(mixed $valor, ?string $min = null): string
    {
        $zona = new \DateTimeZone('America/Guayaquil');
        if (!is_string($valor) || !preg_match('/^\d{4}-\d{2}-\d{2}$/D', $valor)
            || $valor < ($min ?? '1000-01-01') || $valor > (new \DateTimeImmutable('today', $zona))->format('Y-m-d')
            || !checkdate((int) substr($valor, 5, 2), (int) substr($valor, 8, 2), (int) substr($valor, 0, 4))) {
            throw new ValidacionException('Revisa las fechas de siembra y registro. Deben existir y no ser futuras.');
        }
        return $valor;
    }

    private static function decimal(mixed $valor, float $min, float $max, int $decimales, string $campo): float
    {
        if (!is_numeric($valor) || !is_finite((float) $valor) || $valor < $min || $valor > $max
            || round((float) $valor, $decimales) !== (float) $valor) throw new ValidacionException("Revisa el valor de {$campo} y sus decimales.");
        return (float) $valor;
    }

    private static function texto(mixed $valor, int $max, string $campo): string
    {
        if (!is_string($valor) || trim($valor) === '' || mb_strlen($valor) > $max) throw new ValidacionException("Revisa el campo {$campo}.");
        return trim($valor);
    }
}
