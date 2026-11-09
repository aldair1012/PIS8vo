<?php
declare(strict_types=1);
$db = getenv('ZEASYS_TEST_DB');
if (!is_string($db) || !preg_match('/^zeasys_test_[a-f0-9]{12}$/D', $db)) throw new RuntimeException('Solo se permite una base desechable de integración');
$pdo = new PDO('mysql:host=127.0.0.1;port=3306;dbname='.$db.';charset=utf8mb4', 'root', '', [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$token = getenv('ZEASYS_TEST_TOKEN');
if (!is_string($token) || !preg_match('/^[a-f0-9]{32}$/D', $token) || !hash_equals((string) $pdo->query('SELECT token FROM __zeasys_prueba')->fetchColumn(), $token)) throw new RuntimeException('La base no pertenece a esta prueba.');
$pdo->exec('CREATE TABLE bench_consultas (id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, usuario_id INT NOT NULL, fecha DATETIME NOT NULL, KEY idx_usuario_fecha (usuario_id,fecha)) ENGINE=InnoDB');
$stmt=$pdo->prepare('INSERT INTO bench_consultas(usuario_id,fecha) VALUES (?,?)');
$pdo->beginTransaction();
for($i=0;$i<20000;$i++) {
  $year=2020+($i%7); $month=1+(intdiv($i,7)%12); $day=1+(intdiv($i,84)%28);
  $stmt->execute([1+(intdiv($i,2352)%4),sprintf('%04d-%02d-%02d 12:00:00',$year,$month,$day)]);
}
$pdo->commit();
$queries=[
 'year' => "SELECT id FROM bench_consultas WHERE usuario_id=1 AND YEAR(fecha)=2025 ORDER BY fecha DESC,id DESC LIMIT 50",
 'rango'=> "SELECT id FROM bench_consultas WHERE usuario_id=1 AND fecha >= '2025-01-01' AND fecha < '2026-01-01' ORDER BY fecha DESC,id DESC LIMIT 50"
];
$rows=[];$times=[];$explain=[];
foreach($queries as $name=>$query) {
 $rows[$name]=$pdo->query($query)->fetchAll(PDO::FETCH_COLUMN);
 $explain[$name]=$pdo->query('EXPLAIN '.$query)->fetch(PDO::FETCH_ASSOC);
 for($i=0;$i<30;$i++){$start=hrtime(true);$pdo->query($query)->fetchAll(PDO::FETCH_COLUMN);$times[$name][]=(hrtime(true)-$start)/1e6;}
 sort($times[$name]);
}
if ($rows['year'] !== $rows['rango']) throw new RuntimeException('Los resultados no coinciden');
echo json_encode(['registros_ficticios'=>20000,'resultados_iguales'=>count($rows['year']),'mediana_year_ms'=>$times['year'][15],'mediana_rango_ms'=>$times['rango'][15],'plan_year'=>$explain['year'],'plan_rango'=>$explain['rango']],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),"\n";
