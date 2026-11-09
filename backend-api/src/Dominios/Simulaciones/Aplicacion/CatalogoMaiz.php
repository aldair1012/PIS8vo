<?php
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Aplicacion;

/** Compara referencias publicadas. No estima cosechas ni modifica parcelas. */
final class CatalogoMaiz
{
    private array $catalogo;

    public function __construct(?array $catalogo = null)
    {
        $this->catalogo = $catalogo ?? json_decode(
            (string) file_get_contents(__DIR__ . '/../../../../data/referencias/catalogo-maiz-ecuador.json'),
            true, 512, JSON_THROW_ON_ERROR
        );
    }

    public function buscar(string $nombre): ?array
    {
        $key = $this->normalizar($nombre);
        foreach ($this->catalogo['variedades'] as $ficha) {
            foreach ([$ficha['nombre'], ...$ficha['alias']] as $alias) {
                if ($key !== '' && $key === $this->normalizar($alias)) return $ficha;
            }
        }
        return null;
    }

    public function nombreModelo(string $nombre): ?string
    {
        return $this->buscar($nombre)['nombre_en_modelo'] ?? null;
    }

    public function evaluar(array $parcela, array $parametros = []): array
    {
        $objetivo = $parametros['objetivo'] ?? 'grano_seco';
        if (!array_key_exists($objetivo, $this->catalogo['usos'])) {
            throw new \InvalidArgumentException('Objetivo de cosecha no reconocido.');
        }
        $actual = $this->buscar((string) ($parcela['variedad_maiz'] ?? ''));
        $altitud = $this->numero($parcela['altitud'] ?? null);
        $ph = $this->numero($parametros['ph_suelo'] ?? $parcela['ph'] ?? null);
        $provincia = \ZeaSys\Dominios\Terreno\Aplicacion\ProvinciaParcela::resolver($parcela)['provincia'] ?? $this->provincia((string) ($parcela['ubicacion'] ?? ''));
        $contexto = ['altitud_registrada_m' => $altitud, 'ph_ingresado' => $ph, 'provincia_reconocida' => $provincia, 'region_reconocida' => $this->region($provincia)];
        $evaluacionActual = $actual ? $this->comparar($actual, $contexto, $objetivo) : null;
        $alternativas = [];
        foreach ($this->catalogo['variedades'] as $ficha) {
            if (($ficha['id'] ?? null) === ($actual['id'] ?? null)) continue;
            // Los tres grupos son los del formulario legado, no una taxonomía agronómica.
            if ($ficha['grupo_formulario'] !== ($parcela['tipo_maiz'] ?? '')) continue;
            $evaluacion = $this->comparar($ficha, $contexto, $objetivo);
            if ($evaluacion['coincidencias'] > 0 && !$evaluacion['fuera_referencia'] && $evaluacion['uso_documentado']) {
                $alternativas[] = $evaluacion;
            }
        }
        usort($alternativas, static fn (array $a, array $b): int =>
            $b['coincidencias'] <=> $a['coincidencias'] ?: strcmp($a['nombre'], $b['nombre'])
        );
        return [
            'version_catalogo' => $this->catalogo['version'],
            'objetivo' => $objetivo,
            'objetivo_etiqueta' => $this->catalogo['usos'][$objetivo],
            'contexto' => $contexto,
            'variedad_registrada' => (string) ($parcela['variedad_maiz'] ?? ''),
            'actual' => $evaluacionActual,
            'alternativas' => array_slice($alternativas, 0, 6),
            'total_alternativas_con_coincidencias' => count($alternativas),
            'materiales_catalogados' => count($this->catalogo['variedades']),
            'criterio_catalogo' => $this->catalogo['seleccion']['criterio'],
            'nota' => 'Coincidencias parciales con referencias publicadas; no es un ranking de rendimiento ni una garantía de adaptación. Las alternativas son para planificar otra siembra. La variedad registrada se conserva.',
            'limites' => [
                'Solo se comparan altitud registrada, referencias territoriales y, cuando existe, una guía general de pH para maíz de altura.',
                'Temperatura actual, lluvia del ciclo y humedad no se convierten en requisitos climáticos propios de una variedad.',
                'La simulación de rendimiento actual sigue siendo de grano; esta consulta puede mostrar otros usos sin convertir las toneladas de grano en choclo o forraje.',
            ],
        ];
    }

