import unittest
from datetime import date
from unittest.mock import patch

from src import data_providers


class DataProvidersTest(unittest.TestCase):
    def test_open_meteo_maps_agricultural_variables_and_provenance(self):
        payload = {
            "timezone": "America/Guayaquil",
            "current": {
                "temperature_2m": 27.5,
                "relative_humidity_2m": 78,
                "rain": 1.2,
                "wind_speed_10m": 5.4,
            },
            "hourly": {
                "vapour_pressure_deficit": [0.8, 0.9],
                "soil_temperature_0cm": [28, 29],
                "soil_moisture_0_to_1cm": [0.31, 0.33],
                "soil_moisture_1_to_3cm": [0.30, 0.32],
                "soil_moisture_3_to_9cm": [0.29, 0.31],
                "soil_moisture_9_to_27cm": [0.28, 0.30],
                "soil_moisture_27_to_81cm": [0.25, 0.27],
                "shortwave_radiation": [200, 220],
            },
            "daily": {
                "precipitation_sum": [12.5, 4.5],
                "et0_fao_evapotranspiration": [3.1, 3.4],
                "temperature_2m_min": [23],
                "temperature_2m_max": [31],
            },
        }
        with patch.object(data_providers, "_request_json", return_value=payload):
            result = data_providers.fetch_open_meteo(-2.1, -79.6)

        self.assertEqual(result["source"], "open_meteo")
        self.assertEqual(result["quality"], "model")
        self.assertEqual(result["precipitacion_pronostico_7d_mm"], 17.0)
        self.assertEqual(result["et0_pronostico_7d_mm"], 6.5)
        self.assertEqual(result["humedad_suelo_0_to_1cm_pct"], 32.0)
        self.assertEqual(result["vpd_24h_kpa"], 0.85)

    def test_nasa_power_maps_latest_daily_record(self):
        payload = {
            "properties": {
                "parameter": {
                    "T2M": {"20261017": 26.1},
                    "T2M_MIN": {"20261017": 21.0},
                    "T2M_MAX": {"20261017": 31.2},
                    "PRECTOTCORR": {"20261017": 8.4},
                    "RH2M": {"20261017": 79.0},
                    "ALLSKY_SFC_SW_DWN": {"20261017": 5.8},
                }
            }
        }
        with patch.object(data_providers, "_request_json", return_value=payload):
            result = data_providers.fetch_nasa_power(-2.1, -79.6)

        self.assertEqual(result["source"], "nasa_power")
        self.assertEqual(result["observed_date"], "20261017")
        self.assertEqual(result["precipitacion_diaria_mm"], 8.4)
        self.assertEqual(result["temperatura_min_c"], 21.0)

    def test_weather_fallback_marks_provider_errors(self):
        nasa = {
            "source": "nasa_power",
            "quality": "reanalysis",
            "temperatura_media_c": 25.0,
        }
        with patch.object(data_providers, "fetch_open_meteo", side_effect=data_providers.ProviderError("offline")), \
             patch.object(data_providers, "fetch_nasa_power", return_value=nasa):
            result = data_providers.fetch_weather_with_fallback(-2.1, -79.6)

        self.assertTrue(result["fallback_used"])
        self.assertEqual(result["source"], "nasa_power")
        self.assertEqual(result["provider_errors"]["open_meteo"], "offline")

    def test_open_meteo_historical_returns_summary_and_series(self):
        payload = {
            "timezone": "America/Guayaquil",
            "daily": {
                "time": ["2026-10-16", "2026-10-17"],
                "temperature_2m_mean": [25.0, 27.0],
                "temperature_2m_min": [20.0, 21.0],
                "temperature_2m_max": [30.0, 32.0],
                "precipitation_sum": [4.0, 6.5],
                "et0_fao_evapotranspiration": [3.0, 3.5],
                "shortwave_radiation_sum": [18.0, 20.0],
            },
        }
        with patch.object(data_providers, "_request_json", return_value=payload):
            result = data_providers.fetch_open_meteo_historical(
                -2.1, -79.6, start=date(2026, 10, 16), end=date(2026, 10, 17)
            )

        self.assertEqual(result["source_kind"], "historical_reanalysis")
        self.assertEqual(result["summary"]["temperatura_media_c"], 26.0)
        self.assertEqual(result["summary"]["precipitacion_total_mm"], 10.5)
        self.assertEqual(len(result["daily"]), 2)
        self.assertEqual(result["daily"][1]["et0_mm"], 3.5)


if __name__ == "__main__":
    unittest.main()
