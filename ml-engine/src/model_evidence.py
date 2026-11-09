"""Evidencia ligada a las huellas del modelo; no representa una precisión individual."""
from functools import lru_cache
import hashlib
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
AVAILABILITY=json.loads((ROOT/'config/disponibilidad_variables.json').read_text(encoding='utf-8'))


@lru_cache(maxsize=1)
def model_card():
    card=json.loads((ROOT/'config/model_evidence.json').read_text(encoding='utf-8'))
    matches=all((ROOT/'models'/name).is_file() and hashlib.sha256((ROOT/'models'/name).read_bytes()).hexdigest()==sha for name,sha in card['artefactos_sha256'].items())
    return {**card,'ficha_coincide_con_artefactos':matches}


def evidence(sources):
    card=model_card()
    future=[key for key,rule in AVAILABILITY.items() if rule['disponibilidad']=='etapa_posterior' and str(sources.get(key,'')).startswith('Referencia del conjunto')]
    return {'uso':card['uso'],'procedencia_entrenamiento':card['procedencia_entrenamiento'] if card['ficha_coincide_con_artefactos'] else 'ficha_desactualizada',
            'validacion_cosechas_independientes':card['validacion_cosechas_independientes'] if card['ficha_coincide_con_artefactos'] else False,
            'ficha_coincide_con_artefactos':card['ficha_coincide_con_artefactos'],'variables_posteriores_asumidas':future,
            'producto_objetivo':card['producto_objetivo'],'modelo_espac2025_publicado':card['modelo_espac2025_publicado']}
