<?php
// CLI idempotente. Respaldar la tabla antes de ampliar su catálogo; no borra registros.
declare(strict_types=1);
if(PHP_SAPI!=='cli') throw new RuntimeException('Solo CLI.');
require __DIR__.'/../backend-api/src/Config/aplicacion.php';
$pdo=new PDO(sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',DB_HOST,DB_PORT,DB_NAME),DB_USER,DB_PASS,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$old="enum('franco','arcilloso','arenoso')";
$new="enum('franco','arcilloso','arenoso','franco_equilibrado','arcillo_limoso')";
$column=$pdo->query("SHOW COLUMNS FROM simulaciones LIKE 'tipo_suelo'")->fetch(PDO::FETCH_ASSOC);
if(($column['Type']??null)===$new) { echo "Catálogo MySQL actualizado; no se modificó.\n"; exit; }
if(($column['Type']??null)!==$old) throw new RuntimeException('La columna difiere del esquema esperado; no se modificó.');
$private=getenv('LOCALAPPDATA');
if(!$private) throw new RuntimeException('Falta una ubicación privada para el respaldo.');
$folder=$private.'/ZeaSys-Recuperacion/texturas-'.date('Ymd-His').'-'.bin2hex(random_bytes(3));
if(!mkdir($folder,0700,true)) throw new RuntimeException('No se pudo crear el respaldo.');
$command=['C:/xampp/mysql/bin/mysqldump.exe','--host='.DB_HOST,'--port='.DB_PORT,'--user='.DB_USER,'--single-transaction','--default-character-set=utf8mb4',DB_NAME,'simulaciones'];
$env=getenv(); $env['MYSQL_PWD']=DB_PASS;
$process=proc_open($command,[0=>['pipe','r'],1=>['file',$folder.'/simulaciones.sql','wb'],2=>['file',$folder.'/error.log','wb']],$pipes,null,$env);
if(!is_resource($process)) throw new RuntimeException('No se pudo ejecutar el respaldo.');
fclose($pipes[0]);
if(proc_close($process)!==0 || filesize($folder.'/simulaciones.sql')===0) throw new RuntimeException('Falló el respaldo; no se cambió la columna.');
$before=(int)$pdo->query('SELECT COUNT(*) FROM simulaciones')->fetchColumn();
$pdo->exec(file_get_contents(__DIR__.'/../database/migraciones/20261108_texturas_suelo.sql'));
$after=(int)$pdo->query('SELECT COUNT(*) FROM simulaciones')->fetchColumn();
if($before!==$after) throw new RuntimeException('Cambió el recuento durante la migración; revisar el respaldo.');
$empty=(int)$pdo->query("SELECT COUNT(*) FROM simulaciones WHERE tipo_suelo=''")->fetchColumn();
file_put_contents($folder.'/verificacion.json',json_encode(['filas_antes'=>$before,'filas_despues'=>$after,'valores_vacios'=>$empty,'sql_sha256'=>hash_file('sha256',$folder.'/simulaciones.sql')],JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR));
echo "Catálogo ampliado. Registros conservados: {$after}. Valores vacíos que requieren revisión: {$empty}. Copia privada: {$folder}\n";
