<?php
// src/Dominios/Chat/Infraestructura/RouterChat.php — Clasificador semántico de intenciones para el chatbot.
declare(strict_types=1);

namespace ZeaSys\Dominios\Chat\Infraestructura;

use ZeaSys\Dominios\Chat\Dominio\RouterChatInterface;

final class RouterChat implements RouterChatInterface
{
    private ?\ZeaSys\Dominios\Chat\Dominio\MemoriaSesionInterface $memoria = null;

    public function __construct(?\ZeaSys\Dominios\Chat\Dominio\MemoriaSesionInterface $memoria = null)
    {
        $this->memoria = $memoria;
    }
    private const SINONIMOS = [
        'indicador' => ['indicador', 'indicadores', 'metrica', 'metricas', 'variable', 'variables', 'kpi', 'kpis',
            'rendimiento', 'rendimientos', 'yield', 'gap', 'yield gap', 'perdida', 'perdidas', 'potencial',
            'alcanzable', 'predicho', 'fertilizante', 'fertilizantes', 'nitrogeno', 'ph', 'suelo', 'temperatura',
            'precipitacion', 'humedad', 'agua', 'riesgo', 'estabilidad', 'probabilidad', 'cosecha',
            'que significa', 'que es', 'explica', 'explicame', 'interpretar', 'interpretacion', 'ayuda',
            'significado', 'concepto', 'definicion', 'valor', 'resultado', 'calculo', 'calcular', 'significa',
            'que quiere decir', 'que representa', 'como se calcula', 'por que', 'que pasa', 'porque',
            'mi', 'mis', 'tu', 'tus', 'mi ', 'mis ', 'tu ', 'tus '],
        'ubicacion' => ['ubicacion', 'ubicaciones', 'donde', 'coordenada', 'coordenadas', 'zona', 'zonas',
            'region', 'regiones', 'provincia', 'provincias', 'parcela', 'parcelas', 'lote', 'lotes',
            'latitud', 'longitud', 'altitud', 'mapa', 'mapas', 'sierra', 'costa', 'amazonia', 'terreno'],
        'clima' => ['clima', 'climas', 'tiempo', 'meteorologico', 'meteorologia', 'temperatura', 'temperaturas',
            'lluvia', 'lluvias', 'precipitacion', 'precipitaciones', 'humedad', 'humedades', 'enso', 'nino',
            'nina', 'sequia', 'sequias', 'anomalia', 'anomalias', 'fenologia', 'fenologico', 'estacion',
            'estaciones', 'calendario', 'siembra', 'cosecha', 'meses'],
        'financiero' => ['financiero', 'finanzas', 'dinero', 'precio', 'precios', 'costo', 'costos',
            'margen', 'margenes', 'mi margen', 'mi margen', 'roi', 'retorno', 'inversion', 'ingreso', 'ingresos', 'beneficio',
            'beneficios', 'equilibrio', 'punto de equilibrio', 'rentabilidad', 'rentable', 'dolares',
            'quintal', 'quintales', 'produccion', 'produccion total', 'break even', 'sensibilidad',
            'waterfall', 'cascada', 'escenarios', 'escenario'],
        'plaga' => ['plaga', 'plagas', 'enfermedad', 'enfermedades', 'insecto', 'insectos', 'hongo', 'hongos',
            'bacteria', 'bacterias', 'virus', 'control', 'tratamiento', 'tratamientos', 'fungicida',
            'fungicidas', 'insecticida', 'insecticidas', 'herbicida', 'herbicidas', 'plaguicida',
            'plaguicidas', 'manejo integrado', 'umbral', 'monitoreo', 'prevencion', 'prevencion',
            'cultivo', 'cultivos', 'proteccion', 'proteccion de plagas', 'biologico', 'quimico',
            'organic', 'organico', 'aplicacion', 'aplicaciones', 'dosis', 'dosis', 'recomendacion',
            'recomendaciones', 'producto', 'productos', 'nombre comun', 'nombre comun', 'control quimico'],
    ];

    private const VISTA_INTENCION = [
        'dashboard-yield' => 'indicador',
        'dashboard-scenarios' => 'financiero',
        'dashboard-climate' => 'clima',
        'dashboard-financial' => 'financiero',
        'cultivos' => 'ubicacion',
        'simular' => 'indicador',
        'history' => 'general',
    ];

