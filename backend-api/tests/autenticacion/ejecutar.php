<?php
// Regresiones de autenticación. Sin base de datos, red ni archivos de usuarios.
declare(strict_types=1);

require_once __DIR__ . '/../../src/Kernel/AutoloaderPsr4.php';
ZeaSys\Kernel\AutoloaderPsr4::registrar(__DIR__ . '/../../src');

use ZeaSys\Dominios\Autenticacion\Aplicacion\AutenticacionService;
use ZeaSys\Dominios\Autenticacion\Dominio\AlmacenAvatarInterface;
use ZeaSys\Dominios\Autenticacion\Dominio\Contrasena;
use ZeaSys\Dominios\Autenticacion\Dominio\GestorSesionInterface;
use ZeaSys\Dominios\Autenticacion\Dominio\UsuarioRepositoryInterface;
use ZeaSys\Dominios\Autenticacion\Dominio\VerificadorTokenGoogleInterface;
use ZeaSys\Dominios\Autenticacion\Infraestructura\UsuarioRepositoryMysql;
use ZeaSys\Kernel\AutenticacionMiddleware;
use ZeaSys\Kernel\Errores\NoAutorizadoException;
use ZeaSys\Kernel\Errores\ValidacionException;
use ZeaSys\Kernel\Peticion;

final class UsuariosMemoriaAuth implements UsuarioRepositoryInterface
{
    public array $usuario = ['id' => 7, 'nombre' => 'Agricultor', 'correo' => 'agricultor@example.test', 'foto_perfil' => null, 'es_google' => 0, 'activo' => 1];
    public ?string $hash = null;
    public bool $existe = true;
    public array $escrituras = [];
    public function login(string $correo, string $contrasena): array|false {
        return $this->existe && $this->usuario['activo'] && $correo === $this->usuario['correo'] && $this->hash !== null && Contrasena::verificar($contrasena, $this->hash) ? $this->usuario : false;
    }
    public function registrar(string $nombre, string $correo, string $contrasena): int {
        $this->hash = Contrasena::crearHash($contrasena);
        $this->usuario = [...$this->usuario, 'nombre' => $nombre, 'correo' => $correo];
        $this->escrituras[] = ['registro', 7];
        return 7;
    }
    public function existeCorreo(string $correo): bool { return false; }
    public function obtenerPorId(int $id): ?array { return $this->existe && $id === 7 ? $this->usuario : null; }
    public function actualizarFotoPerfil(int $id, ?string $fotoUrl, int $esGoogle = 0): bool {
        $this->escrituras[] = ['foto', $id];
        $this->usuario['foto_perfil'] = $fotoUrl;
        $this->usuario['es_google'] = $esGoogle;
        return true;
    }
    public function existeCorreoParaOtro(string $correo, int $id): bool { return false; }
    public function obtenerPasswordHash(int $id): ?string { return $this->hash; }
    public function actualizarUsuario(int $id, string $nombre, ?string $contrasenaHash = null): bool {
        $this->escrituras[] = ['perfil', $id];
        $this->usuario['nombre'] = $nombre;
        if ($contrasenaHash !== null) $this->hash = $contrasenaHash;
        return true;
    }
    public function eliminarUsuario(int $id): bool { $this->escrituras[] = ['eliminar', $id]; $this->existe = false; return true; }
    public function buscarOCrearPorGoogle(string $nombre, string $correo, ?string $picture = null): array|false { return $this->usuario['activo'] ? $this->usuario : false; }
}

final class SesionMemoriaAuth implements GestorSesionInterface
{
    public ?int $id = 7;
    public bool $cerrada = false;
    public bool $recordar = false;
    public function iniciar(array $usuario): void { $this->id = (int) $usuario['id']; }
    public function cerrar(): void { $this->cerrada = true; $this->id = null; }
    public function usuarioId(): ?int { return $this->id; }
    public function actualizarNombre(string $nombre): void {}
    public function extenderCookie(bool $recordar): void { $this->recordar = $recordar; }
}

