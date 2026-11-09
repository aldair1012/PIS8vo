<?php
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Dominio;

use ZeaSys\Kernel\Errores\ValidacionException;

/** Formato común y análisis específico sobre valores aportados, sin completar mediciones. */
abstract class ExplicadorConEvidencia implements ExplicadorInterface
{
    protected const INDICADOR = 'Default';

    public function construir(array $contexto): array
    {
        $definicion = CatalogoIndicadores::obtener(static::INDICADOR);
        if ($definicion['tipo'] === 'grafico' || ($contexto['es_grafico'] ?? false)) return $this->grafico($contexto, $definicion);
        $evidencia = $this->evidencia($contexto, $definicion);
        if ($evidencia === null) return $this->ausente($contexto, $definicion);
        [$valor, $origen, $unidad] = $evidencia;
        $nombre = $contexto['nombre'] ?? $definicion['nombre'];
        $lectura = trim((string) $valor . ($unidad !== '' && !str_contains((string) $valor, $unidad) ? ' ' . $unidad : ''));
        $significado = "{$nombre}: {$lectura}. " . $definicion['definicion'];
        $detalle = "Origen: {$origen}. " . $definicion['limite'];
        $detalle .= $this->analisis($contexto, $valor);
        if (($contexto['entrada']['fuente'] ?? '') !== '') $detalle .= ' Fuente declarada por la tarjeta: ' . $contexto['entrada']['fuente'] . '.';
        if (($contexto['entrada']['fecha_medicion'] ?? $contexto['entrada']['fecha'] ?? '') !== '') $detalle .= ' Fecha declarada: ' . ($contexto['entrada']['fecha_medicion'] ?? $contexto['entrada']['fecha']) . '.';
        if (($contexto['rango_ideal'] ?? '') !== '') $detalle .= ' Referencia comunicada por la tarjeta: ' . $contexto['rango_ideal'] . '. Su aplicabilidad depende de la fuente y las condiciones.';
        return $this->secciones($significado, $detalle, $definicion['accion']);
    }

    private function evidencia(array $c, array $d): ?array
    {
        $entrada = $c['entrada'] ?? [];
        $unidad = $c['unidad'] ?? '';
        // La tarjeta es la lectura elegida por el usuario; incluso null impide rescatar otro periodo.
        if (array_key_exists('valor', $entrada)) return self::disponible($entrada['valor']) ? [$entrada['valor'], 'valor explícito de la tarjeta; no verificado como observación de campo', $unidad] : null;
        foreach ($d['campos'] as $campo) {
            if (array_key_exists($campo, $entrada)) return self::disponible($entrada[$campo]) ? [$entrada[$campo], 'contexto explícito de la tarjeta', $unidad !== '' ? $unidad : $d['unidad']] : null;
        }
        if (static::INDICADOR === 'RendimientoPredicho' && self::disponible($c['rend_predicho'] ?? null)) return [$c['rend_predicho'], $this->origenSimulacion($c), $unidad !== '' ? $unidad : 't/ha'];
        if (static::INDICADOR === 'YieldGap' && isset($c['potencial_max'], $c['rend_predicho'])) return [round($c['potencial_max'] - $c['rend_predicho'], 4), 'diferencia calculada entre la referencia explícita y el rendimiento del contexto', 't/ha'];
        if (static::INDICADOR === 'IndiceCosecha' && isset($entrada['grano_seco_kg'], $entrada['biomasa_seca_kg']) && $entrada['biomasa_seca_kg'] > 0 && $entrada['grano_seco_kg'] >= 0 && $entrada['grano_seco_kg'] <= $entrada['biomasa_seca_kg']) return [round($entrada['grano_seco_kg'] / $entrada['biomasa_seca_kg'], 4), 'cociente calculado desde las masas secas explícitas de la misma muestra declarada', ''];
        if (in_array(static::INDICADOR, ['PerdidaAgua', 'PerdidaNitrogeno', 'LimitantePrincipal'], true)) {
            $aportes = $this->aportes($c);
            if ($aportes !== []) {
                if (static::INDICADOR === 'LimitantePrincipal') {
                    $negativos = array_filter($aportes, static fn (float $v): bool => $v < 0);
                    if ($negativos === []) return ['No hay aportes negativos en la explicación suministrada', 'aportes SHAP del modelo; no diagnóstico de campo', ''];
                    asort($negativos);
                    return [array_key_first($negativos), 'variable con el aporte SHAP más negativo de la explicación suministrada', ''];
                }
                $clave = static::INDICADOR === 'PerdidaAgua' ? 'precipitacion' : 'fertilizante';
                if (array_key_exists($clave, $aportes)) return [$aportes[$clave], 'aporte SHAP firmado de ' . $clave . '; no pérdida medida ni ganancia recuperable', 't/ha'];
            }
        }
        return null;
    }

