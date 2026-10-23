# Guía Completa y Explicación Técnica de los Modelos de Simulación de IA (ZeaSys)

> **Documento oficial de preparación para la Defensa de Proyecto de Grado y Manual Guía para el Equipo.**  
> *Redactado en primera persona de manera técnica, didáctica y directa para la exposición ante el jurado.*

---

## 🎯 1. Resumen Ejecutivo y Analogías sencillas (Para la Exposición)

Cuando el jurado nos pregunte **"¿Cómo funciona la IA de simulación en ZeaSys?"**, lo explicamos con esta analogía clara:

### ⚡ XGBoost (Extreme Gradient Boosting) — *"El Aprendizaje Corrector Continuo"*
* **¿Cómo lo construí?** Los árboles se crean en **serie secuencial de 600 árboles**.
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
* **Modelo usado:** `XGBRegressor`.
* **Objetivo:** Predecir un valor numérico **continuo y cuantitativo** (el rendimiento exacto de maíz en toneladas por hectárea, por ejemplo: `6.45 t/ha`).
* **Función de pérdida:** Minimiza la desviación de los residuos utilizando métricas como el Error Cuadrático Medio ($RMSE$) y el Error Absoluto Medio ($MAE$).

#### 🏷️ B) Clasificación Multiclase Supervisada (Supervised Multi-class Classification)
* **Modelo usado:** `XGBClassifier`.
* **Objetivo:** Clasificar el resultado de la siembra en **categorías cualitativas discretas** (`Rendimiento Alto`, `Rendimiento Medio`, `Rendimiento Bajo`).
* **Función de pérdida:** Minimiza la entropía cruzada (*log-loss*) para asignar probabilidades a las cuatro clases disponibles (`Alta`, `Media`, `Baja` y `Muy Baja`).

---

### 🌳 3. Familia Algorítmica: Aprendizaje por Ensambles (Ensemble Learning)

En lugar de usar un solo Árbol de Decisión individual (el cual suele memorizar los datos y sufrir de *overfitting*), utilizamos **Gradient Boosting**, que combina cientos de árboles de decisión secuenciales para corregir errores y producir una predicción robusta.

| Técnica | Algoritmo | ¿Cómo funciona internamente? | Ventaja Principal |
|---|---|---|---|
| **Boosting** *(Gradient Boosting)* | **XGBoost** | Entrena 600 árboles de forma **secuencial**. Cada nuevo árbol se enfoca específicamente en **corregir los errores (residuos)** cometidos por los árboles anteriores mediante Descenso de Gradiente. | Es el modelo principal actual: mantiene el menor error en validación por provincia ($RMSE \approx 1.04\ t/ha$). |

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
  * `GET /health`: Verifica que el servidor esté activo y que XGBoost (regresión y clasificación) esté cargado en memoria.
  * `GET /metrics`: Devuelve las métricas actuales de rendimiento ($R^2$, MAE, RMSE, Accuracy, F1-Score).
  * `GET /stats`: Proporciona promedios históricos por zona agrícola (temperatura, pH, nitrógeno, rendimiento).
  * `POST /predict`: Recibe los parámetros enviados por el usuario, llama a `feature_builder.py` y `predictor.py`, y devuelve el JSON completo con la estimación y un intervalo aproximado de rendimiento.

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
     * **Regresión (`xgboost.joblib`):** Calcula el rendimiento exacto en $t/ha$.
     * **Clasificación (`xgboost_clf.joblib`):** Clasifica la cosecha como `Alta`, `Media`, `Baja` o `Muy Baja` y decodifica el texto con `target_encoder.joblib`.
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
  4. **Regla de Validación:** elimina duplicados exactos, separa por provincia usando `GroupKFold` y compara el RMSE medio de XGBoost contra el último entrenamiento agrupado. Si empeora, se conserva el artefacto anterior.

### 📦 Archivos `.joblib` y `metrics.json` en `models/`
* `xgboost.joblib`: Modelo entrenado de regresión XGBoost.
* `xgboost_clf.joblib`: Modelo clasificador de categorías XGBoost.
* `label_encoder.joblib`: Objeto de `OrdinalEncoder` para transformar variables de entrada.
* `target_encoder.joblib`: Objeto de `LabelEncoder` para descodificar las categorías de salida (`Alto`, `Medio`, `Bajo`).
* `metrics.json`: Registro persistente de los coeficientes de precisión actuales.

---

## ⚙️ 3. Librerías y Métodos Utilizados (Justificación Técnica)

