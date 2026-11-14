<?php
declare(strict_types=1);

function servicio_seleccion_prueba(?array $row): \ZeaSys\Dominios\Chat\Aplicacion\ChatService {
    $repo=new class($row) implements \ZeaSys\Dominios\Simulaciones\Dominio\SimulacionRepositoryInterface {
        public function __construct(private ?array $row) {}
        public function obtenerPorId(int $id): ?array { return $this->row; }
        public function guardar(array $datos,array $resultado): int { return 1; }
        public function obtenerPorUsuario(int $usuarioId,int $limite=50,?int $year=null,int $desplazamiento=0): array { return []; }
        public function obtenerAniosPorUsuario(int $usuarioId): array { return []; }
        public function obtenerEstadisticas(int $usuarioId,?int $year=null): array { return []; }
        public function obtenerRecientes(int $usuarioId,int $limite=5,?int $year=null): array { return []; }
        public function obtenerRecientesPorCultivo(int $usuarioId,int $cultivoId,int $limite=50,?int $year=null): array { return []; }
        public function eliminar(int $id): bool { return false; }
        public function contarPorUsuario(int $usuarioId): int { return 0; }
        public function obtenerUltimaPorCultivo(int $cultivoId,?int $año=null): ?array { return null; }
    };
    $service=(new ReflectionClass(\ZeaSys\Dominios\Chat\Aplicacion\ChatService::class))->newInstanceWithoutConstructor();
    (new ReflectionProperty($service,'simulaciones'))->setValue($service,$repo);
    return $service;
}

test('Chat: la simulación visible se resuelve desde el servidor y no desde cifras enviadas por el navegador',function():void{
    $row=['id'=>102,'usuario_id'=>7,'parcela_id'=>1,'rendimiento_estimado'=>3.0];
    $service=servicio_seleccion_prueba($row);
    $actual=(new ReflectionMethod($service,'resolverSimulacionSeleccionada'))->invoke($service,'yield',['simulacion_seleccionada'=>['id'=>102,'rendimiento_estimado'=>999]],7,1);
    assert_equals($row,$actual);
});
test('Chat: rechaza una simulación visible ajena, de otra parcela o inexistente',function():void{
    foreach([null,['usuario_id'=>8,'parcela_id'=>1],['usuario_id'=>7,'parcela_id'=>2]] as $row){
        $service=servicio_seleccion_prueba($row);
        assert_throws(\ZeaSys\Kernel\Errores\AccesoDenegadoException::class,static fn()=>(new ReflectionMethod($service,'resolverSimulacionSeleccionada'))->invoke($service,'yield',['simulacion_seleccionada'=>['id'=>102]],7,1));
    }
});
test('Chat: el contexto final conserva la ejecución antigua seleccionada y sus entradas, aunque exista una más reciente',function():void{
    $gemini=new \ZeaSys\Dominios\Chat\Infraestructura\GeminiFlowise();
    $selected=['id'=>102,'rendimiento_estimado'=>3,'produccion_total'=>1.5,'area_simulada'=>.5,'fertilizante'=>100];
    $context=['panel_actual'=>'yield','simulacion_seleccionada'=>$selected,'simulaciones_recientes'=>[['id'=>101,'rendimiento_estimado'=>4]],'contexto_agricola'=>['rendimiento'=>['kpis'=>['rendimiento_predicho'=>4]],'impacto_precio'=>['ingreso'=>999],'finanzas'=>['kpis'=>['ingreso'=>999]]]];
    $json=(new ReflectionMethod($gemini,'compactarContextoParaConsulta'))->invoke($gemini,$context,'Explica el rendimiento');
    $data=json_decode($json,true,512,JSON_THROW_ON_ERROR);
    assert_equals(102,$data['simulacion_seleccionada']['id']);
    assert_equals(3,$data['rendimiento']['rendimiento_predicho']);
    assert_equals(100,$data['simulacion_seleccionada']['entradas']['fertilizante']);
    assert_true(!isset($data['simulacion_reciente']) && !isset($data['impacto_precio']) && !isset($data['finanzas']),'No debe mezclar los resultados financieros de la última ejecución con la seleccionada.');
});
test('Chat: conserva referencia visible y prioriza las mediciones actuales recuperadas en el servidor',function():void{
    $gemini=new \ZeaSys\Dominios\Chat\Infraestructura\GeminiFlowise();
    $context=['panel_actual'=>'yield','dashboard_visible'=>['referencia_sipa'=>['año_visible'=>2025,'territorio_visible'=>'Manabí'],'mediciones_campo'=>['datos'=>['profundidad_cm'=>999]]],'contexto_agricola'=>['rendimiento'=>['mediciones_campo'=>['datos'=>['profundidad_cm'=>80]]]]];
    $data=json_decode((new ReflectionMethod($gemini,'compactarContextoParaConsulta'))->invoke($gemini,$context,'¿Qué referencia estoy viendo?'),true,512,JSON_THROW_ON_ERROR);
    assert_equals(80,$data['registro_campo_actual']['datos']['profundidad_cm']);
    assert_equals(2025,$data['referencia_sipa_visible']['año_visible']);
});
