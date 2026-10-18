<?php
// src/Dominios/Lotes/Aplicacion/CultivoService.php — Casos de uso de cultivos (parcelas/lotes).
// Port verbatim del CultivoController legacy (backend-api/controllers/CultivoController.php, líneas 25–281):
// mismos strings, códigos y payloads; echo+exit → return y errores → excepciones tipadas.
declare(strict_types=1);

namespace ZeaSys\Dominios\Lotes\Aplicacion;

use ZeaSys\Dominios\Lotes\Dominio\CultivoRepositoryInterface;
use ZeaSys\Dominios\Lotes\Dominio\ValidadorLimitesEcuador;
use ZeaSys\Dominios\Terreno\Aplicacion\ServicioDatosTerreno;
use ZeaSys\Kernel\Errores\AccesoDenegadoException;
use ZeaSys\Kernel\Errores\ValidacionException;
use ZeaSys\Kernel\Errores\ZeaSysException;
use ZeaSys\Kernel\Peticion;

final class CultivoService
{
    public function __construct(
        private CultivoRepositoryInterface $cultivos,
        private ValidadorLimitesEcuador $limites,
        private ServicioDatosTerreno $terreno,
    ) {
    }

    /** listar() 25–32. */
    public function listar(int $usuarioId): array
    {
        return $this->cultivos->obtenerPorUsuario($usuarioId);
    }

    /** crear() 34–93. */
    public function crear(int $usuarioId, Peticion $p): array
    {
        $data = $p->cuerpo();

        $datos = [
            'usuario_id'     => $usuarioId,
            'nombre_parcela' => trim($data['nombre_parcela'] ?? ''),
            'variedad_maiz'  => trim($data['variedad_maiz'] ?? 'Híbrido convencional'),
            'tipo_maiz'      => trim($data['tipo_maiz'] ?? 'Duro Amarillo'),
            'ubicacion'      => trim($data['ubicacion'] ?? ''),
            'area'           => $this->numeroOpcional($data, 'area') ?? 0.0,
            'latitud'        => $this->numeroOpcional($data, 'latitud'),
            'longitud'       => $this->numeroOpcional($data, 'longitud'),
            'fecha_siembra'  => $this->fechaOpcional($data, 'fecha_siembra'),
            'geojson'        => $this->geoJsonOpcional($data),
            'altitud'        => $this->numeroOpcional($data, 'altitud'),
            'ph'             => $this->numeroOpcional($data, 'ph') ?? 6.5,
            'fertilizacion_fecha' => $this->fechaOpcional($data, 'fertilizacion_fecha'),
            'fertilizacion_dosis' => $this->numeroOpcional($data, 'fertilizacion_dosis'),
            'fertilizacion_tipo'  => !empty($data['fertilizacion_tipo']) ? trim($data['fertilizacion_tipo']) : null
        ];

        $this->validarTextos($datos);

        if ($datos['area'] <= 0) {
            throw new ValidacionException('El área debe ser mayor a 0.');
        }

        $this->validarRangosAgronomicos($datos);

        if (!$this->limites->validoAlCrear($datos['latitud'], $datos['longitud'])) {
            throw new ValidacionException(ValidadorLimitesEcuador::MENSAJE_FUERA_DE_RANGO);
        }

        try {
            $id = $this->cultivos->crear($datos);
        } catch (\Exception $e) {
            throw new ZeaSysException('Error al registrar la parcela: ' . $e->getMessage(), 500);
        }

        $datos['id'] = $id;
        return [
            'success' => true,
            'message' => 'Parcela registrada exitosamente.',
            'cultivo' => $datos
        ];
    }

