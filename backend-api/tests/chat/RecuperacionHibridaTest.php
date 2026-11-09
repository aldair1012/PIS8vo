<?php
declare(strict_types=1);
use ZeaSys\Dominios\Chat\Infraestructura\RecuperadorChroma;
use ZeaSys\Dominios\Chat\Infraestructura\GeminiFlowise;

test('RAG: fusiona recuperación global por palabras y vectores, prioriza cotejo y evita páginas repetidas', function (): void {
    $file='iniap-manual-produccion-maiz-2007.pdf';
    $corpus=[
        ['id'=>'ocr','text'=>'Temperatura de germinación 150C a 200C.', 'metadata'=>['source_file'=>$file,'page'=>7,'year'=>2007]],
        ['id'=>'checked','text'=>'Temperatura de germinación entre 15 °C y 20 °C.', 'metadata'=>['source_file'=>$file,'page'=>7,'year'=>2007,'verified_excerpt'=>true]],
        ['id'=>'water','text'=>'Riego en floración para mantener la humedad.', 'metadata'=>['source_file'=>$file,'page'=>8,'year'=>2007]],
    ];
    $result=RecuperadorChroma::fusionar('Temperatura para germinación según manual de 2007',$corpus,['ocr','checked']);
    assert_equals('checked',$result[0]['id']);
    assert_equals(1,count(array_filter($result,fn($x)=>$x['metadata']['page']===7)));
    assert_equals([],RecuperadorChroma::fusionar('Windows Update computadora',$corpus,['ocr']));
});

test('RAG: fuente explícita y comparación de regiones conservan alcance correcto', function (): void {
    assert_equals(['inec-espac-resultados-2025.pdf'],RecuperadorChroma::archivosPermitidos('INEC ESPAC 2025 producción'));
    assert_equals(['iniap-manual-produccion-maiz-2007.pdf'],RecuperadorChroma::archivosPermitidos('manual INIAP 2007'));
    assert_equals(5,count(RecuperadorChroma::archivosPermitidos('Compara Sierra y Costa')));
    assert_true(!in_array('iniap-guia-maiz-amarillo-litoral-2014.pdf',RecuperadorChroma::archivosPermitidos('siembra de Sierra'),true));
});

test('RAG: configuración de embeddings conserva dimensión y prefijo de consulta', function (): void {
    $calls=[];
    $file='iniap-manual-produccion-maiz-2007.pdf';
    $corpus=[['id'=>'checked','text'=>'Temperatura de germinación 15 a 20 grados.', 'metadata'=>['source_file'=>$file,'page'=>7,'year'=>2007,'verified_excerpt'=>true]]];
    $client=new RecuperadorChroma(function($url,$body) use (&$calls,$file) {
        $calls[]=$body;
        if(count($calls)===1) return [['name'=>'test_collection','id'=>'12345678-1234-1234-1234-123456789abc']];
        if(count($calls)===2) return ['embeddings'=>[array_fill(0,768,.1)]];
        return ['documents'=>[['texto']], 'metadatas'=>[[['source_file'=>$file,'page'=>7]]], 'ids'=>[['checked']]];
    },['collection'=>'test_collection','model'=>'embeddinggemma:300m','dimensions'=>768,'query_prefix'=>'task: search result | query: '],$corpus);
    assert_equals('checked',$client->recuperar('Temperatura de germinación')[0]['id']);
    assert_equals('embeddinggemma:300m',$calls[1]['model']);
    assert_true(str_starts_with($calls[1]['input'],'task: search result | query: '));
    assert_equals(false,$calls[1]['truncate']);
});

test('RAG: conserva contexto de cifras y rechaza páginas inexistentes', function (): void {
    $method=new ReflectionMethod(GeminiFlowise::class,'normalizarDocumentos');
    $result=$method->invoke(new GeminiFlowise(),[
        ['pageContent'=>str_repeat('Texto suficiente con contexto. ',20).'Humedad 13–14 %.','metadata'=>['source_file'=>'iniap-guia-produccion-maiz-sierra-2021.pdf','page'=>112,'year'=>2021,'verified_excerpt'=>true]],
        ['pageContent'=>'Página inventada','metadata'=>['source_file'=>'mag-guia-productores-maiz-amarillo-2026.pdf','page'=>999]],
    ]);
    assert_equals(1,count($result));
    assert_contains('13–14 %',$result[0]['texto']);
    assert_equals(true,$result[0]['extracto_cotejado_visualmente']);
    assert_equals(112,$result[0]['pagina_pdf']);
});

test('RAG: conserva una tabla y su explicación revisadas en la misma página', function (): void {
    $meta=['source_file'=>'inec-espac-resultados-2025.pdf','page'=>25,'year'=>2025,'verified_excerpt'=>true];
    $rows=[['id'=>'tabla','text'=>'Producción 1.508.854 toneladas; superficie sembrada 307.587 ha.','metadata'=>$meta],['id'=>'porcentaje','text'=>'Los Ríos, Manabí y Guayas concentran 87,1 % de la producción.','metadata'=>$meta]];
    $result=RecuperadorChroma::fusionar('Producción de maíz según INEC',$rows,['porcentaje','tabla']);
    assert_equals(1,count($result));
    assert_contains('1.508.854',$result[0]['pageContent']);
    assert_contains('87,1 %',$result[0]['pageContent']);
});
