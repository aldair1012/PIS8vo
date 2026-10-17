# Guía Completa y Explicación Técnica de los Modelos de Simulación de IA (ZeaSys)

> **Documento oficial de preparación para la Defensa de Proyecto de Grado y Manual Guía para el Equipo.**  
> *Redactado en primera persona de manera técnica, didáctica y directa para la exposición ante el jurado.*

---

## 🎯 1. Resumen Ejecutivo y Analogías sencillas (Para la Exposición)

Cuando el jurado nos pregunte **"¿Cómo funciona la IA de simulación en ZeaSys?"**, lo explicamos con esta analogía clara:

### 🌲 A) Random Forest (Bosque Aleatorio) — *"El Comité de 300 Agrónomos Expertos"*
* **¿Cómo lo construí?** Creo un ensamblado de 300 árboles de decisión independientes. Cada árbol analiza una muestra aleatoria diferente de los datos históricos de cosechas de maíz en Ecuador.
* **¿Cómo predice?** Cuando entra una simulación, cada uno de los 300 árboles emite su pronóstico individual. La predicción final es el **promedio de todas las opiniones**, lo que evita que un error aislado distorsione el resultado final.

### ⚡ B) XGBoost (Extreme Gradient Boosting) — *"El Aprendizaje Corrector Continuo"*
* **¿Cómo lo construí?** A diferencia de Random Forest, los árboles no se crean de forma independiente, sino en **serie secuencial de 600 árboles**.
* **¿Cómo predice?** El primer árbol hace un cálculo inicial. El segundo árbol revisa los errores que cometió el primero y ajusta sus pesos para corregirlos. El tercer árbol corrige al segundo, y así sucesivamente. Cada nuevo paso afina la precisión hasta alcanzar un error mínimo.

---

## 🧠 2. Tipos de Aprendizaje Automático (Machine Learning) Utilizados

Si en la exposición el jurado pregunta **"¿Qué tipos o paradigmas de Aprendizaje Automático utilizaron en su proyecto?"**, la respuesta técnica exacta es:

> **"Utilizamos Aprendizaje Automático Supervisado (Supervised Machine Learning), abordando dos tipos de tareas: Regresión Supervisada y Clasificación Multiclase Supervisada, mediante la familia de algoritmos de Aprendizaje por Ensambles (Ensemble Learning)."**

A continuación explico en detalle cada uno de estos paradigmas:

### 1️⃣ Aprendizaje Supervisado (Supervised Learning)
* **¿Por qué es supervisado?** Porque los modelos fueron entrenados utilizando un dataset histórico etiquetado de cosechas en Ecuador (`maiz_ecuador_training_data.csv`), donde cada fila contenía tanto las variables de entrada (clima, suelo, fertilizante) como la **respuesta real esperada** (*ground truth*: rendimiento exacto en $t/ha$ y categoría de cosecha).
* **Funcionamiento:** El algoritmo analiza las entradas y compara continuamente sus predicciones contra las respuestas reales de la tabla para ajustar sus parámetros matemáticos hasta minimizar el error.

### 2️⃣ Subtipos de Tareas de Machine Learning Implementadas

#### 📊 A) Regresión Supervisada (Supervised Regression)
* **Modelos usados:** `XGBRegressor` y `RandomForestRegressor`.
* **Objetivo:** Predecir un valor numérico **continuo y cuantitativo** (el rendimiento exacto de maíz en toneladas por hectárea, por ejemplo: `6.45 t/ha`).
* **Función de pérdida:** Minimiza la desviación de los residuos utilizando métricas como el Error Cuadrático Medio ($RMSE$) y el Error Absoluto Medio ($MAE$).

#### 🏷️ B) Clasificación Multiclase Supervisada (Supervised Multi-class Classification)
* **Modelos usados:** `XGBClassifier` y `RandomForestClassifier`.
* **Objetivo:** Clasificar el resultado de la siembra en **categorías cualitativas discretas** (`Rendimiento Alto`, `Rendimiento Medio`, `Rendimiento Bajo`).
* **Función de pérdida:** Minimiza la entropía cruzada (*log-loss*) para asignar probabilidades a cada una de las 3 clases posibles.

