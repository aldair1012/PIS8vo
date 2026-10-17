# Suite de contrato ZeaSys

Verifica que la reestructuración del backend no cambia ninguna respuesta del API.

## Uso

```
C:\xampp\php\php.exe tests\contrato\ejecutar.php --modo=capturar
C:\xampp\php\php.exe tests\contrato\ejecutar.php --modo=comparar
```

- `--modo` es obligatorio (`capturar`|`comparar`); si falta o es inválido, se imprime el uso y se sale con exit 2.
- `capturar` guarda la huella en `tests/contrato/snapshots/antes/contrato.json`.
- `comparar` re-ejecuta el escenario y la compara (exit 0 = OK, 1 = diferencias, 2 = infraestructura).
- Volatilidad por paso: `exacto` (comparación estricta), `tolerante` (±25% en números), `estructural` (solo forma/tipos; para APIs externas).
- IDs, fechas, tokens y correos de prueba se normalizan automáticamente.
- Claves de APIs externas en vivo (soilgrids, open_meteo) se colapsan a <externo>; los ítems aleatorios de "fecha de siembra" (mt_rand) se neutralizan a <volatil>.
- Salidas derivadas del motor ML (rendimiento_estimado, produccion_total, rendimiento_promedio, shap_json, escenarios_json, ...) se colapsan a <externo:tipo>: comparamos solo el tipo de dato (la variabilidad proviene de SoilGrids dentro del motor).
- En pasos con volatilidad tolerante, los textos comparan esqueleto exacto (números → #) y cada número embebido con ±25% — cubre la prosa de explain cuando cambia el rendimiento ML.
- La comparación estructural une integer y float en la familia "number" (json_encode emite floats enteros sin decimal: 15.0 → 15).

## Requisitos
Apache + MySQL de XAMPP corriendo. El motor IA se verifica y se arranca solo (auto_ia_server.bat).

## Limpieza manual (opcional, si una corrida se interrumpe)

```powershell
# 1) Borra SOLO los avatares de usuarios de contrato (los avatares reales NO se tocan).
#    Ejecutar ANTES del DELETE de usuarios: necesita que aún existan en la DB (si no, no encontrará ids).
#    Los archivos se nombran avatar_<usuarioId>_<timestamp>.png (ver AuthController).
$ids = & C:\xampp\mysql\bin\mysql.exe -u root -N -e "SELECT id FROM agropredict_db.usuarios WHERE correo LIKE 'contrato\_%@zeasys.local';"
foreach ($id in $ids) { Remove-Item "backend-api\public\uploads\avatars\avatar_${id}_*.png" -ErrorAction SilentlyContinue }
```

```sql
DELETE FROM usuarios WHERE correo LIKE 'contrato\_%@zeasys.local';
```

## Limitaciones conocidas

- El formato de fechas NO forma parte del contrato (se normaliza a `<fecha>`).
- La tolerancia numérica tiene suelo absoluto: valores < 1 comparan con ±0.25 fijo (denominador mínimo 1.0).
- `estructura()` compara listas colapsando elementos en la misma ruta (`/*`): un cambio de tipo solo en el primer elemento de una lista puede quedar enmascarado si los últimos elementos no cambian (afecta a los 2 pasos `estructural`).
- Los temporales de una corrida interrumpida pueden quedar en `%TEMP%` (y un usuario de contrato puede quedar huérfano en DB — ya documentado). La suite los borra vía `register_shutdown_function` incluso al abortar con `exit`; solo quedan restos si el proceso se mata a la fuerza.
