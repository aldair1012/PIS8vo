# ZeaSys — AgroPredict DSS

Sistema de apoyo a la decisión agrícola para parcelas de maíz en Ecuador.

## Estructura canónica

- `frontend-app/`: código fuente React/Vite. `npm run build` genera y sincroniza el frontend servido por XAMPP en la raíz (`index.html`, `assets/` e `images/`).
- `backend-api/`: API PHP organizada por dominios y capas.
- `ml-engine/`: API Flask y modelos de simulación.
- `database/agropredict_db.sql`: esquema y datos iniciales de MySQL.
- `documentacion/`: instalación, arquitectura, modelos, ADRs y configuración del chatbot Gemini/Flowise.

Los artefactos de `assets/`, `images/` e `index.html` en la raíz son intencionales: XAMPP los sirve directamente. No deben editarse a mano; se regeneran desde `frontend-app`.

## Puesta en marcha rápida

1. Enciende Apache y MySQL en XAMPP e importa `database/agropredict_db.sql`.
2. Instala las dependencias de `ml-engine` y ejecuta `auto_ia_server.bat`.
3. En `frontend-app`, ejecuta `npm install` y después `npm run build`.
4. Abre `http://localhost/ZeaSys/`.

La guía completa está en [`documentacion/GUIA_INSTALACION.md`](documentacion/GUIA_INSTALACION.md). El chatbot se configura según [`documentacion/flowise-hibrido.md`](documentacion/flowise-hibrido.md).