---

### 🌳 3. Familia Algorítmica: Aprendizaje por Ensambles (Ensemble Learning)

En lugar de usar un solo Árbol de Decisión individual (el cual suele memorizar los datos y sufrir de *overfitting*), utilizamos **Ensambles**, que combinan cientos de árboles de decisión para lograr un modelo compuesto mucho más preciso y robusto.

Usamos dos técnicas principales de ensamblado:

| Técnica | Algoritmo | ¿Cómo funciona internamente? | Ventaja Principal |
|---|---|---|---|
| **Bagging** *(Bootstrap Aggregating)* | **Random Forest** | Entrena 300 árboles de decisión de forma **paralela e independiente**. Cada árbol ve una muestra aleatoria de datos y variables. La respuesta final es la **promedio o votación mayoritaria**. | Excelente para **reducir la varianza** y evitar que datos ruidosos o atípicos distorsionen la predicción. |
| **Boosting** *(Gradient Boosting)* | **XGBoost** | Entrena 600 árboles de forma **secuencial**. Cada nuevo árbol se enfoca específicamente en **corregir los errores (residuos)** cometidos por los árboles anteriores mediante Descenso de Gradiente. | Excelente para **reducir el sesgo** y lograr la máxima precisión matemática ($R^2 = 67.0\%$). |

---

### 🔍 4. IA Explicable (XAI - Explainable Artificial Intelligence)
* **Técnica utilizada:** **SHAP (Shapley Additive exPlanations)** mediante el algoritmo `shap.TreeExplainer`.
* **¿Qué paradigma es?** Pertenece al campo de la **Interpretabilidad de Modelos Complexos** basada en la *Teoría de Juegos Cooperativos de Shapley*.
* **Propósito:** Descompone el resultado de la predicción y calcula matemáticamente la contribución marginal de cada variable de entrada (ejemplo: cuánto aportó el pH, la humedad o el nitrógeno a la cifra final de rendimiento).

---

## 📁 3. Explicación Detallada de Cada Archivo del Motor ML (`ml-engine`)

A continuación explico exactamente qué hace cada archivo que creé dentro de la carpeta `ml-engine/`:

### 📄 `app.py` (El Servidor API REST en Flask)
* **¿Para qué sirve?** Es la puerta de entrada que conecta el sistema web (Backend PHP) con la Inteligencia Artificial en Python.
* **¿Cómo lo hice?** Utilicé **Flask** y **Flask-CORS** para escuchar peticiones HTTP en el puerto `5000`.
* **Endpoints que expone:**
  * `GET /health`: Verifica que el servidor esté activo y que los 4 modelos `.joblib` estén cargados en memoria.
  * `GET /metrics`: Devuelve las métricas actuales de rendimiento ($R^2$, MAE, RMSE, Accuracy, F1-Score).
  * `GET /stats`: Proporciona promedios históricos por zona agrícola (temperatura, pH, nitrógeno, rendimiento).
  * `POST /predict`: Recibe los parámetros enviados por el usuario, llama a `feature_builder.py` y `predictor.py`, y devuelve el JSON completo con la estimación.

### 📄 `src/feature_builder.py` (Ingeniería de Características y Preprocesamiento)
* **¿Para qué sirve?** Toma los datos brutos enviados por el usuario (o por el formulario de simulación) y los transforma en el formato exacto que exigen los modelos matemáticos.
* **¿Qué métodos utiliza?**
  * **Completado inteligente (Imputación Agronómica):** Si el usuario no ingresa variables como variada de semilla, tipo de riego o provincia, `feature_builder` asigna valores de referencia basados en promedios históricos de la zona seleccionada.
  * **Ordenamiento estricto:** Garantiza que las columnas ingresen a las matrices de NumPy/Pandas en el orden exacto con el que fueron entrenados los modelos (`COLS_ORDER`).

