<?php
use ZeaSys\Dominios\Chat\Aplicacion\ChatService;

function normalizar_borrador_prueba(array $datos): array
{
    $service=(new ReflectionClass(ChatService::class))->newInstanceWithoutConstructor();
    return (new ReflectionMethod(ChatService::class,'normalizarSimulacion'))->invoke($service,$datos,['id'=>1,'nombre_parcela'=>'Parcela ficticia','area'=>1,'variedad_maiz'=>'INIAP 198 Canguil']);
}

test('Chat: conserva lluvia del ciclo, ceros, fecha y manejo sin atribuirlos a un resultado', function (): void {
    $draft=normalizar_borrador_prueba(['precipitacion'=>3300,'precipitacion_ciclo_mm'=>0,'fecha_siembra'=>'2024-02-28','parametros_campo'=>['ciclo_dias'=>'235','lamina_riego_mm'=>'0','semilla_certificada'=>'0','riego_tipo'=>'temporal_lluvia']]);
    assert_equals(0.0,$draft['precipitacion_ciclo_entrada_mm']);
    assert_equals(null,$draft['precipitacion_anual_entrada_mm']);
    assert_equals('mm/ciclo',$draft['periodo_precipitacion']);
    assert_equals(0.0,$draft['parametros_campo']['lamina_riego_mm']);
    assert_equals('2024-02-28',$draft['fecha_siembra']);
    assert_equals(false,$draft['variedad_documentada']['simulacion_grano_habilitada']);
    assert_equals('borrador_no_ejecutado',$draft['estado']);
});
test('Chat: distingue entrada anual antigua y descarta campos inválidos del borrador', function (): void {
    $draft=normalizar_borrador_prueba(['precipitacion'=>3300,'fecha_siembra'=>'2025-02-29','parametros_campo'=>['ciclo_dias'=>'no sé','lamina_riego_mm'=>true,'rendimiento_t_ha'=>10]]);
    assert_equals(3300.0,$draft['precipitacion_anual_entrada_mm']);
    assert_equals(null,$draft['fecha_siembra']);
    assert_equals([],$draft['parametros_campo']);
});
test('Chat: el contexto compacto conserva el periodo y manejo del formulario', function (): void {
    $gemini=new \ZeaSys\Dominios\Chat\Infraestructura\GeminiFlowise();
    $draft=normalizar_borrador_prueba(['precipitacion_ciclo_mm'=>0,'parametros_campo'=>['ciclo_dias'=>235,'lamina_riego_mm'=>0]]);
    $compact=(new ReflectionMethod($gemini,'compactarBorradorParaConsulta'))->invoke($gemini,$draft);
    assert_equals(0.0,$compact['precipitacion_ciclo_entrada_mm']);
    assert_equals(235.0,$compact['parametros_campo']['ciclo_dias']);
    assert_equals(false,$compact['variedad_documentada']['simulacion_grano_habilitada']);
});
test('Chat y simulación: fechas malformadas no producen error interno del parser', function (): void {
    foreach (["2024-02-28\0", '2025-02-29', '28/02/2024'] as $fecha) {
        assert_equals(null,normalizar_borrador_prueba(['fecha_siembra'=>$fecha])['fecha_siembra']);
        assert_throws(\ZeaSys\Kernel\Errores\ValidacionException::class, static fn () => \ZeaSys\Dominios\Simulaciones\Aplicacion\EntradasCampo::normalizar(['temperatura'=>24,'fecha_siembra'=>$fecha],[]));
    }
});
test('Chat: el presupuesto conserva JSON válido y el borrador cuando crece el contexto', function (): void {
    $gemini=new \ZeaSys\Dominios\Chat\Infraestructura\GeminiFlowise();
    $draft=normalizar_borrador_prueba(['precipitacion_ciclo_mm'=>0,'parametros_campo'=>['ciclo_dias'=>235,'lamina_riego_mm'=>0]]);
    $agricola=[];
    foreach (['precio_maiz','impacto_precio','nutricion','clima','rendimiento','finanzas'] as $key) $agricola[$key]=['kpis'=>['datos'=>str_repeat('dato ',300)],'descripcion'=>str_repeat('referencia ',100)];
    $json=(new ReflectionMethod($gemini,'compactarContextoParaConsulta'))->invoke($gemini,['panel_actual'=>'simular','simulacion_borrador'=>$draft,'contexto_agricola'=>$agricola],'¿Cuánta agua declaré?');
    assert_true(mb_strlen($json,'UTF-8') <= 6400,'Debe respetar el límite antes de construir el prompt.');
    $data=json_decode($json,true,512,JSON_THROW_ON_ERROR);
    assert_equals(0.0,(float)$data['simulacion_borrador']['precipitacion_ciclo_entrada_mm']);
    assert_equals(235.0,(float)$data['simulacion_borrador']['parametros_campo']['ciclo_dias']);
});
test('Chat: recupera fechas y manejo reales de la instantánea de una simulación guardada', function (): void {
    $gemini=new \ZeaSys\Dominios\Chat\Infraestructura\GeminiFlowise();
    $saved=['escenarios_json'=>json_encode(['_zeasys_modelo'=>['version_modelo'=>'prueba','trazabilidad'=>['periodo_precipitacion'=>'mm/ciclo','calendario'=>['fecha_siembra'=>'2024-02-28','ciclo_dias'=>120]],'parcela_ejecucion'=>['parametros_campo'=>['lamina_riego_mm'=>0,'ciclo_dias'=>120]]]])];
    $result=(new ReflectionMethod($gemini,'compactarSimulacionParaConsulta'))->invoke($gemini,$saved);
    assert_equals(0,$result['parametros_campo']['lamina_riego_mm']);
    assert_equals('2024-02-28',$result['calendario']['fecha_siembra']);
    assert_equals('mm/ciclo',$result['periodo_precipitacion']);
});
