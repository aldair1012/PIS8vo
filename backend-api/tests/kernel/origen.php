<?php
declare(strict_types=1);
require_once __DIR__ . '/../../src/Kernel/AutoloaderPsr4.php';
ZeaSys\Kernel\AutoloaderPsr4::registrar(__DIR__ . '/../../src');
$cases = [
    ['POST', 'http://localhost', null, null, true],
    ['POST', 'http://localhost:5500', null, null, true],
    ['POST', 'http://localhost.ejemplo.test', null, null, false],
    ['DELETE', 'null', null, null, false],
    ['POST', null, 'https://ajeno.example/path', null, false],
    ['POST', null, 'http://localhost/ZeaSys/', null, true],
    ['POST', null, null, 'cross-site', false],
    ['POST', null, null, null, true],
    ['GET', 'https://ajeno.example', null, null, true],
];
foreach ($cases as [$method, $origin, $referer, $site, $expected]) {
    $_SERVER = ['REQUEST_METHOD' => $method, 'HTTP_HOST' => 'localhost'];
    if ($origin !== null) $_SERVER['HTTP_ORIGIN'] = $origin;
    if ($referer !== null) $_SERVER['HTTP_REFERER'] = $referer;
    if ($site !== null) $_SERVER['HTTP_SEC_FETCH_SITE'] = $site;
    $allowed = true;
    try { ZeaSys\Kernel\Cors::verificarEscritura(); }
    catch (ZeaSys\Kernel\Errores\AccesoDenegadoException) { $allowed = false; }
    if ($allowed !== $expected) throw new RuntimeException('Resultado inesperado en la comprobación de origen.');
}
echo '[OK] ' . count($cases) . " casos de origen, referencia y método.\n";
