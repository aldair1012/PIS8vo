CREATE TABLE IF NOT EXISTS accesos_tecnicos (
    parcela_id INT NOT NULL,
    tecnico_id INT NOT NULL,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (parcela_id, tecnico_id),
    INDEX idx_tecnico_parcelas (tecnico_id, parcela_id),
    FOREIGN KEY (parcela_id) REFERENCES parcelas(id) ON DELETE CASCADE,
    FOREIGN KEY (tecnico_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
