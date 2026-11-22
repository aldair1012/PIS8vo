# Recuperación: ensayo y problema independiente en XAMPP

## Actualización: reparación aplicada por el propietario

El 8 de noviembre de 2026 el propietario mostró `CHECK TABLE mysql.db` con estado `OK` después de seguir la reparación manual. Una comprobación independiente con `mysqlcheck --check mysql db` confirmó `OK`. Se creó una base desechable, un usuario temporal y permisos limitados a esa base; la conexión y escritura con ese usuario funcionaron. Usuario y base se eliminaron al finalizar. Apache respondió 200 para ZeaSys y el endpoint de sesión respondió correctamente.

La corrupción que impedía asignar permisos ya no se reprodujo. Esto no demuestra que se hayan recuperado los tres registros antiguos indicados por la cabecera ni verifica los accesos particulares de los demás proyectos. Se conserva el diagnóstico anterior como historial y deben conservarse las copias previas a la reparación.

## Cambios y ensayo reproducible

`tools/respaldo_local.py` ahora guarda configuración local conocida y variables `ZEASYS_*` heredadas, verifica hashes y SQLite, rechaza archivos adicionales, rutas fuera del respaldo y enlaces, y prepara la recuperación exclusivamente en una carpeta nueva fuera del directorio web. No importa SQL sobre una instalación existente. El manifiesto sigue siendo una comprobación de integridad, no una firma de autenticidad.

Prueba ejecutada el 8 de noviembre de 2026:

```powershell
python tools/probar_recuperacion.py
```

El ensayo inicializó una instancia MariaDB temporal, en un puerto libre, sin instalar un servicio de Windows. Creó dos bases con marcadores de propiedad y datos ficticios, ejecutó el respaldo, verificó y preparó 13 archivos, e importó el SQL con un usuario limitado a la base de destino. Comprobó filas, acentos y cero real, SQLite de flujos, archivo subido, almacenamiento, secreto ficticio, PDF de prueba y configuración. Creó y consultó una colección persistente real de Chroma con dos documentos y embeddings de prueba; después de copiarla recuperó el documento y su página esperados.

La instancia y sus bases se eliminaron al finalizar. No se detuvo MariaDB de XAMPP ni se usaron cuentas o bases personales para el ensayo. La suite de herramientas tiene siete pruebas correctas, cinco de respaldo y dos de recuperación documental. El verificador general admite `-Recuperacion` para repetir el ensayo adicional.

La prueba de SQLite no arranca Flowise ni verifica descifrado de credenciales o conexión con proveedores. Los documentos y embeddings son ficticios. La recuperación completa de servicios personales y la instalación en otra computadora siguen pendientes.

## Hallazgo en la instalación compartida

Al intentar asignar permisos en el primer ensayo, MariaDB devolvió error 176 de Aria, «Read page with wrong checksum». Una comprobación dirigida `mysqlcheck --check mysql db` confirmó corrupción en **mysql.db**, tabla de permisos por base, ajena al esquema de ZeaSys.

Se guardaron copias privadas de `db.frm`, `db.MAI` y `db.MAD`, con SHA-256, en `%LOCALAPPDATA%/ZeaSys-Recuperacion/mysql-db-20261108/original`. Son copias de diagnóstico tomadas con el servidor en marcha; no se presentan como un respaldo completo y consistente de MariaDB. No se empaquetan con el proyecto.

Dos ensayos de `aria_chk` se realizaron solo sobre copias, con recuperación normal y recuperación extendida. Ambas pasaron de tres registros indicados por la cabecera a cero registros recuperados. Por ello no se aplicó esa reparación a la tabla activa. La documentación de [REPAIR TABLE](https://mariadb.com/docs/server/reference/sql-statements/table-statements/repair-table) y [Aria](https://mariadb.com/docs/server/clients-and-utilities/aria-clients-and-utilities/aria_chk) distingue reparación en servidor y herramientas sobre archivos cerrados.

El propietario confirmó que XAMPP también aloja otros proyectos. Reparar o reconstruir permisos requiere identificar los accesos de esos proyectos y disponer de una copia de recuperación adecuada. No se reemplazó la tabla por la plantilla de XAMPP ni se descartaron sus registros. La aplicación y su integración con bases desechables funcionaron; eso no resuelve la corrupción interna de permisos.
