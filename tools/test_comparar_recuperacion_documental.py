import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('rag', Path(__file__).resolve().parent / 'comparar_recuperacion_documental.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class RegionalRetrievalTest(unittest.TestCase):
    def test_filter_only_applies_to_unambiguous_explicit_region(self):
        self.assertNotIn('iniap-guia-produccion-maiz-sierra-2021.pdf', module.regional_filter('plagas del Litoral')['source_file']['$in'])
        self.assertNotIn('iniap-guia-maiz-amarillo-litoral-2014.pdf', module.regional_filter('maíz en Sierra')['source_file']['$in'])
        self.assertIsNone(module.regional_filter('maíz en Ecuador'))
        self.assertIsNone(module.regional_filter('Sierra y Litoral'))

    def test_ignores_unknown_sources_and_invalid_pages(self):
        rows = [{'pageContent': 'contenido', 'metadata': {'source_file': 'ajeno.pdf', 'page': 1}},
                {'pageContent': 'contenido', 'metadata': {'source_file': 'inec-espac-resultados-2025.pdf', 'page': 0}},
                {'pageContent': 'válido', 'metadata': {'source_file': 'inec-espac-resultados-2025.pdf', 'page': 3}}]
        self.assertEqual(module.normalized(rows), [{'archivo': 'inec-espac-resultados-2025.pdf', 'pagina': 3, 'texto': 'válido'}])

if __name__ == '__main__': unittest.main()
