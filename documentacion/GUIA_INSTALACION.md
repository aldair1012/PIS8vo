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

---

## 3. Backend PHP

1. Copia toda la carpeta del proyecto en la ruta `c:\xampp\htdocs\ZeaSys`.
2. La conexión se configura mediante variables de entorno. Si no defines ninguna,
   se usan `127.0.0.1:3306`, base `agropredict_db`, usuario `root` y contraseña vacía.
   Para una instalación distinta define `ZEASYS_DB_HOST`, `ZEASYS_DB_PORT`,
   `ZEASYS_DB_NAME`, `ZEASYS_DB_USER` y `ZEASYS_DB_PASS` antes de iniciar Apache.

---

## 4. Motor de IA en Python (`ml-engine`)

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

## 5. Frontend React

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

## 6. Chatbot Gemini mediante Flowise (opcional para el resto del sistema)

1. Inicia Flowise con el script `iniciar_flowise.bat` y confirma que responde en
   `http://127.0.0.1:3000`.
2. En Flowise guarda el chatflow de ZeaSys con Gemini y `Buffer Window Memory`.
3. PHP usa por defecto el chatflow configurado en `src/Config/aplicacion.php`.
   Si cambias el ID o proteges Flowise, define `ZEASYS_FLOWISE_URL`,
   `ZEASYS_FLOWISE_CHATFLOW_ID` y, si corresponde, `ZEASYS_FLOWISE_API_KEY`.
4. La clave de Gemini se guarda sólo en Flowise; nunca en React, PHP ni Git.

La arquitectura y el formato de respuestas están documentados en
`documentacion/flowise-hibrido.md`.

---

## 7. Acceder a la Aplicación

Abre tu navegador web e ingresa a:
```
http://localhost/ZeaSys/
```
