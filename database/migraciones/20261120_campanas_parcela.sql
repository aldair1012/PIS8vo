-- Una cosecha consolidada por siembra. La predicción archivada conserva su
-- procedencia aunque el usuario borre después la simulación de su historial.
CREATE TABLE IF NOT EXISTS cosechas_campana (
    parcela_id INT NOT NULL,
    fecha_siembra DATE NOT NULL,
    fecha_cosecha DATE NOT NULL,
    produccion_seca_kg DECIMAL(16,4) NOT NULL,
    area_cosechada_ha DECIMAL(14,6) NOT NULL,
    humedad_grano_pct DECIMAL(5,2) NOT NULL,
    fuente VARCHAR(255) NOT NULL,
    prediccion_json LONGTEXT NULL CHECK (prediccion_json IS NULL OR JSON_VALID(prediccion_json)),
    base_comparable TINYINT(1) NOT NULL,
    registrado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (parcela_id, fecha_siembra),
    UNIQUE KEY uq_cosecha_fecha (parcela_id, fecha_cosecha),
    FOREIGN KEY (parcela_id) REFERENCES parcelas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS observaciones_campana (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    parcela_id INT NOT NULL,
    fecha_siembra DATE NOT NULL,
    fecha DATE NOT NULL,
    fuente VARCHAR(255) NOT NULL,
    ndvi DECIMAL(6,5) NULL,
    nota VARCHAR(500) NULL,
    adjunto_tipo VARCHAR(30) NULL,
    adjunto MEDIUMBLOB NULL,
    huella CHAR(64) NOT NULL,
    registrado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_observacion (parcela_id, fecha_siembra, fecha, huella),
    FOREIGN KEY (parcela_id) REFERENCES parcelas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
