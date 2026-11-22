CREATE TABLE IF NOT EXISTS consentimiento_asistente (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    version_aviso VARCHAR(32) NOT NULL,
    autorizado TINYINT(1) NOT NULL,
    registrado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_consentimiento_usuario (usuario_id, id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
