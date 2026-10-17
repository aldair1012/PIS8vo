# Plan de Implementación: Reestructuración Backend ZeaSys (Microservicios Lógicos + SOLID)

> **Para agentes ejecutores:** SUB-SKILL REQUERIDA: usar `subagent-driven-development` (recomendada) o `executing-plans` para implementar tarea por tarea. Los pasos usan checkbox (`- [ ]`).
>
> **Convención para migraciones:** el código del sistema ACTUAL está versionado en el commit `e89067d` ("foto cero"). Cuando una tarea diga "mover verbatim", se refiere a copiar el bloque indicado del archivo actual conservando **cada string, número y mensaje de error exactamente igual** (la suite de contrato compara salidas). Las líneas citadas corresponden a ese commit.

**Goal:** Reorganizar `backend-api/` en 5 dominios aislados con capas estrictas (Http → Aplicación → Dominio ← Infraestructura), router declarativo, contenedor DI y contratos por interfaz, sin cambiar ni una ruta ni un byte del JSON de respuesta.

**Architecture:** Microservicios lógicos sobre XAMPP (Enfoque A aprobado). El núcleo (`Kernel/`) provee autoloader, router, contenedor, petición/respuesta, middleware y errores tipados. Cada dominio se migra en su propia fase con la suite de contrato como puerta de salida.

**Tech Stack:** PHP 8.2.12 (XAMPP, CLI en `C:\xampp\php\php.exe`), MySQL (XAMPP), Flask :5000 (ya operativo), sin Composer, sin frameworks nuevos.

**Precondiciones globales (verificar antes de cada fase):**
- Apache y MySQL de XAMPP corriendo (el sistema responde en `http://localhost/ZeaSys/`).
- Motor IA: la suite de contrato verifica `/health` y lo arranca con `auto_ia_server.bat` si está apagado.
- Todos los comandos se ejecutan desde `C:\xampp\htdocs\ZeaSys`.
- Todos los commits usan estilo conventional (`tipo(ambito): descripción`) en español.

---

## Fase F00 — Suite de contrato (red de verificación)

### Task 1: Crear la suite de contrato en PHP CLI

**Files:**
- Create: `backend-api/tests/contrato/ejecutar.php`
- Create: `backend-api/tests/contrato/README.md`

- [ ] **Step 1: Crear `backend-api/tests/contrato/ejecutar.php` (hecho en F00)**

El script vive versionado en `backend-api/tests/contrato/ejecutar.php` (fuente única de verdad de la suite). No se pega aquí para evitar desfases: consultarlo/leerlo directamente del repo. Sus reglas de normalización/volatilidad están resumidas en `backend-api/tests/contrato/README.md`.

> Ajuste post-implementación (commits correctivos de F00): `normalizar()` colapsa claves externas en vivo (`soilgrids`, `open_meteo` → `<externo>`), neutraliza items aleatorios de "fecha de siembra" (mt_rand de YieldController → `<volatil>`) y salidas derivadas del motor ML (rendimiento_estimado, produccion_total, rendimiento_promedio, blobs `*_json` → `<externo:tipo>`). En modo tolerante los strings comparan esqueleto + números con ±25%; `estructura()` une integer/float en la familia "number" (json_encode emite 15.0 como 15). Endurecimiento final del gate: la volatilidad de la referencia manda y se diffea, captura validada (curl_error/5xx → exit 2), familias de tipo escalar comparadas, `--modo` obligatorio, huella corrupta → exit 2. El archivo versionado es la fuente de verdad final de la suite.

- [ ] **Step 2: Crear `backend-api/tests/contrato/README.md` (hecho en F00)**

El README vive versionado en `backend-api/tests/contrato/README.md` (fuente única de verdad: uso, volatilidad, reglas de normalización, límites conocidas y limpieza SEGURA). No se pega aquí para evitar desfases. Nota de seguridad: la limpieza de avatares residuales se hace por los ids de los usuarios `contrato_%` (consulta SQL primero, después borrado selectivo) — NUNCA con un wildcard global `avatar_*_*.png` (borraría avatares de usuarios reales).

- [ ] **Step 3: Ejecutar la captura y verificar que funciona**

Run: `C:\xampp\php\php.exe backend-api\tests\contrato\ejecutar.php --modo=capturar`
Expected: lista de `[OK]` por paso (29 pasos), termina con `[OK] Huella capturada en: ...\snapshots\antes\contrato.json` y exit code 0.

- [ ] **Step 4: Ejecutar la comparación contra sí misma (control positivo)**

Run: `C:\xampp\php\php.exe backend-api\tests\contrato\ejecutar.php --modo=comparar`
Expected: `== CONTRATO OK: sin diferencias ==` y exit code 0.

### Task 2: Control negativo (probar que el comparador detecta fallos reales)

**Files:**
- Test: `backend-api/tests/contrato/snapshots/antes/contrato.json`

- [ ] **Step 1: Fabricar una huella dañada temporal**

Run (PowerShell):
```powershell
$origen   = "backend-api\tests\contrato\snapshots\antes\contrato.json"
$temporal = "$env:TEMP\contrato_danado.json"
$texto = [System.IO.File]::ReadAllText((Resolve-Path $origen), [System.Text.Encoding]::UTF8)
$texto = $texto.Replace('"titulo"', '"tituloX"')
[System.IO.File]::WriteAllText($temporal, $texto, (New-Object System.Text.UTF8Encoding($false)))
```

- [ ] **Step 2: Comparar contra la huella dañada — DEBE FALLAR**

Run: `C:\xampp\php\php.exe backend-api\tests\contrato\ejecutar.php --modo=comparar --destino="$env:TEMP\contrato_danado.json"`
Expected: `[X]` con diferencias tipo `CLAVE NUEVA`/`FALTA`, `== CONTRATO FALLIDO: N diferencias ==`, exit code 1.

- [ ] **Step 3: Limpiar el archivo temporal**

Run: `Remove-Item "$env:TEMP\contrato_danado.json"`

- [ ] **Step 4: Commit de la fase F00**

```bash
git add backend-api/tests/contrato
git commit -m "test(contrato): suite de contrato PHP CLI + huella del estado actual"
```

---

## Fase F01 — Kernel (router, contenedor, petición/respuesta, errores)

> **Puerta de salida F01:** la comparación de contrato pasa completa con el nuevo `index.php` y las rutas en tabla. Nada más cambia.

### Task 3: Autoloader PSR-4 + excepciones tipadas + manejador global

**Files:**
- Create: `backend-api/src/Kernel/AutoloaderPsr4.php`
- Create: `backend-api/src/Kernel/Errores/ZeaSysException.php`
- Create: `backend-api/src/Kernel/Errores/NoAutorizadoException.php`
- Create: `backend-api/src/Kernel/Errores/ValidacionException.php`
- Create: `backend-api/src/Kernel/Errores/AccesoDenegadoException.php`
- Create: `backend-api/src/Kernel/Errores/RecursoNoEncontradoException.php`
- Create: `backend-api/src/Kernel/Errores/ServicioExternoException.php`
- Create: `backend-api/src/Kernel/Errores/ManejadorErrores.php`

- [ ] **Step 1: Crear `AutoloaderPsr4.php`**

El código vive versionado en `backend-api/src/Kernel/AutoloaderPsr4.php` (fuente única de verdad del kernel; autoloader PSR-4 idempotente). No se pega aquí para evitar desfases: consultarlo/leerlo directamente del repo.

- [ ] **Step 2: Crear las excepciones (una clase por archivo, misma forma)**

Las 6 excepciones tipadas (`ZeaSysException`, `NoAutorizadoException`, `ValidacionException`, `AccesoDenegadoException`, `RecursoNoEncontradoException`, `ServicioExternoException`) viven versionadas en `backend-api/src/Kernel/Errores/` (una clase por archivo, misma forma: extienden `ZeaSysException` con su código HTTP). No se pegan aquí para evitar desfases: consultarlas/leerlas directamente del repo.

- [ ] **Step 3: Crear `ManejadorErrores.php`**

Formato de error IDÉNTICO al actual (`{"error": "..."}`; 500 con prefijo `Error interno del servidor: `):

El código vive versionado en `backend-api/src/Kernel/Errores/ManejadorErrores.php` (fuente única de verdad; handler global con fallback mínimo `try/catch(\Throwable)`). No se pega aquí para evitar desfases: consultarlo/leerlo directamente del repo.

- [ ] **Step 4: Verificar sintaxis y autoload**

Run:
```powershell
& C:\xampp\php\php.exe -l backend-api\src\Kernel\AutoloaderPsr4.php
& C:\xampp\php\php.exe -r "require 'backend-api/src/Kernel/AutoloaderPsr4.php'; ZeaSys\Kernel\AutoloaderPsr4::registrar(__DIR__.'/backend-api/src'); new ZeaSys\Kernel\Errores\ValidacionException('x'); echo 'autoload OK', PHP_EOL;"
```
Expected: `No syntax errors detected` y `autoload OK`.

### Task 4: Peticion + RespuestaJson + Cors

**Files:**
- Create: `backend-api/src/Kernel/Peticion.php`
- Create: `backend-api/src/Kernel/RespuestaJson.php`
- Create: `backend-api/src/Kernel/Cors.php`

- [ ] **Step 1: Crear `Peticion.php`** (lectura perezosa del cuerpo para no interferir con controladores legacy)

El código vive versionado en `backend-api/src/Kernel/Peticion.php` (fuente única de verdad; captura ruta resuelta + snapshot de `$_GET`, cuerpo perezoso con fallback a `$_POST`). No se pega aquí para evitar desfases: consultarlo/leerlo directamente del repo.

- [ ] **Step 2: Crear `RespuestaJson.php`**

El código vive versionado en `backend-api/src/Kernel/RespuestaJson.php` (fuente única de verdad; envío JSON con guard `headers_sent()`). No se pega aquí para evitar desfases: consultarlo/leerlo directamente del repo.

