<?php
declare(strict_types=1);
require_once __DIR__.'/../../src/Kernel/AutoloaderPsr4.php';
ZeaSys\Kernel\AutoloaderPsr4::registrar(__DIR__.'/../../src');
use ZeaSys\Dominios\Terreno\Aplicacion\ProvinciaParcela;
use ZeaSys\Dominios\Terreno\Aplicacion\TexturaSuelo;
use ZeaSys\Dominios\Terreno\Infraestructura\ProveedorSoilGrids;

$failures=0; $checks=0;
function check(bool $ok,string $label): void { global $checks,$failures; $checks++; if (!$ok) { $failures++; echo '[FAIL] '.$label."\n"; } }
foreach ([[-.8,-80.2,'Manabí'],[-.18,-78.47,'Pichincha'],[-2.19,-79.89,'Guayas'],[-.7,-90.35,'Galápagos']] as [$lat,$lon,$expected]) {
    check(ProvinciaParcela::resolver(['latitud'=>$lat,'longitud'=>$lon,'ubicacion'=>'Nombre de comunidad sin provincia'])['provincia']===$expected,'Provincia por coordenadas: '.$expected);
}
check(ProvinciaParcela::resolver(['ubicacion'=>'Cuenca, Azuay, Ecuador'])['provincia']==='Azuay','Respaldo al texto declarado.');
check(ProvinciaParcela::resolver(['latitud'=>0,'longitud'=>0])['provincia']===null,'No inventar provincia fuera del mapa.');
$cases=[[5,90,5,'Arenosa'],[8,80,12,'Areno franca'],[10,65,25,'Franco arenosa'],[20,40,40,'Franca'],[20,20,60,'Franco limosa'],[5,10,85,'Limosa'],[25,55,20,'Franco arcillo arenosa'],[35,35,30,'Franco arcillosa'],[35,10,55,'Franco arcillo limosa'],[40,50,10,'Arcillo arenosa'],[50,10,40,'Arcillo limosa'],[50,30,20,'Arcillosa']];
foreach ($cases as [$clay,$sand,$silt,$label]) check(TexturaSuelo::clasificar(compact('clay','sand','silt'))['clase_estimada']===$label,'Textura USDA: '.$label);
check(TexturaSuelo::clasificar(['clay'=>20,'sand'=>30])===null,'No clasificar fracciones incompletas.');
check(TexturaSuelo::clasificar(['clay'=>80,'sand'=>60,'silt'=>10])===null,'No clasificar fracciones incoherentes.');
$soil=ProveedorSoilGrids::interpretarMuestras(['clay'=>294,'sand'=>404,'silt'=>301,'phh2o'=>62,'soc'=>489]);
check($soil['clay']===29.4 && $soil['ph']===6.2,'Convertir g/kg a porcentaje y pH escalado.');
check(TexturaSuelo::clasificar($soil)['tipo_modelo']==='arcilloso','Muestra real del proveedor se agrupa como franco arcilloso.');
check(ProveedorSoilGrids::interpretarMuestras(['clay'=>null,'phh2o'=>-32768,'sand'=>true])===[],'Nodata y booleanos no son mediciones.');
check(!isset(ProveedorSoilGrids::interpretarMuestras(['clay'=>800,'sand'=>600,'silt'=>100])['clay']),'Descartar fracciones de proveedor incoherentes.');
echo ($checks-$failures).' passed, '.$failures." failed\n"; exit($failures?1:0);
