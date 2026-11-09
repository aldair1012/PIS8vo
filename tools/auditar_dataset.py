"""Perfil de calidad del CSV, sin modificarlo ni atribuirle una procedencia."""
import argparse
from collections import Counter, defaultdict
import csv
import hashlib
import json
import math
from pathlib import Path


def audit(path):
    raw = path.read_bytes()
    text = raw.decode('utf-8-sig').replace('\r\n', '\n')
    with path.open(encoding='utf-8-sig', newline='') as stream:
        reader = csv.DictReader(stream)
        columns = reader.fieldnames or []
        rows = list(reader)
    counts = Counter(tuple(row.get(key) for key in columns) for row in rows)
    variation_groups = defaultdict(list)
    if 'variedad' in columns:
        other_columns = [key for key in columns if key != 'variedad']
        for line, row in enumerate(rows, 2):
            variation_groups[tuple(row.get(key) for key in other_columns)].append({'fila_csv': line, 'variedad': row.get('variedad')})
    variety_only = [group for group in variation_groups.values() if len({row['variedad'] for row in group}) > 1]
    missing = {key: sum(not str(row.get(key) or '').strip() for row in rows) for key in columns}
    texture = []
    invalid_temperatures = []
    invalid_numbers = []
    def number(row, key, line):
        try:
            value = float(row[key])
            if not math.isfinite(value):
                raise ValueError()
            return value
        except (KeyError, ValueError, TypeError):
            invalid_numbers.append({'fila_csv': line, 'columna': key})
            return None
    for line, row in enumerate(rows, 2):
        values = [number(row, key, line) for key in ('textura_arcilla_pct', 'textura_arena_pct', 'textura_limo_pct')]
        if all(value is not None for value in values):
            total = sum(values)
            if abs(total - 100) > 1:
                texture.append({'fila_csv': line, 'suma_pct': round(total, 4)})
        minimum, mean, maximum = [number(row, key, line) for key in ('temperatura_min_c', 'temperatura_media_c', 'temperatura_max_c')]
        if all(value is not None for value in (minimum, mean, maximum)) and not minimum <= mean <= maximum:
            invalid_temperatures.append(line)
    return {
        'archivo': str(path.as_posix()), 'sha256_archivo': hashlib.sha256(raw).hexdigest(),
        'sha256_texto_lf': hashlib.sha256(text.encode()).hexdigest(),
        'filas': len(rows), 'numero_columnas': len(columns), 'columnas': columns,
        'duplicados_exactos_adicionales': sum(count - 1 for count in counts.values()),
        'filas_unicas': len(counts), 'celdas_vacias': sum(missing.values()),
        'provincias': len({row.get('provincia') for row in rows}),
        'variedades': len({row.get('variedad') for row in rows}),
        'grupos_que_solo_difieren_en_variedad': variety_only,
        'columnas_de_procedencia_ausentes': [key for key in ('fuente', 'fecha_medicion', 'fecha_siembra', 'fecha_cosecha', 'id_parcela', 'latitud', 'longitud') if key not in columns],
        'textura_fuera_de_100_mas_menos_1': texture,
        'temperaturas_fuera_de_orden': invalid_temperatures,
        'valores_no_numericos_o_no_finitos_en_comprobaciones': invalid_numbers,
        'limite': 'Este perfil no verifica observaciones, origen ni licencia. La suma de textura requiere revisar el diccionario de datos; no se corrige automáticamente.',
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archivo', nargs='?', type=Path, default=Path(__file__).resolve().parents[1] / 'ml-engine/data/maiz_ecuador_training_data.csv')
    parser.add_argument('--salida', type=Path)
    args = parser.parse_args()
    result = audit(args.archivo)
    content = json.dumps(result, ensure_ascii=False, indent=2)
    if args.salida:
        args.salida.write_text(content + '\n', encoding='utf-8')
    else:
        print(json.dumps(result, ensure_ascii=True, indent=2))
