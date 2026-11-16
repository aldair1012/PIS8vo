<?php
declare(strict_types=1);

namespace ZeaSys\Dominios\Analitica\Aplicacion;

use ZeaSys\Dominios\Simulaciones\Aplicacion\CatalogoMaiz;

/** Referencias institucionales curadas. No pronostica clima, brotes ni rendimiento. */
final class GuiaCalendarioAgricola
{
    private array $datos;
    public function __construct(?array $datos = null, private ?CatalogoMaiz $variedades = null)
    {
        $this->datos = $datos ?? json_decode((string) file_get_contents(__DIR__.'/../../../../data/referencias/calendario-agricola-ecuador.json'), true, 512, JSON_THROW_ON_ERROR);
        $this->variedades ??= new CatalogoMaiz();
    }

    public function paraParcela(array $parcela): array
    {
        $provincia = $parcela['provincia'] ?? null;
        $ficha = $this->variedades->buscar((string) ($parcela['variedad_maiz'] ?? ''));
        $sierra = ['Carchi','Imbabura','Pichincha','Cotopaxi','Tungurahua','Chimborazo','Bolívar','Cañar','Azuay','Loja'];
        $costa = ['Guayas','Los Ríos','Manabí','El Oro','Santa Elena','Loja'];
        // La familia depende de la ficha, no del grupo legado del formulario (canguil está en «Duro»).
        $familia = $ficha === null ? null : (in_array('Sierra', $ficha['regiones_documentadas'], true) ? 'sierra' : 'duro');
        if ($ficha === null) {
            // Sólo los dos grupos inequívocos admiten una guía general. El grupo mixto legado
            // «Duro Amarillo / Blanco» no permite decidir entre canguil de altura y maíz de Costa.
            $familia = match ($parcela['tipo_maiz'] ?? null) {
                'Suave Harinoso' => 'sierra',
                'Duro Amarillo' => str_contains(mb_strtolower((string) ($parcela['variedad_maiz'] ?? ''), 'UTF-8'), 'canguil') ? null : 'duro',
                default => null,
            };
        }
        $territorio = $familia !== null && in_array($provincia, $familia === 'sierra' ? $sierra : $costa, true);
        $altitud = isset($parcela['altitud']) && is_numeric($parcela['altitud']) ? (float) $parcela['altitud'] : null;
        $rango = $ficha['altitud_documentada_m'] ?? null;
        $fueraAltitud = $altitud !== null && is_array($rango) && ($altitud < $rango['min'] || $altitud > $rango['max']);
        $avisos = [];
        if ($ficha === null) $avisos[] = $familia === null
            ? 'No hay una ficha verificada para el nombre de maíz registrado. Revisa la variedad de la parcela.'
            : 'La variedad no tiene una ficha identificada. Mostramos sólo la guía general del tipo de maíz que registraste; confirma la variedad antes de decidir.';
        if (!$territorio && $familia !== null) $avisos[] = 'No tenemos una ventana publicada que corresponda a esta combinación de maíz y provincia.';
        if ($fueraAltitud) $avisos[] = 'La altitud registrada queda fuera del intervalo documentado de esta variedad. Confirma su adaptación con asistencia agrícola local.';
        $cubre = $territorio && !$fueraAltitud;
        $ventana = $cubre ? ($this->datos['ventanas'][$familia.':'.$provincia] ?? $this->datos['ventanas'][$familia]) : null;
        $sanidad = $territorio ? ($this->datos['sanidad'][$familia.':'.$provincia] ?? null) : null;
        $suelo = $familia !== null ? $this->datos['suelo'][$familia] : null;
        $ids = ['agrocalidad_vigilancia'];
        foreach ([$ventana,$sanidad,$suelo] as $dato) if ($dato !== null) {
            $ids[] = $dato['fuente_id'];
            if (isset($dato['fuente_complementaria_id'])) $ids[] = $dato['fuente_complementaria_id'];
        }
        $fuentes = [];
        foreach (array_unique($ids) as $id) $fuentes[$id] = $this->datos['fuentes'][$id];
        return [
            'version' => $this->datos['version'], 'estado' => $cubre ? 'referencia_disponible' : 'sin_ventana_verificada',
            'provincia' => $provincia, 'variedad' => $ficha['nombre'] ?? ($parcela['variedad_maiz'] ?? null),
            'familia' => $familia, 'alcance' => $familia === 'sierra' ? 'Guía general de maíz de altura' : ($familia === 'duro' ? 'Guía general de maíz duro' : 'Variedad por identificar'),
            'ventana' => $ventana, 'suelo' => $suelo, 'sanidad' => $sanidad, 'avisos' => $avisos,
            'riego' => [
                'registrado' => $parcela['riego_tipo'] ?? null,
                'nota' => $familia === 'sierra'
                    ? 'INIAP contempla otras épocas con riego para cosechar en choclo. Esta condición no se extiende automáticamente al grano seco o al canguil.'
                    : 'El agua disponible y el inicio de las lluvias deben confirmarse antes de escoger el día de siembra.',
            ],
            'vigilancia_actual' => ['estado' => 'sin_reporte_verificado_por_parcela','nota' => 'No hay un reporte actual integrado para esta parcela. Los antecedentes provinciales no confirman una plaga o enfermedad activa.'],
            'fuentes' => $fuentes, 'limites' => $this->datos['limites'],
        ];
    }
}
