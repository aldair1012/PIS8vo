<?php
declare(strict_types=1);
namespace ZeaSys\Dominios\Lotes\Http;

use ZeaSys\Dominios\Lotes\Aplicacion\ServicioAcompanamiento;
use ZeaSys\Dominios\Lotes\Infraestructura\AcompanamientoRepository;
use ZeaSys\Kernel\Errores\ValidacionException;
use ZeaSys\Kernel\Peticion;
use ZeaSys\Kernel\RespuestaJson;

final class AcompanamientoController
{
    public function __construct(private AcompanamientoRepository $repo, private ServicioAcompanamiento $servicio) {}

    public function panel(Peticion $p): void
    {
        $id = (int) $_SESSION['usuario_id'];
        header('Cache-Control: private, no-store');
        RespuestaJson::enviar(['accesos' => $this->repo->otorgados($id), 'triaje' => $this->servicio->triaje($id)]);
    }

    private function id(Peticion $p, string $campo): int
    {
        $id = filter_var($p->campo($campo), FILTER_VALIDATE_INT);
        if (!$id || $id < 1) throw new ValidacionException('Selecciona una parcela y una cuenta válidas.');
        return $id;
    }

    public function conceder(Peticion $p): void
    {
        $correo = $p->campo('correo');
        if (!is_string($correo) || strlen($correo) > 150 || !filter_var(trim($correo), FILTER_VALIDATE_EMAIL)) throw new ValidacionException('Revisa el correo de la cuenta.');
        $this->repo->autorizar((int) $_SESSION['usuario_id'], $this->id($p, 'parcela_id'), trim($correo));
        RespuestaJson::enviar(['exito' => true]);
    }

    public function revocar(Peticion $p): void
    {
        $this->repo->revocar((int) $_SESSION['usuario_id'], $this->id($p, 'parcela_id'), $this->id($p, 'tecnico_id'));
        RespuestaJson::enviar(['exito' => true]);
    }

    public function exportar(Peticion $p): void
    {
        $filas = $this->servicio->triaje((int) $_SESSION['usuario_id']);
        header('Cache-Control: private, no-store');
        header('Content-Type: text/csv; charset=UTF-8');
        header('X-Content-Type-Options: nosniff');
        header('Content-Disposition: attachment; filename="acompanamiento-parcelas.csv"');
        $salida = fopen('php://output', 'wb');
        fwrite($salida, "\xEF\xBB\xBF");
        $columnas = ['id', 'nombre_parcela', 'fecha_siembra', 'area', 'estado', 'motivo', 'ultima_observacion', 'fecha_cosecha', 'rendimiento_observado_t_ha'];
        fputcsv($salida, $columnas, ',', '"', '');
        foreach ($filas as $fila) {
            $valores = [];
            foreach ($columnas as $c) {
                $texto = (string) ($fila[$c] ?? '');
                $valores[] = preg_match('/^[\s\p{Cf}]*[=+@-]/u', $texto) ? "'" . $texto : $texto;
            }
            fputcsv($salida, $valores, ',', '"', '');
        }
        fclose($salida);
    }
}
