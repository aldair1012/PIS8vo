# Contraseñas exactas y compatibilidad

Las contraseñas nuevas y los cambios de contraseña conservan exactamente los caracteres enviados, incluidos los espacios al principio y al final. La confirmación también debe coincidir exactamente. Bcrypt admite hasta 72 **bytes**; se rechaza una clave nueva que supere ese límite o contenga bytes nulos para evitar truncamientos.

`Dominio/Contrasena` centraliza creación y verificación. La columna existente `usuarios.contrasena` (`VARCHAR(255)`) guarda los hashes nuevos como `zeasys-exact-v1$` seguido del hash bcrypt estándar. Ese prefijo identifica la semántica; no contiene una contraseña, clave o secreto. No requiere DDL ni modificar hashes existentes.

- Hash con prefijo: se verifica únicamente la contraseña exacta, sin recortarla.
- Hash bcrypt anterior sin prefijo: se intenta la entrada exacta y, después, su `trim()` para mantener el acceso de cuentas creadas con el comportamiento anterior.
- No se reescriben hashes durante login ni se elige una nueva contraseña a partir de un acceso legacy ambiguo. El usuario puede establecer una contraseña nueva desde su perfil para adoptar la semántica exacta.
- Se rechazan sufijos que excedan 72 bytes; no se permite que bcrypt autentique solo los primeros 72 bytes de una contraseña más larga.
- Las cuentas creadas mediante Google conservan una contraseña aleatoria no publicada, ahora con el mismo formato versionado. La autenticación Google verifica el token por separado; no deriva una contraseña del token ni del correo.

Los backups deben conservar **todo** el contenido de `contrasena`, incluido el prefijo. Las herramientas administrativas de establecimiento/restablecimiento de contraseña deben usar `Contrasena::crearHash()` y nunca aplicar `trim()` ni almacenar texto plano. `obtenerPasswordHash()` devuelve el valor completo almacenado; para comprobarlo debe usarse `Contrasena::verificar()`, no `password_verify()` directamente sobre el valor con prefijo.

Pruebas sin base de datos ni red:

```powershell
C:\xampp\php\php.exe backend-api\tests\autenticacion\ejecutar.php
```