    /** actualizar() 95–167. */
    public function actualizar(int $usuarioId, Peticion $p): array
    {
        $data = $p->cuerpo();

        $id = intval($data['id'] ?? ($p->query('id') ?? 0));
        if ($id <= 0) {
            throw new ValidacionException('ID de parcela inválido.');
        }

        $cultivo = $this->cultivos->obtenerPorId($id);
        if (!$cultivo || $cultivo['usuario_id'] != $usuarioId) {
            throw new AccesoDenegadoException('No tiene permisos para editar esta parcela.');
        }

        $datos = [
            'nombre_parcela' => trim($data['nombre_parcela'] ?? $cultivo['nombre_parcela']),
            'variedad_maiz'  => trim($data['variedad_maiz'] ?? $cultivo['variedad_maiz']),
            'tipo_maiz'      => trim($data['tipo_maiz'] ?? $cultivo['tipo_maiz']),
            'ubicacion'      => trim($data['ubicacion'] ?? $cultivo['ubicacion']),
            'area'           => array_key_exists('area', $data) ? ($this->numeroOpcional($data, 'area') ?? 0.0) : (float) $cultivo['area'],
            'latitud'        => array_key_exists('latitud', $data) ? $this->numeroOpcional($data, 'latitud') : ($cultivo['latitud'] !== null ? (float) $cultivo['latitud'] : null),
            'longitud'       => array_key_exists('longitud', $data) ? $this->numeroOpcional($data, 'longitud') : ($cultivo['longitud'] !== null ? (float) $cultivo['longitud'] : null),
            'fecha_siembra'  => array_key_exists('fecha_siembra', $data) ? $this->fechaOpcional($data, 'fecha_siembra') : $cultivo['fecha_siembra'],
            'geojson'        => array_key_exists('geojson', $data) ? $this->geoJsonOpcional($data) : $cultivo['geojson'],
            'altitud'        => array_key_exists('altitud', $data) ? $this->numeroOpcional($data, 'altitud') : ($cultivo['altitud'] !== null ? (float) $cultivo['altitud'] : null),
            'ph'             => array_key_exists('ph', $data) ? $this->numeroOpcional($data, 'ph') : ($cultivo['ph'] !== null ? (float) $cultivo['ph'] : null),
            'fertilizacion_fecha' => array_key_exists('fertilizacion_fecha', $data) ? $this->fechaOpcional($data, 'fertilizacion_fecha') : $cultivo['fertilizacion_fecha'],
            'fertilizacion_dosis' => array_key_exists('fertilizacion_dosis', $data) ? $this->numeroOpcional($data, 'fertilizacion_dosis') : ($cultivo['fertilizacion_dosis'] !== null ? (float) $cultivo['fertilizacion_dosis'] : null),
            'fertilizacion_tipo'  => isset($data['fertilizacion_tipo']) ? trim($data['fertilizacion_tipo']) : $cultivo['fertilizacion_tipo']
        ];

        $this->validarTextos($datos);

        if ($datos['area'] <= 0) {
            throw new ValidacionException('El área debe ser mayor a 0.');
        }

        $this->validarRangosAgronomicos($datos);

        if (!$this->limites->validoAlActualizar($datos['latitud'], $datos['longitud'])) {
            throw new ValidacionException(ValidadorLimitesEcuador::MENSAJE_FUERA_DE_RANGO);
        }

        try {
            $this->cultivos->actualizar($id, $datos);
        } catch (\Exception $e) {
            throw new ZeaSysException('Error al actualizar: ' . $e->getMessage(), 500);
        }

        $datos['id'] = $id;
        return [
            'success' => true,
            'message' => 'Parcela actualizada exitosamente.',
            'cultivo' => $datos
        ];
    }

    /** eliminar() 169–197 (el id viene de query, como en el original: $_GET['id']). */
    public function eliminar(int $usuarioId, Peticion $p): array
    {
        $id = intval($p->query('id') ?? 0);
        if ($id <= 0) {
            throw new ValidacionException('ID de parcela inválido.');
        }

        $cultivo = $this->cultivos->obtenerPorId($id);
        if (!$cultivo || $cultivo['usuario_id'] != $usuarioId) {
            throw new AccesoDenegadoException('No tiene permisos para eliminar esta parcela.');
        }

        try {
            $this->cultivos->eliminar($id);
        } catch (\Exception $e) {
            throw new ZeaSysException('Error al eliminar: ' . $e->getMessage(), 500);
        }

        return ['success' => true, 'message' => 'Parcela eliminada correctamente.'];
    }

    /** mapa() 199–206. */
    public function mapa(int $usuarioId): array
    {
        return $this->cultivos->obtenerConCoordenadas($usuarioId);
    }