- [ ] **Step 3: Crear `Cors.php`** (comportamiento idéntico al actual: refleja el Origin con credenciales)

El código vive versionado en `backend-api/src/Kernel/Cors.php` (fuente única de verdad). No se pega aquí para evitar desfases: consultarlo/leerlo directamente del repo.

- [ ] **Step 4: Verificar sintaxis**

Run: `Get-ChildItem backend-api\src\Kernel\*.php | ForEach-Object { & C:\xampp\php\php.exe -l $_.FullName }`
Expected: `No syntax errors detected` para cada archivo.

### Task 5: Contenedor DI + nueva configuración + shims

**Files:**
- Create: `backend-api/src/Kernel/Container.php`
- Create: `backend-api/src/Config/aplicacion.php`
- Create: `backend-api/src/Config/constantes_negocio.php`
- Modify: `backend-api/config/database.php` (se convierte en shim)

- [ ] **Step 1: Crear `Container.php`**

El código vive versionado en `backend-api/src/Kernel/Container.php` (fuente única de verdad; DI con fábricas, caché de instancias y detección de dependencias circulares). No se pega aquí para evitar desfases: consultarlo/leerlo directamente del repo.

- [ ] **Step 2: Crear `src/Config/aplicacion.php`**

Contenido = copia verbatim del actual `backend-api/config/database.php` (líneas 1–51 del commit `e89067d`), **quitando** las dos constantes de negocio (`PRECIO_MAIZ_TON`, `PRECIO_MAIZ_FUENTE`), que pasan al paso siguiente. El encabezado (comentario de propósito + nota de `declare(strict_types=1)` omitido a propósito) vive versionado en `backend-api/src/Config/aplicacion.php`: no se pega aquí para evitar desfases.

- [ ] **Step 3: Crear `src/Config/constantes_negocio.php`**

El código vive versionado en `backend-api/src/Config/constantes_negocio.php` (fuente única de verdad; `PRECIO_MAIZ_TON=178`, `PRECIO_MAIZ_FUENTE='MAG 2024'`). No se pega aquí para evitar desfases: consultarlo/leerlo directamente del repo.

- [ ] **Step 4: Convertir `backend-api/config/database.php` en shim temporal**

Reemplazar TODO el contenido por un shim que haga `require_once` de `src/Config/aplicacion.php` y `src/Config/constantes_negocio.php`. El código vive versionado en `backend-api/config/database.php` (fuente única de verdad). No se pega aquí para evitar desfases: consultarlo/leerlo directamente del repo.

- [ ] **Step 5: Verificar que el sistema sigue operando**

Run: `(Invoke-WebRequest -Uri 'http://localhost/ZeaSys/backend-api/public/index.php/api/simulaciones/ia-status' -UseBasicParsing -TimeoutSec 5).StatusCode`
Expected: `200` (el endpoint público sigue funcionando con el shim).

- [ ] **Step 6: Commit del avance del kernel**

```bash
git add backend-api/src backend-api/config/database.php
git commit -m "refactor(backend): kernel de autoload, errores, peticion/respuesta, cors y contenedor DI"
```

### Task 6: Router declarativo + tabla de rutas + nuevo front controller

**Files:**
- Create: `backend-api/src/Kernel/AutenticacionMiddleware.php`
- Create: `backend-api/src/Kernel/Router.php`
- Create: `backend-api/src/Config/rutas.php`
- Create: `backend-api/src/Config/contenedor.php`
- Modify: `backend-api/public/index.php` (reemplazo completo)
- Backup: guardar el index anterior como `backend-api/public/index.legacy.php.txt` (referencia durante F01–F05; se borra en F06)

- [ ] **Step 1: Crear `AutenticacionMiddleware.php`** (preserva EXACTAMENTE el comportamiento actual: rutas públicas y cierre de sesión selectivo)

El código vive versionado en `backend-api/src/Kernel/AutenticacionMiddleware.php` (fuente única de verdad; auth 401 + cierre selectivo según el flag `'sesion' => true` de la tabla de rutas). No se pega aquí para evitar desfases: consultarlo/leerlo directamente del repo.

- [ ] **Step 2: Crear `Router.php`**

El código vive versionado en `backend-api/src/Kernel/Router.php` (fuente única de verdad; resolución de ruta idéntica al original, `despachar(Peticion, ?ruta)` con guard de despacho dinámico). No se pega aquí para evitar desfases: consultarlo/leerlo directamente del repo.

- [ ] **Step 3: Crear `src/Config/rutas.php`** (TODAS las rutas actuales; en F01 apuntan a los controladores legacy sin namespace)

La tabla vive versionada en `backend-api/src/Config/rutas.php` (fuente única de verdad; TODAS las rutas con los flags `'publica'`/`'sesion'`). No se pega aquí para evitar desfases: consultarla/leerla directamente del repo.

NOTA IMPORTANTE (paridad exacta con el original): `api/cultivos` es la ÚNICA ruta con despacho por método (`GET → listar`, `POST → crear`, `PUT → actualizar`, `DELETE → eliminar`, cualquier otro método → `405 {"error":"Método no permitido."}`). El resto de rutas acepta cualquier método, igual que hoy. El orden original se conserva: middleware de autenticación (401) ANTES del gate de método (405). Verificar en Step 6 con la suite.

- [ ] **Step 4: Crear `src/Config/contenedor.php`**

El código vive versionado en `backend-api/src/Config/contenedor.php` (fuente única de verdad; bindings de los controladores legacy). No se pega aquí para evitar desfases: consultarlo/leerlo directamente del repo.

- [ ] **Step 5: Reemplazar `backend-api/public/index.php` por el nuevo bootstrap**

Antes: copiar el actual a `backend-api/public/index.legacy.php.txt`.

El bootstrap vive versionado en `backend-api/public/index.php` (fuente única de verdad; front controller delgado). No se pega aquí para evitar desfases: consultarlo/leerlo directamente del repo.

NOTA sobre `SESSION_NAME`: el original usaba el literal `'AGROPREDICT_SESSION'` y `aplicacion.php` define `SESSION_NAME` con ese mismo valor — verificar que coincida antes de continuar.

- [ ] **Step 6: Verificación de la puerta F01 — suite de contrato completa**

Run: `C:\xampp\php\php.exe backend-api\tests\contrato\ejecutar.php --modo=comparar`
Expected: `== CONTRATO OK: sin diferencias ==` (exit 0). Si algo falla: corregir SOLO el kernel (las rutas/acciones deben replicar exactamente el comportamiento del switch original) y repetir.

- [ ] **Step 7: Commit de la fase F01**

```bash
git add backend-api/src backend-api/public/index.php backend-api/public/index.legacy.php.txt
git commit -m "refactor(backend): front controller delgado con router declarativo, DI y rutas en tabla"
```

## Fase F02 — Dominio Autenticación

> **Puerta de salida:** `CONTRATO OK` con el dominio nuevo enrutado y `AuthController` legacy eliminado.
>
> **Convención de portado (válida F02–F05):** para cada clase nueva que sea un *portado* indico firma, rol, reglas mecánicas exactas y su origen en el commit `e89067d`. El código ya existe: se mueve, no se reescribe. Toda respuesta (`echo json_encode(...); exit;`) pasa a `return [...];` y todo error pasa a excepción tipada **conservando el mensaje literal** (la suite compara mensajes).

### Task 7: Config de Google + contratos e infraestructura de Autenticación

**Files:**
- Create: `backend-api/src/Config/google.php`
- Modify: `backend-api/config/google.php` (shim)
- Create: `backend-api/src/Dominios/Autenticacion/Dominio/UsuarioRepositoryInterface.php`
- Create: `backend-api/src/Dominios/Autenticacion/Dominio/VerificadorTokenGoogleInterface.php`
- Create: `backend-api/src/Dominios/Autenticacion/Dominio/AlmacenAvatarInterface.php`
- Create: `backend-api/src/Dominios/Autenticacion/Dominio/GestorSesionInterface.php`
- Create: `backend-api/src/Dominios/Autenticacion/Infraestructura/GestorSesion.php`
- Create: `backend-api/src/Dominios/Autenticacion/Infraestructura/VerificadorTokenGoogle.php`
- Create: `backend-api/src/Dominios/Autenticacion/Infraestructura/AlmacenAvatarArchivos.php`
- Create: `backend-api/src/Dominios/Autenticacion/Infraestructura/UsuarioRepositoryMysql.php`

- [ ] **Step 1: Mover `config/google.php` a `src/Config/google.php`** (contenido verbatim, 7 líneas) y dejar `backend-api/config/google.php` como shim:

```php
<?php
// Shim temporal (F02–F06).
require_once __DIR__ . '/../src/Config/google.php';
```

- [ ] **Step 2: Crear `UsuarioRepositoryInterface.php`** — refleja EXACTAMENTE los métodos públicos de `models/Usuario.php` (líneas 29–158):

```php
<?php
declare(strict_types=1);

namespace ZeaSys\Dominios\Autenticacion\Dominio;

interface UsuarioRepositoryInterface
{
    /** @return array<string, mixed>|false  (false = credenciales inválidas o inactivo) */
    public function login(string $correo, string $contrasena);

    public function registrar(string $nombre, string $correo, string $contrasena): int;

    public function existeCorreo(string $correo): bool;

    /** @return array<string, mixed>|null */
    public function obtenerPorId(int $id): ?array;

    public function actualizarFotoPerfil(int $id, ?string $fotoUrl, int $esGoogle = 0): bool;

    public function existeCorreoParaOtro(string $correo, int $id): bool;

    public function obtenerPasswordHash(int $id): ?string;

    public function actualizarUsuario(int $id, string $nombre, ?string $contrasenaHash = null): bool;

    public function eliminarUsuario(int $id): bool;

    /** @return array<string, mixed>|false */
    public function buscarOCrearPorGoogle(string $nombre, string $correo, ?string $picture = null);
}
```

