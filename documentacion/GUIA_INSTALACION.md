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
2. Revisa la conexión en `c:\xampp\htdocs\ZeaSys\backend-api\config\database.php`:
   *(usuario `root`, sin contraseña por defecto)*.

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

## 6. Acceder a la Aplicación

Abre tu navegador web e ingresa a:
```
http://localhost/ZeaSys/
```
