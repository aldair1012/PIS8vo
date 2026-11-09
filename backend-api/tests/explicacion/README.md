# Intérprete agrícola con evidencia

Ejecutar desde `backend-api`:

```powershell
& C:\xampp\php\php.exe tests/explicacion/ejecutar.php
```

La suite usa repositorios en memoria, convierte advertencias PHP en errores y no accede a MySQL, red o procesos externos. Recorre las 46 estrategias con ausencia y con cero, verifica la selección por nombre y las claves que consume el modal, y prueba casos específicos de SHAP, intervalos, brecha, índice de cosecha, datos económicos, sensibilidad y series.

Reglas verificadas:

- El `valor` explícito de la tarjeta tiene prioridad. Un `null` o marcador de ausencia impide sustituirlo con una simulación guardada.
- Los campos explícitos de un indicador preceden a los datos de simulación. La predicción guardada corresponde al año solicitado; una predicción puntual no se usa como mediana de escenarios.
- Las magnitudes ausentes permanecen `null`. No se completan rendimientos, potenciales, dosis, pérdidas, precios ni causas.
- Los aportes SHAP mantienen su signo y se identifican como explicación del modelo, sin convertirlos en causalidad ni ganancias recuperables.
- Los gráficos resumen sus series por separado y conservan huecos y ceros. La frecuencia descriptiva de escenarios negativos no se declara una probabilidad.
- La precipitación conserva el periodo declarado, incluida la diferencia entre `mm/año` y `mm/ciclo`; no se compara con un umbral universal ni se convierte entre periodos.
- Una tarjeta sin evidencia recibe una respuesta informativa normal con las mismas claves del API; las estructuras o tipos inválidos producen `ValidacionException` HTTP 400.

El intérprete describe el valor comunicado por el origen; no certifica que una entrada del frontend sea una medición real. Las fuentes, fechas, unidades y límites se hacen explícitos en el texto.
