# Arquitectura del Sistema ZeaSys (AgroPredict DSS)


## 1. Fundamentos Teóricos y Tipo de Arquitectura

El sistema ZeaSys implementa una **Arquitectura Multicapa Distribución Orientada a Servicios (Microservicios Híbridos)** combinada con el patrón **MVC (Modelo-Vista-Controlador)** y **DSS (Decision Support Systems)**.

### A. Patrones y Estilos Arquitectónicos Aplicados
1. **Arquitectura Multicapa Decoplada (Multi-Tier Architecture):**
   - **Capa de Presentación (Frontend Client-Side):** Interfaz Single Page Application (SPA) construida en React 18 que gestiona el estado visual, interacciones de mapas GIS y gráficos interactivos sin recargar la página.
   - **Capa de Servicios y Negocio (Backend API):** Servidor PHP estructurado en MVC que expone servicios RESTful, gestiona reglas de negocio agronómicas, sesiones de usuario y validaciones.
   - **Capa de Inteligencia y Microservicio de ML (AI Inference Engine):** Servidor independiente Flask en Python enfocado exclusivamente en la ejecución de algoritmos de aprendizaje automático y explicabilidad.
   - **Capa de Persistencia de Datos (Data Tier):** Base de datos relacional MySQL con modelos relacionales normalizados y almacenamiento geográfico GeoJSON.

2. **Arquitectura DSS (Decision Support System):**
   ZeaSys está diseñado bajo los principios teóricos de los Sistemas de Soporte de Decisiones impulsados por datos y modelos (*Data-Driven & Model-Driven DSS*). Transforma variables agrícolas puras (suelo, precipitación, temperatura, fertilización) en indicadores clave de rendimiento (KPIs), recomendaciones operativas y proyecciones de riesgo financiero.

---

## 2. Tecnologías y Modelos de Inteligencia Artificial / Machine Learning

### A. Modelos y Algoritmos Inteligentes Utilizados
1. **XGBoost (Extreme Gradient Boosting):**
   - **Propósito:** Estimación del rendimiento real (*Yield Gap*) y predicción de toneladas por hectárea ($t/ha$).
   - **Justificación Teórica:** Es un algoritmo de ensamble basado en árboles de decisión optimizados por gradiente, ideal para datos tabulares agrícolas donde existen interacciones no lineales entre variables edafológicas y climáticas.
2. **Random Forest Regressor:**
   - **Propósito:** Modelo secundario de validación y cálculo de variabilidad de escenarios (*Monte Carlo simulation*).
   - **Justificación Teórica:** Evita el sobreajuste (*overfitting*) promediando múltiples árboles de decisión independientes entrenados con submuestras del conjunto de datos.
3. **Distribución Gaussiana y Percentiles (Análisis Estadístico Probabilístico):**
   - **Propósito:** Cálculo de percentiles (P10, P50, P90) e histograma de curva normal de densidad en el *DSS 2: Viabilidad de Siembra*.
   - **Justificación Teórica:** Permite representar la incertidumbre climática a lo largo de 30 simulaciones históricas, mostrando al agricultor la probabilidad matemática de superar un objetivo de rendimiento.
4. **Explicabilidad de Modelos (XAI - Explainable AI con SHAP / Feature Importance):**
   - **Propósito:** Desglosar la contribución porcentual de cada factor (*Agua, Nitrógeno, Temperatura, pH, Fecha de Siembra*) en la pérdida de rendimiento.
   - **Justificación Teórica:** Convierte una "caja negra" predictiva en explicaciones agronómicas comprensibles para el usuario final.

---

