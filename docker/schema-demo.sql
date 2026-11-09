-- Solo estructura, sin cuentas ni registros del usuario.
SET NAMES utf8mb4;
CREATE TABLE `cultivos` (
  `id` int(11) NOT NULL,
  `usuario_id` int(11) NOT NULL,
  `nombre_parcela` varchar(150) NOT NULL,
  `variedad_maiz` varchar(100) NOT NULL DEFAULT 'Híbrido convencional',
  `ubicacion` varchar(255) DEFAULT NULL,
  `area` decimal(10,2) NOT NULL COMMENT 'Área en hectáreas',
  `latitud` decimal(10,7) DEFAULT NULL,
  `longitud` decimal(10,7) DEFAULT NULL,
  `fecha_siembra` date DEFAULT NULL,
  `fecha_registro` datetime NOT NULL DEFAULT current_timestamp(),
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `geojson` longtext DEFAULT NULL,
  `altitud` decimal(6,1) DEFAULT NULL,
  `ph` decimal(3,1) DEFAULT NULL,
  `tipo_maiz` varchar(100) NOT NULL DEFAULT 'Duro Amarillo',
  `fertilizacion_fecha` date DEFAULT NULL,
  `fertilizacion_dosis` decimal(8,2) DEFAULT NULL,
  `fertilizacion_tipo` varchar(150) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `simulaciones` (
  `id` int(11) NOT NULL,
  `usuario_id` int(11) NOT NULL,
  `cultivo_id` int(11) DEFAULT NULL,
  `nombre` varchar(200) NOT NULL DEFAULT 'Simulación sin nombre',
  `modelo_usado` enum('xgboost') NOT NULL DEFAULT 'xgboost',
  `temperatura` decimal(5,2) NOT NULL COMMENT '°C',
  `humedad` decimal(5,2) NOT NULL COMMENT '%',
  `precipitacion` decimal(8,2) NOT NULL COMMENT 'mm/año',
  `fertilizante` decimal(8,2) NOT NULL COMMENT 'kg/ha',
  `ph_suelo` decimal(4,2) NOT NULL,
  `tipo_suelo` enum('franco','arcilloso','arenoso') NOT NULL DEFAULT 'franco',
  `area_simulada` decimal(10,2) NOT NULL DEFAULT 1.00 COMMENT 'Hectáreas simuladas',
  `rendimiento_estimado` decimal(8,4) DEFAULT NULL COMMENT 't/ha',
  `produccion_total` decimal(10,2) DEFAULT NULL COMMENT 'Toneladas totales',
  `confianza` decimal(5,2) DEFAULT NULL COMMENT 'Porcentaje de confianza',
  `shap_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'Valores SHAP de cada variable' CHECK (json_valid(`shap_json`)),
  `recomendaciones_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'Recomendaciones generadas' CHECK (json_valid(`recomendaciones_json`)),
  `fecha` datetime NOT NULL DEFAULT current_timestamp(),
  `categoria_cosecha` varchar(50) DEFAULT NULL,
  `escenarios_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`escenarios_json`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `usuarios` (
  `id` int(11) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `correo` varchar(150) NOT NULL,
  `contrasena` varchar(255) NOT NULL COMMENT 'Hash bcrypt de la contraseña',
  `rol` enum('admin','agricultor','investigador') NOT NULL DEFAULT 'agricultor',
  `fecha_registro` datetime NOT NULL DEFAULT current_timestamp(),
  `ultimo_acceso` datetime DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `foto_perfil` varchar(500) DEFAULT NULL,
  `es_google` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `chat_favoritos` (
  `id` int(11) NOT NULL,
  `usuario_id` int(11) NOT NULL,
  `cultivo_id` int(11) DEFAULT NULL,
  `año` smallint(5) UNSIGNED DEFAULT NULL,
  `ambito` varchar(20) NOT NULL DEFAULT 'dashboard' COMMENT 'dashboard o simulacion',
  `vista` varchar(50) DEFAULT NULL,
  `conversacion_id` char(64) NOT NULL COMMENT 'Identificador de la conversación en el chat',
  `titulo` varchar(180) NOT NULL DEFAULT 'Conversación guardada',
  `mensajes_json` longtext NOT NULL COMMENT 'Mensajes visibles que el usuario guardó',
  `contexto_json` longtext DEFAULT NULL COMMENT 'Fotografía mínima: parcela, año, ámbito y vista',
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  `actualizado_en` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `cultivos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_usuario` (`usuario_id`);

ALTER TABLE `simulaciones`
  ADD PRIMARY KEY (`id`),
  ADD KEY `cultivo_id` (`cultivo_id`),
  ADD KEY `idx_usuario_fecha` (`usuario_id`,`fecha`),
  ADD KEY `idx_modelo` (`modelo_usado`);

ALTER TABLE `usuarios`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `correo` (`correo`),
  ADD KEY `idx_correo` (`correo`),
  ADD KEY `idx_rol` (`rol`);

ALTER TABLE `chat_favoritos`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_chat_favorito_usuario_conversacion` (`usuario_id`, `conversacion_id`),
  ADD KEY `idx_chat_favorito_usuario` (`usuario_id`, `cultivo_id`, `año`),
  ADD KEY `idx_chat_favorito_cultivo` (`cultivo_id`),
  ADD KEY `idx_chat_favorito_recientes` (`usuario_id`, `actualizado_en`);

ALTER TABLE `cultivos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=36;

ALTER TABLE `simulaciones`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=48;

ALTER TABLE `usuarios`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;

ALTER TABLE `chat_favoritos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `cultivos`
  ADD CONSTRAINT `cultivos_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE;

ALTER TABLE `simulaciones`
  ADD CONSTRAINT `simulaciones_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `simulaciones_ibfk_2` FOREIGN KEY (`cultivo_id`) REFERENCES `cultivos` (`id`) ON DELETE SET NULL;

ALTER TABLE `chat_favoritos`
  ADD CONSTRAINT `chat_favoritos_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `chat_favoritos_ibfk_2` FOREIGN KEY (`cultivo_id`) REFERENCES `cultivos` (`id`) ON DELETE SET NULL;

-- Registros declarados por el productor. No contiene datos de ejemplo.
CREATE TABLE IF NOT EXISTS mediciones_rendimiento (
    cultivo_id INT NOT NULL PRIMARY KEY,
    datos_json LONGTEXT NOT NULL,
    actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_mediciones_rendimiento_cultivo FOREIGN KEY (cultivo_id) REFERENCES cultivos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

