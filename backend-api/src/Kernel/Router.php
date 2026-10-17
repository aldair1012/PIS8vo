<?php
declare(strict_types=1);

namespace ZeaSys\Kernel;

use ZeaSys\Kernel\Errores\RecursoNoEncontradoException;

final class Router
{
    /**
     * @param array<string, array{controlador: string, accion?: string, acciones?: array<string, string>, publica?: bool}> $rutas
     */
    public function __construct(
        private Container $contenedor,
        private array $rutas,
        private AutenticacionMiddleware $middleware,
    ) {
    }

    /** Resolución de ruta IDÉNTICA a la del index.php original (action → PATH_INFO → URI). */
    public function resolverRutaActual(): string
    {
        $route = $_GET['action'] ?? '';
        if ($route === '') {
            $route = $_SERVER['PATH_INFO'] ?? '';
            if ($route === '') {
                $uriPath = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?: '';
                $pos = strpos($uriPath, 'index.php');
                if ($pos !== false) {
                    $route = substr($uriPath, $pos + 9);
                } else {
                    $posApi = strpos($uriPath, '/api/');
                    if ($posApi !== false) {
                        $route = substr($uriPath, $posApi);
                    }
                }
            }
        }
        return trim($route, '/');
    }

    public function despachar(Peticion $peticion): void
    {
        $ruta = $this->resolverRutaActual();
        $definicion = $this->rutas[$ruta] ?? null;

        if ($definicion === null) {
            // Paridad exacta con el index.php legacy: la autenticación corría ANTES del
            // switch, así que una ruta inexistente sin sesión devolvía 401 (el 404 del
            // case default solo era alcanzable con la sesión ya abierta).
            $this->middleware->procesar($ruta, ['publica' => false]);
            throw new RecursoNoEncontradoException("Ruta no encontrada: {$ruta}");
        }

        $this->middleware->procesar($ruta, $definicion);

        // Rutas con despacho por método HTTP (p. ej. api/cultivos) o de acción única.
        if (isset($definicion['acciones'])) {
            $accion = $definicion['acciones'][$peticion->metodo()] ?? null;
            if ($accion === null) {
                // Paridad con el switch original de api/cultivos.
                RespuestaJson::enviar(['error' => 'Método no permitido.'], 405);
                return;
            }
        } else {
            $accion = $definicion['accion'];
        }

        $controlador = $this->contenedor->get($definicion['controlador']);
        $controlador->{$accion}($peticion);
    }
}
