# Suite de contrato ZeaSys

Verifica que la reestructuración del backend no cambia ninguna respuesta del API.

## Uso

```
C:\xampp\php\php.exe tests\contrato\ejecutar.php --modo=capturar
C:\xampp\php\php.exe tests\contrato\ejecutar.php --modo=comparar
```

- `capturar` guarda la huella en `tests/contrato/snapshots/antes/contrato.json`.
- `comparar` re-ejecuta el escenario y la compara (exit 0 = OK, 1 = diferencias, 2 = infraestructura).
- Volatilidad por paso: `exacto` (comparación estricta), `tolerante` (±25% en números), `estructural` (solo forma/tipos; para APIs externas).
- IDs, fechas, tokens y correos de prueba se normalizan automáticamente.
- Claves de APIs externas en vivo (soilgrids, open_meteo) se colapsan a <externo>; los ítems aleatorios de "fecha de siembra" (mt_rand) se neutralizan a <volatil>.
- Salidas derivadas del motor ML (rendimiento_estimado, produccion_total, rendimiento_promedio, shap_json, escenarios_json, ...) se colapsan a <externo:tipo>: comparamos solo el tipo de dato (la variabilidad proviene de SoilGrids dentro del motor).
- En pasos con volatilidad tolerante, los textos comparan esqueleto exacto (números → #) y cada número embebido con ±25% — cubre la prosa de explain cuando cambia el rendimiento ML.

## Requisitos
Apache + MySQL de XAMPP corriendo. El motor IA se verifica y se arranca solo (auto_ia_server.bat).

## Limpieza manual (opcional, si una corrida se interrumpe)

```sql
DELETE FROM usuarios WHERE correo LIKE 'contrato\_%@zeasys.local';
```

```powershell
# Avatares residuales de las corridas de contrato (deleteAvatar no borra el archivo, igual que hoy)
Remove-Item backend-api\public\uploads\avatars\avatar_*_*.png -ErrorAction SilentlyContinue
```
