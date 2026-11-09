import unittest

import app as ml_app


class MlApiTest(unittest.TestCase):
    BASE_PAYLOAD = {
        "temperatura": 24.5,
        "humedad": 70,
        "precipitacion": 800,
        "fertilizante": 150,
        "phSuelo": 6.2,
        "area": 2.5,
        "tipoSuelo": "franco",
    }

    @classmethod
    def setUpClass(cls):
        cls.client = ml_app.app.test_client()

    def test_health_endpoints(self):
        for path in ("/", "/health", "/metrics", "/stats"):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(200, response.status_code)
                self.assertTrue(response.is_json)

    def test_predict_rejects_non_json_body(self):
        response = self.client.post("/predict", data="temperatura=24")
        self.assertEqual(415, response.status_code)
        self.assertEqual("Content-Type debe ser application/json", response.get_json()["error"])

    def test_predict_rejects_missing_fields(self):
        response = self.client.post("/predict", json={"temperatura": 24})
        self.assertEqual(400, response.status_code)
        self.assertIn("Campo requerido faltante", response.get_json()["error"])

    def test_predict_rejects_non_finite_and_out_of_range_values(self):
        base = {
            "temperatura": 24,
            "humedad": 70,
            "precipitacion": 800,
            "fertilizante": 150,
            "phSuelo": 6.2,
            "area": 2.5,
            "tipoSuelo": "franco",
        }
        invalidos = (("humedad", 101), ("area", 0), ("phSuelo", 15), ("temperatura", "nan"))
        for campo, valor in invalidos:
            with self.subTest(campo=campo, valor=valor):
                payload = {**base, campo: valor}
                response = self.client.post("/predict", json=payload)
                self.assertEqual(400, response.status_code)

    def test_predict_accepts_valid_payload(self):
        response = self.client.post("/predict", json={
            "temperatura": 24.5,
            "humedad": 70,
            "precipitacion": 800,
            "fertilizante": 150,
            "phSuelo": 6.2,
            "area": 2.5,
            "tipoSuelo": "franco",
            "modelo": "xgboost",
        })
        self.assertEqual(200, response.status_code)
        resultado = response.get_json()
        self.assertTrue(resultado["success"])
        self.assertIsInstance(resultado["probabilidad_cosecha"], float)
        self.assertGreaterEqual(resultado["probabilidad_cosecha"], 0)
        self.assertLessEqual(resultado["probabilidad_cosecha"], 100)
        self.assertIn("Alta", resultado["probabilidades_cosecha"])
        self.assertEqual(resultado["confianza_tipo"], "calidad_global_r2")
        self.assertIn("intervalo_rendimiento", resultado)
        intervalo = resultado["intervalo_rendimiento"]
        self.assertLessEqual(intervalo["min"], resultado["rendimiento_estimado"])
        self.assertGreaterEqual(intervalo["max"], resultado["rendimiento_estimado"])

    def test_predict_rejects_invalid_numeric_types(self):
        campos = ("temperatura", "humedad", "precipitacion", "fertilizante", "phSuelo", "area", "altitud")
        for campo in campos:
            for valor in (None, True, False, [], {}, "texto", 10 ** 400):
                with self.subTest(campo=campo, valor=valor):
                    response = self.client.post("/predict", json={**self.BASE_PAYLOAD, campo: valor})
                    self.assertEqual(400, response.status_code)
                    self.assertIn(campo, response.get_json()["error"])

    def test_predict_rejects_invalid_optional_text_types(self):
        for campo in ("variedad_maiz", "tipo_maiz", "ubicacion"):
            for valor in (None, True, 12, [], {}):
                with self.subTest(campo=campo, valor=valor):
                    response = self.client.post("/predict", json={**self.BASE_PAYLOAD, campo: valor})
                    self.assertEqual(400, response.status_code)
                    self.assertIn(campo, response.get_json()["error"])

    def test_predict_rejects_invalid_soil_text(self):
        for valor in (None, True, 12, [], {}, "", " "):
            with self.subTest(valor=valor):
                response = self.client.post("/predict", json={**self.BASE_PAYLOAD, "tipoSuelo": valor})
                self.assertEqual(400, response.status_code)
                self.assertIn("tipoSuelo", response.get_json()["error"])

    def test_predict_validates_coordinates_without_requesting_external_data(self):
        for campo, fuera_de_rango in (("latitud", 91), ("longitud", 181)):
            for valor in (True, False, [], {}, "texto", "nan", "inf", fuera_de_rango):
                with self.subTest(campo=campo, valor=valor):
                    response = self.client.post("/predict", json={**self.BASE_PAYLOAD, campo: valor})
                    self.assertEqual(400, response.status_code)
                    self.assertIn(campo, response.get_json()["error"])

    def test_predict_rejects_invalid_historical_flag(self):
        for valor in (None, 0, 1, "true", [], {}):
            with self.subTest(valor=valor):
                response = self.client.post("/predict", json={**self.BASE_PAYLOAD, "incluir_historico": valor})
                self.assertEqual(400, response.status_code)
                self.assertIn("incluir_historico", response.get_json()["error"])

    def test_predict_preserves_numeric_strings_and_null_coordinates(self):
        payload = {campo: str(valor) for campo, valor in self.BASE_PAYLOAD.items()}
        payload.update({
            "altitud": "45.0",
            "variedad_maiz": "INIAP H-551",
            "tipo_maiz": "Duro Amarillo",
            "ubicacion": "",
            "latitud": None,
            "longitud": None,
            "incluir_historico": False,
        })
        response = self.client.post("/predict", json=payload)
        self.assertEqual(200, response.status_code)
        self.assertEqual(45.0, response.get_json()["entradas_modelo"]["altitud_msnm"])

    def test_predict_rejects_non_finite_altitude(self):
        for valor in ("nan", "inf", "-inf"):
            with self.subTest(valor=valor):
                response = self.client.post("/predict", json={**self.BASE_PAYLOAD, "altitud": valor})
                self.assertEqual(400, response.status_code)
                self.assertIn("altitud", response.get_json()["error"])

    def test_predict_rejects_unknown_soil_without_silently_using_franco(self):
        response = self.client.post("/predict", json={**self.BASE_PAYLOAD, "tipoSuelo": "inventado"})
        self.assertEqual(400, response.status_code)
        self.assertIn("tipoSuelo", response.get_json()["error"])
        self.assertIn("franco", response.get_json()["error"])

    def test_predict_accepts_legacy_and_documented_soil_aliases(self):
        for suelo, expected in ((" franco ", "Franco limoso"), ("arcilloso", "Franco arcilloso"),
                                ("arenoso", "Franco arenoso"), ("Franco-Arcilloso", "Franco arcilloso"),
                                ("Franco limoso", "Franco limoso")):
            with self.subTest(suelo=suelo):
                response = self.client.post("/predict", json={**self.BASE_PAYLOAD, "tipoSuelo": suelo})
                self.assertEqual(200, response.status_code)
                self.assertEqual(expected, response.get_json()["entradas_modelo"]["tipo_suelo"])

    def test_predict_rejects_invalid_cycle_rainfall(self):
        for valor in (None, True, False, [], {}, "texto", "nan", "inf", -1, 1e308):
            with self.subTest(valor=valor):
                response = self.client.post("/predict", json={**self.BASE_PAYLOAD, "precipitacion_ciclo_mm": valor})
                self.assertEqual(400, response.status_code)
                self.assertIn("precipitacion_ciclo_mm", response.get_json()["error"])

    def test_predict_uses_explicit_cycle_rainfall_without_annual_conversion(self):
        response = self.client.post("/predict", json={
            **self.BASE_PAYLOAD, "precipitacion": 3300, "precipitacion_ciclo_mm": "700", "ubicacion": "Manabí", "variedad_maiz": "INIAP H-551",
        })
        self.assertEqual(200, response.status_code)
        resultado = response.get_json()
        self.assertEqual(700, resultado["entradas_modelo"]["precipitacion_mm"])
        self.assertEqual("mm/ciclo", resultado["trazabilidad"]["periodo_precipitacion"])
        self.assertIn("ciclo", resultado["trazabilidad"]["fuentes"]["precipitacion_mm"])
        self.assertTrue(any("Precipitación del ciclo adecuada" in r for r in resultado["recomendaciones"]))
        for nombre, lluvia in (("lluvioso", 1000.0), ("verano", 700.0), ("sequia", 300.0)):
            self.assertEqual(lluvia, resultado["escenarios"][nombre]["condiciones"]["precipitacion_mm_ciclo"])
            self.assertNotIn("precipitacion_mm_anio", resultado["escenarios"][nombre]["condiciones"])

    def test_predict_keeps_legacy_rainfall_with_explicit_period_limitation(self):
        response = self.client.post("/predict", json=self.BASE_PAYLOAD)
        self.assertEqual(200, response.status_code)
        resultado = response.get_json()
        self.assertEqual(self.BASE_PAYLOAD["precipitacion"], resultado["entradas_modelo"]["precipitacion_mm"])
        self.assertEqual("mm/año", resultado["trazabilidad"]["periodo_precipitacion"])
        self.assertEqual("no_evaluable_sin_dato_del_ciclo", resultado["trazabilidad"]["evaluacion_precipitacion_ciclo"])
        self.assertTrue(any("no permite evaluar" in r for r in resultado["recomendaciones"]))

    def test_predict_rejects_numbers_that_overflow_model_or_production(self):
        for campo in ("area", "precipitacion", "fertilizante", "altitud"):
            with self.subTest(campo=campo):
                response = self.client.post("/predict", json={**self.BASE_PAYLOAD, campo: 1e308})
                self.assertEqual(400, response.status_code)
                self.assertIn(campo, response.get_json()["error"])

    def test_predict_normalizes_model_name(self):
        response = self.client.post("/predict", json={
            "temperatura": 24.5,
            "humedad": 70,
            "precipitacion": 800,
            "fertilizante": 150,
            "phSuelo": 6.2,
            "area": 2.5,
            "tipoSuelo": " Franco ",
            "modelo": " XGBOOST ",
        })
        self.assertEqual(200, response.status_code)
        self.assertEqual("xgboost", response.get_json()["modelo"])

    def test_predict_rejects_unsupported_model(self):
        response = self.client.post("/predict", json={
            "temperatura": 24.5,
            "humedad": 70,
            "precipitacion": 800,
            "fertilizante": 150,
            "phSuelo": 6.2,
            "area": 2.5,
            "tipoSuelo": "franco",
            "modelo": "modelo_no_disponible",
        })
        self.assertEqual(400, response.status_code)
        self.assertEqual(["xgboost"], response.get_json()["modelos_disponibles"])


if __name__ == "__main__":
    unittest.main()
