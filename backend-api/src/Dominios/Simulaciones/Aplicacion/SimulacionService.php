<?php
// src/Dominios/Simulaciones/Aplicacion/SimulacionService.php — Casos de uso del dominio simulaciones (predicción ML + explicabilidad).
// Orquesta simulaciones, disponibilidad del motor y explicabilidad.
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Aplicacion;

use ZeaSys\Dominios\Lotes\Dominio\CultivoRepositoryInterface;
use ZeaSys\Dominios\Simulaciones\Dominio\GestorMotorIaInterface;
use ZeaSys\Dominios\Simulaciones\Dominio\MotorPrediccionInterface;
use ZeaSys\Dominios\Simulaciones\Dominio\SimulacionRepositoryInterface;
use ZeaSys\Dominios\Simulaciones\Explicacion\Aplicacion\ServicioExplicabilidad;
use ZeaSys\Dominios\Terreno\Dominio\CacheInterface;
use ZeaSys\Kernel\Errores\AccesoDenegadoException;
use ZeaSys\Kernel\Errores\ServicioExternoException;
use ZeaSys\Kernel\Errores\ValidacionException;
use ZeaSys\Kernel\Errores\ZeaSysException;
use ZeaSys\Kernel\Peticion;

final class SimulacionService
{
    public function __construct(
        private SimulacionRepositoryInterface $simulaciones,
        private MotorPrediccionInterface $motor,
        private GestorMotorIaInterface $motorIa,
        private ServicioExplicabilidad $explicabilidad,
        private CacheInterface $cache,
        private CultivoRepositoryInterface $cultivos,
    ) {
    }

    /** simular() 54–164. */
    public function simular(int $usuarioId, Peticion $p): array
    {
        $data = $p->cuerpo();

        foreach (['temperatura', 'humedad', 'precipitacion', 'fertilizante', 'ph_suelo', 'area_simulada'] as $campo) {
            if (!array_key_exists($campo, $data)) {
                throw new ValidacionException("El campo {$campo} es obligatorio.");
            }
            $this->validarNumero($data[$campo], $campo);
        }

        if (isset($data['cultivo_id']) && filter_var($data['cultivo_id'], FILTER_VALIDATE_INT) === false) {
            throw new ValidacionException('ID de parcela inválido.');
        }

        $datos = [
            'usuario_id'    => $usuarioId,
            'cultivo_id'    => !empty($data['cultivo_id']) ? intval($data['cultivo_id']) : null,
            'nombre'        => trim($data['nombre'] ?? 'Simulación ' . date('d/m/Y H:i')),
            'modelo_usado'  => $data['modelo_usado'] ?? 'xgboost',
            'temperatura'   => isset($data['temperatura']) ? floatval($data['temperatura']) : 0.0,
            'humedad'       => isset($data['humedad']) ? floatval($data['humedad']) : 0.0,
            'precipitacion' => isset($data['precipitacion']) ? floatval($data['precipitacion']) : 0.0,
            'fertilizante'  => isset($data['fertilizante']) ? floatval($data['fertilizante']) : 0.0,
            'ph_suelo'      => isset($data['ph_suelo']) ? floatval($data['ph_suelo']) : 0.0,
            'tipo_suelo'    => $data['tipo_suelo'] ?? 'franco',
            'area_simulada' => isset($data['area_simulada']) ? floatval($data['area_simulada']) : 1.0
        ];

        if (empty($datos['cultivo_id'])) {
            throw new ValidacionException('Debe seleccionar una parcela registrada para realizar la simulación.');
        }

        $c = $this->cultivos->obtenerPorId($datos['cultivo_id']);
        if (!$c || $c['usuario_id'] != $usuarioId) {
            throw new AccesoDenegadoException('La parcela seleccionada es inválida o no le pertenece.');
        }

        $datos['variedad_maiz'] = $c['variedad_maiz'] ?? 'Híbrido convencional';
        $datos['tipo_maiz'] = $c['tipo_maiz'] ?? 'Duro Amarillo';
        $datos['ubicacion'] = $c['ubicacion'] ?? '';
        $datos['altitud'] = $c['altitud'] ?? 45.0;
        $datos['latitud'] = $c['latitud'] ?? null;
        $datos['longitud'] = $c['longitud'] ?? null;

        // Validaciones
        if ($datos['temperatura'] < 0 || $datos['temperatura'] > 50) {
            throw new ValidacionException('La temperatura debe estar entre 0°C y 50°C.');
        }

        if ($datos['humedad'] < 0 || $datos['humedad'] > 100) {
            throw new ValidacionException('La humedad debe estar entre 0% y 100%.');
        }

        if ($datos['precipitacion'] < 0 || $datos['precipitacion'] > 4000) {
            throw new ValidacionException('La precipitación debe estar entre 0 y 4000 mm/año.');
        }

        if ($datos['fertilizante'] < 0 || $datos['fertilizante'] > 500) {
            throw new ValidacionException('El fertilizante debe estar entre 0 y 500 kg/ha.');
        }

        if ($datos['ph_suelo'] < 3.0 || $datos['ph_suelo'] > 11.0) {
            throw new ValidacionException('El pH debe estar entre 3.0 y 11.0.');
        }

        if ($datos['area_simulada'] <= 0) {
            throw new ValidacionException('El área simulada debe ser mayor a 0.');
        }

        if (!in_array($datos['modelo_usado'], ['random_forest', 'xgboost'], true)) {
            throw new ValidacionException('El modelo seleccionado no está disponible.');
        }

        if (!in_array($datos['tipo_suelo'], ['franco', 'arcilloso', 'arenoso'], true)) {
            throw new ValidacionException('El tipo de suelo no es válido.');
        }

        if ($datos['nombre'] === '' || mb_strlen($datos['nombre']) > 200) {
            throw new ValidacionException('El nombre de la simulación debe contener entre 1 y 200 caracteres.');
        }

        // Asegurar que el servidor de IA esté activo
        $iaStatus = $this->motorIa->asegurarActivo();
        if (!$iaStatus['running']) {
            throw new ZeaSysException('El motor de simulación está inactivo: ' . $iaStatus['message'], 503);
        }

        $resultado = $this->motor->predecir($datos);

        if (!isset($resultado['success']) || !$resultado['success']) {
            throw new ServicioExternoException($resultado['error'] ?? 'Error al comunicarse con el motor de simulación.');
        }

        try {
            $id = $this->simulaciones->guardar($datos, $resultado);
            $resultado['simulacion_id'] = $id;

            return [
                'success' => true,
                'message' => 'Simulación completada exitosamente.',
                'resultado' => $resultado
            ];
        } catch (\Exception $e) {
            // paridad: legacy catch(Exception) → 500 con mensaje concatenado exacto.
            throw new ZeaSysException('Error al guardar la simulación: ' . $e->getMessage(), 500);
        }
    }

