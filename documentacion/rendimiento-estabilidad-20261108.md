# Bloque 6: rendimiento y estabilidad

Se aplicó `performance-profiling`: medir antes de cambiar herramientas. No se sustituyó PHP, Flask o MySQL sin evidencia de una ventaja.

## Sesiones y chat

El chat mantenía el bloqueo del archivo de sesión durante las consultas a proveedores. Una prueba con procesos PHP independientes reprodujo el bloqueo: una operación ficticia de 1,6 s hizo esperar a otra consulta 1,625 s. Al liberar el bloqueo durante la operación larga, la consulta paralela tardó 0,063 s.

El resultado del chat solo vuelve a guardarse si el usuario y la conversación siguen vigentes. Las pruebas comprobaron que limpiar una conversación o cerrar sesión durante la espera impide que una respuesta antigua restaure el historial. Se preservan cambios de otras claves de sesión. Estas mediciones corresponden al componente de sesión, no a una prueba de capacidad HTTP.

## Predicción

El adaptador PHP ya dispone de las referencias validadas del formulario. Se retiraron de su petición las consultas duplicadas de clima reciente y el REST de suelo obsoleto. El suelo validado de caché sigue llegando al modelo; el histórico del ciclo sigue disponible cuando se solicita. Los clientes directos del motor conservan el comportamiento anterior salvo que envíen los nuevos indicadores booleanos.

Una petición real local con contexto reciente tardó 1.672 ms. Cinco peticiones sin repetir esa consulta dieron una mediana de 78 ms (78–94 ms). Todas conservaron exactamente las mismas entradas predictoras y el mismo rendimiento en el caso comprobado. Esto no mide velocidad de Internet en otras máquinas ni rendimiento bajo concurrencia. Motor activo 2.6.0; 67 pruebas Python correctas.

## Historial con volumen

Se utilizó el repositorio de producción y el esquema real en una base marcada y desechable: 20.000 registros y 100 parcelas ficticias. Veintiuna lecturas por consulta.

| Consulta | Mediana ms | P95 ms |
| --- | ---: | ---: |
| Historial de 50 registros de 2025 | 1,25 | 4,69 |
| Página con desplazamiento 3.000 | 9,48 | 61,31 |
| Historial por parcela y año | 9,26 | 9,87 |
| Estadísticas de 2025 | 8,38 | 9,09 |
| Años disponibles | 11,66 | 12,09 |
| Recuento total | 4,41 | 4,60 |

Se verificaron los recuentos y límites. Se conservó el índice existente y se explicitó el desempate por ID en la última simulación. La base ficticia se eliminó al finalizar. Estos resultados no justifican cambiar de gestor de base de datos.

## Fallo adicional de persistencia corregido

La prueba HTTP detectó que `tipo_suelo` admitía cinco claves en la aplicación pero solo tres en MySQL, que podía guardar vacías las nuevas. Una prueba falló antes del arreglo y pasó después. El esquema nuevo y una migración idempotente agregan las dos opciones al final del ENUM, conservando las anteriores.

Antes de migrar la instalación se exportó la tabla a una carpeta privada. Se conservaron sus 36 filas y se comprobaron cero valores vacíos. Los veinte recorridos HTTP con base desechable verificaron las dos texturas, historial, autorización y resto del circuito. El SQL personal histórico no se reescribió como si fuera un esquema nuevo.

## Reproducción y límites

```powershell
python backend-api/tests/chat/sesion_concurrente.py
python tools/benchmark_historial_real.py
python backend-api/tests/integracion/ejecutar.py
```

Informes compactos en `rendimiento-estabilidad-20261108.json`. No se probó una granja de servidores, alta concurrencia remota ni todos los proveedores con fallos prolongados. Se midieron el proveedor real de chat, predicción local y volúmenes ficticios representados en las tablas reales.
