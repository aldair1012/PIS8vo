<?php
// Ensayo de recuperación: solo bases creadas por entorno.php y SQL importado con permisos limitados.
declare(strict_types=1);
require __DIR__ . '/../../src/Config/aplicacion.php';
[$script, $modo, $db, $token] = array_pad($argv, 4, '');
if (!preg_match('/^zeasys_test_[a-f0-9]{12}$/D', $db) || !preg_match('/^[a-f0-9]{32}$/D', $token)) {
    throw new RuntimeException('Solo se admiten bases desechables propias.');
}
$dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', DB_HOST, DB_PORT, $db);
$pdo = new PDO($dsn, DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$stored = $pdo->query('SELECT token FROM __zeasys_prueba')->fetchColumn();
if (!is_string($stored) || !hash_equals($stored, $token)) throw new RuntimeException('Base ajena al ensayo.');
if ($modo === 'sembrar') {
    $pdo->exec('CREATE TABLE recuperacion_prueba (id INT PRIMARY KEY, texto VARCHAR(100), valor DECIMAL(10,2))');
    $pdo->prepare('INSERT INTO recuperacion_prueba VALUES (1, ?, 0), (2, ?, 12.50)')->execute(['Maíz blanco · prueba ficticia', 'Suelo y riego']);
} elseif ($modo === 'importar') {
    $sql = file_get_contents($argv[4] ?? '');
    if (!$sql) throw new RuntimeException('Falta el volcado controlado de prueba.');
    $user = 'zs_restore_' . bin2hex(random_bytes(6));
    $pass = bin2hex(random_bytes(24));
    $account = $pdo->quote($user) . "@'127.0.0.1'";
    $pdo->exec('CREATE USER ' . $account . ' IDENTIFIED BY ' . $pdo->quote($pass));
    try {
        $pdo->exec("GRANT ALL PRIVILEGES ON `{$db}`.* TO {$account}");
        $limited = new PDO($dsn, $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        $limited->exec($sql);
        $limited = null;
    } finally {
        // El volcado trae el marcador de origen; conservar la propiedad del destino para limpiar.
        try {
            $pdo->prepare('UPDATE __zeasys_prueba SET token = ?')->execute([$token]);
        } finally { $pdo->exec('DROP USER ' . $account); }
    }
} elseif ($modo === 'comprobar') {
    $rows = $pdo->query('SELECT texto, valor FROM recuperacion_prueba ORDER BY id')->fetchAll(PDO::FETCH_ASSOC);
    if (count($rows) !== 2 || $rows[0]['texto'] !== 'Maíz blanco · prueba ficticia' || (float)$rows[0]['valor'] !== 0.0 || (float)$rows[1]['valor'] !== 12.5) {
        throw new RuntimeException('Los datos restaurados no coinciden.');
    }
    echo "Filas, acentos y cero real recuperados.\n";
} else {
    throw new RuntimeException('Operación de ensayo desconocida.');
}
