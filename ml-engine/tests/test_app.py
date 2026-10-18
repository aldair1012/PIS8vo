import unittest

import app as ml_app


class MlApiTest(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
