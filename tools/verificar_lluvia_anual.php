<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__.'/../backend-api/src/Kernel/AutoloaderPsr4.php';
ZeaSys\Kernel\AutoloaderPsr4::registrar(__DIR__.'/../backend-api/src');
if (count($argv)!==3 || !is_numeric($argv[1]) || !is_numeric($argv[2])) {fwrite(STDERR,"Uso: php tools/verificar_lluvia_anual.php latitud longitud\n");exit(1);}
$provider=new ZeaSys\Dominios\Terreno\Infraestructura\ProveedorLluviaAnual(new ZeaSys\Dominios\Terreno\Infraestructura\CacheArchivos());
$reference=$provider->obtenerParaParcela(['latitud'=>(float)$argv[1],'longitud'=>(float)$argv[2]]);
if ($reference===null) {fwrite(STDERR,"No hay una referencia histórica completa disponible para esta ubicación.\n");exit(2);}
unset($reference['serie']);
echo json_encode($reference,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)."\n";