### 📄 `src/predictor.py` (El Motor Inferencia Dual, SHAP y Escenarios)
* **¿Para qué sirve?** Realiza los cálculos matemáticos de predicción en tiempo real.
* **Proceso de ejecución interna:**
  1. **Transformación Categórica:** Aplica `label_encoder.joblib` para convertir textos ("Provincia", "Tipo de Suelo") a números.
  2. **Inferencia Dual Paralela:**
     * **Regresión (`xgboost.joblib` o `random_forest.joblib`):** Calcula el rendimiento exacto en $t/ha$.
     * **Clasificación (`xgboost_clf.joblib` o `random_forest_clf.joblib`):** Clasifica la cosecha como `Alto`, `Medio` o `Bajo` rendimiento y decodifica el texto con `target_encoder.joblib`.
  3. **Explicabilidad con SHAP (`TreeExplainer`):** Calcula qué porcentaje de impacto positivo o negativo tuvo cada factor (clima, suelo, nitrógeno) en el resultado.
  4. **Simulador de Escenarios Alternativos:** Genera 3 predicciones instantáneas sin modificar la entrada del usuario:
     * *Escenario Lluvioso:* 1000 mm precipitación / 80% humedad.
     * *Escenario Verano:* 700 mm precipitación / 60% humedad.
     * *Escenario Sequía / Estrés Térmico:* 300 mm precipitación / 40% humedad / 33°C.

### 📄 `scripts/retrain_models.py` (El Script de Re-entrenamiento Automatizado y Seguro)
* **¿Para qué sirve?** Permite re-entrenar todos los modelos con nuevos datos de campo de forma segura, garantizando que el sistema nunca empeore su precisión.
* **¿Cómo funciona la salvaguarda?**
  1. Carga el dataset actualizado `data/maiz_ecuador_training_data.csv`.
  2. Genera un **Backup Automático** de las versiones activas en `models/backup_YYYYMMDD_HHMMSS`.
  3. Entrena y evalúa las nuevas versiones calculando el **RMSE**.
  4. **Regla de Validación:** Compara el nuevo RMSE contra el guardado en `metrics.json`. Si el nuevo RMSE es menor o igual, se aprueba el reemplazo de los `.joblib`. Si empeora, se rechaza la actualización y se restauran los modelos anteriores.

### 📦 Archivos `.joblib` y `metrics.json` en `models/`
* `random_forest.joblib`: Modelo entrenado de regresión Random Forest.
* `xgboost.joblib`: Modelo entrenado de regresión XGBoost.
* `random_forest_clf.joblib`: Modelo clasificador de categorías Random Forest.
* `xgboost_clf.joblib`: Modelo clasificador de categorías XGBoost.
* `label_encoder.joblib`: Objeto de `OrdinalEncoder` para transformar variables de entrada.
* `target_encoder.joblib`: Objeto de `LabelEncoder` para descodificar las categorías de salida (`Alto`, `Medio`, `Bajo`).
* `metrics.json`: Registro persistente de los coeficientes de precisión actuales.

---

## ⚙️ 3. Librerías y Métodos Utilizados (Justificación Técnica)

