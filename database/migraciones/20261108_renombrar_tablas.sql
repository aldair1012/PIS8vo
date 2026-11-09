-- ============================================================================
-- Migración: Renombrar tablas y columnas al español
-- ============================================================================
-- ADVERTENCIA: Ejecutar SIEMPRE con un respaldo previo de la base de datos.
-- Compatible con MariaDB 10.5+ y MySQL 8.0+ (usa RENAME COLUMN).
-- Si usas MariaDB 10.4 o anterior, reemplaza RENAME COLUMN por CHANGE COLUMN.
-- ============================================================================

-- 1. Eliminar claves foráneas que referencian a la tabla cultivos
ALTER TABLE `simulaciones` DROP FOREIGN KEY `simulaciones_ibfk_2`;
ALTER TABLE `chat_favoritos` DROP FOREIGN KEY `chat_favoritos_ibfk_2`;
ALTER TABLE `mediciones_rendimiento` DROP FOREIGN KEY `fk_mediciones_rendimiento_cultivo`;

-- 2. Renombrar tablas al español
RENAME TABLE `cultivos` TO `parcelas`;
RENAME TABLE `chat_favoritos` TO `conversaciones_favoritas`;

-- 3. Renombrar columnas cultivo_id → parcela_id
ALTER TABLE `simulaciones` RENAME COLUMN `cultivo_id` TO `parcela_id`;
ALTER TABLE `conversaciones_favoritas` RENAME COLUMN `cultivo_id` TO `parcela_id`;
ALTER TABLE `mediciones_rendimiento` RENAME COLUMN `cultivo_id` TO `parcela_id`;

-- 4. Recrear claves foráneas con los nuevos nombres de tabla y columna
ALTER TABLE `simulaciones`
  ADD CONSTRAINT `simulaciones_ibfk_2` FOREIGN KEY (`parcela_id`) REFERENCES `parcelas` (`id`) ON DELETE SET NULL;

ALTER TABLE `conversaciones_favoritas`
  ADD CONSTRAINT `conversaciones_favoritas_ibfk_2` FOREIGN KEY (`parcela_id`) REFERENCES `parcelas` (`id`) ON DELETE SET NULL;

ALTER TABLE `mediciones_rendimiento`
  ADD CONSTRAINT `fk_mediciones_rendimiento_parcela` FOREIGN KEY (`parcela_id`) REFERENCES `parcelas` (`id`) ON DELETE CASCADE;

-- ============================================================================
-- Fin de migración
-- ============================================================================
