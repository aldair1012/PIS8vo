import hashlib
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
import pandas as pd
from src.training_quality import evaluar, validar_publicacion, ROOT


class TrainingQualityTest(unittest.TestCase):
    def setUp(self):
        self.frame = pd.read_csv(ROOT / 'data/maiz_ecuador_training_data.csv').iloc[:1].copy()

    def test_physical_contradictions_are_excluded_without_repairing_values(self):
        self.frame.loc[0,'temperatura_min_c'] = self.frame.loc[0,'temperatura_media_c'] + 1
        mask, report = evaluar(self.frame)
        self.assertFalse(mask.iloc[0])
        self.assertEqual(1, report['problemas']['temperaturas_inconsistentes'])
        self.assertGreater(self.frame.loc[0,'temperatura_min_c'],self.frame.loc[0,'temperatura_media_c'])

    def test_provenance_gate_rejects_unverified_source_and_wrong_hash(self):
        with TemporaryDirectory() as folder:
            path = Path(folder)/'datos.csv'; self.frame.to_csv(path,index=False)
            with self.assertRaisesRegex(ValueError,'procedencia verificada'):
                validar_publicacion(self.frame,path)
            manifest = path.with_suffix('.procedencia.json')
            manifest.write_text(json.dumps({'estado':'verificada','sha256':'incorrecto','fuentes':['Fuente ficticia de prueba']}),encoding='utf-8')
            with self.assertRaises(ValueError): validar_publicacion(self.frame,path)
            manifest.write_text(json.dumps({'estado':'verificada','sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'fuentes':['Fuente ficticia de prueba']}),encoding='utf-8')
            self.assertEqual(0,validar_publicacion(self.frame,path)['filas_invalidas'])


if __name__ == '__main__': unittest.main()
