# ADR-006: Contenedor DI manual (fábricas explícitas, sin autowiring)

**Estado:** Aceptado  
**Fecha:** 2026-10-16

## Contexto

Se necesitaba inyección de dependencias sin Composer ni reflexión. El sistema legacy instanciaba modelos directamente en constructores (`new Simulacion()`), lo que impedía testear.

## Decisión

`Container` con `registrar()` y `get()`. Las fábricas son closures explícitas en `src/Config/contenedor.php`. Cada binding declara sus dependencias. Los servicios reciben interfaces por constructor. Singleton por request (el Container vive en memoria por request en PHP-FPM/Apache).

## Consecuencias

- **Ventajas:** bindings visibles en un solo lugar, sin reflexión, testable con fakes.
- **Costos:** añadir un binding requiere editar `contenedor.php`; sin resolución automática.
- **Circular deps:** detectadas con `RuntimeException` (implementado).
