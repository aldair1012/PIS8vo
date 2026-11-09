"""Contrato compartido de entradas opcionales; vacío significa desconocido."""
from datetime import date, timedelta
import json
import math
import unicodedata
from pathlib import Path

SCHEMA = json.loads((Path(__file__).resolve().parents[2] / 'backend-api/data/referencias/entradas-campo.json').read_text(encoding='utf-8'))
CATALOGO = json.loads((Path(__file__).resolve().parents[2] / 'backend-api/data/referencias/catalogo-maiz-ecuador.json').read_text(encoding='utf-8'))


def clave_variedad(value):
    ascii_name = unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode()
    return ''.join(c for c in ascii_name.lower() if c.isalnum())


def validar_campos(data):
    for flag in ('consultar_suelo','incluir_contexto_reciente'):
        if flag in data and type(data[flag]) is not bool:
            raise ValueError(f'{flag} debe ser booleano')
    if 'suelo_ubicacion' in data:
        soil = data['suelo_ubicacion']
        allowed = {'textura_arcilla_pct','textura_arena_pct','textura_limo_pct','materia_organica_pct'}
        if not isinstance(soil, dict) or set(soil)-allowed:
            raise ValueError('suelo_ubicacion debe contener propiedades admitidas del proveedor')
        for key,value in soil.items():
            if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value) or not 0 <= value <= 100:
                raise ValueError(f'Propiedad de suelo no válida: {key}')
        fractions = [soil[k] for k in ['textura_arcilla_pct','textura_arena_pct','textura_limo_pct'] if k in soil]
        if fractions and (len(fractions)!=3 or abs(sum(fractions)-100)>5):
            raise ValueError('Las tres fracciones de suelo deben estar completas y sumar aproximadamente 100 %')
    nombre = data.get('variedad_maiz', '')
    if isinstance(nombre, str):
        for ficha in CATALOGO['variedades']:
            if ficha.get('simulacion_grano_habilitada') is False and clave_variedad(nombre) in {clave_variedad(n) for n in [ficha['nombre'], *ficha['alias']]}:
                raise ValueError('Esta variedad tiene ficha de consulta, pero su modelo de rendimiento específico aún no está habilitado.')
    fields = data.get('parametros_campo', {})
    if not isinstance(fields, dict):
        raise ValueError('parametros_campo debe ser un objeto')
    result = {}
    for key, value in fields.items():
        rule = SCHEMA['campos'].get(key)
        if rule is None:
            raise ValueError(f'Parámetro de campo no admitido: {key}')
        if value is None or isinstance(value, (bool, dict, list)) or str(value).strip() == '':
            raise ValueError(f'El campo {key} debe tener un valor válido u omitirse')
        if 'opciones' in rule and str(value) not in rule['opciones']:
            raise ValueError(f'Opción no válida para {key}')
        if 'opciones' in rule and not rule.get('entero'):
            result[key] = value
            continue
        try:
            number = float(value)
        except (TypeError, ValueError, OverflowError):
            raise ValueError(f'El campo {key} debe ser numérico') from None
        if not math.isfinite(number) or not rule.get('min', 0) <= number <= rule.get('max', 1):
            raise ValueError(f'El campo {key} está fuera del rango admitido')
        if rule.get('entero') and not number.is_integer():
            raise ValueError(f'El campo {key} debe ser un entero')
        result[key] = int(number) if rule.get('entero') else number
    mean = float(data['temperatura'])
    if result.get('temperatura_min_c', mean) > mean or result.get('temperatura_max_c', mean) < mean:
        raise ValueError('La temperatura mínima debe ser menor o igual a la media, y la máxima mayor o igual')
    if 'fecha_siembra' in data:
        value = data['fecha_siembra']
        try:
            parsed = date.fromisoformat(value) if isinstance(value, str) else None
        except ValueError:
            parsed = None
        if parsed is None or parsed.isoformat() != value or parsed.year < 1950 or parsed.year > 2100:
            raise ValueError('fecha_siembra debe ser una fecha válida AAAA-MM-DD entre 1950 y 2100')
    return result


def calendario(data, ciclo_dias):
    start = data.get('fecha_siembra')
    return {'fecha_siembra': start, 'ciclo_dias': ciclo_dias,
            'fecha_fin_estimada': (date.fromisoformat(start) + timedelta(days=round(ciclo_dias) - 1)).isoformat() if start else None,
            'origen_duracion': 'Ingresado por el productor' if 'ciclo_dias' in data.get('parametros_campo', {}) else 'Referencia del conjunto de entrenamiento',
            'nota': 'Fecha orientativa: no demuestra madurez, clima futuro ni fecha real de cosecha. La fecha sitúa el periodo; XGBoost utiliza ciclo_dias, no una nueva variable de fecha.'}


def ventana_historica(plan, hoy):
    """Devuelve solo días pasados. Nunca crea lluvia futura a partir del pasado."""
    if not plan['fecha_siembra']:
        return None
    start = date.fromisoformat(plan['fecha_siembra'])
    end = min(date.fromisoformat(plan['fecha_fin_estimada']), hoy - timedelta(days=2))
    return (start, end) if start <= end else None
