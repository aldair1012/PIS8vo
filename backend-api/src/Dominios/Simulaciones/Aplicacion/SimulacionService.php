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
use ZeaSys\Dominios\Terreno\Aplicacion\ProvinciaParcela;
use ZeaSys\Dominios\Terreno\Aplicacion\ServicioDatosTerreno;
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
            'nombre'        => $this->texto($data['nombre'] ?? 'Simulación ' . date('d/m/Y H:i'), 'nombre'),
            'modelo_usado'  => $this->texto($data['modelo_usado'] ?? 'xgboost', 'modelo_usado', false),
            'temperatura'   => isset($data['temperatura']) ? floatval($data['temperatura']) : 0.0,
            'humedad'       => isset($data['humedad']) ? floatval($data['humedad']) : 0.0,
            'precipitacion' => isset($data['precipitacion']) ? floatval($data['precipitacion']) : 0.0,
            'fertilizante'  => isset($data['fertilizante']) ? floatval($data['fertilizante']) : 0.0,
            'ph_suelo'      => isset($data['ph_suelo']) ? floatval($data['ph_suelo']) : 0.0,
            'tipo_suelo'    => $this->texto($data['tipo_suelo'] ?? 'franco', 'tipo_suelo', false),
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
        $provincia = ProvinciaParcela::resolver($c);
        $datos['provincia_identificada'] = $provincia['provincia'];
        $datos['fuente_provincia'] = $provincia['fuente'];
        $datos = [...$datos, ...EntradasCampo::normalizar($data, $c)];
        if (array_key_exists('usar_suelo_ubicacion', $data) && !is_bool($data['usar_suelo_ubicacion'])) {
            throw new ValidacionException('La selección de suelo por ubicación debe ser un booleano.');
        }
        if (($data['usar_suelo_ubicacion'] ?? false) === true && $datos['latitud'] !== null && $datos['longitud'] !== null) {
            try { $referencia = $this->cache->obtener(ServicioDatosTerreno::claveCache((float)$datos['latitud'],(float)$datos['longitud'])); }
            catch (\Throwable) { $referencia = null; }
            $muestras = [];
            foreach (['clay'=>'textura_arcilla_pct','sand'=>'textura_arena_pct','silt'=>'textura_limo_pct','materia_organica'=>'materia_organica_pct'] as $key=>$feature) {
                if (in_array($key,$referencia['suelo_campos_api'] ?? [],true) && is_numeric($referencia['suelo'][$key] ?? null)) $muestras[$feature]=(float)$referencia['suelo'][$key];
            }
            $fractions=['textura_arcilla_pct','textura_arena_pct','textura_limo_pct'];
            if (count(array_intersect(array_keys($muestras),$fractions))!==3) foreach ($fractions as $key) unset($muestras[$key]);
            if ($muestras !== []) $datos['suelo_ubicacion']=$muestras;
            else $datos['aviso_suelo_ubicacion']='No se recuperaron propiedades del mapa de suelo para esta ejecución. Revisa las referencias utilizadas o vuelve a consultar los datos de ubicación.';
        }

        if (array_key_exists('precipitacion_ciclo_mm', $data)) {
            $this->validarNumero($data['precipitacion_ciclo_mm'], 'precipitacion_ciclo_mm');
            $lluviaCiclo = (float) $data['precipitacion_ciclo_mm'];
            if ($lluviaCiclo < 0 || $lluviaCiclo > 4000) {
                throw new ValidacionException('La precipitación del ciclo debe estar entre 0 y 4000 mm.');
            }
            $datos['precipitacion_ciclo_mm'] = $lluviaCiclo;
            $datos['precipitacion'] = $lluviaCiclo;
        }

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

        if ($datos['area_simulada'] < 0.01) {
            throw new ValidacionException('El área simulada debe ser al menos 0.01 ha.');
        }
        if ($datos['area_simulada'] > (float) ($c['area'] ?? 0)) {
            throw new ValidacionException('El área simulada no puede superar el área registrada de la parcela.');
        }

        if ($datos['modelo_usado'] !== 'xgboost') {
            throw new ValidacionException('El único modelo de simulación disponible es XGBoost.');
        }

        $tiposSuelo = json_decode((string)file_get_contents(__DIR__.'/../../../../data/referencias/tipos-suelo.json'),true,512,JSON_THROW_ON_ERROR);
        if (!array_key_exists($datos['tipo_suelo'], $tiposSuelo)) {
            throw new ValidacionException('El tipo de suelo no es válido.');
        }

        if ($datos['nombre'] === '' || mb_strlen($datos['nombre']) > 200) {
            throw new ValidacionException('El nombre de la simulación debe contener entre 1 y 200 caracteres.');
        }

        $catalogo = new CatalogoMaiz();
        $ficha = $catalogo->buscar($datos['variedad_maiz']);
        if (($ficha['simulacion_grano_habilitada'] ?? true) === false) {
            throw new ValidacionException('Esta variedad tiene ficha de consulta, pero aún no tiene un modelo de rendimiento compatible y validado para su uso. Puedes revisar sus referencias en Consultar variedades.');
        }
        // Asegurar que el servidor esté activo solo tras validar las entradas.
        $iaStatus = $this->motorIa->asegurarActivo();
        if (!$iaStatus['running']) {
            throw new ZeaSysException('El motor de simulación está inactivo: ' . $iaStatus['mensaje'], 503);
        }
        $entradasMotor = $datos;
        if ($provincia['provincia'] !== null) $entradasMotor['ubicacion'] = $provincia['provincia'].', Ecuador';
        // Homologar únicamente alias documentados de la misma variedad.
        // El nombre guardado de la parcela permanece intacto.
        $nombreModelo = $catalogo->nombreModelo($datos['variedad_maiz']);
        if ($nombreModelo !== null) $entradasMotor['variedad_maiz'] = $nombreModelo;
        $resultado = $this->motor->predecir($entradasMotor);

        if (!isset($resultado['success']) || !$resultado['success']) {
            throw new ServicioExternoException($resultado['error'] ?? 'Error al comunicarse con el motor de simulación.');
        }

        if ((!empty($datos['parametros_campo']) || !empty($datos['incluir_historico'])) && ($resultado['trazabilidad']['contrato_campo'] ?? null) !== '1.0') {
            throw new ServicioExternoException('El motor abierto usa una versión anterior que no procesa los nuevos datos de campo. Reinicia el motor de ZeaSys y vuelve a simular; esta ejecución no se ha guardado.');
        }
        if (!empty($datos['suelo_ubicacion']) && ($resultado['trazabilidad']['suelo_ubicacion_utilizado'] ?? false) !== true) {
            throw new ServicioExternoException('Reinicia el motor de ZeaSys para activar los datos de suelo por ubicación. La ejecución no se ha guardado porque el proceso anterior no los utilizó.');
        }
        $resultado['trazabilidad']['origen_fecha_siembra'] = $datos['origen_fecha_siembra'] ?? 'Sin fecha registrada';
        if (isset($datos['aviso_suelo_ubicacion'])) $resultado['trazabilidad']['advertencias'][]=$datos['aviso_suelo_ubicacion'];
        $resultado['trazabilidad']['provincia_identificada'] = $provincia;
        if ($provincia['provincia'] !== null && ($resultado['entradas_modelo']['provincia'] ?? null) === $provincia['provincia']) {
            $resultado['trazabilidad']['fuentes']['provincia'] = $provincia['fuente'];
        }
        elseif ($provincia['provincia'] !== null) {
            $resultado['trazabilidad']['advertencias'] = array_values(array_filter($resultado['trazabilidad']['advertencias'] ?? [], static fn($warning): bool => !str_starts_with((string)$warning,'Provincia no identificada')));
            $resultado['trazabilidad']['advertencias'][] = 'La provincia de la parcela es '.$provincia['provincia'].', pero el modelo utiliza otra categoría geográfica de referencia. No hay respaldo específico confirmado para esa provincia.';
        }

        $resultado['evaluacion_variedades'] = $catalogo->evaluar($c, ['ph_suelo' => $datos['ph_suelo']]);
        $utilizada = $resultado['entradas_modelo']['variedad'] ?? null;
        $resultado['trazabilidad']['variedad_simulada'] = [
            'registrada' => $datos['variedad_maiz'], 'enviada_al_motor' => $entradasMotor['variedad_maiz'],
            'utilizada_por_modelo' => $utilizada,
            'estado' => $utilizada === null ? 'sin_trazabilidad_del_motor' : ($nombreModelo !== null && $utilizada === $nombreModelo ? 'etiqueta_documentada' : 'referencia_general'),
            'nota' => 'Añadir una ficha al catálogo no entrena al modelo para esa variedad ni acredita precisión agrícola.',
        ];

        try {
            $id = $this->simulaciones->guardar($datos, $resultado);
            $resultado['simulacion_id'] = $id;

            return [
                'exito' => true,
                'mensaje' => 'Simulación completada exitosamente.',
                'resultado' => $resultado
            ];
        } catch (\Exception $e) {
            // paridad: legacy catch(Exception) → 500 con mensaje concatenado exacto.
            throw new ZeaSysException('Error al guardar la simulación: ' . $e->getMessage(), 500);
        }
    }

    public function evaluarVariedades(int $usuarioId, Peticion $p): array
    {
        $data = $p->cuerpo();
        $id = $data['cultivo_id'] ?? null;
        if (is_bool($id) || filter_var($id, FILTER_VALIDATE_INT) === false || (int) $id < 1) {
            throw new ValidacionException('Selecciona una parcela registrada.');
        }
        $cultivo = $this->cultivos->obtenerPorId((int) $id);
        if (!$cultivo || (int) $cultivo['usuario_id'] !== $usuarioId) {
            throw new AccesoDenegadoException('La parcela seleccionada es inválida o no le pertenece.');
        }
        $objetivo = $data['objetivo'] ?? 'grano_seco';
        if (!is_string($objetivo) || !in_array($objetivo, ['grano_seco','choclo','forraje','tostado','canguil'], true)) {
            throw new ValidacionException('Selecciona un objetivo de cosecha válido.');
        }
        $parametros = ['objetivo' => $objetivo];
        if (array_key_exists('ph_suelo', $data) && $data['ph_suelo'] !== null && $data['ph_suelo'] !== '') {
            $this->validarNumero($data['ph_suelo'], 'ph_suelo');
            if ((float) $data['ph_suelo'] < 3 || (float) $data['ph_suelo'] > 11) {
                throw new ValidacionException('El pH debe estar entre 3 y 11.');
            }
            $parametros['ph_suelo'] = (float) $data['ph_suelo'];
        }
        return ['exito' => true, 'evaluacion' => (new CatalogoMaiz())->evaluar($cultivo, $parametros)];
    }

    /** historial() 166–181 (limpiarCacheExpirada() → CacheInterface::limpiarExpirados()). */
    public function historial(int $usuarioId, Peticion $p): array
    {
        $this->cache->limpiarExpirados();

        $añoConsulta = $p->query('año');
        $year = null;
        if (isset($añoConsulta) && $añoConsulta !== '') {
            if (filter_var($añoConsulta, FILTER_VALIDATE_INT) === false) {
                throw new ValidacionException('El año consultado no es válido.');
            }
            $year = (int) $añoConsulta;
            if ($year < 2000 || $year > 2100) {
                throw new ValidacionException('El año consultado debe estar entre 2000 y 2100.');
            }
        }
        $estadisticas = $this->simulaciones->obtenerEstadisticas($usuarioId, $year);
        $porPagina = $p->queryEntero('por_pagina', 100, 1, 100);
        $paginaSolicitada = $p->queryEntero('pagina', 1, 1, 1000000);
        $total = (int) ($estadisticas['total_simulaciones'] ?? 0);
        $paginas = max(1, (int) ceil($total / $porPagina));
        $pagina = min($paginaSolicitada, $paginas);
        $simulaciones = $this->simulaciones->obtenerPorUsuario($usuarioId, $porPagina, $year, ($pagina - 1) * $porPagina);

        return [
            'simulaciones' => $simulaciones,
            'estadisticas' => $estadisticas,
            'años_disponibles' => $this->simulaciones->obtenerAniosPorUsuario($usuarioId),
            'paginacion' => ['pagina' => $pagina, 'por_pagina' => $porPagina, 'total' => $total, 'paginas' => $paginas],
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
            return ['exito' => true, 'mensaje' => 'Simulación eliminada correctamente.'];
        } catch (\Exception $e) {
            // paridad: legacy catch(Exception) → 500 con mensaje concatenado exacto.
            throw new ZeaSysException('Error al eliminar la simulación: ' . $e->getMessage(), 500);
        }
    }

    /** estadoIA() 213–221 (el legacy también limpiaba el caché expirado antes de responder). */
    public function estadoIA(Peticion $p): array
    {
        $this->cache->limpiarExpirados();
        return $this->motorIa->estado(false);
    }

    /**
     * explicar() 223–929: validaciones 225–238 + delegación al catálogo Strategy.
     * El preprocesamiento (líneas 238–344) y la cadena if/elseif (354–911) viven en
     * ServicioExplicabilidad; el ensamblado final (913–929) es verbatim allí.
     * El contexto solo puede referenciar parcelas pertenecientes al usuario autenticado.
     */
    public function explicar(int $usuarioId, Peticion $p): array
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

    private function texto(mixed $valor, string $campo, bool $recortar = true): string
    {
        if (!is_string($valor)) {
            throw new ValidacionException("El campo {$campo} debe ser texto.");
        }
        return $recortar ? trim($valor) : $valor;
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
