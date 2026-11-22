<?php
declare(strict_types=1);
namespace ZeaSys\Dominios\Analitica\Http;

use ZeaSys\Dominios\Analitica\Aplicacion\ServicioCampanas;
use ZeaSys\Dominios\Analitica\Infraestructura\CampanasRepository;
use ZeaSys\Kernel\Errores\ValidacionException;
use ZeaSys\Kernel\Peticion;
use ZeaSys\Kernel\RespuestaJson;

final class CampanasController
{
    public function __construct(private ServicioCampanas $servicio, private CampanasRepository $repo) {}

    public function historial(Peticion $p): void
    {
        $id = $p->queryEntero('parcela_id', null, 1) ?? throw new ValidacionException('Selecciona la parcela.');
        header('Cache-Control: private, no-store');
        RespuestaJson::enviar($this->servicio->historial((int) $_SESSION['usuario_id'], $id));
    }

    private function parcela(Peticion $p): int
    {
        $id = filter_var($p->campo('parcela_id'), FILTER_VALIDATE_INT);
        if (!$id || $id < 1) throw new ValidacionException('Selecciona la parcela.');
        return $id;
    }

    public function cosechar(Peticion $p): void
    {
        $this->servicio->cosechar((int) $_SESSION['usuario_id'], $this->parcela($p), $p->cuerpo());
        RespuestaJson::enviar(['exito' => true]);
    }

    public function observar(Peticion $p): void
    {
        $this->servicio->observar((int) $_SESSION['usuario_id'], $this->parcela($p), $p->cuerpo(), $_FILES['adjunto'] ?? null);
        RespuestaJson::enviar(['exito' => true]);
    }

    public function descargar(Peticion $p): void
    {
        $id = $p->queryEntero('id', null, 1) ?? throw new ValidacionException('Selecciona la observación.');
        $fila = $this->repo->adjunto((int) $_SESSION['usuario_id'], $id);
        $extension = match ($fila['adjunto_tipo']) {
            'image/png' => 'png', 'image/jpeg' => 'jpg', 'audio/mpeg' => 'mp3', 'audio/ogg' => 'ogg',
            'audio/mp4', 'audio/x-m4a' => 'm4a', 'audio/wav', 'audio/x-wav' => 'wav', default => 'bin',
        };
        header('Cache-Control: private, no-store');
        header('Content-Type: application/octet-stream');
        header('X-Content-Type-Options: nosniff');
        header('Content-Disposition: attachment; filename="observacion-' . $id . '.' . $extension . '"');
        echo $fila['adjunto'];
    }
}
