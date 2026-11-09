import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from src.espac_dataset import prepare,FEATURES,ROOT
from src.model_evidence import evidence,AVAILABILITY
from src.training_quality import FEATURES as MODEL_FEATURES


class OfficialDatasetTest(unittest.TestCase):
    def test_official_input_is_hash_bound_and_label_never_becomes_feature(self):
        self.assertFalse(set(FEATURES)&{'ct_prod','ct_k511ha','rendimiento_t_ha','fecha_cosecha'})
        with tempfile.TemporaryDirectory() as tmp:
            source=Path(tmp)/'copia.csv'; source.write_text('contenido alterado')
            with self.assertRaisesRegex(ValueError,'difiere'): prepare(source)

    def test_availability_covers_model_and_future_values_are_not_presented_as_observations(self):
        self.assertEqual(set(MODEL_FEATURES),set(AVAILABILITY))
        result=evidence({'ndvi_r3_llenado_grano':'Referencia del conjunto de entrenamiento','ph_suelo':'Ingresado por el productor'})
        self.assertEqual(['ndvi_r3_llenado_grano'],result['variables_posteriores_asumidas'])
        self.assertFalse(result['validacion_cosechas_independientes'])
        self.assertEqual('no_acreditada',result['procedencia_entrenamiento'])
        self.assertTrue(result['ficha_coincide_con_artefactos'])


if __name__=='__main__': unittest.main()
