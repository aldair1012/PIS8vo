<?php
declare(strict_types=1);
require __DIR__.'/../../src/Kernel/AutoloaderPsr4.php';
ZeaSys\Kernel\AutoloaderPsr4::registrar(__DIR__.'/../../src');
use ZeaSys\Dominios\Lotes\Dominio\PlanificacionParcela as Plan;
use ZeaSys\Kernel\Errores\ValidacionException;
function check(bool $ok,string $message):void {if(!$ok)throw new RuntimeException($message);}
$unknown=Plan::completar([],['fecha_siembra'=>'2024-01-01'],'2024-01-01');
check($unknown['tipo_fecha_siembra']===null,'No inferir una fecha real de un registro antiguo.');
$valid=Plan::completar(['tipo_fecha_siembra'=>'prevista','ciclo_dias'=>120,'riego_tipo'=>'goteo'],[],'2027-03-01');
check($valid['ciclo_dias']===120&&$valid['riego_tipo']==='goteo','Conservar datos explícitos.');
check(Plan::completar([],$valid+['fecha_siembra'=>'2027-03-01'],'2027-03-01')===$valid,'Una actualización parcial conserva la planificación.');
check(Plan::completar([],$valid+['fecha_siembra'=>'2027-03-01'],'2027-04-01')['tipo_fecha_siembra']===null,'Cambiar fecha desde un cliente antiguo no reutiliza su clasificación.');
check(Plan::fin('2024-02-28',3)==='2024-03-01','Ciclo inclusivo en año bisiesto.');
check(Plan::fin('2026-01-01',1)==='2026-01-01','Un día no agrega un día extra.');
foreach ([['tipo_fecha_siembra'=>'inventada'],['tipo_fecha_siembra'=>'real_declarada'],['ciclo_dias'=>true],['ciclo_dias'=>1.5],['ciclo_dias'=>731],['riego_tipo'=>'otro inventado']] as $input) {
    try {Plan::completar($input,[],'2099-01-01');throw new RuntimeException('Debió rechazar la planificación inválida.');}
    catch(ValidacionException) {}
}
echo "12 comprobaciones de planificación aprobadas.\n";
