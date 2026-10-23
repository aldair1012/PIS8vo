# Arquitectura ZeaSys — AgroPredict DSS

## 1. Visión general

ZeaSys es un DSS (Sistema de Apoyo a la Decisión) para cultivo de maíz en Ecuador. El backend está organizado en **6 dominios lógicos** sobre XAMPP (Apache + PHP + MySQL + Python/Flask + Flowise), sin microservicios físicos ni framework.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Apache + PHP-FPM                             │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  public/index.php  (front controller, ~45 líneas)            │   │
│  │    → CORS → Sesión → Router → Middleware → Container        │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│  ┌───────────────────────────┼───────────────────────────────────┐  │
│  │                    src/Kernel/                                 │  │
│  │  AutoloaderPsr4 · Router · Container · Peticion · Respuesta  │  │
│  │  Cors · AutenticacionMiddleware · ManejadorErrores            │  │
│  │  Errores/: ZeaSysException + Validacion/NoAutorizado/         │  │
│  │    AccesoDenegado/RecursoNoEncontrado/ServicioExterno         │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│  ┌───────────────────────────┼───────────────────────────────────┐  │
│  │              src/Dominios/  (6 dominios lógicos)               │  │
│  │                                                               │  │
│  │  Autenticacion/    Lotes/    Terreno/    Simulaciones/        │  │
│  │  Analitica/        Chat/                                      │  │
│  │                                                               │  │
│  │  Cada dominio:  Dominio/  Infraestructura/  Aplicacion/  Http/│  │
│  │  (interfaces)    (impl PDO/cURL)  (servicios)     (ctrls)    │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│  ┌───────────────────────────┼───────────────────────────────────┐  │
│  │  src/Config/: aplicacion.php · constantes_negocio.php ·        │  │
│  │    google.php · rutas.php · contenedor.php                     │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
         │                                    │
    ┌────┴────┐                          ┌────┴────┐
    │  MySQL  │                          │  Flask  │
    │ (XAMPP) │                          │  :5000  │
    └─────────┘                          │ motor ML│
                                         └────┬────┘
                                              │
                                         ┌────┴────┐
                                         │ Flowise │
                                         │  :3000  │
                                         └─────────┘
