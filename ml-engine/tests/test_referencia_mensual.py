import json
import unittest

from scripts.referencia_mensual_espac import construir
from src.espac_dataset import prepare, ROOT


class ReferenciaMensualTest(unittest.TestCase):
    def test_resultado_publicado_y_aislamiento_de_segmentos(self):
        archivo = ROOT / "documentacion/fuentes-maiz/candidatos/maiz_espac2025_original.csv"
        if not archivo.is_file():
            self.skipTest("Se necesita la copia de microdatos acreditada por el proyecto.")
        frame, calidad = prepare(archivo)
        referencia = construir(frame, calidad)
        publicada = json.loads((ROOT / "backend-api/data/referencias/planificacion-mensual-espac.json").read_text(encoding="utf-8"))
        self.assertEqual(referencia, publicada)
        # Alterar sólo la cosecha de un segmento de prueba no puede modificar medianas ni márgenes.
        bloques = frame.grupo_segmento.map(lambda segmento: int(segmento[:8], 16) % 10)
        frame.loc[bloques >= 8, "rendimiento_t_ha"] += 100
        modificada = construir(frame, calidad)
        self.assertEqual(referencia["celdas"], modificada["celdas"])
        self.assertEqual([b["margen"] for b in referencia["bandas"]], [b["margen"] for b in modificada["bandas"]])
        self.assertEqual(sum(b["aciertos_prueba"] for b in modificada["bandas"]), 0)