- [ ] **Step 3: Crear `VerificadorTokenGoogleInterface.php`**

```php
<?php
declare(strict_types=1);

namespace ZeaSys\Dominios\Autenticacion\Dominio;

interface VerificadorTokenGoogleInterface
{
    /**
     * Valida el id_token contra Google.
     * @return array{nombre: string, correo: string, picture: string}
     * @throws \ZeaSys\Kernel\Errores\NoAutorizadoException token inválido/expirado o aud distinta
     * @throws \ZeaSys\Kernel\Errores\ValidacionException sin correo en el payload
     */
    public function verificar(string $idToken): array;
}
```

- [ ] **Step 4: Crear `AlmacenAvatarInterface.php`**

```php
<?php
declare(strict_types=1);

namespace ZeaSys\Dominios\Autenticacion\Dominio;

interface AlmacenAvatarInterface
{
    /**
     * Valida y guarda una foto de perfil.
     * @param array<string, mixed> $archivo  Entrada de $_FILES (p. ej. $_FILES['foto'])
     * @return string URL pública: /backend-api/public/uploads/avatars/...
     */
    public function guardar(array $archivo, int $usuarioId): string;
}
```

- [ ] **Step 5: Crear `GestorSesionInterface.php`** y `GestorSesion.php` (encapsula las claves `usuario_id`, `nombre`, `correo` — las únicas usadas hoy):

```php
<?php
declare(strict_types=1);

namespace ZeaSys\Dominios\Autenticacion\Dominio;

interface GestorSesionInterface
{
    /** @param array{id: int|string, nombre: string, correo: string} $usuario */
    public function iniciar(array $usuario): void;

    /** Idéntico al logout actual: session_destroy() + session_start(). */
    public function cerrar(): void;

    public function usuarioId(): ?int;

    public function actualizarNombre(string $nombre): void;
}
```

```php
<?php
declare(strict_types=1);

namespace ZeaSys\Dominios\Autenticacion\Infraestructura;

use ZeaSys\Dominios\Autenticacion\Dominio\GestorSesionInterface;

final class GestorSesion implements GestorSesionInterface
{
    public function iniciar(array $usuario): void
    {
        $_SESSION['usuario_id'] = (int) $usuario['id'];
        $_SESSION['nombre']     = $usuario['nombre'];
        $_SESSION['correo']     = $usuario['correo'];
    }

    public function cerrar(): void
    {
        session_destroy();
        session_start();
    }

    public function usuarioId(): ?int
    {
        return isset($_SESSION['usuario_id']) ? (int) $_SESSION['usuario_id'] : null;
    }

    public function actualizarNombre(string $nombre): void
    {
        $_SESSION['nombre'] = $nombre;
    }
}
```

- [ ] **Step 6: Crear `VerificadorTokenGoogle.php`** (código completo; es el bloque verbatim de `googleLogin()` líneas 119–153, convertido a excepciones):

```php
<?php
declare(strict_types=1);

namespace ZeaSys\Dominios\Autenticacion\Infraestructura;

use ZeaSys\Dominios\Autenticacion\Dominio\VerificadorTokenGoogleInterface;
use ZeaSys\Kernel\Errores\NoAutorizadoException;
use ZeaSys\Kernel\Errores\ValidacionException;

final class VerificadorTokenGoogle implements VerificadorTokenGoogleInterface
{
    public function verificar(string $idToken): array
    {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, 'https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($idToken));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200 || empty($response)) {
            throw new NoAutorizadoException('El token de Google no es válido o ha expirado.');
        }

        $payload = json_decode($response, true);
        $email   = trim($payload['email'] ?? '');
        $nombre  = trim($payload['name'] ?? 'Usuario de Google');
        $picture = trim($payload['picture'] ?? '');
        if (!empty($picture)) {
            $picture = preg_replace('/=s\d+(-c)?$/i', '=s400', $picture);
        }
        $aud = trim($payload['aud'] ?? '');

        if (empty($email)) {
            throw new ValidacionException('No se pudo obtener el correo del token de Google.');
        }

        if (defined('GOOGLE_CLIENT_ID') && GOOGLE_CLIENT_ID !== '' && $aud !== GOOGLE_CLIENT_ID) {
            throw new NoAutorizadoException('La audiencia del token de Google no coincide con la aplicación registrada.');
        }

        return ['nombre' => $nombre, 'correo' => $email, 'picture' => $picture];
    }
}
```

- [ ] **Step 7: Crear `AlmacenAvatarArchivos.php`** (código completo; port de `uploadAvatar()` líneas 368–432, con las 4 validaciones y mensajes EXACTOS):

```php
<?php
declare(strict_types=1);

namespace ZeaSys\Dominios\Autenticacion\Infraestructura;

use ZeaSys\Dominios\Autenticacion\Dominio\AlmacenAvatarInterface;
use ZeaSys\Kernel\Errores\ValidacionException;
use ZeaSys\Kernel\Errores\ZeaSysException;

final class AlmacenAvatarArchivos implements AlmacenAvatarInterface
{
    private const MAX_BYTES = 5242880; // 5 MB
    private const MIMES_PERMITIDOS = [
        'image/jpeg' => 'jpg',
        'image/png'  => 'png',
        'image/webp' => 'webp',
        'image/gif'  => 'gif',
    ];

    public function guardar(array $archivo, int $usuarioId): string
    {
        if (($archivo['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            throw new ValidacionException('No se ha seleccionado ningún archivo o ocurrió un error al subirlo.');
        }

        if ($archivo['size'] > self::MAX_BYTES) {
            throw new ValidacionException('El archivo supera el tamaño máximo permitido de 5 MB.');
        }

        $finfo    = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $archivo['tmp_name']);
        finfo_close($finfo);

        if (!array_key_exists($mimeType, self::MIMES_PERMITIDOS)) {
            throw new ValidacionException('El formato del archivo no es permitido. Suba una imagen JPG, PNG, WEBP o GIF.');
        }
        $ext = self::MIMES_PERMITIDOS[$mimeType];

        $uploadDir = __DIR__ . '/../../../../public/uploads/avatars/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        $filename = 'avatar_' . $usuarioId . '_' . time() . '.' . $ext;
        if (!move_uploaded_file($archivo['tmp_name'], $uploadDir . $filename)) {
            throw new ZeaSysException('No se pudo guardar la imagen en el servidor.', 500);
        }

        return '/backend-api/public/uploads/avatars/' . $filename;
    }
}
```

- [ ] **Step 8: Crear `UsuarioRepositoryMysql.php`** — copia `models/Usuario.php` completo y aplica SOLO estos cambios mecánicos:
  1. `namespace ZeaSys\Dominios\Autenticacion\Infraestructura;`
  2. `final class UsuarioRepositoryMysql implements UsuarioRepositoryInterface`
  3. Constructor: `public function __construct(private \PDO $db) {}` — **se conserva `$this->asegurarColumnasPerfil();` tal cual** (comportamiento actual; queda registrado como deuda en ADR-07).
  4. Eliminar `require_once __DIR__ . '/../config/database.php';`
  5. Todo lo demás (métodos, SQL, mensajes) verbatim.

- [ ] **Step 9: Verificar sintaxis de todo lo creado**

Run: `Get-ChildItem backend-api\src\Dominios -Recurse -Filter *.php | ForEach-Object { & C:\xampp\php\php.exe -l $_.FullName }`
Expected: `No syntax errors detected` en todos.

### Task 8: AutenticacionService + AuthController nuevo + switch de rutas

**Files:**
- Create: `backend-api/src/Dominios/Autenticacion/Aplicacion/AutenticacionService.php`
- Create: `backend-api/src/Dominios/Autenticacion/Http/AuthController.php`
- Modify: `backend-api/src/Config/contenedor.php` (bindings del dominio)
- Modify: `backend-api/src/Config/rutas.php` (ids del dominio)
- Modify: `backend-api/public/index.php` (quitar `require_once` de AuthController legacy)
- Delete: `backend-api/controllers/AuthController.php`

- [ ] **Step 1: Crear `AutenticacionService.php`** — port método a método del `AuthController` legacy (origen: `e89067d:backend-api/controllers/AuthController.php`):

Tabla de mapeo (método nuevo ← método legacy / líneas):

| Método del servicio | Origen | Reemplazos mecánicos |
|---|---|---|
| `me(): array` | `me()` 16–40 | `$_SESSION['usuario_id']` → `$this->sesion->usuarioId()` |
| `login(Peticion $p): array` | `login()` 41–103 | sesión → `$this->sesion->iniciar($usuario)`; conservar `setcookie` de "remember" verbatim |
| `googleLogin(Peticion $p): array` | `googleLogin()` 104–194 | bloque cURL+tipo 119–153 → `$this->google->verificar($idToken)`; `if ($usuario)` falso → `throw new AccesoDenegadoException('Este usuario está desactivado en el sistema.')` |
| `registro(Peticion $p): array` | `registro()` 196–267 | correo duplicado → `throw new ZeaSysException('Este correo ya está registrado.', 409)` |
| `logout(): array` | `logout()` 269–276 | `session_destroy(); session_start();` → `$this->sesion->cerrar()` |
| `update(Peticion $p): array` | `update()` 278–355 | `$_SESSION['nombre'] = $nombre;` → `$this->sesion->actualizarNombre($nombre)` |
| `uploadAvatar(): array` | `uploadAvatar()` 357–433 | validaciones 368–405 → `$this->avatares->guardar($_FILES['foto'] ?? [], $usuarioId)` |
| `deleteAvatar(): array` | `deleteAvatar()` 435–461 | — |
| `syncGoogleAvatar(Peticion $p): array` | `syncGoogleAvatar()` 463–502 | — |
| `eliminar(): array` | `eliminar()` 504–527 | `session_destroy(); session_start();` → `$this->sesion->cerrar()` |

