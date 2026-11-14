import hashlib
import json
from pathlib import Path
import tempfile
import unittest
import csv
from src.espac_dataset import prepare,FEATURES,ROOT
from src.model_evidence import evidence,AVAILABILITY
from src.training_quality import FEATURES as MODEL_FEATURES


class OfficialDatasetTest(unittest.TestCase):
    def test_choclo_and_dry_grain_never_share_targets(self):
        with tempfile.TemporaryDirectory() as tmp:
            source=Path(tmp)/'productos.csv'
            base={'Identificador':'1','ct_k504':'1','ct_k506':'1','ct_k507':'5','ct_k510ha':'2','ct_k511ha':'1','ct_prod':'5','fact_exp_fin':'1','ual_prov':'MANABI','ual_estr':'1','ual_segm':'10'}
            rows=[{**base,'ct_nclavr':'MAIZ DURO SECO (GRANO SECO)','ct_k520':'GRANO SECO'},
                  {**base,'Identificador':'2','ct_nclavr':'MAIZ SUAVE CHOCLO (CHOCLO)','ct_k520':'CHOCLO','ct_prod':'9'},
                  {**base,'Identificador':'3','ct_nclavr':'MAIZ SUAVE CHOCLO (CHOCLO)','ct_k520':'GRANO SECO'}]
            with source.open('w',encoding='utf8',newline='') as handle:
                writer=csv.DictWriter(handle,fieldnames=rows[0].keys(),delimiter=';');writer.writeheader();writer.writerows(rows)
            profile=Path(tmp)/'perfil.json';profile.write_text(json.dumps({'url':'https://example.test/fixture','archivos':{'maiz_espac2025_original.csv':{'sha256':hashlib.sha256(source.read_bytes()).hexdigest()}}}),encoding='utf8')
            dry,_=prepare(source,profile,producto='grano_seco'); fresh,meta=prepare(source,profile,producto='choclo')
            self.assertEqual(dry.rendimiento_t_ha.tolist(),[5])
            self.assertEqual(fresh.rendimiento_t_ha.tolist(),[9])
            self.assertEqual(meta['estado_cosecha'],'CHOCLO')
            self.assertEqual(meta['exclusiones']['estado_incompatible'],1)

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
