# Revisión académica de ZeaSys — 9 de noviembre de 2026

Es una aplicación web. El ZIP contiene código fuente, compilación servida por Apache,
modelos y datos públicos. No contiene la base personal, cuentas, claves API ni avatares.
El Word de referencias está en `documentacion/ZeaSys-referencias-datos-20261109.docx`.
La última revisión de Rendimiento se detalla en
`documentacion/revision-rendimiento-20261109.md`.
La revisión de Siembra está en `documentacion/revision-siembra-20261109.md`.
La conexión final de sus módulos está en `documentacion/revision-siembra-modulos-20261109.md`.
La estructura común con Rendimiento se detalla en `documentacion/revision-siembra-estructura-20261109.md`.

## Para revisar el código

La revisión de planificación y lluvia anual del 10 de noviembre se documenta en
`documentacion/revision-siembra-lluvia-20261110.md`. Incluye los cambios de Siembra,
las fuentes INAMHI/ERA5, la distinción entre lluvia anual y del ciclo y las pruebas.
El Word de referencias también incorpora esa actualización.

La organización de Siembra para productores se revisó después con UI UX Pro Max.
Consulta `documentacion/revision-siembra-ux-pro-max-20261110.md` para los criterios,
los fallos corregidos y las verificaciones de interfaz y guardado real.

Descomprime el ZIP y abre la carpeta ZeaSys con un editor. No necesitas iniciar
servicios para leer el código, el Word y los informes de pruebas.

## Para ejecutarlo en una instalación nueva de Windows

1. Instala XAMPP con PHP 8.2 y MariaDB; Python 3.11; Node.js compatible con Vite 8.
   Usa `frontend-app/package-lock.json` y `ml-engine/requirements.txt` para las dependencias.
2. Copia ZeaSys en `C:\xampp\htdocs\ZeaSys`. Inicia Apache y MySQL desde XAMPP.
3. Crea una base VACÍA para la revisión. Importa únicamente `database/schema-demo.sql`
   en esa base. No importes ese esquema encima de una base existente.
4. La configuración predeterminada usa `agropredict_db`, servidor `127.0.0.1:3306`
   y el usuario local `root` sin contraseña. Si tu instalación es distinta, configura
   en Apache `ZEASYS_DB_NAME`, `ZEASYS_DB_HOST`, `ZEASYS_DB_PORT`, `ZEASYS_DB_USER`
   y `ZEASYS_DB_PASS` mediante `SetEnv` y reinicia Apache. Consulta
   `backend-api/src/Config/aplicacion.php`. Este proyecto lee variables de entorno;
   no carga automáticamente un archivo `.env`.
5. En `ml-engine`, ejecuta `py -3.11 -m venv .venv` y después
   `.venv\Scripts\python.exe -m pip install -r requirements.txt`. Desde la raíz ejecuta
   `scripts/auto_ia_server.bat`. El motor utiliza el puerto 5000.
6. Abre `http://localhost/ZeaSys/`. Crea una cuenta nueva y una parcela de prueba.
   No se entrega una cuenta personal preconfigurada. La compilación ya está incluida;
   para modificarla: `cd frontend-app`, `npm ci`, `npm run build`.
7. Para pruebas completas usa `scripts/verificar_sistema.ps1 -Integracion`. La prueba
   crea y elimina su propia base ficticia; no debe apuntar a una base personal de prueba.

El chatbot completo requiere además Flowise, Chroma, Ollama y una credencial propia
del proveedor generativo. Los puertos del equipo de desarrollo son 3000, 8000 y
11434; `scripts/iniciar_sistemas.bat` comprueba e inicia los servicios instalados.
El modelo de embeddings vigente está indicado en
`backend-api/data/referencias/rag-indice.json`; no se distribuye la base privada de Flowise.
Las guías y herramientas RAG del proyecto describen la preparación del corpus e índice.
No se afirma que el chatbot se transfiera configurado con una clave ajena.

Las APIs meteorológicas y cartográficas necesitan Internet y pueden tener
interrupciones. Los datos ausentes deben conservarse como ausentes. La simulación
de grano seco es exploratoria: no hay validación independiente con cosechas de
parcelas de ZeaSys. El ensayo oficial de choclo se conserva como investigación y
sus referencias no se convierten en predicciones de grano seco.

El archivo `.zip.sha256` permite comprobar integridad. Dentro del ZIP,
`MANIFIESTO-REVISION.json` identifica cada archivo por SHA-256.
