<?php
// src/Dominios/Simulaciones/Explicacion/Dominio/EvaluadorCondiciones.php — Evalúa las condiciones strpos de las reglas preservando el orden del registro.
declare(strict_types=1);

namespace ZeaSys\Dominios\Simulaciones\Explicacion\Dominio;

final class EvaluadorCondiciones
{
    /**
     * Formatos soportados:
     *  ['cualquiera' => ['cascada','brecha']]      → algún strpos
     *  ['todas'      => ['probabilidad','cosecha']] → todos los strpos
     *  ['y' => [cond, cond]] / ['o' => [cond, cond]] → composición recursiva
     */
    public function cumple(array $condicion, string $nombreLower): bool
    {
        if (isset($condicion['cualquiera'])) {
            foreach ($condicion['cualquiera'] as $texto) {
                if (strpos($nombreLower, $texto) !== false) { return true; }
            }
            return false;
        }
        if (isset($condicion['todas'])) {
            foreach ($condicion['todas'] as $texto) {
                if (strpos($nombreLower, $texto) === false) { return false; }
            }
            return true;
        }
        if (isset($condicion['y'])) {
            foreach ($condicion['y'] as $sub) {
                if (!$this->cumple($sub, $nombreLower)) { return false; }
            }
            return true;
        }
        if (isset($condicion['o'])) {
            foreach ($condicion['o'] as $sub) {
                if ($this->cumple($sub, $nombreLower)) { return true; }
            }
            return false;
        }
        return false;
    }
}
