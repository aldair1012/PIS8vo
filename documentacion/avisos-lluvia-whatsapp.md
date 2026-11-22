# Avisos semanales de lluvia por WhatsApp

En **Clima y cultivo → Los próximos 7 días → Avisos semanales**, el productor elige el umbral diario en milímetros y envía el mensaje de alta desde su WhatsApp. El enlace caduca a los 15 minutos. El teléfono se obtiene del mensaje firmado por Meta. El botón para retirar el permiso elimina el número de esa parcela. Enviar **BAJA** o **STOP** elimina todos los avisos de ese teléfono.

## Configuración

1. Aplica `database/migraciones/20261120_alertas_lluvia.sql` a las instalaciones existentes. Las nuevas incluyen las tablas en el esquema de demostración.
2. Solicita en WhatsApp Business una plantilla de utilidad aprobada en español con dos parámetros posicionales de cuerpo. El primero recibe la fecha ISO y el segundo la lluvia prevista en mm. Texto de ejemplo «ZeaSys prevé para el {{1}} una lluvia de {{2}} mm en un día. Revisa el drenaje de tu parcela. Responde BAJA para cancelar». [Documentación de Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/overview/).
3. Define las siguientes variables en el entorno del servidor PHP y del proceso de avisos. Guarda los secretos fuera del directorio público.
4. Registra en Meta el webhook HTTPS público `/backend-api/public/index.php/api/whatsapp/webhook` con el prefijo de instalación y suscribe el campo `messages`. El servidor verifica la firma HMAC SHA-256 sobre el cuerpo original.
5. Programa cada hora `php scripts/avisos_lluvia.php --enviar`. Sin el argumento se cuentan coincidencias sin enviar ni reservar entregas.

| Variable | Valor |
| --- | --- |
| ZEASYS_WA_TOKEN | Token con permiso whatsapp_business_messaging |
| ZEASYS_WA_PHONE_ID | Identificador del teléfono empresarial |
| ZEASYS_WA_NUMERO | Número empresarial internacional, solo dígitos |
| ZEASYS_WA_PLANTILLA | Nombre de la plantilla aprobada |
| ZEASYS_WA_IDIOMA | Código de la traducción aprobada, por defecto es |
| ZEASYS_WA_VERSION | Versión habilitada de Graph, por ejemplo v27.0 |
| ZEASYS_WA_APP_SECRET | Secreto de aplicación para verificar mensajes entrantes |
| ZEASYS_WA_VERIFY_TOKEN | Secreto elegido para verificar el webhook |

## Entregas y reintentos

El proceso usa el máximo diario disponible dentro de los siete días desde hoy. Omite pronósticos vencidos y parcelas o cuentas inactivas. Una reserva única por parcela y semana, de lunes a domingo en America/Guayaquil, evita duplicados entre procesos. Justo antes de enviar vuelve a comprobar el consentimiento. Se comparten con Meta el teléfono, la fecha y la lluvia prevista.

Un HTTP 429 o un fallo antes de establecer conexión admite hasta tres intentos por semana separados por al menos una hora. Una respuesta ambigua, un timeout posterior o una interrupción después de reservar queda sin reenvío automático. El operador puede revisar los estados en `envios_alertas_lluvia`. «Aceptado» indica que Meta devolvió un identificador. La entrega y lectura en el teléfono requieren seguimiento adicional. Consulta las tarifas y los límites de tu cuenta antes de activar el envío.
