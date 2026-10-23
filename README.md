# ZeaSys — AgroPredict DSS

Sistema de apoyo a la decisión agrícola para parcelas de maíz en Ecuador.

## Estructura canónica

- `frontend-app/`: código fuente React/Vite. `npm run build` genera y sincroniza el frontend servido por XAMPP en la raíz (`index.html`, `assets/`, `models/` e `images/`).
- `backend-api/`: API PHP organizada por dominios y capas.
- `ml-engine/`: API Flask y modelos de simulación.
- `database/agropredict_db.sql`: esquema y datos iniciales de MySQL.
- `database/migraciones/`: cambios incrementales para bases ya instaladas.
- `scripts/`: lanzadores locales de Apache/MySQL, ML, Chroma, Ollama y Flowise.
- `tools/`: migraciones reproducibles de Flowise y utilidades del corpus RAG.
- `rag-sources/`: fuentes documentales; los PDF no se versionan (ver `SOURCES.md`).
- `documentacion/`: instalación, arquitectura, modelos, proveedores de datos, ADRs y configuración del chatbot Gemini/Flowise.

Los artefactos de `assets/`, `models/` e `index.html` en la raíz son intencionales: XAMPP los sirve directamente. No deben editarse a mano; se regeneran desde `frontend-app` con `npm run build`.

### Carpetas que se repiten a propósito

No son copias accidentales:

- `assets/` (raíz) es el despliegue que sirve XAMPP; `frontend-app/src/assets/` es la fuente.
- `models/` (raíz) es la copia desplegada del modelo 3D; `frontend-app/public/models/` es la fuente.
- `ml-engine/models/` contiene los artefactos `.joblib` del motor de IA; no tiene relación con el modelo 3D.
- `Dominio/`, `Aplicacion/`, `Infraestructura/` y `Http/` se repiten dentro de cada dominio del backend porque son sus capas arquitectónicas.
- `scripts/` (raíz) son lanzadores locales; `ml-engine/scripts/` contiene scripts de entrenamiento.
- `tests/`, `data/`, `public/` y `Config/` existen en más de un componente porque cada uno tiene su propia infraestructura.

Sí son descartables y están ignorados por Git: `frontend-app/dist/`, `node_modules/`, `__pycache__/`, `backend-api/data/cache/` y los PDF de `rag-sources/`. Los archivos de `backend-api/public/uploads/` son datos de usuarios y tampoco se versionan.

## Puesta en marcha rápida

1. Importa `database/agropredict_db.sql` en MySQL. El dump ya incluye la tabla
   `chat_favoritos` y XGBoost como único modelo.
2. Si actualizas una base existente, aplica las migraciones pendientes:
   ```cmd
   mysql -u root agropredict_db < database\migraciones\20261018_solo_xgboost.sql
   mysql -u root agropredict_db < database\migraciones\20261019_chat_favoritos.sql
   ```
3. Ejecuta `scripts\iniciar_sistemas.bat` como lanzador único. Comprueba los puertos y
   enciende Apache, MySQL, ML, Chroma, Ollama y Flowise sin duplicar procesos.
4. Si sólo necesitas un componente, ejecuta su lanzador dentro de `scripts/`.
5. Para regenerar el frontend, en `frontend-app` ejecuta `npm install` y después
   `npm run build`.
6. Abre `http://localhost/ZeaSys/`.

La guía completa está en [`documentacion/GUIA_INSTALACION.md`](documentacion/GUIA_INSTALACION.md). La referencia de APIs y calidad de datos está en [`documentacion/proveedores-datos.md`](documentacion/proveedores-datos.md). El chatbot se configura según [`documentacion/flowise-hibrido.md`](documentacion/flowise-hibrido.md).