    private function analisis(array $c, mixed $valor): string
    {
        $texto = '';
        $n = (is_int($valor) || is_float($valor) || (is_string($valor) && is_numeric($valor))) ? (float) $valor : null;
        if ($n !== null) {
            if (static::INDICADOR === 'BeneficioCosto') $texto .= $n > 1 ? ' El cociente aportado supera la unidad: los ingresos considerados exceden los costos considerados.' : ($n === 1.0 ? ' El cociente aportado es igual a la unidad: ingresos y costos considerados se igualan.' : ' El cociente aportado es inferior a la unidad: los ingresos considerados no cubren los costos considerados.');
            if (in_array(static::INDICADOR, ['MargenNeto', 'GananciaPorDolar', 'ROI'], true)) $texto .= $n < 0 ? ' El resultado aportado es negativo bajo los supuestos del cálculo.' : ($n === 0.0 ? ' El resultado aportado es cero bajo los supuestos del cálculo.' : ' El resultado aportado es positivo bajo los supuestos del cálculo.');
            if (in_array(static::INDICADOR, ['PerdidaAgua', 'PerdidaNitrogeno'], true) && $n === 0.0) $texto .= ' El valor aportado es cero; no se añade una pérdida mínima.';
            if (static::INDICADOR === 'YieldGap' && $n < 0) $texto .= ' La diferencia aportada es negativa: el rendimiento supera la referencia usada, lo que requiere comprobar su comparabilidad.';
        }
        if (static::INDICADOR === 'RendimientoPredicho') {
            $rango = $c['intervalo_rendimiento'] ?? [];
            if (isset($rango['min'], $rango['max']) && is_numeric($rango['min']) && is_numeric($rango['max']) && is_finite((float) $rango['min']) && is_finite((float) $rango['max']) && $rango['min'] <= $rango['max']) $texto .= ' Rango comunicado por el modelo: ' . $rango['min'] . ' a ' . $rango['max'] . ' t/ha. Es orientativo; no constituye una garantía de cosecha.';
            $aportes = $this->aportes($c);
            if ($aportes !== []) {
                $negativos = array_filter($aportes, static fn (float $v): bool => $v < 0);
                asort($negativos);
                if ($negativos !== []) $texto .= ' Mayor aporte SHAP negativo suministrado: ' . array_key_first($negativos) . ' (' . reset($negativos) . ' t/ha); no demuestra una causa ni una pérdida recuperable.';
            }
        }
        if (static::INDICADOR === 'NivelConfianza') {
            $tipo = $c['entrada']['confianza_tipo'] ?? $c['metadatos_modelo']['confianza_tipo'] ?? null;
            if (is_string($tipo) && $tipo !== '') $texto .= ' Tipo de métrica comunicado: ' . $tipo . '.';
        }
        if (in_array(static::INDICADOR, ['PerdidaAgua', 'LluviaPromedio'], true)) $texto .= is_string($c['periodo_precipitacion'] ?? null) && $c['periodo_precipitacion'] !== '' ? ' Periodo de precipitación declarado: ' . $c['periodo_precipitacion'] . '; no se convierte a otro periodo.' : ' El periodo de precipitación no está documentado en este contexto.';
        return $texto;
    }

