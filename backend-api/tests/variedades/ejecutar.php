<?php
declare(strict_types=1);
require_once __DIR__ . '/../../src/Kernel/AutoloaderPsr4.php';
ZeaSys\Kernel\AutoloaderPsr4::registrar(__DIR__ . '/../../src');
use ZeaSys\Dominios\Simulaciones\Aplicacion\CatalogoMaiz;

function verificar(bool $condition, string $message): void { if (!$condition) throw new RuntimeException($message); }
$catalogo = new CatalogoMaiz();
$parcela = ['variedad_maiz'=>'INIAP 101 Blanco Harinoso Precoz','tipo_maiz'=>'Suave Harinoso','ubicacion'=>'Quito, Pichincha, Ecuador','altitud'=>2700,'ph'=>6.2];
$pruebas = [];
$pruebas['nombres completos y abreviados representan la misma variedad entrenada'] = static function () use ($catalogo): void {
    verificar($catalogo->nombreModelo('INIAP 101 Blanco Harinoso Precoz') === 'INIAP 101 Blanco Harinoso', 'No debe sustituir por otra variedad.');
    verificar($catalogo->nombreModelo('iniap-124 MISHCA MEJORADO') === 'INIAP 124 Mishca', 'Debe admitir puntuación y mayúsculas.');
    verificar($catalogo->nombreModelo('INIAP H-554 Renacer') === 'INIAP Renacer', 'Debe homologar la denominación histórica.');
    verificar($catalogo->nombreModelo('INIAP 529') === null, 'Agregar la ficha no agrega una etiqueta al modelo.');
};
$pruebas['desconocido conserva la ausencia de ficha y el nombre de la parcela'] = static function () use ($catalogo, $parcela): void {
    $r = $catalogo->evaluar([...$parcela,'variedad_maiz'=>'Semilla local del productor']);
    verificar($r['actual'] === null && $r['variedad_registrada'] === 'Semilla local del productor', 'No debe inventar equivalencias.');
};
$pruebas['faltantes no se convierten en cero ni generan selección territorial'] = static function () use ($catalogo): void {
    $r = $catalogo->evaluar(['variedad_maiz'=>'INIAP 101','tipo_maiz'=>'Suave Harinoso','altitud'=>null,'ph'=>null,'ubicacion'=>'']);
    verificar($r['contexto']['altitud_registrada_m'] === null && $r['contexto']['ph_ingresado'] === null, 'Debe conservar ausencias.');
    verificar($r['alternativas'] === [] && $r['actual']['estado'] === 'informacion_insuficiente', 'No sugerir por datos desconocidos.');
};
$pruebas['altitud cero explícita se compara sin sustituirla por un valor favorable'] = static function () use ($catalogo, $parcela): void {
    $r = $catalogo->evaluar([...$parcela,'altitud'=>0]);
    verificar($r['contexto']['altitud_registrada_m'] === 0.0 && $r['actual']['fuera_referencia'], 'Cero no es ausencia.');
};
$pruebas['cosecha en choclo y grano usan duraciones documentadas diferentes'] = static function () use ($catalogo, $parcela): void {
    $grano = $catalogo->evaluar($parcela);
    $choclo = $catalogo->evaluar($parcela,['objetivo'=>'choclo']);
    verificar($grano['actual']['cosecha_orientativa_dias'] === 205 && $choclo['actual']['cosecha_orientativa_dias'] === 120, 'No confundir usos.');
    verificar(!isset($grano['actual']['rendimiento_estimado']), 'Una ficha no es una predicción.');
};
$pruebas['alternativas excluyen intervalos fuera de referencia y otros usos'] = static function () use ($catalogo, $parcela): void {
    $r = $catalogo->evaluar([...$parcela,'altitud'=>2900],['objetivo'=>'choclo']);
    $names = array_column($r['alternativas'],'id');
    verificar(!in_array('i102',$names,true) && !in_array('i199',$names,true), 'Altitud y uso deben respetarse.');
    verificar($r['variedad_registrada'] === $parcela['variedad_maiz'], 'La consulta no cambia la parcela.');
};
$pruebas['pH general no se transforma en óptimo ni altera ranking de variedades'] = static function () use ($catalogo, $parcela): void {
    $a = $catalogo->evaluar($parcela,['ph_suelo'=>6.2]); $b = $catalogo->evaluar($parcela,['ph_suelo'=>9]);
    verificar(array_column($a['alternativas'],'id') === array_column($b['alternativas'],'id'), 'pH general no discrimina cultivares.');
    verificar(end($b['actual']['criterios'])['estado'] === 'fuera_guia_general', 'Debe mostrar la diferencia sin inventar un óptimo específico.');
};
$pruebas['provincia fuera de lista significa evidencia ausente sin prohibir el cultivo'] = static function () use ($catalogo, $parcela): void {
    $r=$catalogo->evaluar([...$parcela,'ubicacion'=>'Latacunga - Cotopaxi','altitud'=>2700]);
    verificar($r['actual']['criterios'][1]['estado'] === 'sin_referencia_provincial' && !$r['actual']['fuera_referencia'], 'No inferir fracaso por límites administrativos.');
};
$pruebas['catálogo y etiquetas del modelo tienen trazabilidad y nombres únicos'] = static function (): void {
    $root=dirname(__DIR__,3); $c=json_decode(file_get_contents($root.'/backend-api/data/referencias/catalogo-maiz-ecuador.json'),true,512,JSON_THROW_ON_ERROR);
    verificar(count($c['variedades']) === 14, 'Se esperan 14 fichas, incluyendo canguil.');
    verificar(count(array_unique(array_column($c['variedades'],'id'))) === 14, 'Los identificadores deben ser únicos.');
    $h=fopen($root.'/ml-engine/data/maiz_ecuador_training_data.csv','rb'); $cols=fgetcsv($h); $index=array_search('variedad',$cols,true); $names=[];
    while (($r=fgetcsv($h))!==false) $names[$r[$index]]=true;
    fclose($h);
    foreach ($c['variedades'] as $ficha) {
        foreach ($ficha['fuentes'] as $source) verificar(isset($c['fuentes'][$source['id']]), 'La fuente debe existir.');
        if ($ficha['nombre_en_modelo']!==null) verificar(isset($names[$ficha['nombre_en_modelo']]), 'No debe inventar una etiqueta entrenada.');
    }
};
$pruebas['variedades históricas sin ficha no reaparecen como alternativas documentadas'] = static function () use ($catalogo): void {
    $root=dirname(__DIR__,3);
    $active=json_decode(file_get_contents($root.'/backend-api/data/referencias/catalogo-maiz-ecuador.json'),true,512,JSON_THROW_ON_ERROR);
    $ids=array_column($active['variedades'],'id');
    $h=fopen($root.'/ml-engine/data/maiz_ecuador_training_data.csv','rb');
    $columns=fgetcsv($h); $index=array_search('variedad',$columns,true); $retiradas=[];
    verificar($index!==false,'Debe conservar el nombre histórico en el archivo original.');
    while (($row=fgetcsv($h))!==false) { $name=trim($row[$index]); if ($name!=='' && $catalogo->buscar($name)===null) $retiradas[$name]=['nombre'=>$name]; }
    fclose($h);
    verificar(count($retiradas)>0,'Se comprueban nombres históricos que no tienen ficha activa.');
    foreach ($retiradas as $ficha) {
        verificar($catalogo->buscar($ficha['nombre']) === null, 'La ficha retirada no debe seguir activa.');
        $r=$catalogo->evaluar(['variedad_maiz'=>$ficha['nombre'],'tipo_maiz'=>'Suave Harinoso','altitud'=>2700,'ubicacion'=>'Pichincha']);
        verificar($r['actual'] === null && $r['variedad_registrada'] === $ficha['nombre'], 'El registro histórico debe conservar el nombre.');
        verificar(array_diff(array_column($r['alternativas'],'id'),$ids) === [], 'Las alternativas deben pertenecer al catálogo activo.');
    }
};
$pruebas['nuevas referencias de cosecha no se generalizan a otros híbridos'] = static function () use ($catalogo): void {
    verificar($catalogo->buscar('INIAP H-551')['cosecha_orientativa_dias']['grano_seco'] === 120, 'Duración según ficha original.');
    verificar($catalogo->buscar('DEKALB DK-7088')['cosecha_orientativa_dias']['grano_seco'] === 120, 'Duración según fabricante Ecuador.');
    verificar($catalogo->buscar('INIAP H-553')['cosecha_orientativa_dias'] === [], 'No copiar los días de otro híbrido.');
};
$pruebas['cubre choclo blanco, amarillo, duro y canguil sin inventar soporte del modelo'] = static function () use ($catalogo): void {
    foreach (['INIAP 101'=>'Choclo blanco','INIAP 122 Chaucho Mejorado'=>'Choclo amarillo','INIAP H-551'=>'Maíz duro amarillo','INIAP 198'=>'Canguil para reventar'] as $nombre=>$categoria) {
        $r=$catalogo->evaluar(['variedad_maiz'=>$nombre,'tipo_maiz'=>'Duro Amarillo / Blanco'],['objetivo'=>'canguil']);
        verificar(in_array($categoria,$r['actual']['categorias_consumo'],true),'Debe distinguir el destino alimentario.');
    }
    verificar($catalogo->nombreModelo('INIAP 198 Canguil') === null && !$catalogo->buscar('INIAP 198')['simulacion_grano_habilitada'], 'No habilitar un soporte inconsistente.');
};
$fallos=0;
foreach ($pruebas as $nombre=>$prueba) {
    try { $prueba(); echo "[OK] $nombre\n"; } catch (Throwable $e) { $fallos++; echo "[FAIL] $nombre: {$e->getMessage()}\n"; }
}
echo (count($pruebas)-$fallos)." passed, $fallos failed\n";
exit($fallos ? 1 : 0);
