# ADR-001: Microservicios lógicos sobre XAMPP (no servicios físicos)

**Estado:** Aceptado  
**Fecha:** 2026-10-16

## Contexto

ZeaSys (AgroPredict DSS) corre en XAMPP (Apache + PHP + MySQL + Python/Flask) sin Docker. El sistema legacy era un monolito de ~2800 líneas en 7 controladores acoplados a `models/`. La reestructuración debía mejorar la arquitectura sin romper comportamiento ni cambiar la infraestructura.

## Decisión

Organizar el backend en **5 dominios lógicos** (Autenticación, Lotes, Terreno, Simulaciones, Analítica DSS) dentro del mismo repositorio y proceso PHP. Cada dominio tiene 4 capas: `Dominio/` (interfaces), `Infraestructura/` (implementaciones), `Aplicacion/` (servicios), `Http/` (controladores delgados). No se crean microservicios físicos ni se cambia XAMPP.

## Consecuencias

- **Ventajas:** límites de dominio claros, dependencias inyectadas, testabilidad, mismo despliegue.
- **Costos:** sin escalado independiente; los dominios comparten el proceso PHP-FPM.
- **Migración futura:** cada dominio puede extraerse a un servicio físico cuando sea necesario.