    private function grafico(array $c, array $d): array
    {
        $datos = $c['datos_grafico'] ?? null;
        $series = is_array($datos) ? $this->series($datos) : [];
        if (static::INDICADOR === 'Cascada' && $series === []) {
            $aportes = $this->aportes($c);
            if ($aportes !== []) $series = ['Aportes SHAP suministrados' => array_values($aportes)];
        }
        $series = array_filter($series, static fn (array $valores): bool => $valores !== []);
        if ($series === []) return $this->ausente($c, $d);
        $resumen = [];
        foreach (array_slice($series, 0, 8, true) as $nombre => $valores) $resumen[] = $nombre . ': ' . count($valores) . ' valores presentes, mínimo ' . min($valores) . ' y máximo ' . max($valores);
        $detalle = $d['limite'] . ' Se resume cada serie por separado, sin completar huecos ni combinar magnitudes diferentes.';
        if (static::INDICADOR === 'Sensibilidad' && isset($series['margen'])) {
            $negativos = count(array_filter($series['margen'], static fn (float $v): bool => $v < 0));
            $detalle .= ' Escenarios aportados con margen negativo: ' . $negativos . ' de ' . count($series['margen']) . '. Esta frecuencia descriptiva no es una probabilidad de pérdida.';
        }
        if (static::INDICADOR === 'DistribucionProbabilistica' && is_array($datos) && isset($datos['p10'], $datos['p50'], $datos['p90'])) {
            $p10 = EntradaExplicacion::numero($datos['p10'], 'datos_grafico.p10');
            $p50 = EntradaExplicacion::numero($datos['p50'], 'datos_grafico.p50');
            $p90 = EntradaExplicacion::numero($datos['p90'], 'datos_grafico.p90');
            if ($p10 > $p50 || $p50 > $p90) throw new ValidacionException('Los percentiles deben estar ordenados de menor a mayor.');
            $detalle .= " Percentiles comunicados: P10={$p10}, P50={$p50}, P90={$p90}. No se deducen escenarios no aportados.";
        }
        if (static::INDICADOR === 'Cascada') {
            $modelo = $c['explicacion_modelo'] ?? [];
            $aportes = $this->aportes($c);
            $base = $modelo['base'] ?? null;
            if ((is_int($base) || is_float($base)) && is_finite((float) $base) && $aportes !== []) {
                $reconstruccion = $base + array_sum($aportes);
                $detalle .= ' Base aportada: ' . $base . '; suma firmada de aportes: ' . round(array_sum($aportes), 6) . '; reconstrucción: ' . round($reconstruccion, 6) . ' t/ha.';
                if (($modelo['recortada'] ?? false) || (isset($c['rend_predicho']) && abs($reconstruccion - $c['rend_predicho']) > 0.01)) $detalle .= ' La reconstrucción no se presenta como una descomposición exacta de la predicción final: hay recorte o diferencia con el resultado suministrado.';
            }
        }
        return $this->secciones($d['definicion'] . ' ' . implode('; ', $resumen) . '.', $detalle, $d['accion']);
    }

