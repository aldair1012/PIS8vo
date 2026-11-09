<?php
// src/Dominios/Analitica/Http/YieldController.php — Controlador delgado para el dashboard Yield.
declare(strict_types=1);

namespace ZeaSys\Dominios\Analitica\Http;

use ZeaSys\Dominios\Analitica\Aplicacion\ServicioAnaliticaYield;
use ZeaSys\Dominios\Analitica\Aplicacion\ServicioMedicionesRendimiento;
use ZeaSys\Kernel\Errores\ValidacionException;
use ZeaSys\Kernel\Peticion;
use ZeaSys\Kernel\RespuestaJson;

final class YieldController
{
    public function __construct(private ServicioAnaliticaYield $servicio, private ServicioMedicionesRendimiento $mediciones) {}

    public function index(Peticion $peticion): void
    {
        RespuestaJson::enviar($this->servicio->construir(
            $this->usuarioId(),
            $peticion->queryEntero('parcela_id', null, 1),
            $peticion->queryEntero('año', null, 2000, 2100),
        ));
    }

    /** El middleware de sesión ya garantiza $_SESSION['usuario_id'] para estas rutas. */
    private function usuarioId(): int
    {
        return (int) $_SESSION['usuario_id'];
    }

    public function obtenerMediciones(Peticion $peticion): void
    {
        $id = $peticion->queryEntero('parcela_id', null, 1);
        if ($id === null) throw new ValidacionException('La parcela no es válida.');
        RespuestaJson::enviar(['mediciones' => $this->mediciones->obtener($this->usuarioId(), $id)]);
    }

    public function guardarMediciones(Peticion $peticion): void
    {
        $id = filter_var($peticion->campo('parcela_id'), FILTER_VALIDATE_INT);
        if ($id === false || $id < 1) throw new ValidacionException('La parcela no es válida.');
        RespuestaJson::enviar(['exito' => true, 'mediciones' => $this->mediciones->guardar($this->usuarioId(), $id, $peticion->cuerpo())]);
    }
}
