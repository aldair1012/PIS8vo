<?php
/**
 * Adapter: ClienteMotorFlask
 * ==========================
 * Cliente HTTP del motor de predicción Flask. Implementa el puerto
 * MotorPrediccionInterface y mantiene aislada la comunicación externa.
 */

declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Infraestructura;

use ZeaSys\Dominios\Simulaciones\Dominio\MotorPrediccionInterface;

final class ClienteMotorFlask implements MotorPrediccionInterface
{
    public function predecir(array $datos): array
    {
        $url = IA_SERVER_URL . '/predict';

        $entradas = [
            'temperatura'   => (float) $datos['temperatura'],
            'humedad'       => (float) $datos['humedad'],
            'precipitacion' => (float) $datos['precipitacion'],
            'fertilizante'  => (float) $datos['fertilizante'],
            'phSuelo'       => (float) $datos['ph_suelo'],
            'area'          => (float) $datos['area_simulada'],
            'tipoSuelo'     => $datos['tipo_suelo'],
            'variedad_maiz' => $datos['variedad_maiz'] ?? 'Híbrido convencional',
            'tipo_maiz'     => $datos['tipo_maiz'] ?? 'Duro Amarillo',
            'ubicacion'     => $datos['ubicacion'] ?? '',
            'altitud'       => (float) ($datos['altitud'] ?? 45.0),
            'latitud'       => isset($datos['latitud']) ? (float) $datos['latitud'] : null,
            'longitud'      => isset($datos['longitud']) ? (float) $datos['longitud'] : null,
            'modelo'        => $datos['modelo_usado'] ?? 'xgboost',
            // El backend ya consulta y valida las referencias del formulario.
            // No repetir clima reciente que no interviene en el escenario ni el REST de suelo obsoleto.
            'incluir_contexto_reciente' => false,
            'consultar_suelo' => false,
        ];
        if (array_key_exists('precipitacion_ciclo_mm', $datos)) {
            $entradas['precipitacion_ciclo_mm'] = (float) $datos['precipitacion_ciclo_mm'];
        }
        foreach (['parametros_campo', 'fecha_siembra', 'incluir_historico', 'suelo_ubicacion'] as $campo) {
            if (array_key_exists($campo, $datos)) $entradas[$campo] = $datos[$campo];
        }
        $payload = json_encode($entradas);

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_TIMEOUT        => 30,
            CURLOPT_CONNECTTIMEOUT => 10
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error    = curl_error($ch);
        curl_close($ch);

        if ($error) {
            return [
                'success' => false,
                'error'   => 'No se pudo conectar con el motor de simulación: ' . $error
            ];
        }

        if ($httpCode !== 200) {
            return [
                'success' => false,
                'error'   => 'Error del motor de simulación (HTTP ' . $httpCode . ')'
            ];
        }

        $result = json_decode($response, true);
        return $result ?: ['success' => false, 'error' => 'Respuesta inválida del motor de simulación'];
    }
}
