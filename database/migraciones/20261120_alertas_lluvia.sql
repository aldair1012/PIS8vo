CREATE TABLE IF NOT EXISTS alertas_lluvia (
    parcela_id INT PRIMARY KEY,
    usuario_id INT NOT NULL,
    umbral_mm DECIMAL(5,1) NOT NULL,
    codigo_hash CHAR(64) NULL UNIQUE,
    codigo_vence DATETIME NULL,
    telefono VARCHAR(15) NULL,
    consentido_utc DATETIME NULL,
    aviso_version VARCHAR(20) NOT NULL,
    INDEX ix_alertas_telefono (telefono),
    FOREIGN KEY (parcela_id) REFERENCES parcelas(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS envios_alertas_lluvia (
    parcela_id INT NOT NULL,
    semana DATE NOT NULL,
    estado VARCHAR(20) NOT NULL,
    intentos INT NOT NULL DEFAULT 0,
    actualizado_utc DATETIME NOT NULL,
    PRIMARY KEY (parcela_id, semana),
    FOREIGN KEY (parcela_id) REFERENCES parcelas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