final class AvataresMemoriaAuth implements AlmacenAvatarInterface
{
    public array $eliminados = [];
    public int $guardados = 0;
    public function guardar(array $archivo, int $usuarioId): string { $this->guardados++; return '/backend-api/public/uploads/avatars/avatar_7_123.png'; }
    public function eliminar(?string $fotoUrl): void { $this->eliminados[] = $fotoUrl; }
}

final class PdoUsuariosAuth extends PDO
{
    public array|false $fila = false;
    public array $consultas = [];
    public function __construct() {}
    public function prepare(string $query, array $options = []): PDOStatement|false {
        $indice = count($this->consultas);
        $this->consultas[] = ['sql' => $query, 'parametros' => null];
        return new SentenciaUsuariosAuth($this, $indice, $this->fila);
    }
    public function lastInsertId(?string $name = null): string|false { return '7'; }
}

final class SentenciaUsuariosAuth extends PDOStatement
{
    public function __construct(private PdoUsuariosAuth $pdo, private int $indice, private array|false $fila) {}
    public function execute(?array $params = null): bool { $this->pdo->consultas[$this->indice]['parametros'] = $params; return true; }
    public function fetch(int $mode = PDO::FETCH_DEFAULT, int $cursorOrientation = PDO::FETCH_ORI_NEXT, int $cursorOffset = 0): mixed { return $this->fila; }
}

function comprobar(bool $condicion, string $mensaje): void { if (!$condicion) throw new RuntimeException($mensaje); }
function peticion(array $datos): Peticion {
    $p = new Peticion('POST');
    (new ReflectionProperty($p, 'cuerpo'))->setValue($p, $datos);
    return $p;
}
function entorno(): array {
    $usuarios = new UsuariosMemoriaAuth();
    $sesion = new SesionMemoriaAuth();
    $avatares = new AvataresMemoriaAuth();
    $google = new class implements VerificadorTokenGoogleInterface {
        public function verificar(string $idToken): array { return ['nombre' => 'Agricultor', 'correo' => 'agricultor@example.test', 'picture' => 'https://lh3.googleusercontent.com/photo']; }
    };
    return [new AutenticacionService($usuarios, $google, $avatares, $sesion), $usuarios, $sesion, $avatares];
}
function esperarError(callable $operacion, string $clase, int $codigo): void {
    try { $operacion(); } catch (Throwable $e) {
        comprobar($e instanceof $clase, 'Tipo inesperado: ' . get_class($e));
        comprobar($e->codigoHttp() === $codigo, 'Código HTTP inesperado.');
        return;
    }
    throw new RuntimeException('Se aceptó una operación inválida.');
}