Reglas de conversión (todas):
- `http_response_code(401) + echo json_encode(['error' => M]); exit;` → `throw new NoAutorizadoException(M)` (M literal).
- `... 400 ...` → `throw new ValidacionException(M)`. `403` → `AccesoDenegadoException(M)`. `404` → `RecursoNoEncontradoException(M)`. `500` → relanzar como `ZeaSysException("Error al ...: " . $e->getMessage(), 500)` conservando el prefijo del mensaje original.
- Éxitos → `return [ ... ];` (payload literal).
- Peticiones: `file_get_contents('php://input') + json_decode` → `$p->cuerpo()`; `$_GET['x']` → `$p->query('x')`.
- Constructor:

```php
public function __construct(
    private UsuarioRepositoryInterface $usuarios,
    private VerificadorTokenGoogleInterface $google,
    private AlmacenAvatarInterface $avatares,
    private GestorSesionInterface $sesion,
) {
}
```

- [ ] **Step 2: Crear `AuthController.php` nuevo** (código completo — capa Http ultra-delgada):

```php
<?php
declare(strict_types=1);

namespace ZeaSys\Dominios\Autenticacion\Http;

use ZeaSys\Dominios\Autenticacion\Aplicacion\AutenticacionService;
use ZeaSys\Kernel\Peticion;
use ZeaSys\Kernel\RespuestaJson;

final class AuthController
{
    public function __construct(private AutenticacionService $servicio)
    {
    }

    public function me(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->me()); }
    public function login(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->login($peticion)); }
    public function googleLogin(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->googleLogin($peticion)); }
    public function registro(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->registro($peticion)); }
    public function logout(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->logout()); }
    public function update(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->update($peticion)); }
    public function uploadAvatar(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->uploadAvatar()); }
    public function deleteAvatar(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->deleteAvatar()); }
    public function syncGoogleAvatar(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->syncGoogleAvatar($peticion)); }
    public function eliminar(Peticion $peticion): void { RespuestaJson::enviar($this->servicio->eliminar()); }
}
```

- [ ] **Step 3: Añadir bindings en `contenedor.php`** (dentro del closure, ANTES de devolver; añadir el `require_once` de google y los `use`):

```php
require_once __DIR__ . '/google.php';

$contenedor->registrar(
    \ZeaSys\Dominios\Autenticacion\Dominio\UsuarioRepositoryInterface::class,
    static fn (): \ZeaSys\Dominios\Autenticacion\Infraestructura\UsuarioRepositoryMysql =>
        new \ZeaSys\Dominios\Autenticacion\Infraestructura\UsuarioRepositoryMysql(getConnection())
);
$contenedor->registrar(
    \ZeaSys\Dominios\Autenticacion\Dominio\VerificadorTokenGoogleInterface::class,
    static fn (): \ZeaSys\Dominios\Autenticacion\Infraestructura\VerificadorTokenGoogle =>
        new \ZeaSys\Dominios\Autenticacion\Infraestructura\VerificadorTokenGoogle()
);
$contenedor->registrar(
    \ZeaSys\Dominios\Autenticacion\Dominio\AlmacenAvatarInterface::class,
    static fn (): \ZeaSys\Dominios\Autenticacion\Infraestructura\AlmacenAvatarArchivos =>
        new \ZeaSys\Dominios\Autenticacion\Infraestructura\AlmacenAvatarArchivos()
);
$contenedor->registrar(
    \ZeaSys\Dominios\Autenticacion\Dominio\GestorSesionInterface::class,
    static fn (): \ZeaSys\Dominios\Autenticacion\Infraestructura\GestorSesion =>
        new \ZeaSys\Dominios\Autenticacion\Infraestructura\GestorSesion()
);
$contenedor->registrar(
    \ZeaSys\Dominios\Autenticacion\Aplicacion\AutenticacionService::class,
    static fn (Container $c): \ZeaSys\Dominios\Autenticacion\Aplicacion\AutenticacionService =>
        new \ZeaSys\Dominios\Autenticacion\Aplicacion\AutenticacionService(
            $c->get(\ZeaSys\Dominios\Autenticacion\Dominio\UsuarioRepositoryInterface::class),
            $c->get(\ZeaSys\Dominios\Autenticacion\Dominio\VerificadorTokenGoogleInterface::class),
            $c->get(\ZeaSys\Dominios\Autenticacion\Dominio\AlmacenAvatarInterface::class),
            $c->get(\ZeaSys\Dominios\Autenticacion\Dominio\GestorSesionInterface::class),
        )
);
$contenedor->registrar(
    \ZeaSys\Dominios\Autenticacion\Http\AuthController::class,
    static fn (Container $c): \ZeaSys\Dominios\Autenticacion\Http\AuthController =>
        new \ZeaSys\Dominios\Autenticacion\Http\AuthController(
            $c->get(\ZeaSys\Dominios\Autenticacion\Aplicacion\AutenticacionService::class)
        )
);
```

Y ELIMINAR el string `'AuthController'` del array `$legacy` (el loop de registros legacy sigue para los demás dominios).

- [ ] **Step 4: Actualizar `rutas.php`** — reemplazar TODOS los `'controlador' => 'AuthController'` por `'controlador' => \ZeaSys\Dominios\Autenticacion\Http\AuthController::class` (10 rutas).

- [ ] **Step 5: Limpiar legacy**: en `public/index.php` eliminar la línea `require_once __DIR__ . '/../controllers/AuthController.php';` y ejecutar `git rm backend-api/controllers/AuthController.php`. Verificar que nada más lo referencia:

Run: `rg -n "AuthController" backend-api --glob "!tests/**" --glob "!src/**"`
Expected: solo `public/index.legacy.php.txt` (referencia histórica) — si aparecen controladores de otros dominios referenciándolo, detenerse y revisar.

- [ ] **Step 6: Verificación de la puerta F02**

Run: `C:\xampp\php\php.exe backend-api\tests\contrato\ejecutar.php --modo=comparar`
Expected: `== CONTRATO OK: sin diferencias ==`. Este paso cubre registro, login, me, update, logout, avatares (subida/borrado/sync) y eliminación de cuenta contra la huella del sistema original.

- [ ] **Step 7: Commit de la fase F02**

```bash
git add -A backend-api/src backend-api/config/google.php backend-api/public/index.php backend-api/controllers/AuthController.php
git commit -m "refactor(auth): dominio Autenticacion con servicio, repositorio, verificador Google y gestor de sesion"
```

---

## Fase F03 — Dominios Terreno y Lotes

> **Puerta de salida:** `CONTRATO OK`. `valores-ubicacion` y `climate` (comparación estructural) validan la extracción del acceso a Open-Meteo/SoilGrids.

### Task 9: Dominio Terreno (datos de clima/suelo + caché de archivos)

**Files:**
- Create: `backend-api/src/Dominios/Terreno/Dominio/CacheInterface.php`
- Create: `backend-api/src/Dominios/Terreno/Dominio/ProveedorClimaInterface.php`
- Create: `backend-api/src/Dominios/Terreno/Dominio/ProveedorSueloInterface.php`
- Create: `backend-api/src/Dominios/Terreno/Infraestructura/CacheArchivos.php`
- Create: `backend-api/src/Dominios/Terreno/Infraestructura/ProveedorOpenMeteo.php`
- Create: `backend-api/src/Dominios/Terreno/Infraestructura/ProveedorSoilGrids.php`
- Create: `backend-api/src/Dominios/Terreno/Aplicacion/ServicioDatosTerreno.php`

- [ ] **Step 1: Inventario obligatorio antes de mover**

Run: `rg -n "curl_|_URL|file_put_contents|file_get_contents|precision_data|usleep|time\(\)" backend-api/controllers/ClimateController.php`
Leer `ClimateController::consultarDatosApiPrecision()` (líneas 28–230) y clasificar cada bloque en: (a) caché de archivo, (b) llamada Open-Meteo, (c) llamada SoilGrids, (d) ensamblado/márgenes de error. Objetivo: mover (a)→`CacheArchivos`, (b)→`ProveedorOpenMeteo`, (c)→`ProveedorSoilGrids`, (d)→`ServicioDatosTerreno`. **Sin alterar URLs, timeouts, TTL (24 h), rutas de caché (`backend-api/data/cache/precision_data_*.json`), valores de fallback ni formato de retorno.**

- [ ] **Step 2: Crear las interfaces (código completo)**

```php
<?php
declare(strict_types=1);

namespace ZeaSys\Dominios\Terreno\Dominio;

interface CacheInterface
{
    /** @return array<string, mixed>|null  null = no existe o expiró */
    public function obtener(string $clave): ?array;

    /** @param array<string, mixed> $valor */
    public function guardar(string $clave, array $valor): void;

    /** Elimina precision_data_*.json con más de 24 h (port de limpiarCacheExpirada()). */
    public function limpiarExpirados(): void;
}
```

```php
<?php
declare(strict_types=1);

namespace ZeaSys\Dominios\Terreno\Dominio;

interface ProveedorClimaInterface
{
    /** @return array<string, mixed>  bloque 'clima' tal como lo arma el método original */
    public function obtenerClima(float $latitud, float $longitud, ?float $altitud): array;
}
```

```php
<?php
declare(strict_types=1);

namespace ZeaSys\Dominios\Terreno\Dominio;

interface ProveedorSueloInterface
{
    /** @return array<string, mixed>  bloque 'suelo' tal como lo arma el método original */
    public function obtenerSuelo(float $latitud, float $longitud): array;
}
```

- [ ] **Step 3: Crear `CacheArchivos.php`** — implementa `CacheInterface` moviendo los bloques detectados en Step 1 + el cuerpo de `SimulacionController::limpiarCacheExpirada()` (líneas 29–52). Directorio base: `__DIR__ . '/../../../../data/cache'` (ajustar al equivalente real de `backend-api/data/cache`). Nombre de archivo: mismo criterio que el original (`precision_data_{lat}_{lng}.json`).

