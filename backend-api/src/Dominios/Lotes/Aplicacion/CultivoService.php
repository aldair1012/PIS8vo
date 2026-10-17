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
            'area'           => floatval($data['area'] ?? 0),
            'latitud'        => !empty($data['latitud']) ? floatval($data['latitud']) : null,
            'longitud'       => !empty($data['longitud']) ? floatval($data['longitud']) : null,
            'fecha_siembra'  => !empty($data['fecha_siembra']) ? $data['fecha_siembra'] : null,
            'geojson'        => !empty($data['geojson']) ? trim($data['geojson']) : null,
            'altitud'        => !empty($data['altitud']) ? floatval($data['altitud']) : null,
            'ph'             => (!empty($data['ph']) && floatval($data['ph']) > 0) ? floatval($data['ph']) : 6.5,
            'fertilizacion_fecha' => !empty($data['fertilizacion_fecha']) ? $data['fertilizacion_fecha'] : null,
            'fertilizacion_dosis' => isset($data['fertilizacion_dosis']) ? floatval($data['fertilizacion_dosis']) : null,
            'fertilizacion_tipo'  => !empty($data['fertilizacion_tipo']) ? trim($data['fertilizacion_tipo']) : null
        ];

        if (empty($datos['nombre_parcela'])) {
            throw new ValidacionException('El nombre de la parcela es obligatorio.');
        }

        if ($datos['area'] <= 0) {
            throw new ValidacionException('El área debe ser mayor a 0.');
        }

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
            'area'           => floatval($data['area'] ?? $cultivo['area']),
            'latitud'        => isset($data['latitud']) ? floatval($data['latitud']) : ($cultivo['latitud'] !== null ? floatval($cultivo['latitud']) : null),
            'longitud'       => isset($data['longitud']) ? floatval($data['longitud']) : ($cultivo['longitud'] !== null ? floatval($cultivo['longitud']) : null),
            'fecha_siembra'  => isset($data['fecha_siembra']) ? $data['fecha_siembra'] : $cultivo['fecha_siembra'],
            'geojson'        => isset($data['geojson']) ? trim($data['geojson']) : $cultivo['geojson'],
            'altitud'        => isset($data['altitud']) ? floatval($data['altitud']) : ($cultivo['altitud'] !== null ? floatval($cultivo['altitud']) : null),
            'ph'             => isset($data['ph']) ? floatval($data['ph']) : ($cultivo['ph'] !== null ? floatval($cultivo['ph']) : null),
            'fertilizacion_fecha' => isset($data['fertilizacion_fecha']) ? $data['fertilizacion_fecha'] : $cultivo['fertilizacion_fecha'],
            'fertilizacion_dosis' => isset($data['fertilizacion_dosis']) ? floatval($data['fertilizacion_dosis']) : ($cultivo['fertilizacion_dosis'] !== null ? floatval($cultivo['fertilizacion_dosis']) : null),
            'fertilizacion_tipo'  => isset($data['fertilizacion_tipo']) ? trim($data['fertilizacion_tipo']) : $cultivo['fertilizacion_tipo']
        ];

        if (empty($datos['nombre_parcela'])) {
            throw new ValidacionException('El nombre de la parcela es obligatorio.');
        }

        if ($datos['area'] <= 0) {
            throw new ValidacionException('El área debe ser mayor a 0.');
        }

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
    public function mapa(): array
    {
        return $this->cultivos->obtenerConCoordenadas();
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

        $lat = !empty($cultivo['latitud']) ? floatval($cultivo['latitud']) : null;
        $lng = !empty($cultivo['longitud']) ? floatval($cultivo['longitud']) : null;

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
                $altitud = !empty($cultivo['altitud']) ? floatval($cultivo['altitud']) : null;
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
                $fuente = 'Fallback por error en API: ' . $e->getMessage();
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
}
