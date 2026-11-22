<?php
declare(strict_types=1);
// Cargar únicamente en una cuenta de demostración creada para esta finalidad.
if (PHP_SAPI !== 'cli') exit(1);
require __DIR__ . '/../backend-api/src/Config/aplicacion.php';
$correo = $argv[1] ?? '';
if (!filter_var($correo, FILTER_VALIDATE_EMAIL) || !str_ends_with($correo, '@example.test')) {
    exit("Indica el correo de la cuenta de demostración existente bajo example.test.\n");
}
$db = getConnection();
$db->beginTransaction();
try {
    $consulta = $db->prepare('SELECT id FROM usuarios WHERE correo=? AND activo=1 FOR UPDATE');
    $consulta->execute([$correo]);
    $id = $consulta->fetchColumn();
    if (!$id) throw new RuntimeException('Crea primero la cuenta ficticia en la instalación de demostración.');
    $crear = $db->prepare('INSERT INTO parcelas (usuario_id,nombre_parcela,variedad_maiz,tipo_maiz,ubicacion,area,latitud,longitud,altitud,ph) VALUES (?,?,?,?,?,?,?,?,?,?)');
    $existe = $db->prepare('SELECT 1 FROM parcelas WHERE usuario_id=? AND nombre_parcela=?');
    foreach ([
        ['Demo Costa · Quevedo','INIAP H-551','Duro Amarillo','Los Ríos',2.5,-1.03,-79.47,75,6.2],
        ['Demo Sierra · Riobamba','INIAP 101 Blanco Harinoso Precoz','Suave Harinoso','Chimborazo',1.2,-1.65,-78.65,2720,6.5],
    ] as $parcela) {
        $existe->execute([$id,$parcela[0]]);
        if (!$existe->fetchColumn()) $crear->execute([$id,...$parcela]);
    }
    $db->commit();
    echo "Parcelas ficticias disponibles. Ninguna cosecha de validación añadida.\n";
} catch (Throwable $e) {
    $db->rollBack();
    throw $e;
}