```

## 2. Regla de dependencia

```
Http/  →  Aplicacion/  →  Dominio/  ←  Infraestructura/
(ctrl)     (servicio)     (interface)    (impl PDO/cURL)
```

- **Http** traduce Peticion → args → RespuestaJson. No contiene lógica de negocio.
- **Aplicacion** orquesta: validaciones, llamadas a repositorios/servicios, cálculos. Sin superglobals ni PDO.
- **Dominio** define interfaces (puertos). No tiene implementaciones.
- **Infraestructura** implementa interfaces con PDO/cURL. Único lugar con `getConnection()`.

## 3. Tabla de rutas

| Ruta | Controlador | Servicio | Repositorio/Interfaz |
|------|-------------|----------|----------------------|
| `api/auth/login` | `Autenticacion\Http\AuthController` | `AutenticacionService` | `UsuarioRepositoryInterface` |
| `api/auth/register` | `AuthController` | `AutenticacionService` | `UsuarioRepositoryInterface` |
| `api/auth/google-login` | `AuthController` | `AutenticacionService` | `VerificadorTokenGoogleInterface` |
| `api/auth/me` | `AuthController` | `AutenticacionService` | — |
| `api/auth/logout` | `AuthController` | `AutenticacionService` | — |
| `api/auth/update` | `AuthController` | `AutenticacionService` | `UsuarioRepositoryInterface` |
| `api/auth/upload-avatar` | `AuthController` | `AutenticacionService` | `AlmacenAvatarInterface` |
| `api/auth/delete-avatar` | `AuthController` | `AutenticacionService` | `AlmacenAvatarInterface` |
| `api/auth/sync-google-avatar` | `AuthController` | `AutenticacionService` | `AlmacenAvatarInterface` |
| `api/auth/delete` | `AuthController` | `AutenticacionService` | `UsuarioRepositoryInterface` |
| `api/cultivos` (GET/POST/PUT/DELETE) | `Lotes\Http\CultivoController` | `CultivoService` | `CultivoRepositoryInterface` |
| `api/cultivos/mapa` | `CultivoController` | `CultivoService` | `CultivoRepositoryInterface` |
| `api/cultivos/valores-ubicacion` | `CultivoController` | `CultivoService` | `CultivoRepositoryInterface` + `ServicioDatosTerreno` |
| `api/simulaciones/simular` | `Simulaciones\Http\SimulacionController` | `SimulacionService` | `SimulacionRepositoryInterface` + `MotorPrediccionInterface` |
| `api/simulaciones/historial` | `SimulacionController` | `SimulacionService` | `SimulacionRepositoryInterface` |
| `api/simulaciones/eliminar` | `SimulacionController` | `SimulacionService` | `SimulacionRepositoryInterface` |
| `api/simulaciones/ia-status` | `SimulacionController` | `SimulacionService` | `GestorMotorIaInterface` |
| `api/simulaciones/explain` | `SimulacionController` | `SimulacionService` | `ServicioExplicabilidad` (46 estrategias) |
| `api/yield` | `Analitica\Http\YieldController` | `ServicioAnaliticaYield` | `CultivoRepositoryInterface` + `SimulacionRepositoryInterface` + `CatalogoAgronomicoInterface` |
| `api/scenarios` | `Analitica\Http\ScenarioController` | `ServicioAnaliticaScenario` | idem |
| `api/climate` | `Analitica\Http\ClimateController` | `ServicioAnaliticaClimate` | `CultivoRepositoryInterface` + `ServicioDatosTerreno` + `CatalogoAgronomicoInterface` + `ServicioClimaActual` |
| `api/financial` | `Analitica\Http\FinancialController` | `ServicioAnaliticaFinancial` | `CultivoRepositoryInterface` + `SimulacionRepositoryInterface` |
| `api/chat/preguntar` | `Chat\Http\ChatController` | `ChatService` | `MemoriaSesionInterface` + `CultivoRepositoryInterface` + `SimulacionRepositoryInterface` + `GeminiFlowise` + `ContextoAgricolaService` + `FavoritoService` |
| `api/chat/limpiar` | `ChatController` | `ChatService` | `MemoriaSesionInterface` |
| `api/chat/favorito` | `ChatController` | `FavoritoService` | `FavoritoRepositoryInterface` + `CultivoRepositoryInterface` |
| `api/chat/favorito/eliminar` | `ChatController` | `FavoritoService` | `FavoritoRepositoryInterface` |

## 4. Flujo de una petición

```
1. Apache → public/index.php
2. Cors::aplicar() + preflight OPTIONS → 204
3. session_name(SESSION_NAME) + session_start()
4. ManejadorErrores::registrar() (JSON errors)
5. Router::despachar(Peticion::desdeGlobal())
   a. resolverRutaActual(): $_GET['action'] → PATH_INFO → URI
   b. AutenticacionMiddleware::procesar(ruta, definicion)
      - ruta pública → OK
      - sesión activa → OK
      - sin sesión → 401 {"error":"No autorizado. Debe iniciar sesión."}
      - session_write_close() selectivo (según flag 'sesion')
   c. Container::get(controlador FQCN)
   d. method_exists + is_object guards
   e. $controlador->{$accion}($peticion)
6. Controller: Peticion → args → Servicio → RespuestaJson::enviar(array)
7. Servicio: interfaces → repositorios → cálculos → return array
8. RespuestaJson: json_encode + Content-Type + http_response_code
```

## 5. Cómo agregar un indicador DSS nuevo (explicador)

1. Crear `src/Dominios/Simulaciones/Explicacion/Explicadores/Explicador<Nombre>.php`:
   ```php
   final class Explicador<Nombre> implements ExplicadorInterface
   {
       public function explicar(array $datos): array
       {
           // Lógica del indicador → return ['secciones' => [...]]
       }
   }
   ```
2. Registrar en `RegistroExplicadores::reglas()` (el orden es contrato):
   ```php
   ['explicador' => Explicador<Nombre>::class, 'condicion' => ['cualquiera' => ['palabra_clave']]],
   ```
3. Verificar con la suite de contrato.

## 6. Cómo agregar una ruta

1. Añadir entrada en `src/Config/rutas.php`:
   ```php
   'api/nueva-ruta' => ['controlador' => \ZeaSys\Dominios\<Dominio>\Http\<Controller>::class, 'accion' => 'metodo'],
   ```
2. Crear el controlador en `Http/` (delgado, recibe `Peticion`).
3. Crear el servicio en `Aplicacion/` (recibe interfaces por constructor).
4. Registrar bindings en `src/Config/contenedor.php`.
5. Verificar con la suite de contrato.

## 7. Suite de contrato

```powershell
# Comparar contra la huella "antes" (exit 0 = OK, 1 = diferencias, 2 = infra)
C:\xampp\php\php.exe backend-api\tests\contrato\ejecutar.php --modo=comparar

