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
                "precipitation_sum": [12.5, 4.5, 0, 0, 0, 0, 0],
                "et0_fao_evapotranspiration": [3.1, 3.4, 0, 0, 0, 0, 0],
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

    def test_open_meteo_omits_totals_when_daily_measurements_are_unavailable(self):
        for daily in ({}, {"precipitation_sum": [], "et0_fao_evapotranspiration": []}, {
            "precipitation_sum": [None, "nan", "inf", -999, None, None, None],
            "et0_fao_evapotranspiration": [None] * 7,
        }):
            with self.subTest(daily=daily):
                payload = {"current": {"temperature_2m": 25, "relative_humidity_2m": 70}, "daily": daily}
                with patch.object(data_providers, "_request_json", return_value=payload):
                    result = data_providers.fetch_open_meteo(-2.1, -79.6)

                for name in ("precipitacion", "et0"):
                    self.assertNotIn(f"{name}_pronostico_7d_mm", result)
                    self.assertNotIn(f"{name}_pronostico_disponible_mm", result)
                self.assertEqual(result["forecast_coverage"]["precipitation_valid_days"], 0)
                self.assertEqual(result["forecast_coverage"]["et0_valid_days"], 0)

    def test_open_meteo_labels_partial_accumulations_with_independent_coverage(self):
        payload = {
            "current": {"temperature_2m": 25, "relative_humidity_2m": 70},
            "daily": {
                "precipitation_sum": [12.5, None, 4.5, None, None, None, None],
                "et0_fao_evapotranspiration": [1] * 7,
            },
        }
        with patch.object(data_providers, "_request_json", return_value=payload):
            result = data_providers.fetch_open_meteo(-2.1, -79.6)

        self.assertNotIn("precipitacion_pronostico_7d_mm", result)
        self.assertEqual(result["precipitacion_pronostico_disponible_mm"], 17.0)
        self.assertEqual(result["et0_pronostico_7d_mm"], 7.0)
        self.assertEqual(result["forecast_coverage"], {
            "expected_days": 7,
            "precipitation_valid_days": 2,
            "et0_valid_days": 7,
        })

    def test_open_meteo_preserves_real_zero_totals_and_short_forecasts(self):
        for days in (2, 7):
            with self.subTest(days=days):
                payload = {
                    "current": {"temperature_2m": 25, "relative_humidity_2m": 70},
                    "daily": {"precipitation_sum": [0] * days, "et0_fao_evapotranspiration": [0] * days},
                }
                with patch.object(data_providers, "_request_json", return_value=payload):
                    result = data_providers.fetch_open_meteo(-2.1, -79.6)

                self.assertEqual(result["forecast_days"], days)
                for name in ("precipitacion", "et0"):
                    self.assertEqual(result[f"{name}_pronostico_disponible_mm"], 0.0)
                    if days == 7:
                        self.assertEqual(result[f"{name}_pronostico_7d_mm"], 0.0)
                    else:
                        self.assertNotIn(f"{name}_pronostico_7d_mm", result)

    def test_open_meteo_limits_accumulations_to_requested_seven_days(self):
        payload = {
            "current": {"temperature_2m": 25, "relative_humidity_2m": 70},
            "daily": {"precipitation_sum": [1] * 8, "et0_fao_evapotranspiration": [2] * 8},
        }
        with patch.object(data_providers, "_request_json", return_value=payload):
            result = data_providers.fetch_open_meteo(-2.1, -79.6)

        self.assertEqual(result["precipitacion_pronostico_7d_mm"], 7.0)
        self.assertEqual(result["et0_pronostico_7d_mm"], 14.0)
        self.assertEqual(result["forecast_days"], 7)

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

    def test_nasa_power_uses_latest_date_with_both_required_measurements(self):
        payload = {"properties": {"parameter": {
            "T2M": {"20261020": -999, "20261019": 27, "20261018": 26.1, "20261017": 25},
            "RH2M": {"20261020": 80, "20261019": None, "20261018": 79, "20261017": 78},
            "PRECTOTCORR": {"20261020": 8.4, "20261018": 0},
            "T2M_MIN": {"20261020": 21},
        }}}
        with patch.object(data_providers, "_request_json", return_value=payload):
            result = data_providers.fetch_nasa_power(-2.1, -79.6)

        self.assertEqual(result["observed_date"], "20261018")
        self.assertEqual(result["temperatura_media_c"], 26.1)
        self.assertEqual(result["humedad_relativa_pct"], 79.0)
        self.assertEqual(result["precipitacion_diaria_mm"], 0.0)
        self.assertNotIn("temperatura_min_c", result)

    def test_nasa_power_rejects_missing_or_incompatible_daily_measurements(self):
        for parameters in ({}, {
            "T2M": {"20261020": 27}, "RH2M": {"20261019": 79},
        }, {
            "T2M": {"20261020": "nan", "20261019": -999},
            "RH2M": {"20261020": 79, "20261019": 78},
        }):
            with self.subTest(parameters=parameters):
                payload = {"properties": {"parameter": parameters}}
                with patch.object(data_providers, "_request_json", return_value=payload):
                    with self.assertRaises(data_providers.ProviderError):
                        data_providers.fetch_nasa_power(-2.1, -79.6)

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

    def test_historical_incomplete_rain_is_not_presented_as_period_total(self):
        for dates, rain in [(['2026-10-16', '2026-10-17'], [0, None]), (['2026-10-16'], [0])]:
            with self.subTest(dates=dates), patch.object(data_providers, '_request_json', return_value={'daily': {'time': dates, 'precipitation_sum': rain}}):
                result = data_providers.fetch_open_meteo_historical(-2, -79, start=date(2026, 10, 16), end=date(2026, 10, 17))
                self.assertNotIn('precipitacion_total_mm', result['summary'])
                self.assertEqual(0, result['summary_available']['precipitacion_disponible_mm'])
                self.assertFalse(result['coverage']['precipitation_complete'])


if __name__ == "__main__":
    unittest.main()
