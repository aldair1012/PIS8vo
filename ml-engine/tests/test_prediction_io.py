import sys
from types import SimpleNamespace
import unittest
from unittest.mock import Mock,patch
import pandas as pd
from src import feature_builder


class PredictionIOTest(unittest.TestCase):
    DATA={'temperatura':24.5,'humedad':70,'precipitacion':700,'precipitacion_ciclo_mm':700,'fertilizante':150,'phSuelo':6.2,'area':1,'tipoSuelo':'franco','latitud':-1,'longitud':-80,'ubicacion':'Manabí','variedad_maiz':'INIAP H-551'}

    def test_skipping_duplicate_context_preserves_every_predictive_input(self):
        station=SimpleNamespace(inamhi_db=SimpleNamespace(get_nearest_station=Mock(return_value=None)))
        soil={'textura_arcilla_pct':29.4,'textura_arena_pct':40.4,'textura_limo_pct':30.1}
        with patch.dict(sys.modules,{'src.inamhi_climate':station}),patch.object(feature_builder,'fetch_precision_weather',return_value={'source':'prueba'}) as weather,patch.object(feature_builder,'fetch_precision_soil') as soil_fetch:
            first,_=feature_builder.build_features({**self.DATA,'suelo_ubicacion':soil})
            second,_=feature_builder.build_features({**self.DATA,'suelo_ubicacion':soil,'consultar_suelo':False,'incluir_contexto_reciente':False})
            pd.testing.assert_frame_equal(first,second)
            self.assertEqual(1,weather.call_count)
            soil_fetch.assert_not_called()

    def test_disabled_soil_lookup_never_calls_external_provider(self):
        station=SimpleNamespace(inamhi_db=SimpleNamespace(get_nearest_station=Mock(return_value=None)))
        with patch.dict(sys.modules,{'src.inamhi_climate':station}),patch.object(feature_builder,'fetch_precision_weather') as weather,patch.object(feature_builder,'fetch_precision_soil') as soil:
            feature_builder.build_features({**self.DATA,'consultar_suelo':False,'incluir_contexto_reciente':False})
            weather.assert_not_called(); soil.assert_not_called()

    def test_strings_are_not_boolean_flags(self):
        for flag in ('consultar_suelo','incluir_contexto_reciente'):
            with self.subTest(flag=flag),self.assertRaisesRegex(ValueError,'booleano'):
                feature_builder.build_features({**self.DATA,flag:'false'})


if __name__=='__main__': unittest.main()
