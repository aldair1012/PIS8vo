<?php
declare(strict_types=1);

test('Chat de Siembra conserva el resumen del servidor, sus percentiles y el calendario aunque exista contexto agrícola', function (): void {
    $provider = new \ZeaSys\Dominios\Chat\Infraestructura\GeminiFlowise();
    $summary = ['sin_simulaciones'=>false,'año'=>2024,'kpis'=>['rendimiento_esperado'=>3], 'percentiles'=>['p10'=>2,'p50'=>3,'p90'=>4], 'resumen_descriptivo'=>['muestra'=>2,'coeficiente_variacion_pct'=>33.33], 'viabilidad_siembra'=>[['rango'=>'1–29 FEB','estado'=>'Siembra: Manabí','fuente'=>'Catálogo agronómico local']], 'ranking'=>[['simulacion_id'=>12,'valor'=>4]]];
    $context = ['panel_actual'=>'scenarios','dashboard_visible'=>['kpis'=>['rendimiento_esperado'=>999]],'contexto_agricola'=>['siembra'=>$summary,'rendimiento'=>['kpis'=>['rendimiento_predicho'=>9]]]];
    $data = json_decode((new ReflectionMethod($provider,'compactarContextoParaConsulta'))->invoke($provider,$context,'Explica los percentiles de Siembra'),true,512,JSON_THROW_ON_ERROR);
    assert_equals(3,$data['siembra']['kpis']['rendimiento_esperado']);
    assert_equals(2024,$data['siembra']['año']);
    assert_equals(3,$data['siembra']['percentiles']['p50']);
    assert_equals('1–29 FEB',$data['siembra']['viabilidad_siembra'][0]['rango']);
});

test('Chat de Siembra conserva ausencia de simulaciones y no la sustituye por el último rendimiento de otro año', function (): void {
    $provider = new \ZeaSys\Dominios\Chat\Infraestructura\GeminiFlowise();
    $context = ['panel_actual'=>'scenarios','contexto_agricola'=>['siembra'=>['sin_simulaciones'=>true,'año'=>2024,'resumen_descriptivo'=>['muestra'=>0],'kpis'=>['rendimiento_esperado'=>null]],'rendimiento'=>['kpis'=>['rendimiento_predicho'=>9]]]];
    $data = json_decode((new ReflectionMethod($provider,'compactarContextoParaConsulta'))->invoke($provider,$context,'¿Qué rendimiento se muestra?'),true,512,JSON_THROW_ON_ERROR);
    assert_equals(0,$data['siembra']['resumen_descriptivo']['muestra']);
    assert_equals(null,$data['siembra']['kpis']['rendimiento_esperado']);
    assert_true(!isset($data['rendimiento']),'La muestra vacía no se reemplaza con una predicción de otro periodo.');
});

test('Chat conserva fechas de la parcela y ventanas de cosecha con su origen visible',function():void{
    $provider=new \ZeaSys\Dominios\Chat\Infraestructura\GeminiFlowise();
    $context=['panel_actual'=>'scenarios','dashboard_visible'=>['calendario_visible'=>['origen'=>'parcela','fase'=>'fechas_de_la_parcela']],'contexto_agricola'=>['siembra'=>['fechas_parcela'=>[['fecha'=>'2027-03-12','tipo'=>'siembra_registrada','fuente'=>'Productor'],['fecha'=>'2027-07-12','tipo'=>'fin_ciclo_estimado','fuente'=>'Simulación #206']],'viabilidad_siembra'=>[['rango'=>'1–31 AGO','estado'=>'Cosecha: Manabí','fuente'=>'Catálogo local']]]]];
    $data=json_decode((new ReflectionMethod($provider,'compactarContextoParaConsulta'))->invoke($provider,$context,'Explica mis fechas'),true,512,JSON_THROW_ON_ERROR);
    assert_equals('2027-03-12',$data['siembra']['fechas_parcela'][0]['fecha']);
    assert_equals('fin_ciclo_estimado',$data['siembra']['fechas_parcela'][1]['tipo']);
    assert_equals('Cosecha: Manabí',$data['siembra']['viabilidad_siembra'][0]['estado']);
    assert_equals('parcela',$data['calendario_visible']['origen']);
});