- [ ] **Step 4: Crear `ProveedorOpenMeteo.php` y `ProveedorSoilGrids.php`** — cada uno mueve su bloque de cURL verbatim (URL, timeouts, user-agent si lo hubiera). Lanzan `ServicioExternoException` con el mensaje original del bloque en caso de fallo, para que `ServicioDatosTerreno` aplique el fallback exactamente como hoy.

- [ ] **Step 5: Crear `ServicioDatosTerreno.php`**

```php
final class ServicioDatosTerreno
{
    public function __construct(
        private CacheInterface $cache,
        private ProveedorClimaInterface $clima,
        private ProveedorSueloInterface $suelo,
    ) {
    }

    /**
     * Puerto literal de ClimateController::consultarDatosApiPrecision() (líneas 28–230).
     * @return array<string, mixed> misma estructura exacta (clima, suelo, source, ...)
     */
    public function obtener(float $latitud, float $longitud, ?float $altitud = null): array
```

El cuerpo del servicio: 1) consulta `$this->cache->obtener(...)`; 2) si falta, pide clima y suelo a los proveedores dentro del MISMO try/catch del original; 3) guarda en caché con el mismo formato; 4) devuelve la misma estructura (incluido `source`). Valores de fallback idénticos al original.

- [ ] **Step 6: Verificar sintaxis + commit intermedio**

```bash
Get-ChildItem backend-api\src\Dominios\Terreno -Recurse -Filter *.php | ForEach-Object { & C:\xampp\php\php.exe -l $_.FullName }
git add backend-api/src/Dominios/Terreno
git commit -m "refactor(terreno): dominio Terreno con cache de archivos y proveedores clima/suelo desacoplados"
```

### Task 10: Dominio Lotes (Cultivos)

**Files:**
- Create: `backend-api/src/Dominios/Lotes/Dominio/ValidadorLimitesEcuador.php`
- Create: `backend-api/src/Dominios/Lotes/Dominio/CultivoRepositoryInterface.php`
- Create: `backend-api/src/Dominios/Lotes/Infraestructura/CultivoRepositoryMysql.php`
- Create: `backend-api/src/Dominios/Lotes/Aplicacion/CultivoService.php`
- Create: `backend-api/src/Dominios/Lotes/Http/CultivoController.php`
- Delete (al final de la fase): `backend-api/controllers/CultivoController.php`, `backend-api/models/Cultivo.php`

- [ ] **Step 1: Crear `ValidadorLimitesEcuador.php`** (código completo; mensajes y límites EXACTOS del original; ¡preservar el comportamiento de `actualizar()`, donde null significa "no validar ese campo" — incluyendo la precedencia `&&`/`||` original!)

```php
<?php
declare(strict_types=1);

namespace ZeaSys\Dominios\Lotes\Dominio;

final class ValidadorLimitesEcuador
{
    public const LAT_MIN = -5.2;
    public const LAT_MAX = 1.6;
    public const LNG_MIN = -81.6;
    public const LNG_MAX = -75.0;
    public const MENSAJE_FUERA_DE_RANGO = 'Las coordenadas del lote están fuera del cuadrante de Ecuador continental (Latitud: [-5.2, 1.6], Longitud: [-81.6, -75.0]). El sistema DSS está restringido únicamente a parcelas dentro del territorio ecuatoriano.';

    /** Crear: exige ambas coordenadas presentes y dentro de rango (port de líneas 72–73). */
    public function validoAlCrear(?float $latitud, ?float $longitud): bool
    {
        return $latitud !== null && $longitud !== null
            && $latitud >= self::LAT_MIN && $latitud <= self::LAT_MAX
            && $longitud >= self::LNG_MIN && $longitud <= self::LNG_MAX;
    }

    /** Actualizar: null = no validar ese campo (port de líneas 146–147, con su precedencia original). */
    public function validoAlActualizar(?float $latitud, ?float $longitud): bool
    {
        return !($latitud !== null && ($latitud < self::LAT_MIN || $latitud > self::LAT_MAX)
            || $longitud !== null && ($longitud < self::LNG_MIN || $longitud > self::LNG_MAX));
    }
}
```

- [ ] **Step 2: Crear `CultivoRepositoryInterface.php`** — calcado de `models/Cultivo.php` (métodos: `crear`, `obtenerPorUsuario`, `obtenerPorId`, `obtenerConCoordenadas`, `actualizar`, `eliminar`, `contarPorUsuario`, `areaTotalPorUsuario`).

- [ ] **Step 3: Crear `CultivoRepositoryMysql.php`** — copia verbatim de `models/Cultivo.php` con los mismos 4 cambios mecánicos de F02 Task 7 Step 8 (namespace, implements, PDO por constructor, quitar require).

- [ ] **Step 4: Crear `CultivoService.php`** — port de `CultivoController` (líneas 25–281). Mapeo:

| Método nuevo | Origen | Notas |
|---|---|---|
| `listar(int $usuarioId): array` | `listar()` 25–32 | devuelve el array directo |
| `crear(int $usuarioId, Peticion $p): array` | `crear()` 34–93 | validaciones → `ValidacionException`; coordenadas → `ValidadorLimitesEcuador::validoAlCrear` + `ValidacionException(MENSAJE_FUERA_DE_RANGO)` |
| `actualizar(int $usuarioId, Peticion $p): array` | `actualizar()` 95–167 | permisos → `AccesoDenegadoException('No tiene permisos para editar esta parcela.')` |
| `eliminar(int $usuarioId, Peticion $p): array` | `eliminar()` 169–197 | id de `$p->query('id')` |
| `mapa(): array` | `mapa()` 199–206 | — |
| `obtenerValoresUbicacion(int $usuarioId, Peticion $p): array` | `obtenerValoresUbicacion()` 208–281 | **elimina** `new ClimateController()`: usa `ServicioDatosTerreno` inyectado (`$this->terreno->obtener($lat, $lng, $altitud)`); el bloque `if ($lat !== null && $lng !== null)` y el catch con `'Fallback por error en API: '` se conservan idénticos |

Constructor: `CultivoRepositoryInterface`, `ValidadorLimitesEcuador`, `ServicioDatosTerreno`, `GestorSesionInterface` (no — el usuarioId llega por parámetro desde el controller; sin GestorSesion aquí).

- [ ] **Step 5: Crear `CultivoController.php` nuevo** (patrón idéntico al de AuthController): 6 métodos ultra-delgados que llaman `RespuestaJson::enviar($this->servicio->...( ... ))`; el usuarioId se obtiene en el controller: `$usuarioId = (int) $_SESSION['usuario_id'];` — añadir `private function usuarioId(): int { return (int) $_SESSION['usuario_id']; }`. (El middleware ya garantiza la sesión para estas rutas.)

- [ ] **Step 6: Bindings + rutas + limpieza legacy**
  - `contenedor.php`: bindings `CultivoRepositoryInterface`→`CultivoRepositoryMysql(getConnection())`, `ValidadorLimitesEcuador`, `ServicioDatosTerreno` (con `CacheArchivos`, `ProveedorOpenMeteo`, `ProveedorSoilGrids`), `CultivoService`, `CultivoController`. Quitar `'CultivoController'` del array legacy.
  - `rutas.php`: las 3 rutas de cultivos → `\ZeaSys\Dominios\Lotes\Http\CultivoController::class` (conservar `'acciones' => [...]`).
  - `index.php`: quitar `require_once ... CultivoController.php`.
  - `git rm backend-api/controllers/CultivoController.php` (y `models/Cultivo.php` SOLO si ya nadie lo usa: `rg -n "models/Cultivo" backend-api` — `SimulacionController` legacy todavía lo usa; si es el caso, se borra en F04).

- [ ] **Step 7: Verificación de la puerta F03 + commit**

Run: `C:\xampp\php\php.exe backend-api\tests\contrato\ejecutar.php --modo=comparar`
Expected: `== CONTRATO OK: sin diferencias ==` (cubre CRUD de cultivos completo, mapa y valores de ubicación externos).

```bash
git add -A backend-api
git commit -m "refactor(lotes): dominio Lotes + terreno inyectado; cultivos sin acoplamiento entre controladores"
```

---

## Fase F04 — Dominio Simulaciones + Explicabilidad (Strategy)

> **Puerta de salida:** `CONTRATO OK`, con especial atención a los 3 pasos `explain` (cascada/ROI/probabilidad) y al paso `simular` (motor Flask).

### Task 11: Motor IA desacoplado (rompe la violación DIP del modelo)

**Files:**
- Create: `backend-api/src/Dominios/Simulaciones/Dominio/MotorPrediccionInterface.php`
- Create: `backend-api/src/Dominios/Simulaciones/Dominio/GestorMotorIaInterface.php`
- Create: `backend-api/src/Dominios/Simulaciones/Infraestructura/ClienteMotorFlask.php`
- Create: `backend-api/src/Dominios/Simulaciones/Infraestructura/GestorMotorIa.php`

- [ ] **Step 1: Crear interfaces (código completo)**

```php
<?php
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Dominio;

interface MotorPrediccionInterface
{
    /** @param array<string, mixed> $datos @return array<string, mixed>   respuesta cruda del motor (con success/error) */
    public function predecir(array $datos): array;
}
```

```php
<?php
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Dominio;

interface GestorMotorIaInterface
{
    public function estaActivo(): bool;

    /** @return array<string, mixed>|null */
    public function detallesSalud(): ?array;

    public function iniciar(): bool;

    /** @return array{running: bool, message: string, ...} */
    public function asegurarActivo(int $maxWaitSeconds = 15): array;

    /** @return array<string, mixed> */
    public function estado(bool $tryStart = false): array;
}
```

