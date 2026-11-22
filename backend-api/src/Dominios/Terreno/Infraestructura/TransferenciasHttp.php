<?php
declare(strict_types=1);
namespace ZeaSys\Dominios\Terreno\Infraestructura;

/** Reúne los GET ya preparados por cada proveedor en un único curl_multi. */
final class TransferenciasHttp
{
    private ?\Fiber $preparando = null;

    /** Cada tarea comprueba su caché y puede solicitar un lote de transferencias. */
    public function agrupar(array $tareas): array
    {
        $fibras = $peticiones = [];
        foreach ($tareas as $nombre => $tarea) {
            $fibra = new \Fiber($tarea);
            $fibras[$nombre] = $fibra;
            $this->preparando = $fibra;
            try {
                $lote = $fibra->start();
                if ($lote !== null) array_push($peticiones, ...array_values($lote));
            } finally {
                $this->preparando = null;
            }
        }
        $cuerpos = $this->transferir($peticiones);
        $resultados = [];
        foreach ($fibras as $nombre => $fibra) {
            if ($fibra->isSuspended()) $fibra->resume($cuerpos);
            $resultados[$nombre] = $fibra->getReturn();
        }
        return $resultados;
    }

    /** Devuelve el cuerpo de cada respuesta 2xx; una transferencia fallida queda en null. */
    public function descargar(array $peticiones): array
    {
        if ($this->preparando !== null && $this->preparando === \Fiber::getCurrent()) {
            $cuerpos = \Fiber::suspend($peticiones);
        } else {
            $cuerpos = $this->transferir($peticiones);
        }
        $respuestas = [];
        foreach ($peticiones as $clave => $ch) {
            $respuestas[$clave] = $cuerpos[spl_object_id($ch)] ?? null;
        }
        return $respuestas;
    }

    private function transferir(array $peticiones): array
    {
        if (!$peticiones) return [];
        $cuerpos = [];
        $multi = curl_multi_init();
        try {
            foreach ($peticiones as $ch) curl_multi_add_handle($multi, $ch);
            do {
                $estado = curl_multi_exec($multi, $activas);
                if ($activas && $estado === CURLM_OK && curl_multi_select($multi, 0.2) === -1) usleep(10000);
            } while ($activas && $estado === CURLM_OK);
            while ($evento = curl_multi_info_read($multi)) {
                $ch = $evento['handle'];
                $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                if ($evento['result'] === CURLE_OK && $http >= 200 && $http < 300) {
                    $cuerpos[spl_object_id($ch)] = curl_multi_getcontent($ch);
                }
            }
        } finally {
            foreach ($peticiones as $ch) curl_multi_remove_handle($multi, $ch);
            curl_multi_close($multi);
        }
        return $cuerpos;
    }
}