    private function comparar(array $ficha, array $contexto, string $objetivo): array
    {
        $checks = [];
        $matches = 0;
        $outside = false;
        $range = $ficha['altitud_documentada_m'];
        if ($range !== null) {
            $value = $contexto['altitud_registrada_m'];
            $inside = $value !== null && $value >= $range['min'] && $value <= $range['max'];
            $outside = $value !== null && !$inside;
            if ($inside) $matches++;
            $checks[] = ['criterio' => 'Altitud', 'estado' => $value === null ? 'sin_dato_parcela' : ($inside ? 'coincide' : 'fuera_referencia'),
                'detalle' => $range['min'] . '–' . $range['max'] . ' m según la referencia; no es un límite fisiológico absoluto.'];
        }
        if ($ficha['provincias_documentadas'] !== []) {
            $province = $contexto['provincia_reconocida'];
            $same = $province !== null && in_array($this->normalizar($province), array_map($this->normalizar(...), $ficha['provincias_documentadas']), true);
            if ($same) $matches++;
            $checks[] = ['criterio' => 'Referencia territorial', 'estado' => $province === null ? 'sin_dato_parcela' : ($same ? 'coincide' : 'sin_referencia_provincial'),
                'detalle' => implode(', ', $ficha['provincias_documentadas']) . '. La referencia provincial no describe todas sus parcelas.'];
        } elseif ($ficha['regiones_documentadas'] !== []) {
            $region = $contexto['region_reconocida'];
            $same = $region !== null && in_array($region, $ficha['regiones_documentadas'], true);
            if ($same) $matches++;
            $checks[] = ['criterio' => 'Zona general', 'estado' => $region === null ? 'sin_dato_parcela' : ($same ? 'coincide' : 'sin_referencia_provincial'),
                'detalle' => implode(', ', $ficha['regiones_documentadas']) . '. Es una referencia regional amplia; requiere comprobar el sitio y su manejo.'];
        }
        // Una provincia fuera de la lista significa falta de evidencia, no fracaso del cultivo.
        $uses = $ficha['usos_documentados'];
        $documented = in_array($objetivo, $uses, true);
        $checks[] = ['criterio' => 'Uso de cosecha', 'estado' => $documented ? 'documentado' : 'sin_referencia',
            'detalle' => $documented ? $this->catalogo['usos'][$objetivo] : 'Falta una referencia específica para este uso en la ficha consultada.'];
        $general = null;
        if (in_array('Sierra', $ficha['regiones_documentadas'], true)) {
            $general = $this->catalogo['guias_generales'][0];
            $ph = $contexto['ph_ingresado'];
            $phRange = $general['ph_referencia'];
            $checks[] = ['criterio' => 'pH: guía general de maíz de altura',
                'estado' => $ph === null ? 'sin_dato_parcela' : (($ph >= $phRange['min'] && $ph <= $phRange['max']) ? 'referencia_general_coincide' : 'fuera_guia_general'),
                'detalle' => $phRange['min'] . '–' . $phRange['max'] . '. No es un óptimo específico del cultivar y no determina la selección.'];
        }
        $sources = [];
        foreach ([...$ficha['fuentes'], ...($ficha['fuentes_por_uso'][$objetivo] ?? [])] as $source) {
            $sources[] = [...$this->catalogo['fuentes'][$source['id']], ...$source];
        }
        if ($general !== null) {
            $source = $general['fuente'];
            $sources[] = [...$this->catalogo['fuentes'][$source['id']], ...$source, 'alcance' => $general['alcance']];
        }
        return [
            'id' => $ficha['id'], 'nombre' => $ficha['nombre'],
            'tipo_grano_documentado' => $ficha['tipo_grano_documentado'],
            'categorias_consumo' => array_map(fn (string $id): string => $this->catalogo['categorias_consumo'][$id], $ficha['categorias_consumo']),
            'estado' => $outside ? 'fuera_intervalo_documentado' : ($matches > 0 ? 'coincidencias_parciales' : 'informacion_insuficiente'),
            'coincidencias' => $matches, 'fuera_referencia' => $outside, 'uso_documentado' => $documented,
            'criterios' => $checks, 'cosecha_orientativa_dias' => $ficha['cosecha_orientativa_dias'][$objetivo] ?? null,
            'manejo_referencial' => $ficha['manejo_referencial'], 'notas' => $ficha['notas'], 'fuentes' => $sources,
            'soporte_modelo' => ['nombre_en_modelo' => $ficha['nombre_en_modelo'],
                'estado' => $ficha['nombre_en_modelo'] === null ? 'sin_etiqueta_especifica' : 'etiqueta_presente_sin_validacion_por_variedad',
                'nota' => ($ficha['simulacion_grano_habilitada'] ?? true) === false ? 'Ficha de consulta. La simulación específica está deshabilitada hasta corregir y validar el soporte del modelo para este material.' : ($ficha['nombre_en_modelo'] === null ? 'El modelo actual utiliza una referencia general para este material; la ficha no agrega datos de entrenamiento.' : 'El nombre existe en el modelo actual. Su precisión agrícola por variedad todavía requiere cosechas verificadas.')],
        ];
    }

    private function provincia(string $ubicacion): ?string
    {
        $names = ['Santo Domingo de los Tsáchilas','Zamora Chinchipe','Morona Santiago','Santa Elena','Los Ríos','Esmeraldas','Manabí','Guayas','El Oro','Carchi','Imbabura','Pichincha','Cotopaxi','Tungurahua','Bolívar','Chimborazo','Cañar','Azuay','Loja','Sucumbíos','Napo','Orellana','Pastaza','Galápagos'];
        $text = ' ' . $this->palabras($ubicacion) . ' ';
        foreach ($names as $name) if (str_contains($text, ' ' . $this->palabras($name) . ' ')) return $name;
        return null;
    }

    private function numero(mixed $value): ?float
    {
        if ($value === null || is_bool($value) || !is_scalar($value) || trim((string) $value) === '') return null;
        $value = str_replace(',', '.', trim((string) $value));
        return is_numeric($value) && is_finite((float) $value) ? (float) $value : null;
    }

    private function region(?string $provincia): ?string
    {
        if ($provincia === null) return null;
        if (in_array($provincia, ['Esmeraldas','Manabí','Guayas','Santa Elena','Los Ríos','El Oro','Santo Domingo de los Tsáchilas'], true)) return 'Costa';
        if (in_array($provincia, ['Carchi','Imbabura','Pichincha','Cotopaxi','Tungurahua','Bolívar','Chimborazo','Cañar','Azuay','Loja'], true)) return 'Sierra';
        if (in_array($provincia, ['Sucumbíos','Napo','Orellana','Pastaza','Morona Santiago','Zamora Chinchipe'], true)) return 'Amazonía';
        return null;
    }

    private function normalizar(string $value): string { return str_replace(' ', '', $this->palabras($value)); }
    private function palabras(string $value): string
    {
        $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', mb_strtolower(trim($value), 'UTF-8'));
        return trim((string) preg_replace('/[^a-z0-9]+/', ' ', $ascii !== false ? $ascii : strtolower($value)));
    }
}
