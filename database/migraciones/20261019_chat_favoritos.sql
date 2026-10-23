-- Conversaciones favoritas del chatbot (ZeaSys IA).
-- El productor guarda una conversación y su contexto; el asistente puede
-- recordarla cuando la pregunta lo pida. Ejecutar una sola vez sobre una base
-- ZeaSys ya instalada.
-- Uso: mysql -u root agropredict_db < database/migraciones/20261019_chat_favoritos.sql

CREATE TABLE IF NOT EXISTS `chat_favoritos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `usuario_id` int(11) NOT NULL,
  `cultivo_id` int(11) DEFAULT NULL,
  `anio` smallint(5) UNSIGNED DEFAULT NULL,
  `ambito` varchar(20) NOT NULL DEFAULT 'dashboard' COMMENT 'dashboard o simulacion',
  `vista` varchar(50) DEFAULT NULL,
  `conversacion_id` char(64) NOT NULL COMMENT 'Identificador de la conversación en el chat',
  `titulo` varchar(180) NOT NULL DEFAULT 'Conversación guardada',
  `mensajes_json` longtext NOT NULL COMMENT 'Mensajes visibles que el usuario guardó',
  `contexto_json` longtext DEFAULT NULL COMMENT 'Fotografía mínima: parcela, año, ámbito y vista',
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  `actualizado_en` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_chat_favorito_usuario_conversacion` (`usuario_id`, `conversacion_id`),
  KEY `idx_chat_favorito_usuario` (`usuario_id`, `cultivo_id`, `anio`),
  KEY `idx_chat_favorito_cultivo` (`cultivo_id`),
  KEY `idx_chat_favorito_recientes` (`usuario_id`, `actualizado_en`),
  CONSTRAINT `chat_favoritos_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chat_favoritos_ibfk_2` FOREIGN KEY (`cultivo_id`) REFERENCES `cultivos` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
