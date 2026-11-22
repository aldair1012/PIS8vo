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
    def evaluate(self, content, header=HEADER):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'datos.csv'
            path.write_text(header + content, encoding='utf-8')
            return module.evaluate(path)

    def test_metrics_and_grouping(self):
        report = self.evaluate('a,Manabí,2025-01-01,2025-04-01,v1,registro,4,3\nb,Manabí,2025-01-01,2025-04-02,v1,registro,2,4\n')
        self.assertEqual(report['total']['n'], 2)
        self.assertEqual(report['total']['mae_t_ha'], 1.5)
        self.assertEqual(report['total']['sesgo_t_ha'], -0.5)
        self.assertEqual(report['por_provincia_y_anio'][0]['anio'], '2025')

    def test_intervalos_guardados_tienen_su_propio_denominador(self):
        header = HEADER.strip() + ',rango_min_t_ha,rango_max_t_ha\n'
        rows = ['a,M,2025-04-01,2025-04-01,v1,registro,2,3,1,3',
                'b,M,2025-03-01,2025-04-01,v1,registro,2,4,1,3',
                'c,M,2025-03-01,2025-04-01,v1,registro,2,4,,']
        report = self.evaluate('\n'.join(rows), header)
        self.assertEqual(report['total']['n'], 3)
        self.assertEqual(report['por_version'][0]['cobertura_observada'], .5)
        self.assertEqual(report['predicciones_el_dia_de_cosecha'], 1)
        for limits in ('3,1', '1,', 'nan,3'):
            with self.subTest(limits=limits), self.assertRaises(ValueError):
                self.evaluate(rows[0].rsplit(',', 2)[0] + ',' + limits, header)

    def test_cosecha_pesada_usa_area_cosechada_y_admite_perdida_total(self):
        header = HEADER.replace('cosecha_t_ha', 'produccion_seca_kg,area_cosechada_ha')
        row = 'a,M,2025-01-01,2025-04-01,v1,registro,4,'
        self.assertEqual(self.evaluate(row + '1500,0.5', header)['total']['mae_t_ha'], 1)
        self.assertEqual(self.evaluate(row + '0,1', header)['total']['mae_t_ha'], 4)
        for measurement in ['10,0', '10,inf', '10,', ',1']:
            with self.subTest(measurement=measurement), self.assertRaises(ValueError):
                self.evaluate(row + measurement, header)

    def test_rejects_leakage_duplicates_and_nonfinite(self):
        cases = ['a,M,2025-05-01,2025-04-01,v1,registro,4,3\n',
                 'a,M,2025-01-01,2025-04-01,v1,registro,nan,3\n',
                 'a,M,2025-01-01,2025-04-01,v1,registro,4,3\n' * 2]
        for case in cases:
            with self.subTest(case=case), self.assertRaises(ValueError):
                self.evaluate(case)

if __name__ == '__main__':
    unittest.main()
