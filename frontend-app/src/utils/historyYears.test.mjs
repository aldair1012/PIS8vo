import test from 'node:test';
import assert from 'node:assert/strict';
import { historyYears } from './historyYears.js';

test('el selector usa fecha de la API y conserva el año de la fecha registrada', () => {
  assert.deepEqual(historyYears([
    { fecha: '2023-12-31 23:59:59' },
    { fecha: '2024-01-01T00:00:00Z' },
    { fecha: '2024-06-15 12:00:00' },
    { fecha: '2025-01-01' },
    { fecha_creacion: '2022-10-31' },
  ], 2026), [2023, 2024, 2025, 2026]);
});

test('ignora fechas ausentes o fuera del rango permitido por el historial', () => {
  assert.deepEqual(historyYears([
    {}, { fecha: null }, { fecha: '' }, { fecha: 'sin fecha' },
    { fecha: '1999-12-31' }, { fecha: '2101-01-01' },
  ], 2026), [2026]);
  assert.deepEqual(historyYears([], 2026), [2026]);
});
