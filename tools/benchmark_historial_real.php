<?php
// Solo tablas del esquema real en una base desechable marcada; ningún dato personal.
declare(strict_types=1);
require __DIR__.'/../backend-api/src/Config/aplicacion.php';
require __DIR__.'/../backend-api/src/Kernel/AutoloaderPsr4.php';
ZeaSys\Kernel\AutoloaderPsr4::registrar(__DIR__.'/../backend-api/src');
$db=getenv('ZEASYS_TEST_DB'); $token=getenv('ZEASYS_TEST_TOKEN');
if(!is_string($db)||!preg_match('/^zeasys_test_[a-f0-9]{12}$/D',$db)) throw new RuntimeException('Solo base desechable.');
$pdo=new PDO(sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',DB_HOST,DB_PORT,$db),DB_USER,DB_PASS,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
if(!is_string($token)||!hash_equals((string)$pdo->query('SELECT token FROM __zeasys_prueba')->fetchColumn(),$token)) throw new RuntimeException('Base ajena a esta prueba.');
$pdo->exec("INSERT INTO usuarios(nombre,correo,contrasena) VALUES ('Prueba de carga','carga@example.test','hash ficticio no utilizable')");
$uid=(int)$pdo->lastInsertId(); $crops=[];
$insertCrop=$pdo->prepare("INSERT INTO cultivos(usuario_id,nombre_parcela,area) VALUES (?, ?, 1)");
for($i=0;$i<100;$i++) { $insertCrop->execute([$uid,'Parcela ficticia '.$i]); $crops[]=(int)$pdo->lastInsertId(); }
$stmt=$pdo->prepare("INSERT INTO simulaciones(usuario_id,cultivo_id,nombre,temperatura,humedad,precipitacion,fertilizante,ph_suelo,tipo_suelo,area_simulada,rendimiento_estimado,produccion_total,confianza,fecha,escenarios_json) VALUES (?,?,'Registro ficticio de carga',24.5,70,700,150,6.2,'franco',1,3.5,3.5,0.5,?,?)");
$snapshot=json_encode(['_zeasys_modelo'=>['nota'=>'Datos ficticios, no una simulación ejecutada','detalle'=>str_repeat('texto de prueba ',100)]],JSON_THROW_ON_ERROR);
$pdo->beginTransaction();
for($i=0;$i<20000;$i++) {
    $year=2021+(intdiv($i,100)%5); $month=1+(intdiv($i,500)%12); $day=1+(intdiv($i,6000)%28);
    $stmt->execute([$uid,$crops[$i%100],sprintf('%04d-%02d-%02d 12:00:00',$year,$month,$day),$snapshot]);
}
$pdo->commit();
$repo=new ZeaSys\Dominios\Simulaciones\Infraestructura\SimulacionRepositoryMysql($pdo);
$queries=['historial_50_2025'=>fn()=>$repo->obtenerPorUsuario($uid,50,2025),
          'historial_pagina_3000'=>fn()=>$repo->obtenerPorUsuario($uid,50,2025,3000),
          'por_parcela_2025'=>fn()=>$repo->obtenerRecientesPorCultivo($uid,$crops[0],50,2025),
          'estadisticas_2025'=>fn()=>$repo->obtenerEstadisticas($uid,2025),
          'años'=>fn()=>$repo->obtenerAniosPorUsuario($uid),'total'=>fn()=>$repo->contarPorUsuario($uid)];
$report=['registros_ficticios'=>20000,'parcelas_ficticias'=>100,'consultas'=>[]];
foreach($queries as $name=>$query) {
    $times=[];
    for($n=0;$n<21;$n++) { $start=hrtime(true); $value=$query(); $times[]=(hrtime(true)-$start)/1e6; }
    sort($times); $report['consultas'][$name]=['mediana_ms'=>$times[10],'p95_ms'=>$times[19],'bytes_respuesta'=>strlen(json_encode($value,JSON_THROW_ON_ERROR))];
}
if($repo->contarPorUsuario($uid)!==20000 || count($repo->obtenerPorUsuario($uid,50,2025))!==50) throw new RuntimeException('Resultados incorrectos bajo carga.');
$report['plan_historial']=$pdo->query("EXPLAIN SELECT * FROM simulaciones WHERE usuario_id={$uid} AND fecha>='2025-01-01' AND fecha<'2026-01-01' ORDER BY fecha DESC,id DESC LIMIT 50")->fetch();
$last=$repo->obtenerUltimaPorCultivo($crops[0],2025);
$expected=(int)$pdo->query("SELECT id FROM simulaciones WHERE cultivo_id={$crops[0]} AND fecha>='2025-01-01' AND fecha<'2026-01-01' ORDER BY fecha DESC,id DESC LIMIT 1")->fetchColumn();
$report['ultima_con_desempate_correcta']=(int)$last['id']===$expected;
$report['nota']='Repositorio y esquema reales, datos ficticios en esta máquina; no mide concurrencia HTTP ni una red remota.';
echo json_encode($report,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),"\n";
