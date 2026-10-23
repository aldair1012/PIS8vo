-- Unifica las simulaciones existentes y deja XGBoost como único modelo.
-- Ejecutar una sola vez sobre una base ZeaSys ya instalada.
UPDATE simulaciones
SET modelo_usado = 'xgboost'
WHERE modelo_usado IS NULL OR modelo_usado <> 'xgboost';

ALTER TABLE simulaciones
    MODIFY COLUMN modelo_usado ENUM('xgboost') NOT NULL DEFAULT 'xgboost';
