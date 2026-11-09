<?php
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Dominio;

use ZeaSys\Kernel\Errores\ValidacionException;

/** Valida el contexto recibido antes de consultar repositorios o construir prosa. */
final class EntradaExplicacion
{
    public static function validar(array $datos): array
    {
        foreach (['nombre', 'titulo', 'estado', 'nivel', 'unidad', 'tipo_elemento', 'rango_ideal', 'descripcion_tecnica', 'impacto_base', 'recomendacion_base', 'fuente', 'source', 'fecha', 'fecha_medicion', 'periodo_precipitacion', 'alerta_clave', 'alerta', 'confianza_tipo', 'principal_nombre', 'tipo_suelo'] as $campo) {
            if (!array_key_exists($campo, $datos) || $datos[$campo] === null) continue;
            if (!is_string($datos[$campo]) || mb_strlen($datos[$campo]) > 5000) throw new ValidacionException("El campo {$campo} debe ser texto de hasta 5000 caracteres.");
            $datos[$campo] = trim($datos[$campo]);
        }
        if (array_key_exists('valor', $datos)) $datos['valor'] = self::valor($datos['valor'], 'valor');
        $numericos = ['ph_suelo', 'fertilizante', 'temperatura', 'precipitacion', 'precipitacion_ciclo_mm', 'humedad', 'area_ha', 'area_simulada', 'rendimiento_estimado', 'rend_predicho', 'potencial_max', 'loss_n', 'loss_water', 'loss_ph', 'loss_temp', 'principal_perdida', 'perdida_dolares_ha', 'grano_seco_kg', 'biomasa_seca_kg'];
        foreach (CatalogoIndicadores::todos() as $fila) {
            foreach ($fila[1] as $campo) {
                if ($fila[3] === 'numero') $numericos[] = $campo;
                elseif (array_key_exists($campo, $datos)) {
                    if ($datos[$campo] !== null && !is_string($datos[$campo])) throw new ValidacionException("El campo {$campo} debe ser texto.");
                    $datos[$campo] = self::valor($datos[$campo], $campo);
                }
            }
        }
        foreach (array_unique($numericos) as $campo) {
            if (array_key_exists($campo, $datos)) $datos[$campo] = self::numero($datos[$campo], $campo);
        }
        foreach (['cultivo_id' => [1, PHP_INT_MAX], 'año' => [2000, 2100]] as $campo => [$min, $max]) {
            if (!isset($datos[$campo]) || $datos[$campo] === '') { $datos[$campo] = null; continue; }
            $numero = filter_var($datos[$campo], FILTER_VALIDATE_INT);
            if (is_bool($datos[$campo]) || $numero === false || $numero < $min || $numero > $max) throw new ValidacionException("El campo {$campo} no es válido.");
            $datos[$campo] = $numero;
        }
        foreach (['datos_grafico', 'explicacion_modelo', 'impactos_modelo_shap', 'intervalo_rendimiento', 'trazabilidad'] as $campo) {
            if (!array_key_exists($campo, $datos) || $datos[$campo] === null) continue;
            if (!is_array($datos[$campo])) throw new ValidacionException("El campo {$campo} debe ser un objeto o una lista JSON.");
            $nodos = 0;
            self::arbol($datos[$campo], $campo, 0, $nodos);
        }
        if (isset($datos['explicacion_modelo'])) {
            $modelo = $datos['explicacion_modelo'];
            foreach (['base', 'prediccion_sin_recorte'] as $campo) if (array_key_exists($campo, $modelo)) $modelo[$campo] = self::numero($modelo[$campo], 'explicacion_modelo.' . $campo);
            if (isset($modelo['aportes'])) {
                if (!is_array($modelo['aportes'])) throw new ValidacionException('El campo explicacion_modelo.aportes debe ser un objeto.');
                foreach ($modelo['aportes'] as $clave => $aporte) $modelo['aportes'][$clave] = self::numero($aporte, 'explicacion_modelo.aportes.' . $clave);
            }
            if (isset($modelo['recortada']) && !is_bool($modelo['recortada'])) throw new ValidacionException('El campo explicacion_modelo.recortada debe ser booleano.');
            $datos['explicacion_modelo'] = $modelo;
        }
        if (isset($datos['impactos_modelo_shap'])) foreach ($datos['impactos_modelo_shap'] as $clave => $aporte) $datos['impactos_modelo_shap'][$clave] = self::numero($aporte, 'impactos_modelo_shap.' . $clave);
        if (isset($datos['intervalo_rendimiento'])) {
            foreach (['min', 'max'] as $campo) if (array_key_exists($campo, $datos['intervalo_rendimiento'])) $datos['intervalo_rendimiento'][$campo] = self::numero($datos['intervalo_rendimiento'][$campo], 'intervalo_rendimiento.' . $campo);
            if (isset($datos['intervalo_rendimiento']['min'], $datos['intervalo_rendimiento']['max']) && $datos['intervalo_rendimiento']['min'] > $datos['intervalo_rendimiento']['max']) throw new ValidacionException('El intervalo de rendimiento tiene límites invertidos.');
        }
        return $datos;
    }

    public static function numero(mixed $valor, string $campo): ?float
    {
        if ($valor === null || $valor === '') return null;
        if ((!is_int($valor) && !is_float($valor) && !(is_string($valor) && is_numeric(trim($valor)))) || !is_finite((float) $valor)) throw new ValidacionException("El campo {$campo} debe ser un número finito.");
        return (float) $valor;
    }

    public static function valor(mixed $valor, string $campo): string|int|float|null
    {
        if ($valor === null) return null;
        if (is_int($valor) || is_float($valor)) {
            if (!is_finite((float) $valor)) throw new ValidacionException("El campo {$campo} debe ser finito.");
            return $valor;
        }
        if (!is_string($valor) || mb_strlen($valor) > 5000) throw new ValidacionException("El campo {$campo} debe ser texto o un número finito.");
        return trim($valor);
    }

    private static function arbol(array $datos, string $campo, int $profundidad, int &$nodos): void
    {
        if ($profundidad > 8) throw new ValidacionException("El campo {$campo} supera la profundidad admitida.");
        foreach ($datos as $clave => $valor) {
            if (++$nodos > 5000) throw new ValidacionException("El campo {$campo} contiene demasiados elementos.");
            if (is_array($valor)) self::arbol($valor, $campo . '.' . $clave, $profundidad + 1, $nodos);
            elseif (is_object($valor) || is_resource($valor) || (is_float($valor) && !is_finite($valor))) throw new ValidacionException("El campo {$campo} contiene un valor inválido.");
        }
    }
}
