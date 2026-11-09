# Preparación experimental de ZeaSys para Docker

**Estado:** configuración inicial preparada, todavía no verificada mediante construcción y ejecución de contenedores. No sustituye la instalación XAMPP y no debe usarse como paquete final para docentes hasta probarla en una instalación limpia.

## Qué está preparado

- `docker/compose.yaml`: servicios de MariaDB, motor de predicción y web. Expone la aplicación solo en el equipo local, en el puerto 8087. El perfil opcional `assistant` añade Flowise, Chroma y Ollama; Flowise se expone en el puerto local 3001.
- `docker/schema-demo.sql`: estructura SQL sin cuentas ni registros de la base original. El esquema se comprobó en una base MySQL temporal; no incluye datos de usuarios.
- `docker/preparar-configuracion.ps1`: genera claves aleatorias para la base de demostración en `docker/.env` y no sobrescribe un archivo existente. Mantener ese archivo privado.
- `docker/iniciar-demo.ps1`: preparado para construir e iniciar el entorno de demostración. **No ejecutarlo todavía como entrega validada.**
- `.dockerignore`: excluye, entre otros, bases existentes, archivos subidos, PDF locales, cachés, dependencias locales y `.env` del contexto de construcción.

Los datos de la demo deben residir en volúmenes Docker distintos de la instalación existente. Nunca utilizar `docker compose down -v` o eliminar volúmenes si contienen información que se quiera conservar. Las copias de seguridad y una prueba de restauración independientes son necesarias antes de migrar datos reales.

## Pendiente

1. Terminar la configuración de Windows y Docker Desktop; reiniciar cuando Windows lo requiera.
2. Verificar `docker version` y `docker compose version`, construcción y salud de la base, API web y motor, y creación de cuenta/simulación ficticias.
3. Preparar e importar flujos de Flowise sin credenciales personales, crear una credencial de demostración, instalar el modelo de embeddings y reconstruir o migrar el índice documental con sus fuentes y páginas.
4. Evaluar el tratamiento de imágenes, OCR de PDF, almacenamiento persistente, origen OAuth, cachés y conexiones a proveedores externos.
5. Probar en un equipo limpio, revisar privacidad y generar una guía/paquete para los docentes.
6. Para trasladar la cuenta y datos reales, hacer un respaldo verificado y acordar el procedimiento después de probar la demo. **La demo no migra automáticamente la base de XAMPP ni los datos personales.**

El acceso con Google y los flujos de chatbot no se han validado en Docker. No incluir credenciales ni `docker/.env`, datos de usuario o bases locales en el paquete para terceros. Las imágenes y modelos pueden requerir descargas grandes y conexión a internet.
