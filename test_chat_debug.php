<?php
require_once 'backend-api/src/Kernel/AutoloaderPsr4.php';
ZeaSys\Kernel\AutoloaderPsr4::registrar('backend-api/src');

$router = new ZeaSys\Dominios\Chat\Infraestructura\RouterChat();
$result = $router->classificar('¿Qué significa mi ROI?', null);
var_dump($result);
