# Diseño: Reestructuración del Backend ZeaSys — Microservicios Lógicos + SOLID

- **Fecha:** 2026-10-16
- **Estado:** Aprobado por el propietario (secciones 1–3)
- **Alcance:** `backend-api/` (profundo) + `tests/contrato/` (nuevo) + documentación; frontend y `ml-engine` solo adaptación de compatibilidad (ninguna esperada).
- **Subproyecto:** 1 de 3 (orden acordado: estructura → chatbot → rediseño visual).

---

## 1. Contexto y problema

ZeaSys (AgroPredict DSS) es funcional hoy, pero su backend concentra deuda técnica que impide evolucionar con seguridad:

| Problema | Evidencia | Principio violado |
|---|---|---|
| Modelo de datos hace HTTP | `models/Simulacion.php` ejecuta cURL a `:5000/predict` | DIP |
| Controlador instancia otro controlador | `CultivoController` → `new ClimateController()` | SRP / DIP |
| Reglas agronómicas incrustadas | `SimulacionController::explain()` ≈ 600 líneas de `if/elseif` | SRP / OCP |
| Router como `switch` | `public/index.php` con 130 líneas de `case` | OCP |
| Repetición de validación, sesión, `exit`, `echo json_encode` | En los 7 controladores | SRP / DRY |
| SQL fuera de repositorios | Consultas directas dentro de `explain()` | SRP |
| Constantes mezcladas | `config/database.php` define DB + motor IA + precio de maíz | SRP |
| Lectura repetida de catálogo | 3 controladores leen `agronomia_data.json` por su cuenta | DRY / SRP |

El objetivo es reestructurar sin romper nada (el sistema es 100 % funcional hoy) aplicando límites de dominio tipo microservicios y los cinco principios SOLID, en el entorno XAMPP obligatorio.

## 2. Decisiones acordadas con el propietario

| # | Pregunta | Decisión |
|---|---|---|
| D1 | ¿Qué "hacer funcionar"? | Todo funciona; el objetivo es estructura correcta |
| D2 | Entorno | XAMPP obligatorio (Apache + PHP + MySQL + Python) — sin Docker |
| D3 | Libertad de contratos | Permitida, pero se decide mantenerlos idénticos en esta fase (menor riesgo) |
| D4 | Alcance | Backend profundo; frontend sin cambios; ml-engine solo compatibilidad |
| D5 | Verificación | Pruebas de contrato antes/después (script PHP CLI sin dependencias) |
| D6 | Documentación | `arquitectura.md` actualizado + 7 ADRs (microservicios lógicos; autoloader sin Composer; router declarativo; contenedor DI; patrón Strategy en explicaciones; repositorios con interfaces; pruebas de contrato) |
| D7 | Enfoque | A — Microservicios lógicos por dominio (descartados: B físico con puertos, C refactor mínimo) |

## 3. Arquitectura objetivo

### 3.1 Dominios (bounded contexts)

| Dominio | Responsabilidad | Endpoints absorbidos |
|---|---|---|
| **Autenticación** | Login, registro, Google OAuth, perfil, avatares, sesión | `api/auth/*` (10) |
| **Lotes** | CRUD parcelas, mapa GIS, validación territorial Ecuador | `api/cultivos*` (3) |
| **Terreno** | Clima/suelo externos (Open-Meteo, SoilGrids), caché 24 h, fallbacks | (hoy embebido en ClimateController) |
| **Simulaciones** | Predicción ML, historial, estado motor IA, explicabilidad | `api/simulaciones/*` (5) |
| **Analítica DSS** | Dashboards de solo lectura: Yield, Scenario, Climate, Financial | `api/yield`, `api/scenarios`, `api/climate`, `api/financial` |

### 3.2 Capas por dominio

```
Http/            Controlador delgado (traduce HTTP ↔ dominio, sin reglas)
Aplicacion/      Servicios: orquestan casos de uso (1 método = 1 caso de uso)
Dominio/         Reglas puras, validadores, entidades, INTERFACES (contratos)
Infraestructura/ Implementaciones: MySQL (PDO), cURL, archivos, Google API
```

