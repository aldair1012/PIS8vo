import unittest
from datetime import date
import sys
from types import SimpleNamespace
from unittest.mock import Mock, patch
from src import feature_builder
from src.simulation_contract import ventana_historica


class FieldInputsTest(unittest.TestCase):
    INPUT = {'temperatura': 24, 'humedad': 70, 'precipitacion': 700,
             'precipitacion_ciclo_mm': 700, 'fertilizante': 150,
             'phSuelo': 6.2, 'area': 1, 'tipoSuelo': 'franco',
             'variedad_maiz': 'INIAP H-551', 'ubicacion': 'Manabí'}

    def test_field_measurements_reach_features_and_keep_explicit_zero(self):
        fields = {'ciclo_dias': 120, 'densidad_plantas_ha': 55000,
                  'lamina_riego_mm': 0, 'fosforo_p2o5_kg_ha': 0,
                  'potasio_k2o_kg_ha': 70, 'materia_organica_pct': 2.3,
                  'riego_tipo': 'temporal_lluvia', 'semilla_certificada': 0,
                  'temperatura_min_c': 18, 'temperatura_max_c': 31}
        frame, meta = feature_builder.build_features({**self.INPUT, 'parametros_campo': fields})
        for field, value in fields.items():
            with self.subTest(field=field):
                self.assertEqual(value, frame.iloc[0][field])
                self.assertIn('Ingresado', meta['trazabilidad']['fuentes'][field])

    def test_dates_respect_leap_year_and_do_not_become_untrained_model_columns(self):
        frame, meta = feature_builder.build_features({**self.INPUT, 'fecha_siembra': '2024-02-28',
                                                     'parametros_campo': {'ciclo_dias': 3}})
        self.assertEqual('2024-03-01', meta['trazabilidad']['calendario']['fecha_fin_estimada'])
        self.assertEqual(feature_builder.COLS_ORDER, list(frame.columns))

    def test_contradictory_temperatures_and_unknown_fields_are_rejected(self):
        for fields in ({'temperatura_min_c': 25}, {'temperatura_max_c': 23},
                       {'ciclo_dias': 120.5}, {'lamina_riego_mm': True},
                       {'riego_tipo': 'inventado'}, {'rendimiento_t_ha': 10}):
            with self.subTest(fields=fields), self.assertRaises(ValueError):
                feature_builder.build_features({**self.INPUT, 'parametros_campo': fields})

    def test_history_window_never_requests_future_days(self):
        plan = {'fecha_siembra': '2026-10-01', 'fecha_fin_estimada': '2027-01-28'}
        self.assertEqual((date(2026,10,1),date(2026,11,6)), ventana_historica(plan,date(2026,11,8)))
        self.assertIsNone(ventana_historica(plan,date(2026,9,30)))

    def test_reference_rows_exclude_duplicates_and_physical_contradictions(self):
        frame = feature_builder.df_reference
        self.assertFalse(frame.duplicated().any())
        self.assertTrue((frame.temperatura_min_c <= frame.temperatura_media_c).all())
        self.assertTrue((frame.temperatura_media_c <= frame.temperatura_max_c).all())
        self.assertEqual(1970, len(frame))

    def test_unconfirmed_region_does_not_produce_local_fertilizer_advice(self):
        _, meta = feature_builder.build_features({**self.INPUT,'ubicacion':''})
        recommendations = feature_builder.generar_recomendaciones(meta['datos_entrada'],meta['zona'])
        self.assertIn('Ubicación no confirmada', recommendations[0])
        self.assertFalse(any('Dosis recomendada' in r for r in recommendations))

    def test_inconsistent_canguil_label_cannot_reach_model_directly(self):
        with self.assertRaisesRegex(ValueError,'modelo de rendimiento'):
            feature_builder.build_features({**self.INPUT,'variedad_maiz':'INIAP-198'})

    def test_past_weather_uses_crop_window_and_does_not_override_scenario(self):
        station = SimpleNamespace(inamhi_db=SimpleNamespace(get_nearest_station=Mock(return_value=None)))
        history = {'summary': {'precipitacion_total_mm': 10}, 'coverage': {'precipitation_complete': True}}
        with patch.dict(sys.modules, {'src.inamhi_climate': station}), patch.object(feature_builder,'fetch_precision_soil',return_value=None), patch.object(feature_builder,'fetch_precision_weather',return_value=None), patch.object(feature_builder,'fetch_open_meteo_historical',return_value=history) as fetch:
            frame, meta = feature_builder.build_features({**self.INPUT,'fecha_siembra':'2025-01-01','parametros_campo':{'ciclo_dias':3},'latitud':-1,'longitud':-80,'incluir_historico':True})
            self.assertEqual(date(2025,1,1),fetch.call_args.kwargs['start'])
            self.assertEqual(date(2025,1,3),fetch.call_args.kwargs['end'])
            self.assertEqual(700,frame.iloc[0].precipitacion_mm)
            self.assertEqual(10,meta['trazabilidad']['clima_ciclo']['resumen']['precipitacion_total_mm'])
            self.assertTrue(meta['trazabilidad']['clima_ciclo']['fin_del_ciclo_incluido'])

    def test_future_cycle_never_requests_historical_future_weather(self):
        station = SimpleNamespace(inamhi_db=SimpleNamespace(get_nearest_station=Mock(return_value=None)))
        with patch.dict(sys.modules, {'src.inamhi_climate': station}), patch.object(feature_builder,'fetch_precision_soil',return_value=None), patch.object(feature_builder,'fetch_precision_weather',return_value=None), patch.object(feature_builder,'fetch_open_meteo_historical') as fetch:
            _, meta = feature_builder.build_features({**self.INPUT,'fecha_siembra':'2100-01-01','parametros_campo':{'ciclo_dias':120},'latitud':-1,'longitud':-80,'incluir_historico':True})
            fetch.assert_not_called()
            self.assertEqual('sin_dias_pasados_disponibles',meta['trazabilidad']['clima_ciclo']['estado'])

    def test_map_soil_values_reach_model_and_manual_measurement_has_priority(self):
        soil={'textura_arcilla_pct':29.4,'textura_arena_pct':40.4,'textura_limo_pct':30.1,'materia_organica_pct':8.43}
        frame,meta=feature_builder.build_features({**self.INPUT,'suelo_ubicacion':soil,'parametros_campo':{'riego_tipo':'goteo','materia_organica_pct':2.4}})
        self.assertEqual(29.4,frame.iloc[0].textura_arcilla_pct)
        self.assertEqual(2.4,frame.iloc[0].materia_organica_pct)
        self.assertIn('Ingresado',meta['trazabilidad']['fuentes']['materia_organica_pct'])
        self.assertTrue(meta['trazabilidad']['suelo_ubicacion_utilizado'])
        self.assertNotIn('riego_tipo',meta['trazabilidad']['supuestos'])
        self.assertFalse(any(r.startswith('Riego,') for r in meta['trazabilidad']['advertencias']))

    def test_new_soil_codes_select_real_trained_categories(self):
        for code,category in [('franco_equilibrado','Franco'),('arcillo_limoso','Arcillo limoso')]:
            frame,_=feature_builder.build_features({**self.INPUT,'tipoSuelo':code})
            self.assertEqual(category,frame.iloc[0].tipo_suelo)

    def test_incomplete_or_impossible_map_soil_is_rejected(self):
        for soil in [{'textura_arcilla_pct':20},{'textura_arcilla_pct':90,'textura_arena_pct':90,'textura_limo_pct':90},{'materia_organica_pct':True}]:
            with self.subTest(soil=soil),self.assertRaises(ValueError):
                feature_builder.build_features({**self.INPUT,'suelo_ubicacion':soil})


if __name__ == '__main__':
    unittest.main()
