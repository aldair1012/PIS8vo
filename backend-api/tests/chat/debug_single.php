<?php
require_once __DIR__ . '/../../src/Kernel/AutoloaderPsr4.php';
ZeaSys\Kernel\AutoloaderPsr4::registrar(__DIR__ . '/../../src');

use ZeaSys\Dominios\Chat\Infraestructura\MemoriaSesion;
use ZeaSys\Dominios\Chat\Infraestructura\RouterChat;

$memoria = new MemoriaSesion();
$router = new RouterChat($memoria);
$resultado = $router->classificar('¿Qué significa mi ROI?', null);
var_dump($resultado);
echo "OK\n";
