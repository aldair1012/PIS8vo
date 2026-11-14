<?php
declare(strict_types=1);
require __DIR__.'/../../src/Kernel/AutoloaderPsr4.php';
ZeaSys\Kernel\AutoloaderPsr4::registrar(__DIR__.'/../../src');
use ZeaSys\Dominios\Terreno\Infraestructura\ProveedorLluviaAnual as Lluvia;
use ZeaSys\Dominios\Terreno\Dominio\CacheInterface;
final class RainCache implements CacheInterface {
    public array $data=[];
    public function obtener(string $clave,int $ttlSegundos=86400):?array{return $this->data[$clave]??null;}
    public function guardar(string $clave,array $valor):void{$this->data[$clave]=$valor;}
    public function limpiarExpirados():void{}
}
$checks=0;
function check(bool $ok,string $message):void{global $checks;$checks++;if(!$ok)throw new RuntimeException($message);}
$daily=['daily_units'=>['precipitation_sum'=>'mm'],'daily'=>['time'=>[],'precipitation_sum'=>[]]];
for($d=new DateTimeImmutable('1991-01-01');$d<=new DateTimeImmutable('2020-12-31');$d=$d->modify('+1 day')){
    $daily['daily']['time'][]=$d->format('Y-m-d');$daily['daily']['precipitation_sum'][]=1;
}
$ref=Lluvia::desdeDiarios($daily);
check($ref!==null&&$ref['años_completos']===30&&$ref['valor']===365.3,'Treinta años completos con años bisiestos.');
foreach([null,true,-1,'texto'] as $bad){$copy=$daily;$copy['daily']['precipitation_sum'][0]=$bad;check(Lluvia::desdeDiarios($copy)===null,'No rellenar días ausentes o inválidos.');}
$copy=$daily;array_pop($copy['daily']['time']);array_pop($copy['daily']['precipitation_sum']);check(Lluvia::desdeDiarios($copy)===null,'No publicar un año incompleto.');
$copy=$daily;$copy['daily']['time'][]='1991-01-01';$copy['daily']['precipitation_sum'][]=1;check(Lluvia::desdeDiarios($copy)===null,'No contar fechas duplicadas.');
$copy=$daily;$copy['daily_units']['precipitation_sum']='inch';check(Lluvia::desdeDiarios($copy)===null,'Comprobar las unidades del proveedor.');
$copy=$daily;$copy['daily']['precipitation_sum']=array_fill(0,count($daily['daily']['time']),0);check(Lluvia::desdeDiarios($copy)['valor']===0.0,'Cero es válido; no imponer un mínimo inventado.');
$calls=0;$provider=new Lluvia(new RainCache(),static function($url)use(&$calls,$daily){$calls++;return $daily;});
$station=$provider->obtener(-1.0546,-80.4545);
check($station!==null&&$station['tipo']==='observaciones_mensuales_estacion'&&$station['años_completos']>=8,'INAMHI por cercanía y cobertura.');
check($calls===0,'La estación local verificada funciona sin Internet.');
$totals=array_column(array_filter($station['serie'],static fn($r)=>$r['precipitacion_mm']!==null),'precipitacion_mm');
check($station['valor']===round(array_sum($totals)/count($totals),1),'La media usa sólo años de doce meses reportados.');
$fallback=$provider->obtener(0,-110);check($fallback['tipo']==='reanalisis_historico'&&$calls===1,'El respaldo utiliza la API histórica, no constantes provinciales.');
$provider->obtener(0,-110);check($calls===1,'Caché de referencia por coordenadas.');
check($provider->obtener(NAN,0)===null,'Coordenadas inválidas no consultan proveedores.');
$cityProvider=new Lluvia(new RainCache(),static fn($url)=>['results'=>[['name'=>'Ciudad','country_code'=>'EC','latitude'=>-1.05,'longitude'=>-80.45]]]);
$city=$cityProvider->obtenerParaParcela(['ubicacion'=>'Ciudad, Ecuador']);
check(($city['ubicacion_referencia']['tipo']??'')==='centro_localidad_aproximado','Una localidad sin GPS queda identificada como aproximación.');
$ambiguous=new Lluvia(new RainCache(),static fn($url)=>['results'=>[['name'=>'Ciudad','country_code'=>'EC'],['name'=>'Ciudad','country_code'=>'EC']]]);
check($ambiguous->obtenerParaParcela(['ubicacion'=>'Ciudad'])===null,'No elegir arbitrariamente localidades homónimas.');
$failure=new Lluvia(new RainCache(),static fn($url)=>null);
check($failure->obtener(0,-110)===null,'Sin referencia disponible se conserva null.');
echo "$checks comprobaciones de lluvia anual aprobadas.\n";
echo json_encode(array_intersect_key($station,array_flip(['valor','estacion','distancia_km','periodo','años_completos','fuente'])),JSON_UNESCAPED_UNICODE)."\n";
