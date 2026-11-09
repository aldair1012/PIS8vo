-- Registros declarados por el productor. No contiene datos de ejemplo.
CREATE TABLE IF NOT EXISTS mediciones_rendimiento (
    cultivo_id INT NOT NULL PRIMARY KEY,
    datos_json LONGTEXT NOT NULL,
    actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_mediciones_rendimiento_cultivo FOREIGN KEY (cultivo_id) REFERENCES cultivos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