# Captura inicial (solo al inicio; NO correr después)
C:\xampp\php\php.exe backend-api\tests\contrato\ejecutar.php --modo=capturar
```

La suite ejecuta 29 pasos reales (registro→login→lotes→simulación→explain→4 dashboards→avatares→limpieza) y normaliza volátiles (ids, fechas, tokens, salidas ML, `mt_rand`).

## 8. Mapa de bindings del contenedor

| Interface / Clase | Implementación | Dependencias |
|-------------------|----------------|--------------|
| `UsuarioRepositoryInterface` | `UsuarioRepositoryMysql` | `getConnection()` |
| `VerificadorTokenGoogleInterface` | `VerificadorTokenGoogle` | — |
| `AlmacenAvatarInterface` | `AlmacenAvatarArchivos` | — |
| `GestorSesionInterface` | `GestorSesion` | — |
| `AutenticacionService` | — | 4 interfaces |
| `CacheInterface` | `CacheArchivos` | — |
| `ProveedorClimaInterface` | `ProveedorOpenMeteo` | — |
| `ProveedorClimaActualInterface` | `ProveedorOpenMeteoForecast` | — |
| `ProveedorSueloInterface` | `ProveedorSoilGrids` | — |
| `AltitudPorCultivoInterface` | `AltitudMysql` | `getConnection()` |
| `ServicioDatosTerreno` | — | 4 interfaces |
| `ServicioClimaActual` | — | `CacheInterface` + `ProveedorClimaActualInterface` |
| `CultivoRepositoryInterface` | `CultivoRepositoryMysql` | `getConnection()` |
| `ValidadorLimitesEcuador` | — | — |
| `CultivoService` | — | 3 interfaces |
| `SimulacionRepositoryInterface` | `SimulacionRepositoryMysql` | `getConnection()` |
| `MotorPrediccionInterface` | `ClienteMotorFlask` | — |
| `GestorMotorIaInterface` | `GestorMotorIa` | — |
| `EvaluadorCondiciones` | — | — |
| `RegistroExplicadores` | — | — |
| `ResolutorContextoExplicacion` | — | 2 interfaces |
| `ServicioExplicabilidad` | — | 3 clases |
| `SimulacionService` | — | 5 interfaces |
| `CatalogoAgronomicoInterface` | `RepositorioCatalogoAgronomico` | — |
| `ServicioAnaliticaYield` | — | 3 interfaces |
| `ServicioAnaliticaScenario` | — | 3 interfaces |
| `ServicioAnaliticaClimate` | — | 4 interfaces |
| `ServicioAnaliticaFinancial` | — | 2 interfaces |
| `ServicioPrecioMaiz` | — | — |
| `FavoritoRepositoryInterface` | `FavoritoRepositoryMysql` | `getConnection()` |
| `FavoritoService` | — | `FavoritoRepositoryInterface` + `CultivoRepositoryInterface` |
| `ContextoAgricolaService` | — | 4 servicios de analítica |
| `ChatService` | — | 6 dependencias |
| `ChatController` | — | `ChatService` |
| Controladores Http | — | 1 servicio c/u |

## 9. Estructura final

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
│       ├── Analitica/          ← dashboards, clima actual y precio de referencia
│       └── Chat/               ← contexto autorizado, memoria y favoritos
├── data/ · uploads/ · tests/   ← datos y pruebas del backend
```

Las migraciones incrementales de MySQL viven fuera del backend, en
`database/migraciones/`, y se aplican una sola vez sobre bases ya instaladas.
