import unittest
from unittest.mock import patch

from src import feature_builder


class RecommendationPeriodsTest(unittest.TestCase):
    INPUT = {
        "temperatura": 24.5, "humedad": 70, "precipitacion": 3000,
        "fertilizante": 150, "phSuelo": 6.2, "area": 2.5, "tipoSuelo": "franco",
    }
    CATALOG = {"condiciones_agronomicas": [{
        "Zona": "Costa – Litoral (Invierno)", "Precipitación (mm/ciclo)": "600–800",
    }]}

    def recommendations(self, cycle=None, annual=3000, rules=None):
        datos = {**self.INPUT, "precipitacion": annual, "precipitacion_ciclo_mm": cycle}
        with patch.object(feature_builder, "agronomia_data", self.CATALOG), \
                patch.object(feature_builder, "reglas_decision", rules or []):
            return feature_builder.generar_recomendaciones(datos, "Costa_Invierno")

    def test_annual_rainfall_never_classifies_cycle_deficit_or_excess(self):
        for annual in (0, 700, 3000):
            with self.subTest(annual=annual):
                result = self.recommendations(annual=annual)
                rainfall = [r for r in result if r.startswith("Precipitación")]
                self.assertEqual(1, len(rainfall))
                self.assertIn("no permite evaluar", rainfall[0])
                self.assertNotIn("Se requiere riego", rainfall[0])
                self.assertNotIn("Asegurar limpieza", rainfall[0])

    def test_explicit_cycle_rainfall_compares_equivalent_units_and_preserves_zero(self):
        for cycle, expected in ((0, "insuficiente"), (700, "adecuada"), (900, "supera")):
            with self.subTest(cycle=cycle):
                rainfall = next(r for r in self.recommendations(cycle=cycle) if r.startswith("Precipitación"))
                self.assertIn(expected, rainfall)
                self.assertIn(f"{cycle} mm/ciclo", rainfall)

    def test_hydric_rules_require_cycle_data_and_cannot_be_triggered_by_nitrogen_or_variety(self):
        rules = [{
            "Región": "Costa", "Problema detectado": "Lixiviación de N", "Variedad": "Comercial",
            "Acción recomendada": "REGLA_HIDRICA", "Subzona": "prueba",
        }, {
            "Región": "Costa", "Problema detectado": "Estrés hídrico", "Variedad": "Comercial",
            "Acción recomendada": "REGLA_SEQUIA", "Subzona": "prueba",
        }]
        for cycle in (None, 700):
            datos = {**self.INPUT, "fertilizante": 50, "variedad": "Comercial", "precipitacion_ciclo_mm": cycle}
            with self.subTest(cycle=cycle), patch.object(feature_builder, "reglas_decision", rules):
                result = feature_builder.generar_recomendaciones(datos, "Costa_Invierno")
                self.assertFalse(any("REGLA_" in r for r in result))
        self.assertTrue(any("REGLA_HIDRICA" in r for r in self.recommendations(cycle=1200, rules=rules)))
        self.assertTrue(any("REGLA_SEQUIA" in r for r in self.recommendations(cycle=300, rules=rules)))

    def test_cycle_overrides_feature_only_when_explicit_and_records_provenance(self):
        legacy, legacy_meta = feature_builder.build_features(self.INPUT)
        cycle, cycle_meta = feature_builder.build_features({**self.INPUT, "precipitacion_ciclo_mm": 700})
        self.assertEqual(3000, legacy.iloc[0]["precipitacion_mm"])
        self.assertEqual(700, cycle.iloc[0]["precipitacion_mm"])
        self.assertEqual(700, cycle_meta["datos_entrada"]["precipitacion"])
        self.assertEqual("mm/año", legacy_meta["trazabilidad"]["periodo_precipitacion"])
        self.assertEqual("mm/ciclo", cycle_meta["trazabilidad"]["periodo_precipitacion"])
        self.assertEqual(3000, cycle_meta["trazabilidad"]["precipitacion_payload_mm"])
        for column in feature_builder.COLS_ORDER:
            if column != "precipitacion_mm":
                self.assertEqual(legacy.iloc[0][column], cycle.iloc[0][column])

    def test_letter_n_or_missing_variety_does_not_invent_nitrogen_deficiency(self):
        rule = {"Región": "Costa", "Problema detectado": "Nuevo híbrido", "Acción recomendada": "REGLA_NUEVO"}
        datos = {**self.INPUT, "fertilizante": 50, "variedad": "INIAP H-551", "precipitacion_ciclo_mm": 700}
        with patch.object(feature_builder, "reglas_decision", [rule]):
            result = feature_builder.generar_recomendaciones(datos, "Costa_Invierno")
        self.assertFalse(any("REGLA_NUEVO" in r for r in result))

    def test_unknown_soil_is_also_rejected_by_feature_builder(self):
        with self.assertRaisesRegex(ValueError, "tipoSuelo"):
            feature_builder.build_features({**self.INPUT, "tipoSuelo": "inventado"})


if __name__ == "__main__":
    unittest.main()
