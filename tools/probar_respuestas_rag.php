<?php
// Preguntas públicas de evaluación, sin iniciar sesión ni consultar cuentas de productores.
declare(strict_types=1);
require __DIR__.'/../backend-api/src/Config/aplicacion.php';
require __DIR__.'/../backend-api/src/Kernel/AutoloaderPsr4.php';
ZeaSys\Kernel\AutoloaderPsr4::registrar(__DIR__.'/../backend-api/src');
$cases=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);
$rows=[];
foreach($cases as $case) {
    $start=microtime(true); $session=bin2hex(random_bytes(16));
    $client=new ZeaSys\Dominios\Chat\Infraestructura\GeminiFlowise();
    $row=['question'=>$case, 'session_id'=>hash('sha256', 'zeasys:0:sin-parcela:sin-año:validacion-documental:'.$session)];
    try {
        $row['answer']=$client->responder($case,[],0,null,null,$session,'validacion-documental');
        $row['references']=$client->referenciasConsultadas();
    } catch(Throwable $error) { $row['error']=$error->getMessage(); }
    $row['seconds']=round(microtime(true)-$start,3);
    $rows[]=$row;
    fwrite(STDERR,isset($row['error'])?"[ERROR] consulta documental\n":"[OK] respuesta recibida\n");
}
file_put_contents($argv[1],json_encode($rows,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR));
exit(count(array_filter($rows,fn($row)=>isset($row['error'])))?1:0);
