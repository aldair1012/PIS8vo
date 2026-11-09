<?php
// Crea solo el esquema en una base desechable. Nunca importa registros de usuarios.
declare(strict_types=1);
require __DIR__ . '/../../src/Config/aplicacion.php';
$modo = $argv[1] ?? '';
$db = $argv[2] ?? '';
$token = $argv[3] ?? '';
$pdo = new PDO(sprintf('mysql:host=%s;port=%d;charset=utf8mb4', DB_HOST, DB_PORT), DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
if ($modo === 'crear') {
    $db = 'zeasys_test_' . bin2hex(random_bytes(6));
    $token = bin2hex(random_bytes(16));
    $pdo->exec("CREATE DATABASE `{$db}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $pdo->exec("USE `{$db}`");
    try {
        $sql = file_get_contents(__DIR__ . '/../../../database/schema-demo.sql');
        if ($sql === false || stripos($sql, 'INSERT INTO') !== false) throw new RuntimeException('Se requiere un esquema vacío de demostración.');
        $pdo->exec($sql);
        $pdo->exec('CREATE TABLE __zeasys_prueba (token CHAR(32) NOT NULL)');
        $pdo->prepare('INSERT INTO __zeasys_prueba VALUES (?)')->execute([$token]);
        echo json_encode(['db' => $db, 'token' => $token], JSON_THROW_ON_ERROR);
    } catch (Throwable $e) {
        $pdo->exec("DROP DATABASE `{$db}`");
        throw $e;
    }
    exit;
}
if (!preg_match('/^zeasys_test_[a-f0-9]{12}$/D', $db) || !preg_match('/^[a-f0-9]{32}$/D', $token)) {
    throw new RuntimeException('Solo se permite operar sobre una base de esta prueba.');
}
$pdo->exec("USE `{$db}`");
$guardado = $pdo->query('SELECT token FROM __zeasys_prueba')->fetchColumn();
if (!is_string($guardado) || !hash_equals($guardado, $token)) throw new RuntimeException('La base no pertenece a esta prueba.');
if ($modo === 'eliminar') {
    $pdo->exec("DROP DATABASE `{$db}`");
    echo "Base desechable eliminada.\n";
} elseif ($modo === 'historial') {
    // Duplicar únicamente la simulación del usuario ficticio de esta base.
    $fila = $pdo->query('SELECT * FROM simulaciones ORDER BY id LIMIT 1')->fetch(PDO::FETCH_ASSOC);
    if (!$fila) throw new RuntimeException('La prueba debe ejecutar una simulación antes.');
    unset($fila['id']);
    $columnas = implode(',', array_map(static fn ($col) => "`{$col}`", array_keys($fila)));
    $marcas = implode(',', array_fill(0, count($fila), '?'));
    $insertar = $pdo->prepare("INSERT INTO simulaciones ({$columnas}) VALUES ({$marcas})");
    for ($i = 0; $i < 130; $i++) {
        $fila['nombre'] = 'Historial de prueba ' . $i;
        $fila['fecha'] = $i === 129 ? '2001-01-01 12:00:00' : '2024-06-01 12:00:00';
        $insertar->execute(array_values($fila));
    }
    echo "Historial ficticio creado.\n";
} elseif ($modo === 'fronteras') {
    // Añade únicamente simulaciones ficticias junto a los límites de año.
    $fila = $pdo->query('SELECT * FROM simulaciones ORDER BY id LIMIT 1')->fetch(PDO::FETCH_ASSOC);
    if (!$fila) throw new RuntimeException('Hace falta una simulación de prueba.');
    unset($fila['id']);
    $columnas = implode(',', array_map(static fn ($col) => "`{$col}`", array_keys($fila)));
    $marcas = implode(',', array_fill(0, count($fila), '?'));
    $insertar = $pdo->prepare("INSERT INTO simulaciones ({$columnas}) VALUES ({$marcas})");
    foreach (['2023-12-31 23:59:59', '2024-01-01 00:00:00', '2024-12-31 23:59:59', '2025-01-01 00:00:00'] as $fecha) {
        $fila['fecha'] = $fecha;
        $fila['nombre'] = 'Límite de año ' . $fecha;
        $insertar->execute(array_values($fila));
    }
    echo "Fechas límite ficticias creadas.\n";
} else {
    throw new RuntimeException('Modo no reconocido.');
}