- [ ] **Step 2: Crear `ClienteMotorFlask.php`** — port verbatim de `Simulacion::predecir()` (`models/Simulacion.php` líneas 16–68): mismo endpoint `IA_SERVER_URL . '/predict'`, mismos timeouts/JSON. Constructor sin dependencias (usa la constante).

- [ ] **Step 3: Crear `GestorMotorIa.php`** — port verbatim de `IaServerHelper` (líneas 8–114): `isRunning→estaActivo`, `getHealthDetails→detallesSalud`, `start→iniciar` (mismo `auto_ia_server.bat`, misma ruta de proceso), `ensureRunning→asegurarActivo`, `getStatus→estado`. **Mismos mensajes y misma lógica de arranque del .bat.**

### Task 12: Repositorio de Simulaciones

**Files:**
- Create: `backend-api/src/Dominios/Simulaciones/Dominio/SimulacionRepositoryInterface.php`
- Create: `backend-api/src/Dominios/Simulaciones/Infraestructura/SimulacionRepositoryMysql.php`

- [ ] **Step 1: Interface** — refleja `models/Simulacion.php` SIN `predecir()`: `guardar(array $datos, array $resultado): int`, `obtenerPorUsuario(int $usuarioId, int $limite = 50, ?int $year = null): array`, `obtenerPorId(int $id): ?array`, `obtenerEstadisticas(int $usuarioId, ?int $year = null): array`, `obtenerRecientes(int $usuarioId, int $limite = 5, ?int $year = null): array`, `eliminar(int $id): bool`, `contarPorUsuario(int $usuarioId): int`.
- [ ] **Step 2: Implementación** — copia verbatim de `models/Simulacion.php` (líneas 70–180) con los 4 cambios mecánicos + `implements`; DELETE el método `predecir()` (vive en `ClienteMotorFlask`).
- [ ] **Step 3: Verificar sintaxis** — `php -l` como en fases anteriores.

### Task 13: Extraer la explicabilidad a Strategy (catálogo de explicadores)

**Files:**
- Create: `backend-api/src/Dominios/Simulaciones/Explicacion/Dominio/ExplicadorInterface.php`
- Create: `backend-api/src/Dominios/Simulaciones/Explicacion/Dominio/EvaluadorCondiciones.php`
- Create: `backend-api/src/Dominios/Simulaciones/Explicacion/Aplicacion/ResolutorContextoExplicacion.php`
- Create: `backend-api/src/Dominios/Simulaciones/Explicacion/Aplicacion/RegistroExplicadores.php`
- Create: `backend-api/src/Dominios/Simulaciones/Explicacion/Aplicacion/ServicioExplicabilidad.php`
- Create: `backend-api/src/Dominios/Simulaciones/Explicacion/Explicadores/*.php` (46 clases)

- [ ] **Step 1: Crear `ExplicadorInterface.php`**

```php
<?php
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Dominio;

interface ExplicadorInterface
{
    /** @param array<string, mixed> $contexto  @return list<array{titulo: string, tipo: string, contenido: string}> */
    public function construir(array $contexto): array;
}
```

- [ ] **Step 2: Crear `EvaluadorCondiciones.php`** (código completo; sustituye la cadena if/elseif de `strpos` preservando el orden del registro):

```php
<?php
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Dominio;

final class EvaluadorCondiciones
{
    /**
     * Formatos soportados:
     *  ['cualquiera' => ['cascada','brecha']]      → algún strpos
     *  ['todas'      => ['probabilidad','cosecha']] → todos los strpos
     *  ['y' => [cond, cond]] / ['o' => [cond, cond]] → composición recursiva
     */
    public function cumple(array $condicion, string $nombreLower): bool
    {
        if (isset($condicion['cualquiera'])) {
            foreach ($condicion['cualquiera'] as $texto) {
                if (strpos($nombreLower, $texto) !== false) { return true; }
            }
            return false;
        }
        if (isset($condicion['todas'])) {
            foreach ($condicion['todas'] as $texto) {
                if (strpos($nombreLower, $texto) === false) { return false; }
            }
            return true;
        }
        if (isset($condicion['y'])) {
            foreach ($condicion['y'] as $sub) {
                if (!$this->cumple($sub, $nombreLower)) { return false; }
            }
            return true;
        }
        if (isset($condicion['o'])) {
            foreach ($condicion['o'] as $sub) {
                if ($this->cumple($sub, $nombreLower)) { return true; }
            }
            return false;
        }
        return false;
    }
}
```

- [ ] **Step 3: Crear `ResolutorContextoExplicacion.php`** — port del preprocesamiento de `explain()` (líneas 240–352): obtener cultivo y simulación por año, calcular datos derivados, normalizar `datos_grafico` (`$dg`), etc. Devuelve un array asociativo `$contexto` con TODAS las claves que los explicadores consumen (incluida `datos_grafico` y los valores ya formateados). Regla: los cálculos intermedios NO se alteran; solo se empaquetan.

- [ ] **Step 4: Crear `RegistroExplicadores.php`** — lista ORDENADA (el orden ES el contrato: mismo orden de evaluación que los if/elseif originales). Cada regla:

```php
[
    'explicador' => \ZeaSys\Dominios\Simulaciones\Explicacion\Explicadores\ExplicadorCascada::class,
    'condicion'  => ['cualquiera' => ['cascada', 'brecha', 'limitante', 'contribuci']],
    'grafico'    => true,   // solo se evalúa si hay datos_grafico (bloque original líneas 350–426)
                     // si se omite, es regla de tarjeta (bloque 431+)
]
```

Tabla completa de reglas (todas de `SimulacionController::explain()`, commit `e89067d`; el orden de esta tabla ES el orden de evaluación):

| # | Clase (`Explicadores/`) | Condición (strpos, como array) | Línea origen | Grupo |
|---|---|---|---|---|
| 1 | `ExplicadorCascada` | cualquiera: cascada, brecha, limitante, contribuci | 354 | gráfico |
| 2 | `ExplicadorCurvaTemporal` | cualquiera: curva — **solo si `isset($dg['labels'])`** | 367 | gráfico |
| 3 | `ExplicadorDistribucionProbabilistica` | cualquiera: gauss, probabil, distribuc | 387 | gráfico |
| 4 | `ExplicadorSensibilidad` | cualquiera: sensibilidad | 412 | gráfico |
| 5 | `ExplicadorPotencialGenetico` | cualquiera: potencial, genético, genetico, límite genético | 434 | tarjeta |
| 6 | `ExplicadorRadiacionFotosintetica` | cualquiera: radiación, radiacion, par, fotosint | 445 | tarjeta |
| 7 | `ExplicadorRendimientoAlcanzable` | cualquiera: alcanzable | 456 | tarjeta |
| 8 | `ExplicadorCapacidadSuelo` | todas: capacidad, suelo | 467 | tarjeta |
| 9 | `ExplicadorAguaUtil` | cualquiera: agua, hídric, hidric, balance | 478 | tarjeta |
| 10 | `ExplicadorRendimientoPredicho` | cualquiera: predicho, estimado, cosecha esperada | 489 | tarjeta |
| 11 | `ExplicadorProbabilidadCosecha` | y: [cualquiera: probabilidad] + [cualquiera: cosecha, éxito, exito] | 502 | tarjeta |
| 12 | `ExplicadorIndiceCosecha` | cualquiera: índice de cosecha, indice de cosecha, harvest | 516 | tarjeta |
| 13 | `ExplicadorYieldGap` | cualquiera: gap, brecha | 527 | tarjeta |
| 14 | `ExplicadorPerdidaAgua` | y: [cualquiera: pérdida, perdida] + [cualquiera: agua, hídric, hidric] | 538 | tarjeta |
| 15 | `ExplicadorPerdidaNitrogeno` | y: [cualquiera: pérdida, perdida] + [cualquiera: nitrógeno, nitrogeno, n] (¡copiar condición literal!) | 549 | tarjeta |
| 16 | `ExplicadorLimitantePrincipal` | cualquiera: limitante, cuello | 560 | tarjeta |
| 17 | `ExplicadorAccionPrioritaria` | cualquiera: acción, accion, prioritaria, correctora | 571 | tarjeta |
| 18 | `ExplicadorFaseFenologica` | cualquiera: fase, fenológ, fenol, floración, floracion, emergencia, crecimiento, vegetativo, espigado | 582 | tarjeta |
| 19 | `ExplicadorROI` | cualquiera: roi, retorno | 594 | tarjeta |
| 20 | `ExplicadorMargenNeto` | cualquiera: margen, ganancia | 607 | tarjeta |
| 21 | `ExplicadorIngresoBruto` | cualquiera: ingreso | 620 | tarjeta |
| 22 | `ExplicadorCostoTotal` | cualquiera: costo, insumos | 631 | tarjeta |
| 23 | `ExplicadorBeneficioCosto` | cualquiera: beneficio, b-c | 642 | tarjeta |
| 24 | `ExplicadorPuntoEquilibrio` | cualquiera: equilibrio, break | 653 | tarjeta |
| 25 | `ExplicadorPrecioMinimo` | y: [cualquiera: precio] + [cualquiera: mínimo, minimo, piso] | 666 | tarjeta |
| 26 | `ExplicadorMargenSeguridad` | cualquiera: seguridad | 679 | tarjeta |
| 27 | `ExplicadorNivelConfianza` | cualquiera: confianza, monte carlo | 690 | tarjeta |
| 28 | `ExplicadorRiesgoFinanciero` | cualquiera: riesgo | 701 | tarjeta |
| 29 | `ExplicadorPerfilesProduccion` | cualquiera: perfiles, modelos de producción | 712 | tarjeta |
| 30 | `ExplicadorTIR` | cualquiera: tir, tasa interna | 723 | tarjeta |
| 31 | `ExplicadorGananciaPorDolar` | cualquiera: dólar, dolar | 734 | tarjeta |
| 32 | `ExplicadorENSO` | cualquiera: enso, niño, nino, oscilación | 746 | tarjeta |
| 33 | `ExplicadorLluviaPromedio` | cualquiera: lluvia — copiar la condición literal de la línea 757 | 757 | tarjeta |
| 34 | `ExplicadorAguaInicial` | copiar la condición literal de la línea 768 | 768 | tarjeta |
| 35 | `ExplicadorRiesgoEstacional` | cualquiera: riesgo estacional, compuesto, agronómico | 779 | tarjeta |
| 36 | `ExplicadorDesviacionMensual` | cualquiera: desviación, desviacion, anomalía | 790 | tarjeta |
| 37 | `ExplicadorAguaPorEstrato` | cualquiera: estrato | 801 | tarjeta |
| 38 | `ExplicadorRendimientoCentral` | cualquiera: central, esperado | 813 | tarjeta |
| 39 | `ExplicadorSuperarObjetivo` | cualquiera: superar — copiar condición literal de la línea 824 | 824 | tarjeta |
| 40 | `ExplicadorEstabilidad` | cualquiera: estabilidad | 835 | tarjeta |
| 41 | `ExplicadorFechaSiembra` | cualquiera: fecha, siembra — copiar condición literal de la línea 846 | 846 | tarjeta |
| 42 | `ExplicadorMesEspecifico` | copiar la condición literal de las líneas 857–866 ("mes de ...") | 857 | tarjeta |
| 43 | `ExplicadorComparadorHibridos` | cualquiera: comparador, híbridos, hibridos | 868 | tarjeta |
| 44 | `ExplicadorEstrategia` | cualquiera: estrategia | 879 | tarjeta |
| 45 | `ExplicadorGraficoGenerico` | cualquiera: gráfico, grafico, distribución, distribucion | 890 | tarjeta (última red antes del default) |
| 46 | `ExplicadorDefault` | (sin condición: fallback final si ninguna regla coincidió) | 900+ | tarjeta |