| Librería / Módulo | Métodos Específicos | ¿Por qué lo usamos y para qué sirve? |
|---|---|---|
| **`scikit-learn`** | `RandomForestRegressor`, `RandomForestClassifier` | Implementa ensambles por Bagging (reducción de varianza y robustez ante ruido). |
| **`scikit-learn`** | `OrdinalEncoder`, `LabelEncoder` | Convierte texto categórico ("Arcilloso", "Los Ríos") a valores escalares requeridos por los algoritmos. |
| **`scikit-learn`** | `train_test_split` | Separa los datos en 80% entrenamiento y 20% prueba aleatoria descolgada (`random_state=42`). |
| **`scikit-learn`** | `r2_score`, `mean_squared_error`, `mean_absolute_error` | Evalúa cuantitativamente el margen de error real del modelo. |
| **`xgboost`** | `XGBRegressor`, `XGBClassifier` | Implementa Gradient Boosting optimizado en C++ con regularización L1/L2 para maximizar el $R^2$. |
| **`shap`** | `TreeExplainer`, `shap_values()` | Aplica Teoría de Juegos de Shapley para explicar de forma transparente qué variable pesó más en el resultado. |
| **`joblib`** | `dump()`, `load()` | Permite serializar los objetos de los modelos entrenados en archivos binarios optimizados en disco. |
| **`flask` & `flask-cors`** | `Flask`, `jsonify`, `CORS` | Expone los servicios de IA mediante microservicios RESTful consumibles por PHP o cualquier frontend. |
| **`pandas` & `numpy`** | `DataFrame`, `read_csv()`, `fit_transform()` | Manipulación eficiente de arreglos multidimensionales y matrices de datos agronómicos. |

---

## 🔄 4. Flujo de Ejecución End-to-End (Paso a Paso)

Para explicar cómo se conecta todo el sistema en vivo:

```
[1. Usuario en React] ➔ (Formulario de Simulación)
        ↓
[2. Backend PHP] ➔ (SimulacionController.php envía HTTP POST via IaServerHelper.php)
        ↓
[3. Servidor Flask ML (app.py:5000)] ➔ (Recibe JSON en endpoint /predict)
        ↓
[4. feature_builder.py] ➔ (Imputación + Codificación Ordinal de variables)
        ↓
[5. predictor.py] ➔ (Inferencia simultánea en Regresor + Clasificador + SHAP + Escenarios)
        ↓
[6. Respuesta JSON] ➔ (Devuelve a PHP y este a React para renderizar gráficos y KPI Cards)
```

---

## 🛠️ 5. Guía Práctica de Pruebas: Comandos y Códigos Exactos

### A) Iniciar el Servidor de IA (Python)
Abrir una terminal en `c:\xampp\htdocs\ZeaSys\ml-engine` y ejecutar:
```bash
python app.py
```

### B) Probar el Estado de Salud (`/health`)
```bash
curl -X GET http://localhost:5000/health
```
*Respuesta esperada:* `{"modelos_cargados": [...], "status": "ok", "version": "2.1.0"}`

### C) Probar las Métricas de los Modelos (`/metrics`)
```bash
curl -X GET http://localhost:5000/metrics
```

### D) Ejecutar una Simulación de Prueba por HTTP (`/predict`)
```bash
curl -X POST http://localhost:5000/predict \
  -H "Content-Type: application/json" \
  -d '{
    "temperatura": 26.5,
    "humedad": 75.0,
    "precipitacion": 850.0,
    "fertilizante": 140.0,
    "phSuelo": 6.5,
    "area": 5.0,
    "tipoSuelo": "Franco-Arcilloso",
    "modelo": "xgboost"
  }'
```

### E) Ejecutar el Re-entrenamiento Seguro de los Modelos
Abrir terminal en `c:\xampp\htdocs\ZeaSys\ml-engine` y ejecutar:
```bash
python scripts/retrain_models.py
```

---

## 🛡️ 6. Proceso de Re-entrenamiento y Salvaguarda de Confiabilidad

### ¿Cómo re-entrenamos el modelo para hacerlo más confiable?
1. **Recolección de Nuevos Datos:** Al incorporar nuevas cosechas reales registradas en las zonas agrícolas de Ecuador, agregamos filas al dataset `maiz_ecuador_training_data.csv`.
2. **Ajuste de Hiperparámetros de Regularización:**
   * En **XGBoost Regressor**, usamos `learning_rate=0.03`, `subsample=0.8`, `reg_alpha=0.1` (L1) y `reg_lambda=1.0` (L2). Esto penaliza ecuaciones sobre-complejas y evita el sobreajuste (*overfitting*).
   * En **Random Forest**, limitamos la profundidad máxima `max_depth=12` y usamos `max_features="sqrt"`, garantizando árboles diversos y desacoplados.