Regla de dependencias: `Http → Aplicacion → Dominio ← Infraestructura`. El dominio no conoce a nadie; el contenedor DI conecta interfaces con implementaciones.

### 3.3 Estructura de carpetas

```
backend-api/
├── public/
│   └── index.php                  Front controller (~40 líneas: bootstrap)
├── src/
│   ├── Kernel/
│   │   ├── Router.php             Tabla declarativa de rutas
│   │   ├── Container.php          Contenedor DI (interfaz → implementación)
│   │   ├── Peticion.php           DTO de entrada (JSON + query)
│   │   ├── RespuestaJson.php      Respuesta estandarizada
│   │   ├── AutenticacionMiddleware.php
│   │   ├── AutoloaderPsr4.php     Autoload sin Composer
│   │   └── Errores/               Excepciones tipadas + manejador global
│   ├── Config/
│   │   ├── aplicacion.php         DB, URLs de servicios, sesión
│   │   ├── constantes_negocio.php PRECIO_MAIZ_TON, etc.
│   │   └── rutas.php              Mapa completo de rutas → controlador
│   └── Dominios/
│       ├── Autenticacion/{Http,Aplicacion,Dominio,Infraestructura}/
│       ├── Lotes/{...}/
│       ├── Terreno/{...}/
│       ├── Simulaciones/{...}/
│       └── Analitica/{...}/
├── tests/contrato/                Suite de contrato + snapshots
└── data/                          agronomia_data.json, cache/
```

Convención de nombres: términos de negocio en español (`Usuario`, `Cultivo`, `Simulacion`), términos técnicos en inglés (`Repository`, `Service`, `Controller`, `DTO`) — consistente con el código existente.

## 4. Contratos internos por dominio

### Autenticación
- `AuthController` (HTTP) · `AutenticacionService` (login/registro/google)
- `UsuarioRepositoryInterface` → `UsuarioRepositoryMysql`
- `VerificadorTokenGoogleInterface` → `VerificadorTokenGoogle`
- `AlmacenAvatarInterface` → `AlmacenAvatarArchivos`
- `GestorSesion` (encapsula `$_SESSION` + cookies persistentes)

### Lotes
- `CultivoService` (CRUD + propiedad) · `CultivoRepositoryInterface`
- `ValidadorLimitesEcuador` (regla pura, reutilizada por crear/actualizar/terreno)
- Consume `ProveedorDatosTerrenoInterface` (dominio Terreno) — elimina el `new ClimateController()`

### Terreno
- `ServicioDatosTerreno` (orquesta clima + suelo + caché)
- `ProveedorClimaInterface` → `ProveedorOpenMeteo`; `ProveedorSueloInterface` → `ProveedorSoilGrids`
- `CacheInterface` → `CacheArchivos` (TTL 24 h)

### Simulaciones
- `SimulacionService` (validar → verificar parcela → asegurar IA → predecir → persistir)
- `SimulacionRepositoryInterface` → MySQL
- `MotorPrediccionInterface` → `ClienteMotorFlask` (el modelo deja de hacer HTTP)
- `GestorMotorIaInterface` → `GestorMotorIa` (reemplaza `IaServerHelper`)
- `ServicioExplicabilidad` + patrón **Strategy**: `ExplicadorInterface` con implementaciones por tipo de indicador (`ExplicadorCascada`, `ExplicadorGaussiana`, `ExplicadorROI`, …) registradas en una tabla `nombre_indicador → estrategia`. Reutilizable por el chatbot (subproyecto 2).

### Analítica
- `ServicioAnaliticaYield`, `ServicioAnaliticaScenario`, `ServicioAnaliticaClimate`, `ServicioAnaliticaFinance`
- `RepositorioCatalogoAgronomicoInterface` (lectura única de `agronomia_data.json`)

## 5. Mapa SOLID

| Principio | Antes | Después |
|---|---|---|
| SRP | Controladores HTTP+negocio+SQL+reglas | Controlador delgado; servicio; repositorio; estrategias; validador |
| OCP | Ruta nueva = editar switch; indicador nuevo = nuevo elseif | Ruta nueva = 1 entrada en `rutas.php`; indicador nuevo = registrar estrategia |
| LSP | Sin jerarquías | Implementaciones sustituibles detrás de cada interfaz |
| ISP | Clases gordas | Interfaces específicas (`ProveedorClimaInterface` ≠ `ProveedorSueloInterface`) |
| DIP | `new Modelo()` → cURL; controlador → controlador | Servicios dependen de interfaces; contenedor inyecta implementaciones |

