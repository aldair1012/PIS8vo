<?php
// Evaluación real del gateway y Gemini con datos ficticios; sin cuentas ni cosechas personales.
declare(strict_types=1);
require __DIR__.'/../backend-api/src/Kernel/AutoloaderPsr4.php';
\ZeaSys\Kernel\AutoloaderPsr4::registrar(__DIR__.'/../backend-api/src');
require __DIR__.'/../backend-api/src/Config/aplicacion.php';
$runId=gmdate('Ymd-His').'-'.bin2hex(random_bytes(3));
$folder=__DIR__.'/../documentacion/fuentes-maiz/descargas/chatbot-20261115';
if(!is_dir($folder))mkdir($folder,0775,true);
$sessionFile=$folder.'/sesiones-evaluacion.json';
$sessions=is_file($sessionFile)?(json_decode(file_get_contents($sessionFile),true)?:[]):[];
$cases=[
    ['concepto','¿Qué significa el pH del suelo y para qué me sirve conocerlo?',[]],
    ['sin_analisis','No tengo un análisis de suelo. ¿Qué puedo hacer para preparar la siembra de maíz?',[]],
    ['sin_brote_confirmado','¿Qué enfermedades hay hoy en mi parcela?',['cultivo_activo'=>['nombre_parcela'=>'Parcela de evaluación','provincia'=>'Manabí'],'contexto_agricola'=>['siembra'=>['guia_agricola'=>['provincia'=>'Manabí','vigilancia_actual'=>['nota'=>'No hay un reporte actual verificado para esta parcela.']]]]]],
    ['cosecha_no_registrada','¿Cuál fue mi cosecha real?',['cultivo_activo'=>['nombre_parcela'=>'Parcela de evaluación'],'simulaciones_recientes'=>[]]],
];
$forecast = array_map(static fn (int $day): array => ["2026-11-$day", 34, 22, $day === 21 ? 12.7 : 0, 80], range(15, 21));
$cases[] = ['pronostico', 'Explícame el pronóstico del 2026-11-21: ¿cuánta lluvia se prevé y qué significa el porcentaje?', ['panel_actual' => 'climate', 'contexto_agricola' => ['clima' => ['fuente' => 'Datos ficticios de evaluación, no tiempo real', 'formato_pronostico' => '[fecha, tmax_c, tmin_c, lluvia_mm, prob_lluvia_pct]', 'pronostico_7d' => $forecast]]]];
$rows=[];
foreach($cases as [$id,$question,$context]){
    $provider=new \ZeaSys\Dominios\Chat\Infraestructura\GeminiFlowise();$start=microtime(true);
    $conversation='zeasys-evaluacion-ayuda-20261115-'.$id.'-'.$runId;
    $sessions[]=$conversation;file_put_contents($sessionFile,json_encode($sessions));
    $text=$provider->responder($question,$context,0,null,null,$conversation);
    if(mb_strlen($text)<40)throw new RuntimeException('Respuesta insuficiente: '.$id);
    $info=$provider->informacionRespuesta();unset($info['sugerencias_busqueda_html']);
    $rows[]=['caso'=>$id,'conversacion_sintetica'=>$conversation,'pregunta'=>$question,'respuesta'=>$text,'segundos'=>round(microtime(true)-$start,2),'documentos_consultados'=>count($provider->referenciasConsultadas()),'investigacion'=>$info];
    echo '[OK] '.$id.' · '.end($rows)['segundos']." s\n";
}
$folder=__DIR__.'/../documentacion/fuentes-maiz/descargas/chatbot-20261115';
if(!is_dir($folder))mkdir($folder,0775,true);
file_put_contents($folder.'/evaluacion-gemini-real.json',json_encode($rows,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES));
echo "Respuestas guardadas para revisión semántica; no se utilizaron datos personales.\n";