$pruebas = [];
$pruebas['hash nuevo distingue exactamente los espacios y rechaza variantes'] = static function (): void {
    $hash = Contrasena::crearHash(' Clave123! ');
    comprobar(str_starts_with($hash, 'zeasys-exact-v1$'), 'Debe marcar la semántica exacta.');
    comprobar(strlen($hash) <= 255, 'Debe caber en la columna existente.');
    comprobar(Contrasena::verificar(' Clave123! ', $hash), 'Debe verificar la clave exacta.');
    foreach (['Clave123!', '  Clave123! ', ' Clave123!', 'Clave123! '] as $variante) {
        comprobar(!Contrasena::verificar($variante, $hash), 'No debe aceptar variantes de espacios.');
    }
    comprobar(!Contrasena::verificar(' Clave123! ' . str_repeat('x', 72), $hash), 'No debe truncar la entrada de login.');
};
$pruebas['hash nuevo sin espacios no acepta espacios añadidos'] = static function (): void {
    $hash = Contrasena::crearHash('Clave123!');
    comprobar(!Contrasena::verificar(' Clave123! ', $hash), 'No se debe aplicar el fallback legacy a claves nuevas.');
};
$pruebas['hash legacy preserva la clave y la normalización anterior sin reescritura'] = static function (): void {
    $hash = password_hash('Clave123!', PASSWORD_BCRYPT);
    comprobar(Contrasena::verificar('Clave123!', $hash), 'Debe aceptar la clave legacy.');
    comprobar(Contrasena::verificar(' Clave123! ', $hash), 'Debe conservar trim para cuentas existentes.');
    comprobar(!Contrasena::verificar('OtraClave123!', $hash), 'No debe aceptar otra contraseña.');
    comprobar(!Contrasena::verificar("Clave123!\0", $hash), 'No debe aceptar bytes nulos.');
};
$pruebas['bcrypt no autentica sufijos fuera del límite de 72 bytes'] = static function (): void {
    $clave = 'Aa1!' . str_repeat('x', 68);
    foreach ([Contrasena::crearHash($clave), password_hash($clave, PASSWORD_BCRYPT)] as $hash) {
        comprobar(Contrasena::verificar($clave, $hash), 'El límite válido debe aceptarse.');
        comprobar(!Contrasena::verificar($clave . 'a', $hash), 'No debe autenticar una clave truncada.');
    }
    esperarError(static fn () => Contrasena::crearHash($clave . 'a'), ValidacionException::class, 400);
    esperarError(static fn () => Contrasena::crearHash(str_repeat('é', 37)), ValidacionException::class, 400);
};
$pruebas['registro conserva contraseña exacta y confirmación exacta'] = static function (): void {
    [$servicio, $usuarios] = entorno();
    $servicio->registro(peticion(['nombre' => ' Agricultor ', 'correo' => 'agricultor@example.test', 'contrasena' => ' Clave123! ', 'confirmar_contrasena' => ' Clave123! ']));
    comprobar(Contrasena::verificar(' Clave123! ', $usuarios->hash), 'El registro no debe recortar la clave.');
    comprobar(!Contrasena::verificar('Clave123!', $usuarios->hash), 'No debe guardar el trim.');
    [$servicio, $usuarios] = entorno();
    esperarError(static fn () => $servicio->registro(peticion(['nombre' => 'Agricultor', 'correo' => 'agricultor@example.test', 'contrasena' => ' Clave123! ', 'confirmar_contrasena' => 'Clave123!'])), ValidacionException::class, 400);
    comprobar($usuarios->escrituras === [], 'Una confirmación diferente no debe escribir.');
};
$pruebas['login conserva clave exacta y recordar booleano'] = static function (): void {
    [$servicio, $usuarios, $sesion] = entorno();
    $usuarios->hash = Contrasena::crearHash(' Clave123! ');
    $resultado = $servicio->login(peticion(['correo' => ' agricultor@example.test ', 'contrasena' => ' Clave123! ', 'remember' => true]));
    comprobar($resultado['success'] && $sesion->recordar, 'Debe autenticar y recordar la sesión.');
    esperarError(static fn () => $servicio->login(peticion(['correo' => 'agricultor@example.test', 'contrasena' => 'Clave123!'])), NoAutorizadoException::class, 401);
};
$pruebas['actualizar contraseña preserva espacios y solo usa la identidad de sesión'] = static function (): void {
    [$servicio, $usuarios] = entorno();
    $servicio->update(peticion(['id' => 99, 'nombre' => 'Nuevo nombre', 'nueva_contrasena' => ' Nueva123! ', 'confirmar_nueva_contrasena' => ' Nueva123! ']));
    comprobar($usuarios->escrituras === [['perfil', 7]], 'Un ID de cuerpo no debe seleccionar otra cuenta.');
    comprobar(Contrasena::verificar(' Nueva123! ', $usuarios->hash), 'Debe guardar el valor exacto.');
    comprobar(!Contrasena::verificar('Nueva123!', $usuarios->hash), 'No debe aplicar trim a claves actualizadas.');
};
$pruebas['actualizar no ignora claves débiles o una confirmación sin clave'] = static function (): void {
    foreach ([['0', '0'], ['', 'Clave123!'], [str_repeat('Aa1!', 19), str_repeat('Aa1!', 19)]] as [$clave, $confirmacion]) {
        [$servicio, $usuarios] = entorno();
        esperarError(static fn () => $servicio->update(peticion(['nueva_contrasena' => $clave, 'confirmar_nueva_contrasena' => $confirmacion])), ValidacionException::class, 400);
        comprobar($usuarios->escrituras === [], 'Debe rechazar la clave antes de guardar el perfil.');
    }
};
$pruebas['me revoca usuarios ausentes o desactivados'] = static function (): void {
    foreach (['ausente', 'desactivado'] as $caso) {
        [$servicio, $usuarios, $sesion] = entorno();
        if ($caso === 'ausente') $usuarios->existe = false; else $usuarios->usuario['activo'] = 0;
        comprobar($servicio->me() === ['authenticated' => false], 'No debe exponer una sesión revocada.');
        comprobar($sesion->cerrada, 'Debe cerrar la sesión obsoleta.');
    }
};
$pruebas['operaciones privadas rechazan cuenta revocada antes de escribir'] = static function (): void {
    foreach (['update', 'uploadAvatar', 'deleteAvatar', 'syncGoogleAvatar', 'eliminar'] as $metodo) {
        foreach (['ausente', 'desactivado', 'sin_sesion'] as $caso) {
            [$servicio, $usuarios, $sesion, $avatares] = entorno();
            if ($caso === 'ausente') $usuarios->existe = false;
            if ($caso === 'desactivado') $usuarios->usuario['activo'] = 0;
            if ($caso === 'sin_sesion') $sesion->id = null;
            $args = match ($metodo) { 'update', 'syncGoogleAvatar' => [peticion([])], 'uploadAvatar' => [[]], default => [] };
            esperarError(static fn () => $servicio->{$metodo}(...$args), NoAutorizadoException::class, 401);
            comprobar($usuarios->escrituras === [] && $avatares->guardados === 0, 'No debe modificar una cuenta revocada.');
        }
    }
};
$pruebas['sincronizar avatar Google limpia avatar local anterior'] = static function (): void {
    [$servicio, $usuarios, , $avatares] = entorno();
    $usuarios->usuario['foto_perfil'] = '/backend-api/public/uploads/avatars/avatar_7_456.png';
    $servicio->syncGoogleAvatar(peticion(['foto_url' => 'https://lh3.googleusercontent.com/foto=s96-c']));
    comprobar($avatares->eliminados === ['/backend-api/public/uploads/avatars/avatar_7_456.png'], 'Debe limpiar el archivo local sustituido.');
    comprobar($usuarios->usuario['foto_perfil'] === 'https://lh3.googleusercontent.com/foto=s400', 'Debe normalizar el tamaño de Google.');
};
$pruebas['repositorio guarda hash versionado y verifica sin exponerlo'] = static function (): void {
    $pdo = new PdoUsuariosAuth();
    $repo = new UsuarioRepositoryMysql($pdo);
    comprobar($repo->registrar('Agricultor', 'agricultor@example.test', ' Clave123! ') === 7, 'Debe devolver el ID.');
    $hash = $pdo->consultas[0]['parametros']['contrasena'];
    comprobar(Contrasena::verificar(' Clave123! ', $hash), 'El repositorio debe usar el formato exacto.');
    $pdo->fila = ['id' => 7, 'nombre' => 'Agricultor', 'correo' => 'agricultor@example.test', 'contrasena' => $hash, 'foto_perfil' => null, 'es_google' => 0, 'activo' => 1];
    comprobar(!array_key_exists('contrasena', $repo->login('agricultor@example.test', ' Clave123! ')), 'No debe devolver el hash al servicio.');
    comprobar($repo->login('agricultor@example.test', 'Clave123!') === false, 'El repo no debe recortar claves nuevas.');
    $pdo->fila['contrasena'] = password_hash('Clave123!', PASSWORD_BCRYPT);
    comprobar($repo->login('agricultor@example.test', ' Clave123! ') !== false, 'Debe conservar login legacy.');
    $pdo->fila['activo'] = 0;
    comprobar($repo->login('agricultor@example.test', 'Clave123!') === false, 'No debe autenticar cuentas inactivas.');
};
$pruebas['middleware no consulta cuentas para visitas anónimas públicas'] = static function (): void {
    $_SESSION = [];
    $consultas = 0;
    $middleware = new AutenticacionMiddleware(static function (int $id) use (&$consultas): bool { $consultas++; return true; });
    $middleware->procesar('api/auth/me', ['publica' => true, 'sesion' => true]);
    comprobar($consultas === 0, 'La página pública no debe abrir una conexión por autenticación.');
};
$pruebas['middleware revoca globalmente una cuenta desactivada y respeta cuentas activas'] = static function (): void {
    $_SESSION = ['usuario_id' => 7, 'ultima_actividad' => time()];
    $middleware = new AutenticacionMiddleware(static fn (int $id): bool => false);
    esperarError(static fn () => $middleware->procesar('api/cultivos', ['sesion' => true]), NoAutorizadoException::class, 401);
    comprobar($_SESSION === [], 'Debe revocar todas las claves de sesión.');
    $_SESSION = ['usuario_id' => 7, 'ultima_actividad' => time()];
    (new AutenticacionMiddleware(static fn (int $id): bool => $id === 7))->procesar('api/cultivos', ['sesion' => true]);
    comprobar($_SESSION['usuario_id'] === 7, 'Debe mantener la sesión válida.');
    $_SESSION = [];
};
$pruebas['middleware evita consultas de cuentas para sesión caducada o ID inválido'] = static function (): void {
    foreach ([['usuario_id' => 7, 'ultima_actividad' => time() - 4000000], ['usuario_id' => 'abc'], ['usuario_id' => -1]] as $sesion) {
        $_SESSION = $sesion;
        $consultas = 0;
        $middleware = new AutenticacionMiddleware(static function (int $id) use (&$consultas): bool { $consultas++; return true; });
        esperarError(static fn () => $middleware->procesar('api/cultivos', ['sesion' => true]), NoAutorizadoException::class, 401);
        comprobar($consultas === 0 && $_SESSION === [], 'Debe rechazar antes de consultar la cuenta.');
    }
};