## 6. Flujo de una petición (ejemplo: simular)

```
POST /api/simulaciones/simular
 → index.php: autoloader, sesión, manejador de errores
 → Router (rutas.php) → SimulacionController::simular
 → AutenticacionMiddleware (401 si no hay sesión)
 → Peticion DTO → SimulacionService
 → ValidadorSimulacion + CultivoRepository(propiedad) 
 → GestorMotorIa(asegurar) → ClienteMotorFlask(/predict)
 → SimulacionRepository.guardar()
 → RespuestaJson 200 (formato JSON idéntico al actual)
```

## 7. Manejo de errores

- Excepciones tipadas: `NoAutorizadoException` (401), `ValidacionException` (400), `RecursoNoEncontradoException` (404), `AccesoDenegadoException` (403), `ServicioExternoException` (502/503)
- Manejador global único → `{"error": "mensaje"}` con el mismo formato que ya consume el frontend
- Sin `exit` dispersos; los controladores devuelven y el kernel responde

## 8. Compatibilidad de contratos

**Rutas y JSON de respuesta permanecen idénticos en esta fase.** Justificación: comparación 1:1 en pruebas de contrato, cero cambios en frontend, superficie de cambio limitada a la organización interna. Las mejoras de contrato se aprovecharán en el subproyecto del chatbot (endpoints nuevos) y del rediseño.

## 9. Verificación (pruebas de contrato)

- Script PHP CLI (`php tests/contrato/ejecutar.php --modo=capturar|comparar`), sin dependencias nuevas (cURL de XAMPP).
- Recorrido completo: registro → login → crear parcela → valores-ubicación → simular → historial → explicaciones (varios tipos) → 4 dashboards → actualizar perfil → logout → limpieza.
- Snapshots en `tests/contrato/snapshots/antes/`; se normalizan IDs, fechas y campos aleatorios (`perdidaFechaSiembra` usa `mt_rand`).
- Respuestas de APIs externas: comparación estructural únicamente.
- Puerta de salida por fase: la comparación completa debe pasar.

## 10. Fases de ejecución

| Fase | Contenido | Puerta de salida |
|---|---|---|
| F00 | Git init, `.gitignore`, script de contrato, captura huella "antes" | Huella versionada |
| F01 | Kernel completo + `index.php` nuevo + rutas en tabla | Comparación pasa |
| F02 | Dominio Autenticación | Comparación pasa |
| F03 | Dominios Lotes + Terreno | Comparación pasa |
| F04 | Dominio Simulaciones + motor de explicabilidad (Strategy) | Comparación pasa + pruebas de estrategias |
| F05 | Dominio Analítica | Comparación pasa |
| F06 | Limpieza de código viejo, `arquitectura.md`, 7 ADRs, verificación final | Informe final + commit de cierre |

## 11. Fuera de alcance

- Cambios visuales o de componentes React (subproyecto 3)
- Chatbot y sus endpoints (subproyecto 2)
- Cambios de esquema de base de datos
- Refactor interno del `ml-engine` (solo verificación de compatibilidad)
- Migración a microservicios físicos (decisión D2/D7; el diseño de contratos la deja preparada)

## 12. Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Romper comportamiento en producción local | Pruebas de contrato + git por fase (reversión con 1 comando) |
| APIs externas caídas durante tests | Comparación estructural + fallbacks ya existentes |
| Motor IA apagado al probar | El script de contrato lo verifica y arranca (`auto_ia_server.bat`) |
| Crecimiento del cambio | 6 fases pequeñas, cada una debe pasar la puerta |

## 13. Glosario

- **Microservicio lógico:** dominio aislado con contratos e interfaces que podría extraerse a un proceso propio sin reescribir lógica.
- **Puerta de salida:** verificación obligatoria antes de dar una fase por terminada.
- **Snapshot de contrato:** huella normalizada de las respuestas del API para comparación antes/después.
