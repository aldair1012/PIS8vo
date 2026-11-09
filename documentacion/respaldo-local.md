# Respaldo local de ZeaSys

La herramienta `tools/respaldo_local.py` crea una carpeta nueva con exportación de MySQL, copia SQLite de Flowise, sus secretos y almacenamiento, datos de Chroma, archivos subidos y los PDF presentes. También guarda `.htaccess`, archivos `.env` conocidos si existen y las variables `ZEASYS_*` heredadas por el proceso. Calcula SHA-256 por archivo y comprueba SQLite. El respaldo contiene información privada y claves: el destino debe estar fuera del directorio web y de las carpetas activas de los servicios.

Antes de crear la copia, detén Flowise y Chroma para evitar copias inconsistentes de sus múltiples archivos; MySQL debe estar iniciado. No se detienen procesos automáticamente. Asegúrate también de no tener escrituras de archivos de usuario en curso. En Windows, con MySQL local root sin contraseña y base predeterminada:

```powershell
python tools/respaldo_local.py crear "D:\respaldos-privados"
python tools/respaldo_local.py verificar "D:\respaldos-privados\zeasys-FECHA"
```

Con credenciales distintas, usa `--mysql-defaults` y un archivo privado de opciones de cliente MySQL, o `ZEASYS_DB_HOST`, `ZEASYS_DB_PORT`, `ZEASYS_DB_USER` y `ZEASYS_DB_PASS`. La contraseña no se pasa como argumento de consola. `ZEASYS_DB_NAME` selecciona la base; por defecto es `agropredict_db`. La verificación detecta archivos alterados, ausentes o adicionales, rutas inválidas y enlaces, y comprueba SQLite; **no demuestra por sí sola que el SQL y los servicios se puedan recuperar**. Una carpeta de una operación fallida es parcial y no debe tratarse como respaldo completo.

Para preparar los archivos recuperados, usa un destino privado que todavía no exista:

```powershell
python tools/respaldo_local.py preparar-restauracion "D:\respaldos-privados\zeasys-FECHA" "D:\recuperacion-privada\ensayo-nuevo"
```

Se verifica antes y después de copiar. No ejecuta SQL ni reemplaza bases, carpetas o cuentas existentes. Conserva la copia original: abrir servicios restaurados puede cambiar sus archivos y las huellas posteriores.

El ensayo `python tools/probar_recuperacion.py` inicia MariaDB temporal, importa con permisos limitados, comprueba archivos y SQLite ficticios y consulta una colección Chroma real recuperada, también ficticia. Requiere los binarios MariaDB de XAMPP y el Python con Chroma; se puede indicar con `--chroma-python`. Véanse [el resultado y sus límites](recuperacion-verificada-20261108.md).

La recuperación personal exige importar el SQL en una base nueva, configurar la aplicación para esa base, recuperar las carpetas de Flowise y Chroma con los servicios detenidos y comprobar conexiones y credenciales antes de sustituir la instalación activa. Esta sustitución no se automatiza. SQLite de Flowise por sí solo no basta: sus claves originales son necesarias para descifrar credenciales guardadas.

No incluye instalaciones de software ni dependencias. La configuración externa adicional, las variables heredadas por otros procesos y las credenciales de otros servicios deben documentarse y protegerse por separado. No programa copias periódicas automáticamente.
