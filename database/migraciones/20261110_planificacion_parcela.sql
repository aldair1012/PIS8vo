-- Additive: legacy dates remain unclassified until the producer confirms them.
ALTER TABLE parcelas
  ADD COLUMN IF NOT EXISTS tipo_fecha_siembra VARCHAR(20) NULL,
  ADD COLUMN IF NOT EXISTS ciclo_dias SMALLINT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS riego_tipo VARCHAR(40) NULL;
