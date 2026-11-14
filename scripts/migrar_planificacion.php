<?php
declare(strict_types=1);
if (PHP_SAPI!=='cli') throw new RuntimeException('Solo CLI.');
require __DIR__.'/../backend-api/src/Config/aplicacion.php';
$db=new PDO(sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',DB_HOST,DB_PORT,DB_NAME),DB_USER,DB_PASS,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$columns=$db->query('SHOW COLUMNS FROM parcelas')->fetchAll(PDO::FETCH_COLUMN);
$definitions=['tipo_fecha_siembra'=>'VARCHAR(20) NULL','ciclo_dias'=>'SMALLINT UNSIGNED NULL','riego_tipo'=>'VARCHAR(40) NULL'];
$missing=array_diff_key($definitions,array_flip($columns));
if ($missing===[]) {echo "Planificación ya actualizada.\n";exit;}
if (!in_array('fecha_siembra',$columns,true)||!in_array('usuario_id',$columns,true)) throw new RuntimeException('Esquema de parcelas inesperado.');
$folder=getenv('LOCALAPPDATA').'/ZeaSys-Recuperacion/planificacion-'.date('Ymd-His').'-'.bin2hex(random_bytes(3));
if (!getenv('LOCALAPPDATA')||!mkdir($folder,0700,true)) throw new RuntimeException('No se pudo crear un respaldo privado.');
$env=getenv();$env['MYSQL_PWD']=DB_PASS;
$process=proc_open(['C:/xampp/mysql/bin/mysqldump.exe','--host='.DB_HOST,'--port='.DB_PORT,'--user='.DB_USER,'--single-transaction','--default-character-set=utf8mb4',DB_NAME,'parcelas'],[0=>['pipe','r'],1=>['file',$folder.'/parcelas.sql','wb'],2=>['file',$folder.'/error.log','wb']],$pipes,null,$env);
if (!is_resource($process)) throw new RuntimeException('No se pudo ejecutar el respaldo.');
fclose($pipes[0]);
if (proc_close($process)!==0||filesize($folder.'/parcelas.sql')===0) throw new RuntimeException('El respaldo falló; no se modificó el esquema.');
$before=(int)$db->query('SELECT COUNT(*) FROM parcelas')->fetchColumn();
foreach ($missing as $name=>$definition) $db->exec("ALTER TABLE parcelas ADD COLUMN {$name} {$definition}");
$after=(int)$db->query('SELECT COUNT(*) FROM parcelas')->fetchColumn();
if ($before!==$after) throw new RuntimeException('El número de parcelas cambió durante la migración. Revisar respaldo.');
echo "Planificación habilitada. Parcelas conservadas: {$after}. Copia privada: {$folder}\n";