**IMPORTANTE — verificaciones al portar cada fila:**
1. Abrir la línea citada en `SimulacionController.php` y copiar la condición `strpos` LITERAL (las tablas anteriores son una transcripción; si hay discrepancia, gana el archivo original).
2. El nombre se normaliza UNA vez, igual que hoy; si el original usa `strtolower(...)`, usar exactamente la misma función (no `mb_strtolower` si el original no la usa).
3. Copiar el contenido (títulos `1. ...`, `'tipo' => 'info'|'success'|'warning'...`, interpolaciones `$variable`) SIN tocar ni un carácter.
4. Cada explicador devuelve las `$secciones` y NO arma la respuesta final (eso es del servicio, líneas 913–929 verbatim).

- [ ] **Step 5: Crear `ServicioExplicabilidad.php`** — orquestador:

```php
public function explicar(array $contextoBruto): array
{
    $contexto    = $this->resolutor->construir($contextoBruto);
    $nombreLower = /* misma normalización del original */;
    $secciones   = [];

    foreach ($this->registro->reglas() as $regla) {
        if (($regla['grafico'] ?? false) && !isset($contexto['datos_grafico'])) {
            continue; // paridad: el bloque gráfico original solo corre con datos_grafico
        }
        if (isset($regla['extra']) && !($regla['extra'])($contexto)) {
            continue; // p. ej. ExplicadorCurvaTemporal exige $dg['labels']
        }
        if (!$this->evaluador->cumple($regla['condicion'], $nombreLower)) {
            continue;
        }
        $clase     = $regla['explicador'];
        $secciones = (new $clase())->construir($contexto);
        break; // primer match gana, igual que if/elseif
    }

    // Ensamblado final VERBATIM de líneas 913–929 (mismas claves: titulo, explicacion_breve,
    // impacto_en_el_cultivo, nivel, recomendacion, alerta, offline).
    return [...];
}
```

- [ ] **Step 6: Prueba focalizada de estrategias** (antes de tocar rutas). Ejecutar 6 explicaciones distintas con `curl` contra el sistema ACTUAL y guardarlas; repetir TRAS el switch (Task 15) y comparar a ojo las más distintas: cascada (gráfico), ROI (financiera), probabilidad (probabilística), fecha siembra (temporal), riesgo estacional (compuesta), y una inventada (default). La suite cubre 3 de ellas automáticamente.

### Task 14: SimulacionService + controller + switch final del dominio

**Files:**
- Create: `backend-api/src/Dominios/Simulaciones/Aplicacion/SimulacionService.php`
- Create: `backend-api/src/Dominios/Simulaciones/Http/SimulacionController.php`
- Modify: `contenedor.php`, `rutas.php`, `public/index.php`
- Delete: `backend-api/controllers/SimulacionController.php`, `backend-api/models/Simulacion.php`, `backend-api/models/Cultivo.php` (si quedó), `backend-api/helpers/IaServerHelper.php`

- [ ] **Step 1: `SimulacionService.php`** — port de `SimulacionController` con inyección (`SimulacionRepositoryInterface`, `MotorPrediccionInterface`, `GestorMotorIaInterface`, `ServicioExplicabilidad`, `CacheInterface`, `CultivoRepositoryInterface` para validar pertenencia del lote):

| Método | Origen | Notas |
|---|---|---|
| `simular(int $usuarioId, Peticion $p): array` | `simular()` 54–164 | `IaServerHelper::ensureRunning()` → `$this->motorIa->asegurarActivo()`; `$this->simulacion->predecir()` → `$this->motor->predecir()`; mensajes exactos (400s, 403, 503, 502, 500) |
| `historial(int $usuarioId, Peticion $p): array` | `historial()` 166–181 | `limpiarCacheExpirada()` → `$this->cache->limpiarExpirados()` |
| `eliminar(int $usuarioId, Peticion $p): array` | `eliminar()` 183–211 | — |
| `iaStatus(Peticion $p): array` | `iaStatus()` 213–221 | `IaServerHelper::getStatus($tryStart)` → `$this->motorIa->estado($tryStart)` |
| `explain(int $usuarioId, Peticion $p): array` | `explain()` 223–929 | validaciones 225–238 + `$this->explicabilidad->explicar($contexto)`; conservar `set_time_limit(240)` |

- [ ] **Step 2: `SimulacionController.php` nuevo** — 5 métodos ultra-delgados: delegar en `RespuestaJson::enviar($this->servicio->metodo(...))`; `simular`, `historial`, `eliminar` y `explain` pasan `$this->usuarioId()` (mismo helper privado que CultivoController); `iaStatus` solo pasa `$peticion`.
- [ ] **Step 3: Bindings + rutas + limpieza**: como en fases previas para las 5 rutas de simulaciones; `git rm` de los 4 archivos legacy. Verificar `rg -n "IaServerHelper|models/Simulacion|models/Cultivo" backend-api --glob "!tests/**"` → sin coincidencias.
- [ ] **Step 4: Verificación de la puerta F04 + commit**

Run: `C:\xampp\php\php.exe backend-api\tests\contrato\ejecutar.php --modo=comparar`
Expected: `== CONTRATO OK: sin diferencias ==`. Además comparar a mano las 6 explicaciones del punto Task 13 Step 6.

```bash
git add -A backend-api
git commit -m "refactor(simulaciones): dominio Simulaciones con motor IA inyectado y explicabilidad por estrategias (46 explicadores)"
```

---

## Fase F05 — Dominio Analítica DSS (4 dashboards)

> **Puerta de salida:** `CONTRATO OK` con los 4 dashboards migrados y controladores delgados.

### Task 15: Catálogo agronómico + servicio/controlador de rendimiento (Yield)

**Files:**
- Create: `backend-api/src/Dominios/Analitica/Dominio/CatalogoAgronomicoInterface.php`
- Create: `backend-api/src/Dominios/Analitica/Infraestructura/RepositorioCatalogoAgronomico.php`
- Create: `backend-api/src/Dominios/Analitica/Aplicacion/ServicioAnaliticaYield.php`
- Create: `backend-api/src/Dominios/Analitica/Http/YieldController.php`

- [ ] **Step 1: `CatalogoAgronomicoInterface`**: `cargar(): array` (lee `agronomia_data.json`; localizar ruta real con `rg -n "agronomia_data" backend-api`). Implementación con cache en memoria por request (estático). **Los 4 dashboards la compartirán** (antes cada controlador lo releía).
- [ ] **Step 2: `ServicioAnaliticaYield.php`** — mover el cuerpo completo de `YieldController::index()` (líneas 28–final, commit `e89067d`) a `construir(?int $cultivoId, ?int $anio): array`; los `echo json_encode([...])` finales → `return [...]`. Dependencias inyectadas: `CultivoRepositoryInterface`, `SimulacionRepositoryInterface`, `CatalogoAgronomicoInterface`. **NO tocar la lógica del `mt_rand` (comportamiento actual; la comparación es tolerante).**
- [ ] **Step 3: `YieldController.php` nuevo** (delgado):

```php
final class YieldController
{
    public function __construct(private ServicioAnaliticaYield $servicio) {}

    public function index(Peticion $peticion): void
    {
        // Semántica EXACTA del original: isset($_GET[x]) && $_GET[x] !== '' ? intval : null
        $cultivoId = $peticion->query('cultivo_id');
        $anio      = $peticion->query('anio');

        RespuestaJson::enviar($this->servicio->construir(
            ($cultivoId !== null && $cultivoId !== '') ? (int) $cultivoId : null,
            ($anio !== null && $anio !== '') ? (int) $anio : null,
        ));
    }
}
```

(Conservar la semántica exacta de `$_GET['anio'] !== ''` del original para cada param.)

### Task 16: Servicios/controladores de Scenario y Financial

