# Guía de Instalación y Requerimientos de ZeaSys

## 1. Requisitos Previos

Instala en tu computadora los siguientes programas si no los tienes:

- **XAMPP** (con PHP 8.0 o superior y MySQL).
- **Node.js** (versión 18 o superior).
- **Python** (versión 3.9 a 3.11).

---

## 2. Base de Datos (MySQL)

1. Abre XAMPP y enciende **Apache** y **MySQL**.
2. Entra en tu navegador a: `http://localhost/phpmyadmin`
3. Crea una base de datos nueva llamada `zeasys_db` (o `agropredict_db`).
4. Haz clic en **Importar** y selecciona el archivo ubicado en:
   `c:\xampp\htdocs\ZeaSys\database\agropredict_db.sql`

El dump ya crea `chat_favoritos` y declara XGBoost como único modelo de
simulación. Si actualizas una base creada antes de esos cambios, ejecuta una sola
vez las migraciones incrementales:

```cmd
mysql -u root agropredict_db < database\migraciones\20261018_solo_xgboost.sql
mysql -u root agropredict_db < database\migraciones\20261019_chat_favoritos.sql
```

---

## 3. Backend PHP

1. Copia toda la carpeta del proyecto en la ruta `c:\xampp\htdocs\ZeaSys`.
2. La conexión se configura mediante variables de entorno. Si no defines ninguna,
   se usan `127.0.0.1:3306`, base `agropredict_db`, usuario `root` y contraseña vacía.
   Para una instalación distinta define `ZEASYS_DB_HOST`, `ZEASYS_DB_PORT`,
   `ZEASYS_DB_NAME`, `ZEASYS_DB_USER` y `ZEASYS_DB_PASS` antes de iniciar Apache.

---

## 4. Arranque unificado (recomendado)

Desde la raíz del proyecto ejecuta:

```cmd
scripts\iniciar_sistemas.bat
```

El lanzador comprueba los puertos antes de iniciar cada servicio, por lo que se
puede ejecutar varias veces sin crear procesos duplicados. Arranca Apache, MySQL,
el motor Flask, Chroma, Ollama y Flowise. El frontend compilado se sirve desde
Apache; no es necesario mantener Vite en desarrollo para usar la aplicación.

## 5. Motor de IA en Python (`ml-engine`)

1. Abre la consola de comandos (CMD o PowerShell).
2. Entra a la carpeta del servidor de IA:
   ```cmd
   cd c:\xampp\htdocs\ZeaSys\ml-engine
   ```
3. Instala los requerimientos con:
   ```cmd
   pip install -r requirements.txt
   ```
4. Inicia el servidor de IA:
   ```cmd
   python app.py
   ```
   *(Quedará corriendo en http://127.0.0.1:5000)*.

---

## 6. Frontend React

1. Abre otra ventana de la consola de comandos.
2. Entra a la carpeta del frontend:
   ```cmd
   cd c:\xampp\htdocs\ZeaSys\frontend-app
   ```
3. Instala los paquetes de Node:
   ```cmd
   npm install
   ```
4. Compila y sincroniza con XAMPP:
   ```cmd
   npm run build
   ```

---

## 7. Chatbot Gemini mediante Flowise (opcional para el resto del sistema)

1. Inicia Flowise con `scripts\iniciar_flowise.bat` (o usa el lanzador unificado) y confirma que responde en
   `http://127.0.0.1:3000`.
2. Usa el chatflow `ZeaSys Chat Bot` con la credencial `zeasys` de Google
   Gemini, el modelo `gemini-3.5-flash-lite`, `Conversation Summary Buffer
   Memory` y `Conversation Chain`. El camino principal no usa RAG.
   `python tools/switch_flowise_conversation_chain.py` reproduce esa
   configuración y actualiza el prompt del asistente.
3. PHP usa por defecto el chatflow configurado en `src/Config/aplicacion.php`.
   Si cambias el ID o proteges Flowise, define `ZEASYS_FLOWISE_URL`,
   `ZEASYS_FLOWISE_CHATFLOW_ID`, `ZEASYS_FLOWISE_API_KEY` y, si hace falta,
   `ZEASYS_FLOWISE_TIMEOUT`.
4. La clave de Gemini se guarda sólo en Flowise; nunca en React, PHP ni Git.
5. El precio del maíz es una referencia oficial del MAGP con fecha, no una
   cotización de mercado en tiempo real. No hay una API de precios en vivo.

La arquitectura, la memoria compartida, los favoritos y el formato de respuestas
están documentados en `documentacion/flowise-hibrido.md`.

---

## 8. Verificación rápida

Desde `backend-api`:

```cmd
php tests\chat\ejecutar.php
php tests\contrato\ejecutar.php --modo=comparar
```

Desde `frontend-app`:

```cmd
npm run lint
npm run build
```

---

## 9. Acceder a la Aplicación

Abre tu navegador web e ingresa a:
```
http://localhost/ZeaSys/
```