| Librería / Módulo | Métodos Específicos | ¿Por qué lo usamos y para qué sirve? |
|---|---|---|
| **`scikit-learn`** | `OrdinalEncoder`, `LabelEncoder` | Convierte texto categórico ("Arcilloso", "Los Ríos") a valores escalares requeridos por los algoritmos. |
| **`scikit-learn`** | `GroupKFold` | Valida por provincia para medir generalización a zonas no vistas y evitar fuga entre muestras similares. |
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
*Respuesta esperada:* `{"modelos_cargados": ["xgboost"], "modelo_principal": "xgboost", "status": "ok", "version": "2.2.0"}`

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

Si el motor Flask ya estaba encendido antes de publicar un reentrenamiento,
reinícialo desde la raíz del proyecto para cargar los nuevos artefactos:
```bat
scripts\reiniciar_motor_ia.bat
```

---

## 🛡️ 6. Proceso de Re-entrenamiento y Salvaguarda de Confiabilidad

### ¿Cómo re-entrenamos el modelo para hacerlo más confiable?
1. **Recolección de Nuevos Datos:** Al incorporar nuevas cosechas reales registradas en las zonas agrícolas de Ecuador, agregamos filas al dataset `maiz_ecuador_training_data.csv`.
2. **Ajuste de Hiperparámetros de Regularización:**
   * En **XGBoost Regressor**, usamos `learning_rate=0.03`, `subsample=0.8`, `reg_alpha=0.1` (L1) y `reg_lambda=1.0` (L2). Esto penaliza ecuaciones sobre-complejas y evita el sobreajuste (*overfitting*).
3. **Validación agrupada y salvaguarda:** `scripts/retrain_models.py` registra las filas eliminadas, las provincias utilizadas, las métricas de cada pliegue y compara el RMSE medio de XGBoost contra la versión anterior antes de publicar el artefacto.
4. **Incertidumbre explícita:** cada `/predict` devuelve `intervalo_rendimiento` (rango aproximado basado en RMSE/MAE de validación). `confianza` se conserva por compatibilidad, pero está etiquetada como `calidad_global_r2`; no es una probabilidad de éxito de la parcela.

---

## ❓ 7. Preguntas Probables del Jurado y Respuestas Preparadas

### 0. "¿Qué tipos de Aprendizaje Automático (Machine Learning) utilizaron en el sistema?"
> *"Utilizamos **Aprendizaje Automático Supervisado** (*Supervised Machine Learning*) mediante XGBoost. `XGBRegressor` predice el rendimiento continuo en toneladas por hectárea ($t/ha$) y `XGBClassifier` categoriza la cosecha como `Alta`, `Media`, `Baja` o `Muy Baja`. La familia algorítmica corresponde a Gradient Boosting con regularización."*

### 1. "¿Por qué utilizaron XGBoost como único modelo?"
> *"XGBoost mantiene el menor error medido en la validación agrupada por provincia (RMSE aproximado de $1.04\ t/ha$; R² medio de 58.2%). Centralizar la inferencia en este modelo elimina divergencias entre motores y facilita mantener una única calibración."*

### 2. "¿Cómo garantizan que el modelo no esté memorizando los datos (Overfitting)?"
> *"Implementamos varias estrategias: eliminamos duplicados exactos, validamos por provincia con `GroupKFold` para medir datos no vistos, limitamos la profundidad (`max_depth=4`) y aplicamos regularización L1/L2 en XGBoost. Las métricas se registran por pliegue para detectar provincias con mayor error."*

### 3. "¿Qué sucede si el usuario ingresa datos incompletos en la simulación?"
> *"El módulo `feature_builder.py` cuenta con un sistema de imputación agronómica inteligente. Si faltan variables categóricas o climáticas, el sistema consulta los promedios históricos de la zona agroecológica seleccionada en Ecuador y completa el vector de entrada antes de enviarlo al modelo."*

### 4. "¿Cómo se asegura que un nuevo re-entrenamiento no arruine la precisión del sistema en producción?"
> *"El script `retrain_models.py` incluye una salvaguarda automática: genera un respaldo con marca de tiempo en `models/backup_...` y compara el nuevo RMSE contra el actual en `metrics.json`. Si el nuevo modelo no iguala o supera la precisión actual, el cambio se rechaza automáticamente y se conservan los modelos vigentes."*

### 5. "¿Por qué utilizaron SHAP para la explicabilidad?"
> *"SHAP (`Shapley Additive exPlanations`) se basa en la Teoría de Juegos de Shapley. A diferencia de la importancia de variables tradicional de Scikit-Learn que solo da un valor global, SHAP nos dice **exactamente para esa simulación particular** cuántas toneladas sumó o restó cada factor específico (ej. la temperatura restó $0.4\ t/ha$, el fertilizante sumó $0.8\ t/ha$). Esto hace que nuestra IA sea 100% transparente y explicable para el agricultor."*
