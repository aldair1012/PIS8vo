CREATE INDEX IF NOT EXISTS idx_simulacion_usuario_parcela_fecha
    ON simulaciones (usuario_id, parcela_id, fecha);