    private function series(array $datos): array
    {
        $salida = [];
        $numeros = static function (array $valores, string $campo): array {
            $resultado = [];
            foreach ($valores as $valor) {
                if (is_array($valor)) {
                    if (array_key_exists('y', $valor)) $valor = $valor['y'];
                    else throw new ValidacionException("La serie {$campo} contiene un punto sin coordenada y.");
                }
                $n = EntradaExplicacion::numero($valor, 'datos_grafico.' . $campo);
                if ($n !== null) $resultado[] = $n;
            }
            return $resultado;
        };
        if (isset($datos['datasets'])) {
            if (!is_array($datos['datasets'])) throw new ValidacionException('El campo datos_grafico.datasets debe ser una lista.');
            foreach ($datos['datasets'] as $i => $serie) {
                if (!is_array($serie) || !is_array($serie['data'] ?? null)) throw new ValidacionException('Cada dataset debe contener una lista data.');
                $nombre = isset($serie['label']) ? EntradaExplicacion::valor($serie['label'], 'datos_grafico.datasets.label') : 'Serie ' . ($i + 1);
                $salida[(string) $nombre . ' [' . ($i + 1) . ']'] = $numeros($serie['data'], (string) $nombre);
            }
            return $salida;
        }
        if (array_is_list($datos)) {
            if ($datos === [] || !is_array($datos[0])) return ['Serie aportada' => $numeros($datos, 'valores')];
            foreach (['valor', 'amount', 'margen', 'roi', 'rendimiento', 'p10', 'p50', 'p90'] as $campo) {
                $valores = [];
                foreach ($datos as $fila) {
                    if (!is_array($fila)) throw new ValidacionException('El gráfico mezcla filas y valores incompatibles.');
                    if (array_key_exists($campo, $fila)) $valores[] = $fila[$campo];
                }
                if ($valores !== []) $salida[$campo] = $numeros($valores, $campo);
            }
            return $salida;
        }
        // Formatos de los dashboards: etiquetas y series paralelas, o percentiles explícitos.
        foreach ($datos as $nombre => $valores) {
            if (in_array($nombre, ['labels', 'etiquetas', 'fechas', 'unidad', 'fuente', 'metodo'], true)) continue;
            if (is_array($valores) && array_is_list($valores)) $salida[(string) $nombre] = $numeros($valores, (string) $nombre);
            elseif (in_array($nombre, ['p10', 'p50', 'p90'], true)) $salida[$nombre] = $numeros([$valores], $nombre);
        }
        return $salida;
    }

    private function aportes(array $c): array
    {
        $aportes = $c['entrada']['impactos_modelo_shap'] ?? $c['explicacion_modelo']['aportes'] ?? [];
        if (!is_array($aportes)) return [];
        $salida = [];
        foreach ($aportes as $clave => $valor) {
            if ((is_int($valor) || is_float($valor) || (is_string($valor) && is_numeric($valor))) && is_finite((float) $valor)) $salida[(string) $clave] = (float) $valor;
        }
        return $salida;
    }

    private function origenSimulacion(array $c): string
    {
        if (array_key_exists('rendimiento_estimado', $c['entrada'] ?? []) || array_key_exists('rend_predicho', $c['entrada'] ?? [])) return 'rendimiento explícito del contexto; no medición verificada';
        $fecha = $c['simulacion']['fecha'] ?? null;
        return 'estimación de la simulación seleccionada' . (is_string($fecha) ? ' (' . $fecha . ')' : '') . '; no medición de cosecha';
    }

    private function ausente(array $c, array $d): array
    {
        $periodo = isset($c['entrada']['año']) ? ' para el año ' . $c['entrada']['año'] : '';
        return $this->secciones('No hay un dato disponible de ' . $d['nombre'] . $periodo . '. ' . $d['definicion'], $d['limite'] . ' No se asignan valores, causas ni resultados económicos para completar la información ausente.', $d['accion'] . ' Aporta el dato y su fuente para obtener una interpretación cuantitativa.');
    }

    private function secciones(string $lectura, string $limites, string $seguimiento): array
    {
        return [
            ['titulo' => '1. Lectura del indicador', 'tipo' => 'info', 'contenido' => $lectura],
            ['titulo' => '2. Alcance y evidencia', 'tipo' => 'info', 'contenido' => $limites],
            ['titulo' => '3. Seguimiento', 'tipo' => 'info', 'contenido' => $seguimiento],
        ];
    }

    private static function disponible(mixed $valor): bool
    {
        if ($valor === null || is_bool($valor) || is_array($valor) || is_object($valor)) return false;
        if (is_int($valor) || is_float($valor)) return is_finite((float) $valor);
        if (!is_string($valor)) return false;
        $texto = mb_strtolower(trim($valor));
        if ($texto === '' || preg_match('/^(?:[—–-]|n\/?[ad]|null|nan|[+-]?inf(?:inity)?|sin datos|sin dato|no disponible|no calculable|pendiente)$/u', $texto)) return false;
        if (str_contains($texto, 'no calculable') || str_contains($texto, 'sin datos')) return false;
        if (is_numeric($texto) && !is_finite((float) $texto)) return false;
        return true;
    }
}
