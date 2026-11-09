-- Conserva los índices ordinales de las tres opciones anteriores; agrega dos al final.
ALTER TABLE simulaciones MODIFY tipo_suelo
ENUM('franco','arcilloso','arenoso','franco_equilibrado','arcillo_limoso') NOT NULL DEFAULT 'franco';