foreach (['nombre', 'correo', 'contrasena', 'confirmar_contrasena'] as $campo) {
    foreach ([[], new stdClass(), false, 123] as $indice => $invalido) {
        $pruebas["registro rechaza tipo inválido {$campo} #{$indice}"] = static function () use ($campo, $invalido): void {
            [$servicio, $usuarios] = entorno();
            $datos = ['nombre' => 'Agricultor', 'correo' => 'agricultor@example.test', 'contrasena' => 'Clave123!', 'confirmar_contrasena' => 'Clave123!'];
            $datos[$campo] = $invalido;
            esperarError(static fn () => $servicio->registro(peticion($datos)), ValidacionException::class, 400);
            comprobar($usuarios->escrituras === [], 'No debe escribir entradas inválidas.');
        };
    }
}
foreach ([[], new stdClass(), false, 123, "Clave123!\0"] as $indice => $invalido) {
    $pruebas["login y cambio de clave rechazan tipo/byte inválido #{$indice}"] = static function () use ($invalido): void {
        [$servicio, $usuarios] = entorno();
        esperarError(static fn () => $servicio->login(peticion(['correo' => 'agricultor@example.test', 'contrasena' => $invalido])), ValidacionException::class, 400);
        esperarError(static fn () => $servicio->update(peticion(['nueva_contrasena' => $invalido, 'confirmar_nueva_contrasena' => $invalido])), ValidacionException::class, 400);
        comprobar($usuarios->escrituras === [], 'No debe escribir una clave inválida.');
    };
}
foreach (['false', 'true', 0, 1, [], new stdClass()] as $indice => $invalido) {
    $pruebas["login y Google rechazan recordar no booleano #{$indice}"] = static function () use ($invalido): void {
        [$servicio] = entorno();
        esperarError(static fn () => $servicio->login(peticion(['correo' => 'agricultor@example.test', 'contrasena' => 'Clave123!', 'remember' => $invalido])), ValidacionException::class, 400);
        esperarError(static fn () => $servicio->googleLogin(peticion(['id_token' => 'token_prueba', 'remember' => $invalido])), ValidacionException::class, 400);
    };
}

$fallos = 0;
foreach ($pruebas as $nombre => $prueba) {
    try { $prueba(); echo "[OK] {$nombre}\n"; }
    catch (Throwable $e) { $fallos++; echo "[FAIL] {$nombre}: {$e->getMessage()}\n"; }
}
echo "\n" . (count($pruebas) - $fallos) . " passed, {$fallos} failed\n";
exit($fallos > 0 ? 1 : 0);