## 3. Diagrama de Arquitectura de Alto Nivel

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          CAPA PRESENTACIÓN / FRONTEND WEB                              │
│                    (React 18 / Vite / CSS Vanilla / Chart.js / Leaflet)                │
│                                                                                        │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐             │
│  │ Autenticación│   │ DSS 1: Brecha│   │ DSS 2: Siembra│   │ DSS 3: Clima │             │
│  │ Google / Correo│ │   Rendimiento│   │   Viabilidad │   │   Fenología  │             │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘             │
│         │                  │                  │                  │                     │
│  ┌──────┴───────┐   ┌──────┴───────┐   ┌──────┴───────┐   ┌──────┴───────┐             │
│  │ DSS 4: Margen│   │ Simulación   │   │ Mapa Polígonos│   │ Gestión Lotes│             │
│  │   Financiero │   │   Escenarios │   │   GIS Leaflet│   │   y Modelos  │             │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘             │
└─────────┼──────────────────┼──────────────────┼──────────────────┼─────────────────────┘
          │                  │                  │                  │
          ▼                  ▼                  ▼                  ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              CAPA API BACKEND (PHP MVC)                                │
│                                (XAMPP / Apache / Port 80)                              │
│                                                                                        │
│   Front Controller (index.php) ───► Router RESTful API ───► Middlewares / Auth Token    │
│                                                                                        │
│  ┌────────────────────┐   ┌────────────────────┐   ┌────────────────────┐              │
│  │ AuthController.php │   │ LotesControlador.php│  │SimulacionCtrl.php  │              │
│  └─────────┬──────────┘   └─────────┬──────────┘   └─────────┬──────────┘              │
│            │                        │                        │                         │
│  ┌─────────▼──────────┐   ┌─────────▼──────────┐   ┌─────────▼──────────┐              │
│  │  ModeloUsuario.php │   │   ModeloLote.php   │   │ModeloSimulacion.php│              │
│  └─────────┬──────────┘   └─────────┬──────────┘   └─────────┬──────────┘              │
│            │                        │                        │                         │
│            └────────────────────────┼────────────────────────┘                         │
│                                     │ Client cURL HTTP                                 │
└─────────────────────────────────────┼──────────────────────────────────────────────────┘
                                      │
               ┌──────────────────────┴──────────────────────┐
               ▼                                             ▼