    public function classificar(string $pregunta, ?string $vista = null): array
    {
        $preguntaNorm = $this->normalizar($pregunta);
        $palabras = $this->tokenizar($preguntaNorm);

        if (trim($preguntaNorm) === '') {
            throw new \ZeaSys\Kernel\Errores\ValidacionException('La pregunta no puede estar vacía.');
        }

        // Contar coincidencias por intención
        $scores = [];
        foreach (self::SINONIMOS as $intencion => $sinonimos) {
            $score = 0;
            foreach ($sinonimos as $sinonimo) {
                if (strpos($preguntaNorm, $sinonimo) !== false) {
                    $score += 1;
                }
                foreach ($palabras as $palabra) {
                    if ($palabra === $sinonimo) {
                        $score += 0.5;
                    }
                }
            }
            $scores[$intencion] = $score;
        }

        // Boost por vista actual SOLO si hubo al menos una coincidencia de palabra clave
        $maxScoreInicial = max($scores);
        if ($maxScoreInicial > 0 && $vista !== null && isset(self::VISTA_INTENCION[$vista])) {
            $intencionVista = self::VISTA_INTENCION[$vista];
            $scores[$intencionVista] = ($scores[$intencionVista] ?? 0) + 0.5;
        }

        // Detectar verbos de explicación vs consulta
        $verbosExplicacion = ['que significa', 'que es', 'explica', 'explicame', 'que representa',
            'como se calcula', 'como funciona', 'significado', 'definicion', 'concepto', 'que quiere decir'];
        $esExplicacion = false;
        foreach ($verbosExplicacion as $ve) {
            if (strpos($preguntaNorm, $ve) !== false) {
                $esExplicacion = true;
                break;
            }
        }

        // Boost a indicador si pregunta de explicación
        if ($esExplicacion && $maxScoreInicial > 0) {
            $scores['indicador'] = ($scores['indicador'] ?? 0) + 1.0;
        }

        // Determinar la mejor intención
        $maxScore = max($scores);
        if ($maxScore === 0) {
            $intencion = 'general';
            $confianza = 0.3;
        } else {
            $intencion = array_search($maxScore, $scores, true);
            $total = array_sum($scores);
            $confianza = $total > 0 ? round($maxScore / $total, 2) : 0.5;
            $confianza = max(0.4, min(1.0, $confianza));
        }

        // Detectar si es follow-up
        $esFollowUp = $this->esFollowUp($preguntaNorm);

        // Si es follow-up con baja confianza, usar el último tema de la memoria
        if ($esFollowUp && $maxScore === 0 && $this->memoria !== null) {
            $temas = $this->memoria->temas();
            if (!empty($temas)) {
                $ultimoTema = end($temas);
                if (in_array($ultimoTema, ['indicador', 'ubicacion', 'clima', 'financiero', 'plaga'], true)) {
                    $intencion = $ultimoTema;
                    $confianza = 0.6;
                }
            }
        }

        // Si no hay intención clara pero hay follow-up y hay memoria, usar último tema
        if ($esFollowUp && $maxScoreInicial === 0 && $this->memoria !== null) {
            $temas = $this->memoria->temas();
            if (!empty($temas)) {
                $ultimoTema = end($temas);
                if (in_array($ultimoTema, ['indicador', 'ubicacion', 'clima', 'financiero', 'plaga'], true)) {
                    $intencion = $ultimoTema;
                    $confianza = 0.5;
                }
            }
        }

        return [
            'intencion' => $intencion,
            'confianza' => $confianza,
            'parametros' => [
                'es_followup' => $esFollowUp,
                'palabras_clave' => $palabras,
                'vista' => $vista,
            ],
        ];
    }

    private function esFollowUp(string $pregunta): bool
    {
        $followUps = ['y eso', 'y eso como', 'y como', 'y que', 'y eso que', 'eso como', 'eso que',
            'como se corrige', 'como se mejora', 'como mejorarlo', 'y despues', 'y luego', 'que mas',
            'y tambien', 'y ademas', 'explica mas', 'mas detalle', 'detalles', 'y eso que significa',
            'eso como funciona', 'como funciona eso', 'y por que', 'por que eso', 'y eso por que'];
        foreach ($followUps as $fu) {
            if (strpos($pregunta, $fu) !== false) {
                return true;
            }
        }
        return false;
    }

    private function normalizar(string $texto): string
    {
        $texto = mb_strtolower(trim($texto), 'UTF-8');
        $acentos = ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ñ' => 'n',
            'ü' => 'u', 'Á' => 'a', 'É' => 'e', 'Í' => 'i', 'Ó' => 'o', 'Ú' => 'u', 'Ñ' => 'n'];
        $texto = strtr($texto, $acentos);
        $texto = preg_replace('/[^a-z0-9\s\/\-]/', ' ', $texto);
        $texto = preg_replace('/\s+/', ' ', $texto);
        return trim($texto);
    }

    private function tokenizar(string $texto): array
    {
        $tokens = explode(' ', $texto);
        $tokens = array_filter($tokens, fn($t) => strlen($t) > 2);
        return array_values(array_unique($tokens));
    }
}