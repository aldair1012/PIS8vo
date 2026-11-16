import importlib.util
import unittest
from pathlib import Path

import numpy as np
import pandas as pd

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts' / 'experimento_realismo_inferencia.py'
spec = importlib.util.spec_from_file_location('experimento_realismo_inferencia', SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ExperimentoRealismoTest(unittest.TestCase):
    def test_loja_sierra_comparte_grupo_con_loja(self):
        provincias = pd.Series(['Loja', 'Loja Sierra', 'Manabí'])
        self.assertEqual(module.grupos_reales(provincias).tolist(), ['Loja', 'Loja', 'Manabí'])

    def test_imputar_usa_solo_el_entrenamiento_y_no_muta_la_prueba(self):
        train = pd.DataFrame({'zona': ['A', 'A', 'B'], 'horas_luz_dia': [6.0, 8.0, 9.0],
                              'control_plaga': ['ninguno', 'ninguno', 'quimico']})
        test = pd.DataFrame({'zona': ['A', 'B', 'Nueva'], 'horas_luz_dia': [1.0, 1.0, 1.0],
                             'control_plaga': ['x', 'x', 'x']})
        copia = test.copy()
        salida = module.imputar(train, test, ['horas_luz_dia', 'control_plaga'])
        self.assertEqual(salida['horas_luz_dia'].tolist(), [7.0, 9.0, 8.0])  # zona desconocida: mediana global
        self.assertEqual(salida['control_plaga'].tolist(), ['ninguno', 'quimico', 'ninguno'])
        pd.testing.assert_frame_equal(test, copia)

    def test_las_variables_futuras_no_estan_en_el_contrato_de_planificacion(self):
        previas = [c for c in module.FEATURES if c not in module.FUTURAS]
        self.assertEqual(len(module.FEATURES), 36)
        self.assertEqual(len(previas), 30)
        self.assertTrue(set(module.FUTURAS).isdisjoint(previas))

    def test_umbral_conforme_es_finito_y_no_negativo(self):
        rng = np.random.default_rng(0)
        x = rng.uniform(0, 10, 120)
        train = pd.DataFrame({'x': x})
        y = pd.Series(2 * x + rng.normal(0, 0.5, 120))
        grupos = pd.Series(np.repeat(np.arange(6), 20))
        umbral = module.umbral_conforme(train, y, grupos, ['x'])
        self.assertTrue(np.isfinite(umbral))
        self.assertGreaterEqual(umbral, 0.0)


if __name__ == '__main__':
    unittest.main()