┌──────────────────────────────┐              ┌──────────────────────────────┐
│  BASE DE DATOS RELACIONAL    │              │  MOTOR IA / MACHINE LEARNING │
│    MySQL (phpMyAdmin)        │              │  Python 3.10+ / Flask API    │
│                              │              │     (http://localhost:5000)  │
│ ┌──────────────────────────┐ │              │                              │
│ │ usuarios                 │ │              │ ┌──────────────────────────┐ │
│ ├──────────────────────────┤ │              │ │ POST /predict            │ │
│ │ cultivos / lotes (GIS)   │ │              │ │ ├─ Modelos XGBoost (ml) │ │
│ ├──────────────────────────┤ │              │ │ ├─ Scikit-Learn Pipeline │ │
│ │ simulaciones_historial   │ │              │ │ └─ SHAP / Feature Importance│
│ └──────────────────────────┘ │              │ └──────────────────────────┘ │
└──────────────────────────────┘              └──────────────────────────────┘
```

---

## 4. Stack Tecnológico Completo

### A. Frontend (Interfaz de Usuario)
- **Framework & Empaquetador:** React 18 + Vite (Javascript ES6+).
- **Estilos:** Vanilla CSS modular optimizado con variables CSS adaptativas (Dark Theme predeterminado y Light Theme compatible).
- **Librería de Gráficos:** Chart.js 4 + React-ChartJS-2 (Líneas, Barras, Gaussianas y Cascada Waterfall).
- **Sistemas de Información Geográfica (GIS):** Leaflet.js + React-Leaflet (polígonos vectoriales GeoJSON, medición de área en hectáreas y capas satelitales/callejero).
- **Iconografía y Tipografía:** Lucide React, Google Fonts (*Plus Jakarta Sans* para interfaz y *JetBrains Mono* para valores numéricos/KPIs).

### B. Backend API & Conectividad
- **Lenguaje & Servidor Web:** PHP 8.x sobre Servidor Apache (XAMPP).
- **Patrón de Enrutamiento:** Front Controller RESTful (`index.php`) con respuestas estándar en formato JSON.
- **Autenticación Integrada:**
  - Login tradicional con hashing seguro de contraseñas (`password_hash`).
  - Autenticación OAuth 2.0 mediante **Google Identity Services (One-Tap / SDK oficial)**.
- **Comunicación Inter-servicio:** Cliente cURL en PHP para solicitudes sincrónicas hacia el servidor de Inteligencia Artificial en Python.

### C. Backend de Inteligencia Artificial (ML Engine)
- **Lenguaje & Microframework:** Python 3.10+ con Flask y Flask-CORS.
- **Librerías de ML & Ciencia de Datos:**
  - `xgboost` (Gradiente incrementado para predicción).
  - `scikit-learn` (Pipelines de procesamiento y Random Forest).
  - `pandas` y `numpy` (Manipulación de matrices agronómicas y climáticas).
  - `joblib` (Serialización y carga en memoria de modelos entrenados).

### D. Base de Datos
- **Motor:** MySQL 8.x / MariaDB administrado mediante phpMyAdmin.
- **Driver de Conexión:** PHP Data Objects (PDO) con sentencias preparadas contra Inyección SQL.

---

## 5. Descripción de los Módulos DSS (Decision Support System)

1. **DSS 1 - Brecha de Rendimiento (Yield Gap Analysis):**
   - Compara el rendimiento predicho contra el potencial genético del híbrido de maíz (*Pioneer P4039, INIAP H-551, Dekalb DK-7088, INIAP Renacer*, etc.).
   - Muestra la cascada de mermas (*Waterfall*) causadas por agua, nitrógeno, temperatura y manejo.

2. **DSS 2 - Viabilidad de Siembra (Scenario Simulation):**
   - Ejecuta simulaciones estocásticas con datos climáticos históricos.
   - Muestra la curva de densidad Gaussiana con la probabilidad de superar la meta del productor y la ventana óptima de siembra.

3. **DSS 3 - Calendario Fenológico y Riesgo Climático:**
   - Mapea el ciclo biológico del maíz (Emergencia, V6, VT Floración, R1-R6) y alerta sobre riesgos de heladas o sequía estival.

4. **DSS 4 - Viabilidad Financiera & Análisis de Riesgo:**
   - Proyecta costos de producción por hectárea, ingresos netos, ROI (Retorno de Inversión), TIR y punto de equilibrio en escenarios Pesimista, Moderado y Optimista.

---

## 6. Estructura de Directorios del Repositorio

```
AgroPredict/
├── backend-api/             # API RESTful en PHP (Controllers, Models, Config)
│   ├── config/              # Conexión PDO a MySQL (database.php)
│   ├── controllers/         # Controladores (AuthController, CultivoController, ScenarioController, etc.)
│   └── models/              # Modelos de datos (Usuario, Cultivo, Simulacion)
├── database/                # Esquema de base de datos MySQL (agropredict_db.sql)
├── documentacion/           # Documentación del proyecto (arquitectura.md, Guia.md)
├── frontend-app/            # Aplicación Frontend React 18 (Vite)
│   ├── src/
│   │   ├── assets/          # Estilos globales (styles.css) y logos SVG
│   │   ├── services/        # Conector API Axios (api.js)
│   │   ├── templates/       # Componentes visuales reutilizables, Navbar, Sidebar
│   │   └── views/           # Pantallas principales (Login, Register, DSS 1-4, Cultivos)
│   └── copy-build.js        # Script automático de despliegue a la raíz de XAMPP
└── ml-engine/               # Servidor de Inteligencia Artificial (app.py, modelos .joblib)
```

---

## 7. Medidas de Seguridad, Calibración y Optimización
- **Calibración Territorial Exclusiva:** El sistema detecta mediante coordenadas geográficas si el lote está dentro del territorio de Ecuador. Si el lote está en el exterior, el sistema emite una alerta indicando que los modelos no poseen validez agronómica fuera del país.
- **Inmunidad SQLi & CORS:** Uso de consultas preparadas PDO y restricción estricta de orígenes HTTP.
- **Rendimiento Frontend:** Empaquetado optimizado con Vite, minificación de bundles y actualización automática en XAMPP mediante `copy-build.js`.
