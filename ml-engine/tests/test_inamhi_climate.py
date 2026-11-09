import json
import unittest

import numpy as np
import pandas as pd

from src.inamhi_climate import InamhiClimateDB, MONTHS


def record(station, year, values):
    return {"Estacion": station, "anio": year, **dict(zip(MONTHS, values))}


def database(precip, temp, stations=None):
    db = InamhiClimateDB()
    db.loaded = True
    columns = ["Estacion", "anio", *MONTHS]
    db.df_precip = pd.DataFrame(precip, columns=columns)
    db.df_temp = pd.DataFrame(temp, columns=columns)
    db.stations = stations or {
        "A": {"id": "A", "nombre": "Estación A", "lat": 0.0, "lon": 0.01, "altitud": None},
        "B": {"id": "B", "nombre": "Estación B", "lat": 0.0, "lon": 0.02, "altitud": 40.0},
    }
    return db


class InamhiClimateTest(unittest.TestCase):
    def test_nearest_without_temperature_is_skipped(self):
        db = database(
            [record("A", 2019, [10.0] * 12), record("B", 2019, [12.0] * 12)],
            [record("B", 2019, [25.0] * 12)],
        )
        result = db.get_nearest_station(0.0, 0.0)
        self.assertEqual("B", result["id"])
        self.assertGreater(result["distancia_km"], 2)
        self.assertIn("altitud", result["representatividad_agronomica"])

    def test_station_with_empty_months_does_not_satisfy_availability(self):
        db = database(
            [record("A", 2019, [np.nan] * 12), record("B", 2019, [12.0] * 12)],
            [record("A", 2019, [25.0] * 12), record("B", 2019, [25.0] * 12)],
        )
        self.assertEqual("B", db.get_nearest_station(0, 0)["id"])

    def test_historical_station_is_not_returned_for_future_period(self):
        db = database([record("A", 2019, [10.0] * 12)], [record("A", 2019, [25.0] * 12)])
        self.assertIsNone(db.get_nearest_station(0, 0, start_year=2025, end_year=2025))
        self.assertEqual("A", db.get_nearest_station(0, 0, start_year=2019, end_year=2019)["id"])

    def test_variables_with_no_common_year_are_not_a_combined_reference(self):
        db = database([record("A", 2018, [10.0] * 12)], [record("A", 2019, [25.0] * 12)])
        self.assertIsNone(db.get_nearest_station(0, 0))

    def test_radius_and_invalid_coordinates_return_no_reference(self):
        db = database([record("A", 2019, [10.0] * 12)], [record("A", 2019, [25.0] * 12)])
        self.assertIsNone(db.get_nearest_station(0, 0, max_distance_km=0.5))
        self.assertIsNone(db.get_nearest_station(5, 0))
        for lat, lon in [(np.nan, 0), (0, np.inf), (91, 0), (0, 181), ("invalid", 0)]:
            with self.subTest(lat=lat, lon=lon):
                self.assertIsNone(db.get_nearest_station(lat, lon))

    def test_history_preserves_zero_and_missing_values_separately(self):
        db = database(
            [record("A", 2018, [0.0, np.nan] + [10.0] * 10), record("A", 2019, [10.0] * 12)],
            [record("A", 2018, [0.0, np.nan] + [25.0] * 10)],
        )
        history = db.get_station_history("A")
        self.assertEqual([0.0, None], history[0]["precipitacion"][:2])
        self.assertEqual([0.0, None], history[0]["temperatura"][:2])
        self.assertEqual([None] * 12, history[1]["temperatura"])
        json.dumps(history, allow_nan=False)

    def test_annual_total_excludes_incomplete_years(self):
        db = database(
            [record("A", 2018, [10.0] * 12), record("A", 2019, [np.nan] + [100.0] * 11)],
            [record("A", 2018, [25.0] * 12), record("A", 2019, [np.nan] + [30.0] * 11)],
        )
        result = db.get_aggregated_stats("A")
        self.assertEqual(120, result["precipitacion_anual_promedio"])
        self.assertEqual(25, result["temperatura_anual_promedio"])
        self.assertEqual(2018, result["mejor_anio_precip"])
        self.assertEqual(1, result["anios_completos_precipitacion"])
        self.assertEqual({"desde": 2018, "hasta": 2019}, result["periodo"])
        self.assertEqual(1, result["meses_reportados_precipitacion"]["ene"])

    def test_missing_annual_total_and_single_sample_std_are_null(self):
        db = database(
            [record("A", 2019, [0.0] + [np.nan] * 11)],
            [record("A", 2019, [0.0] + [np.nan] * 11)],
        )
        result = db.get_aggregated_stats("A")
        self.assertEqual(0, result["precipitacion_media_mensual"]["ene"])
        self.assertIsNone(result["precipitacion_media_mensual"]["feb"])
        self.assertIsNone(result["precipitacion_anual_promedio"])
        self.assertIsNone(result["temperatura_anual_promedio"])
        self.assertIsNone(result["precipitacion_std_mensual"]["ene"])
        self.assertIsNone(result["mejor_anio_precip"])
        json.dumps(result, allow_nan=False)

    def test_unknown_station_returns_no_history_or_statistics(self):
        db = database([record("A", 2019, [10.0] * 12)], [record("A", 2019, [25.0] * 12)])
        self.assertIsNone(db.get_station_history("unknown"))
        self.assertIsNone(db.get_aggregated_stats("unknown"))


if __name__ == "__main__":
    unittest.main()