- [ ] **Step 1:** `ServicioAnaliticaScenario::construir(?int $cultivoId, ?int $anio): array` — cuerpo de `ScenarioController::index()` (líneas 28–final). Dependencias: igual que Yield.
- [ ] **Step 2:** `ServicioAnaliticaFinancial` — cuerpo de `FinancialController::index()` (líneas 28–final); conservar TODOS los `$_GET` (`precio_maiz_qq`, `rendimiento_qq`, `costo_semilla`, `costo_fert`, `costo_riego`, `costo_proteccion`, `otros_var`, `costos_variables`, `costos_fijos`) — la firma del servicio recibe la `Peticion` completa: `construir(Peticion $p): array`.
- [ ] **Step 3:** Controladores delgados `ScenarioController` y `FinancialController` (patrón Yield).

### Task 17: Servicio/controlador de Climate + switch final + limpieza

- [ ] **Step 1:** `ServicioAnaliticaClimate::construir(?int $cultivoId, ?int $anio): array` — cuerpo de `ClimateController::index()` (líneas 231–final). Dependencias: `CultivoRepositoryInterface`, `SimulacionRepositoryInterface`, `ServicioDatosTerreno` (sustituye la llamada interna a `consultarDatosApiPrecision`). Conservar la limpieza de caché si el original la invoca.
- [ ] **Step 2:** Controlador delgado `ClimateController` nuevo.
- [ ] **Step 3: Bindings + rutas + limpieza**: `rutas.php` para las 4 rutas DSS → controladores de `ZeaSys\Dominios\Analitica\Http\...`; bindings de los 4 servicios + catálogo; `git rm` de los 4 controladores legacy (`ScenarioController.php`, `ClimateController.php`, `YieldController.php`, `FinancialController.php`); quitar sus `require_once` de `index.php`.
- [ ] **Step 4: Verificación de la puerta F05 + commit**

Run: `C:\xampp\php\php.exe backend-api\tests\contrato\ejecutar.php --modo=comparar`
Expected: `== CONTRATO OK: sin diferencias ==` (los 4 dashboards; yield/financial tolerantes, climate estructural).

```bash
git add -A backend-api
git commit -m "refactor(analitica): dashboards DSS como servicios con catalogo compartido y controladores delgados"
```

---

## Fase F06 — Limpieza, documentación y verificación integral

### Task 18: Limpieza total de la estructura legacy

- [ ] **Step 1: Verificar que no queda ningún consumidor legacy**

```powershell
rg -n "require_once.*(controllers|models|helpers)" backend-api --glob "!tests/**" --glob "!src/**"
rg -n "config/(database|google)" backend-api --glob "!tests/**"
rg -n "new (AuthController|CultivoController|SimulacionController|ScenarioController|ClimateController|YieldController|FinancialController)\(" backend-api --glob "!tests/**"
```
Expected: sin coincidencias (salvo `index.legacy.php.txt`, que se borra en el paso siguiente).

- [ ] **Step 2: Eliminar shims y residuos**

```powershell
git rm backend-api/public/index.legacy.php.txt backend-api/config/database.php
# Solo si quedó el shim de google:
git rm backend-api/config/google.php
```
Vaciar/eliminar `backend-api/controllers/`, `backend-api/models/`, `backend-api/helpers/` y `backend-api/config/` si quedaron vacíos (`git status` lo confirmará).

- [ ] **Step 3: Confirmar `index.php` final** — debe quedar SIN ningún `require_once` de controladores (solo autoloader + config), y el directorio `backend-api/` debe verse así:

```
backend-api/
├── public/index.php            ← bootstrap ~45 líneas
├── src/
│   ├── Kernel/                 ← Autoloader, Router, Container, Peticion, RespuestaJson, Cors,
│   │   └── Errores/            ←   Middleware, excepciones tipadas + ManejadorErrores
│   ├── Config/                 ← aplicacion.php, constantes_negocio.php, google.php, rutas.php, contenedor.php
│   └── Dominios/
│       ├── Autenticacion/      ← Dominio/ Infraestructura/ Aplicacion/ Http/
│       ├── Lotes/
│       ├── Terreno/
│       ├── Simulaciones/       ← + Explicacion/ (46 explicadores)
│       └── Analitica/
├── data/ · uploads/ · tests/   ← sin cambios
```

- [ ] **Step 4: Verificación final de la suite + commit**

Run: `C:\xampp\php\php.exe backend-api\tests\contrato\ejecutar.php --modo=comparar`
Expected: `== CONTRATO OK: sin diferencias ==`

```bash
git add -A
git commit -m "refactor(backend): eliminacion de estructura legacy, shims y archivos temporales"
```

### Task 19: Documentación (arquitectura + 7 ADRs)

- [ ] **Step 1: Reescribir `documentacion/arquitectura.md`** con: (a) diagrama ASCII de los 5 dominios y sus 4 capas (regla de dependencia: Http → Aplicación → Dominio ← Infraestructura); (b) tabla ruta → controlador → servicio → repositorio/interfaz; (c) flujo de una petición (index.php → Router → Middleware → Container → Controller → Service → Repo); (d) cómo agregar un indicador DSS nuevo (crear explicador + registrarlo); (e) cómo agregar una ruta; (f) comandos de la suite de contrato; (g) mapa de bindings del contenedor.
- [ ] **Step 2: Crear los 7 ADRs en `documentacion/adr/`** (formato: Título, Estado, Contexto, Decisión, Consecuencias; 25–40 líneas cada uno):
  - `ADR-001-microservicios-logicos.md`: por qué dominios lógicos sobre XAMPP y no servicios físicos (restricción obligatoria, costo operativo, mismo repositorio, límites de dominio claros, camino de migración futura).
  - `ADR-002-kernel-sin-framework.md`: autoloader PSR-4 manual, sin Composer ni framework (contexto XAMPP/portabilidad, ~15 clases propias, fuente del routing/DI).
  - `ADR-003-router-declarativo.md`: tabla `rutas.php` como única fuente de verdad; orden middleware→método; extensión futura a parámetros de ruta; por qué `acciones` para `api/cultivos`.
  - `ADR-004-contratos-congelados-y-suite-de-contrato.md`: política de no cambiar rutas/payloads durante la migración; diseño de la suite (normalización de volátiles, tolerancias, estructural para APIs externas); control negativo; exit codes.
  - `ADR-005-strategy-para-explicabilidad.md`: 46 explicadores + registro ordenado; el orden de matching es contrato; beneficios (nuevo indicador = 1 clase + 1 fila) y riesgos (regresiones de orden → cubiertas por la suite).
  - `ADR-006-contenedor-di-manual.md`: fábricas explícitas sin autowiring; singletons por request; trade-offs vs contenedor con reflexión.
  - `ADR-007-deuda-tecnica-aceptada.md`: ALTERs de `asegurarColumnasPerfil()` en cada request (se conserva por paridad), `mt_rand` en pérdidas por fecha de siembra, uploads de avatar sin limpieza de archivos, rutas sin parámetros dinámicos, sin rate-limiting.
- [ ] **Step 3: Commit de documentación**

```bash
git add documentacion
git commit -m "docs(arquitectura): estructura de dominios, guia de extension y 7 ADRs de la reestructuracion"
```

### Task 20: Verificación integral final (puerta de cierre)

- [ ] **Step 1: Suite completa de contrato** → `== CONTRATO OK: sin diferencias ==` (exit 0).
- [ ] **Step 2: Control negativo nuevamente** (la red de seguridad sigue viva): repetir Task 2 Steps 1–3 → debe FALLAR con la huella dañada.
- [ ] **Step 3: Smoke test manual del sistema completo** (lo ejecuta el usuario desde el navegador, con checklist):
  1. Frontend en `http://localhost:5173` carga el login.
  2. Registro de un usuario nuevo y login.
  3. Crear lote con ubicación en mapa (coordenadas dentro de Ecuador).
  4. Correr una simulación y ver resultado + guardado en historial.
  5. Dashboards: Rendimiento, Escenarios, Clima, Financiero (con datos del lote).
  6. Explicar un indicador del dashboard (varias tarjetas distintas).
  7. Editar perfil, subir avatar, cerrar sesión.
- [ ] **Step 4: Tag final y cierre**

```bash
git tag v1.0-reestructurado
git log --oneline -15
```
Expected: se ven los commits por fase (F00–F06) sobre `e89067d`.

- [ ] **Step 5: Informe final al usuario** — resumen de: estructura nueva, fases completadas, resultado de la suite, ADRs, deuda técnica registrada, y siguiente paso (subproyecto 2: chatbot sobre `documentacion/` + explicadores).

---

## Autocontrol del plan (ejecutado al escribirlo)

> Este bloque documenta la revisión del propio plan antes de entregarlo (writing-plans: "self-review").

1. **Cobertura del spec**: todos los puntos del diseño aprobado tienen tarea — 5 dominios (F02–F05), kernel (F01), DIP de `Simulacion` y `CultivoController` (F03–F04), Strategy de `explain()` (F04), errores tipados (F01), verificación antes/después (F00+puertas), docs/ADRs (F06).
2. **Sin placeholders**: todo lo nuevo con código completo; lo portado con origen exacto (archivo + líneas del commit `e89067d`) y reglas mecánicas.
3. **Consistencia de nombres**: `Container` (no Contenedor), `Peticion`, `RespuestaJson`, `ZeaSys\Kernel\Errores\*`, `ZeaSys\Dominios\<Dominio>\{Dominio,Infraestructura,Aplicacion,Http}` — verificada entre fases.
4. **Puntos de riesgo identificados**: orden del registro de explicadores (contrato), `acciones` por método en `api/cultivos` (única ruta con gate de método), `session_write_close` selectivo (const lista), doble `delete-avatar` en la suite (estable), `SESSION_NAME` (definida en `aplicacion.php`).
5. **Cada fase termina en**: suite de contrato OK + commit. Ninguna fase se cierra sin eso.