    /** historial() 166–181 (limpiarCacheExpirada() → CacheInterface::limpiarExpirados()). */
    public function historial(int $usuarioId, Peticion $p): array
    {
        $this->cache->limpiarExpirados();

        $anioConsulta = $p->query('anio');
        $year = null;
        if (isset($anioConsulta) && $anioConsulta !== '') {
            if (filter_var($anioConsulta, FILTER_VALIDATE_INT) === false) {
                throw new ValidacionException('El año consultado no es válido.');
            }
            $year = (int) $anioConsulta;
            if ($year < 2000 || $year > 2100) {
                throw new ValidacionException('El año consultado debe estar entre 2000 y 2100.');
            }
        }
        $simulaciones = $this->simulaciones->obtenerPorUsuario($usuarioId, 100, $year);
        $estadisticas = $this->simulaciones->obtenerEstadisticas($usuarioId, $year);

        return [
            'simulaciones' => $simulaciones,
            'estadisticas' => $estadisticas
        ];
    }

    /** eliminar() 183–211. */
    public function eliminar(int $usuarioId, Peticion $p): array
    {
        $id = intval($p->query('id') ?? 0);
        if ($id <= 0) {
            throw new ValidacionException('ID de simulación inválido.');
        }

        $simulacion = $this->simulaciones->obtenerPorId($id);
        if (!$simulacion || $simulacion['usuario_id'] != $usuarioId) {
            throw new AccesoDenegadoException('No tiene permisos para eliminar esta simulación.');
        }

        try {
            $this->simulaciones->eliminar($id);
            return ['success' => true, 'message' => 'Simulación eliminada correctamente.'];
        } catch (\Exception $e) {
            // paridad: legacy catch(Exception) → 500 con mensaje concatenado exacto.
            throw new ZeaSysException('Error al eliminar la simulación: ' . $e->getMessage(), 500);
        }
    }

    /** iaStatus() 213–221 (el legacy también limpiaba el caché expirado antes de responder). */
    public function iaStatus(Peticion $p): array
    {
        $this->cache->limpiarExpirados();
        return $this->motorIa->estado(false);
    }

    /**
     * explain() 223–929: validaciones 225–238 + delegación al catálogo Strategy.
     * El preprocesamiento (líneas 238–344) y la cadena if/elseif (354–911) viven en
     * ServicioExplicabilidad; el ensamblado final (913–929) es verbatim allí.
     * El contexto solo puede referenciar parcelas pertenecientes al usuario autenticado.
     */
    public function explain(int $usuarioId, Peticion $p): array
    {
        @set_time_limit(240); // paridad: el legacy lo fijaba a 240 s antes del catálogo (el explain puede tardar).

        $data = $p->cuerpo();

        if (empty($data)) {
            throw new ValidacionException('No se recibieron datos de contexto para interpretar.');
        }

        if (isset($data['cultivo_id']) && $data['cultivo_id'] !== '' && $data['cultivo_id'] !== null) {
            if (filter_var($data['cultivo_id'], FILTER_VALIDATE_INT) === false || (int) $data['cultivo_id'] <= 0) {
                throw new ValidacionException('ID de parcela inválido.');
            }
            $cultivo = $this->cultivos->obtenerPorId((int) $data['cultivo_id']);
            if (!$cultivo || (int) $cultivo['usuario_id'] !== $usuarioId) {
                throw new AccesoDenegadoException('No tiene permisos para interpretar datos de esta parcela.');
            }
        }

        return $this->explicabilidad->explicar($data);
    }

    private function validarNumero(mixed $valor, string $campo): void
    {
        if (!is_int($valor) && !is_float($valor) && !(is_string($valor) && is_numeric(trim($valor)))) {
            throw new ValidacionException("El campo {$campo} debe ser numérico.");
        }
        if (!is_finite((float) $valor)) {
            throw new ValidacionException("El campo {$campo} debe ser un número finito.");
        }
    }
}