    /**
     * obtenerValoresUbicacion() 208–281.
     * Se elimina `new ClimateController()`: el acceso a Open-Meteo/SoilGrids lo hace
     * ServicioDatosTerreno inyectado ($this->terreno->obtener($lat, $lng, $altitud)).
     */
    public function obtenerValoresUbicacion(int $usuarioId, Peticion $p): array
    {
        $idConsulta = $p->query('id');
        $id = isset($idConsulta) ? intval($idConsulta) : 0;
        $cultivo = $this->cultivos->obtenerPorId($id);

        if (!$cultivo || $cultivo['usuario_id'] != $usuarioId) {
            throw new AccesoDenegadoException('No tiene permisos para acceder a esta parcela.');
        }

        $lat = isset($cultivo['latitud']) && $cultivo['latitud'] !== '' ? (float) $cultivo['latitud'] : null;
        $lng = isset($cultivo['longitud']) && $cultivo['longitud'] !== '' ? (float) $cultivo['longitud'] : null;

        $clima = [
            'temperatura' => 24.5,
            'humedad' => 68.0,
            'precipitacion' => 750.0
        ];
        $suelo = [
            'ph' => !empty($cultivo['ph']) ? floatval($cultivo['ph']) : 6.5,
            'tipo_suelo' => 'franco'
        ];
        $fuente = 'Valores por defecto del cultivo';

        if ($lat !== null && $lng !== null) {
            try {
                $altitud = isset($cultivo['altitud']) && $cultivo['altitud'] !== '' ? (float) $cultivo['altitud'] : null;
                $datosApi = $this->terreno->obtener($lat, $lng, $altitud);

                if (isset($datosApi['clima'])) {
                    $clima['temperatura'] = $datosApi['clima']['temperatura'];
                    $clima['humedad'] = $datosApi['clima']['humedad'];
                    $clima['precipitacion'] = $datosApi['clima']['precipitacion'];
                }

                if (empty($cultivo['ph']) && isset($datosApi['suelo']['ph'])) {
                    $suelo['ph'] = $datosApi['suelo']['ph'];
                }

                if (isset($datosApi['suelo'])) {
                    $arcilla = $datosApi['suelo']['clay'] ?? 30;
                    $arena = $datosApi['suelo']['sand'] ?? 40;
                    if ($arcilla > 35) {
                        $suelo['tipo_suelo'] = 'arcilloso';
                    } elseif ($arena > 50) {
                        $suelo['tipo_suelo'] = 'arenoso';
                    } else {
                        $suelo['tipo_suelo'] = 'franco';
                    }
                }
                $fuente = $datosApi['source'] ?? 'Open-Meteo & SoilGrids';
            } catch (\Exception $e) {
                error_log('[ZeaSys] No fue posible consultar los datos del terreno: ' . $e->getMessage());
                $fuente = 'Valores agronómicos de respaldo';
            }
        }

        return [
            'success' => true,
            'source' => $fuente,
            'temperatura' => $clima['temperatura'],
            'humedad' => $clima['humedad'],
            'precipitacion' => $clima['precipitacion'],
            'ph_suelo' => $suelo['ph'],
            'tipo_suelo' => $suelo['tipo_suelo'],
            'area_simulada' => !empty($cultivo['area']) ? floatval($cultivo['area']) : 1.0
        ];
    }

    private function numeroOpcional(array $data, string $campo): ?float
    {
        if (!array_key_exists($campo, $data) || $data[$campo] === null || $data[$campo] === '') {
            return null;
        }
        $valor = $data[$campo];
        if (!is_int($valor) && !is_float($valor) && !(is_string($valor) && is_numeric(trim($valor)))) {
            throw new ValidacionException("El campo {$campo} debe ser numérico.");
        }
        $numero = (float) $valor;
        if (!is_finite($numero)) {
            throw new ValidacionException("El campo {$campo} debe ser un número finito.");
        }
        return $numero;
    }

    private function fechaOpcional(array $data, string $campo): ?string
    {
        if (!array_key_exists($campo, $data) || $data[$campo] === null || $data[$campo] === '') {
            return null;
        }
        if (!is_string($data[$campo])) {
            throw new ValidacionException("El campo {$campo} debe ser una fecha válida.");
        }
        $fecha = \DateTimeImmutable::createFromFormat('!Y-m-d', $data[$campo]);
        $errores = \DateTimeImmutable::getLastErrors();
        if ($fecha === false || ($errores !== false && ($errores['warning_count'] > 0 || $errores['error_count'] > 0))) {
            throw new ValidacionException("El campo {$campo} debe usar el formato AAAA-MM-DD.");
        }
        return $fecha->format('Y-m-d');
    }

    private function geoJsonOpcional(array $data): ?string
    {
        if (!array_key_exists('geojson', $data) || $data['geojson'] === null || $data['geojson'] === '') {
            return null;
        }
        $geoJson = is_string($data['geojson'])
            ? trim($data['geojson'])
            : json_encode($data['geojson'], JSON_UNESCAPED_UNICODE);
        if (!is_string($geoJson) || !is_array(json_decode($geoJson, true))) {
            throw new ValidacionException('El polígono GeoJSON no es válido.');
        }
        return $geoJson;
    }

    private function validarTextos(array $datos): void
    {
        if ($datos['nombre_parcela'] === '') {
            throw new ValidacionException('El nombre de la parcela es obligatorio.');
        }
        $limites = [
            'nombre_parcela' => 150,
            'variedad_maiz' => 100,
            'tipo_maiz' => 100,
            'ubicacion' => 255,
            'fertilizacion_tipo' => 150,
        ];
        foreach ($limites as $campo => $maximo) {
            if ($datos[$campo] !== null && mb_strlen((string) $datos[$campo]) > $maximo) {
                throw new ValidacionException("El campo {$campo} no puede superar {$maximo} caracteres.");
            }
        }
    }

    private function validarRangosAgronomicos(array $datos): void
    {
        if ($datos['ph'] !== null && ($datos['ph'] < 0 || $datos['ph'] > 14)) {
            throw new ValidacionException('El pH debe estar entre 0 y 14.');
        }
        if ($datos['fertilizacion_dosis'] !== null && $datos['fertilizacion_dosis'] < 0) {
            throw new ValidacionException('La dosis de fertilización no puede ser negativa.');
        }
    }
}
