# Evaluación de realismo de inferencia (15/11/2026)

Experimento aislado: no publica modelos ni modifica datos. Reproducible con
`python ml-engine/scripts/experimento_realismo_inferencia.py`. Resultados completos en
[evaluacion-realismo-inferencia-20261115.json](evaluacion-realismo-inferencia-20261115.json).

## Pregunta

Las métricas publicadas (`ml-engine/models/metrics.json`: MAE 0,82 t/ha, R² 0,58) se calculan con las 36
variables reales de cada fila. Al simular antes de sembrar, el NDVI de etapas futuras, las plagas y
`horas_luz_dia` no se conocen y el motor las completa con medianas del conjunto histórico. ¿Qué error
recibe realmente el productor en esas condiciones?

## Método

- `GroupKFold(4)` por provincia real: `Loja` y `Loja Sierra` forman un solo grupo (21 grupos).
- Medianas/modas por zona tomadas solo del pliegue de entrenamiento.
- Mismos hiperparámetros que la configuración elegida en `evaluacion-xgboost-20261108.json`.
- Dos conjuntos: sin filas inválidas ni duplicados (1 970 filas) y solo sin duplicados, como se entrenó el
  modelo publicado (2 266 filas).

## Resultados (MAE en t/ha, validación fuera de provincia)

| Escenario | MAE (1 970) | R² (1 970) | MAE (2 266) | R² (2 266) |
|---|---|---|---|---|
| Mediana global | 1,397 | −0,078 | 1,363 | −0,054 |
| Media por zona | 0,939 | 0,518 | 0,958 | 0,478 |
| A. 36 variables con etapas futuras reales (cota superior, no disponible al planificar) | 0,828 | 0,626 | 0,816 | 0,628 |
| B. 36 variables con etapas futuras y luz imputadas (lo que ocurre hoy al simular) | 0,929 | 0,520 | 0,930 | 0,491 |
| C. 30 variables previas, luz imputada | 0,913 | 0,541 | 0,907 | 0,526 |
| D. 29 variables previas, sin `horas_luz_dia` | 0,924 | 0,533 | 0,907 | 0,528 |

## Lectura

1. **La métrica publicada corresponde al escenario A.** Para planificar, el error realista es el de B:
   alrededor de 0,93 t/ha y R² entre 0,49 y 0,52.
2. **Un contrato de planificación (C) no empeora el resultado**: es ligeramente mejor que B y no necesita
   inventar valores. Quitar además `horas_luz_dia` (D) no cambia el error de forma apreciable: la variable
   no llega de un proveedor y se imputa por zona.
3. **Al planificar, la mayor parte del acierto proviene de la zona.** La media por zona queda a 0,94–0,96
   t/ha; el modelo C la mejora en 3–5 % de MAE sobre este conjunto. Esta comparación debe repetirse con
   cosechas reales independientes antes de atribuir valor predictivo adicional al modelo.
4. **El rango actual es razonable.** La regla `max(MAE, 1,96·RMSE)` (±2,04–2,08 t/ha) cubre el 91–92 % de las
   observaciones en el escenario B. Un intervalo conforme por grupos al 80 % (±1,5 t/ha) cubre el 82–84 %.
   Mostrar ambas bandas con su cobertura medida sería más informativo que un solo rango.

## Calidad de datos relacionada

- 296 de 2 366 filas (12,5 %) no pasan `training_quality.evaluar`: 201 con temperaturas inconsistentes, 58
  con textura inconsistente y 49 de canguil clasificadas como suave. `retrain_models.py` se detiene por
  esta razón y por la procedencia no acreditada.
- Los 100 duplicados exactos ya se eliminan al entrenar y al evaluar; no afectan las métricas publicadas.
- `Loja Sierra` (altitud media 2 453 m, 2,83 t/ha) y `Loja` (1 117 m, 4,64 t/ha) son subregiones distintas:
  se mantienen como categorías y solo se agrupan para validar.

## Límites

- El motor real imputa por provincia y variedad cuando existen en el conjunto de referencia; aquí la
  provincia de prueba está reservada, por lo que se usa la zona.
- La procedencia del CSV sigue sin acreditar. Los resultados describen consistencia interna, no exactitud
  agrícola.
- No se modificó `predictor.py` ni `feature_builder.py`: adaptar la inferencia a un contrato de 30
  variables requiere decidir antes si se publica un modelo nuevo.
