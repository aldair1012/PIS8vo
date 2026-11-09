import importlib.util
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts' / 'evaluar_cosechas_verificadas.py'
spec = importlib.util.spec_from_file_location('evaluar_cosechas_verificadas', SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
HEADER = 'parcela_id,provincia,fecha_prediccion,fecha_cosecha,modelo_version,fuente_observacion,prediccion_t_ha,cosecha_t_ha\n'

class EvaluationTest(unittest.TestCase):
    def evaluate(self, content):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'datos.csv'
            path.write_text(HEADER + content, encoding='utf-8')
            return module.evaluate(path)

    def test_metrics_and_grouping(self):
        report = self.evaluate('a,Manabí,2025-01-01,2025-04-01,v1,registro,4,3\nb,Manabí,2025-01-01,2025-04-02,v1,registro,2,4\n')
        self.assertEqual(report['total']['n'], 2)
        self.assertEqual(report['total']['mae_t_ha'], 1.5)
        self.assertEqual(report['total']['sesgo_t_ha'], -0.5)
        self.assertEqual(report['por_provincia_y_anio'][0]['anio'], '2025')

    def test_rejects_leakage_duplicates_and_nonfinite(self):
        cases = ['a,M,2025-05-01,2025-04-01,v1,registro,4,3\n',
                 'a,M,2025-01-01,2025-04-01,v1,registro,nan,3\n',
                 'a,M,2025-01-01,2025-04-01,v1,registro,4,3\n' * 2]
        for case in cases:
            with self.subTest(case=case), self.assertRaises(ValueError):
                self.evaluate(case)

if __name__ == '__main__':
    unittest.main()
