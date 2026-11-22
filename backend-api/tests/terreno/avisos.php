<?php
declare(strict_types=1);
use ZeaSys\Dominios\Terreno\Infraestructura\AvisosWhatsApp;
use ZeaSys\Dominios\Terreno\Aplicacion\ConsultaConRespaldo;
use ZeaSys\Dominios\Terreno\Infraestructura\CacheArchivos;
require __DIR__ . '/../../src/Kernel/AutoloaderPsr4.php';
ZeaSys\Kernel\AutoloaderPsr4::registrar(__DIR__ . '/../../src');
function verificar(bool $ok, string $nota): void { if (!$ok) throw new LogicException($nota); echo "OK $nota\n"; }
$clima = ['disponible' => true, 'pronostico_7d' => [
    ['fecha'=>'2026-11-20','precipitacion_mm'=>80], ['fecha'=>'2026-11-22','precipitacion_mm'=>25], ['fecha'=>'2026-11-29','precipitacion_mm'=>100],
]];
verificar(AvisosWhatsApp::lluvia($clima, '2026-11-21', 25) === ['fecha'=>'2026-11-22','mm'=>25.0], 'fecha y umbral');
verificar(AvisosWhatsApp::lluvia($clima, '2026-11-21', 26) === null && AvisosWhatsApp::lluvia($clima + ['estado'=>'ultimo_conocido'], '2026-11-21', 20) === null, 'umbral no alcanzado y pronóstico vencido');
$db = new PDO('sqlite::memory:');
$db->sqliteCreateFunction('UTC_TIMESTAMP', fn() => '2026-11-21 12:00:00');
$db->exec('CREATE TABLE alertas_lluvia (codigo_hash TEXT, codigo_vence TEXT, telefono TEXT, consentido_utc TEXT)');
$code = str_repeat('A',32);
$db->prepare('INSERT INTO alertas_lluvia (codigo_hash,codigo_vence) VALUES (?,?)')->execute([hash('sha256',$code),'2026-11-21 12:05:00']);
putenv('ZEASYS_WA_PHONE_ID=999');
$evento = static fn($texto,$id='999') => ['entry'=>[['changes'=>[['value'=>['metadata'=>['phone_number_id'=>$id], 'messages'=>[['from'=>'15550001111','text'=>['body'=>$texto]]]]]]]]];
AvisosWhatsApp::procesarEntrada($db,$evento('ALTA '.$code,'111'));
verificar(!$db->query('SELECT telefono FROM alertas_lluvia')->fetchColumn(), 'otro teléfono empresarial no autoriza');
AvisosWhatsApp::procesarEntrada($db,$evento('ALTA '.$code));
verificar($db->query('SELECT telefono FROM alertas_lluvia')->fetchColumn() === '15550001111', 'alta desde el número que confirma');
verificar(!$db->query('SELECT codigo_hash FROM alertas_lluvia')->fetchColumn(), 'confirmación de un solo uso');
AvisosWhatsApp::procesarEntrada($db,$evento('BAJA'));
verificar((int) $db->query('SELECT COUNT(*) FROM alertas_lluvia')->fetchColumn() === 0, 'baja elimina el número');
$dir = sys_get_temp_dir() . '/zeasys_cache_' . bin2hex(random_bytes(6));
$cache = new ConsultaConRespaldo(new CacheArchivos($dir));
try {
    $antes = $cache->obtener('demo',1,86400,fn()=>['valor'=>0]);
    touch($dir . '/demo.json',time()-3600);
    clearstatcache();
    $llamadas = 0;
    $caido = function () use (&$llamadas) { $llamadas++; return []; };
    $despues = $cache->obtener('demo',1,86400,$caido);
    $cache->obtener('demo',1,86400,$caido);
    verificar($antes['consultado_utc'] === $despues['consultado_utc'] && $despues['estado'] === 'ultimo_conocido' && $despues['datos']['valor'] === 0 && $llamadas === 1,'respaldo con fecha y corte temporal');
} finally {
    foreach (['demo.json','demo_fallo.json'] as $f) if (is_file($dir.'/'.$f)) unlink($dir.'/'.$f);
    if (is_dir($dir)) rmdir($dir);
}