3. **Mapeo del Mecanismo de Salvaguarda Automatizado:**
   ```python
   # Código clave en scripts/retrain_models.py
   rf_improved = new_rf_rmse <= current_rf_rmse
   xgb_improved = new_xgb_rmse <= current_xgb_rmse

   if rf_improved and xgb_improved:
       # Se guardan los nuevos archivos .joblib y se actualiza metrics.json
       joblib.dump(xgb_reg, "models/xgboost.joblib")
   else:
       # Se descarta la actualización y se conserva el backup previo
       print("Reentrenamiento rechazado: El nuevo modelo no mejoró el RMSE.")
   ```

---

## ❓ 7. Preguntas Probables del Jurado y Respuestas Preparadas

### 0. "¿Qué tipos de Aprendizaje Automático (Machine Learning) utilizaron en el sistema?"
> *"Utilizamos **Aprendizaje Automático Supervisado** (*Supervised Machine Learning*). Desarrollamos dos modelos de **Regresión Supervisada** (`XGBRegressor` y `RandomForestRegressor`) para predecir el rendimiento continuo en toneladas por hectárea ($t/ha$), y dos modelos de **Clasificación Multiclase Supervisada** (`XGBClassifier` y `RandomForestClassifier`) para categorizar la cosecha como `Alto`, `Medio` o `Bajo` rendimiento. La familia algorítmica utilizada corresponde a **Aprendizaje por Ensambles** (*Ensemble Learning*), combinando técnicas de **Bagging** con Random Forest y **Gradient Boosting** con XGBoost."*

### 1. "¿Por qué utilizaron XGBoost y Random Forest juntos y no solo uno?"
> *"Utilizamos una arquitectura comparativa dual. **XGBoost** es nuestro modelo principal de regresión porque obtiene el mejor $R^2$ ($67.0\%$) y menor error RMSE ($1.0098\ t/ha$) gracias al entrenamiento secuencial con corrección de residuos. **Random Forest** nos brinda estabilidad complementaria en clasificación por categorías ($62.2\%$ de accuracy) y sirve como validación cruzada para evitar sesgos."*

### 2. "¿Cómo garantizan que el modelo no esté memorizando los datos (Overfitting)?"
> *"Implementamos tres estrategias: Primero, dividimos los datos en 80% entrenamiento y 20% prueba descolgada (`train_test_split`). Segundo, limitamos la profundidad máxima de los árboles (`max_depth=12` en RF y `max_depth=4` en XGBoost). Tercero, aplicamos regularización L1 (`reg_alpha=0.1`) y L2 (`reg_lambda=1.0`) en XGBoost."*

### 3. "¿Qué sucede si el usuario ingresa datos incompletos en la simulación?"
> *"El módulo `feature_builder.py` cuenta con un sistema de imputación agronómica inteligente. Si faltan variables categóricas o climáticas, el sistema consulta los promedios históricos de la zona agroecológica seleccionada en Ecuador y completa el vector de entrada antes de enviarlo al modelo."*

### 4. "¿Cómo se asegura que un nuevo re-entrenamiento no arruine la precisión del sistema en producción?"
> *"El script `retrain_models.py` incluye una salvaguarda automática: genera un respaldo con marca de tiempo en `models/backup_...` y compara el nuevo RMSE contra el actual en `metrics.json`. Si el nuevo modelo no iguala o supera la precisión actual, el cambio se rechaza automáticamente y se conservan los modelos vigentes."*

### 5. "¿Por qué utilizaron SHAP para la explicabilidad?"
> *"SHAP (`Shapley Additive exPlanations`) se basa en la Teoría de Juegos de Shapley. A diferencia de la importancia de variables tradicional de Scikit-Learn que solo da un valor global, SHAP nos dice **exactamente para esa simulación particular** cuántas toneladas sumó o restó cada factor específico (ej. la temperatura restó $0.4\ t/ha$, el fertilizante sumó $0.8\ t/ha$). Esto hace que nuestra IA sea 100% transparente y explicable para el agricultor."*
