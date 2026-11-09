<?php
// Prueba controlada de recuperación sin generar una respuesta auxiliar.
declare(strict_types=1);

namespace ZeaSys\Dominios\Chat\Infraestructura;

final class RecuperadorChroma
{
    private const COLLECTION_PATH = '/api/v2/tenants/default_tenant/databases/default_database/collections';
    private ?\Closure $transporte;
    private float $limite = 0.0;
    private array $indice;
    private array $corpus;

    public function __construct(?\Closure $transporte = null, ?array $indice = null, ?array $corpus = null)
    {
        $this->transporte = $transporte;
        $dir = __DIR__ . '/../../../../data/referencias/';
        $this->indice = $indice ?? $this->leerJson($dir . 'rag-indice.json');
        $this->corpus = $corpus ?? [];
        if ($corpus === null && $this->indice !== []) {
            $file = $dir . 'rag-corpus.json';
            if (is_file($file) && hash_equals((string) ($this->indice['corpus_sha256'] ?? ''), hash_file('sha256', $file))) {
                $this->corpus = $this->leerJson($file)['entries'] ?? [];
            }
        }
    }

    /** Devuelve null si el servicio falla; un array vacío indica una búsqueda válida sin resultados. */
    public function recuperar(string $pregunta): ?array
    {
        $result = $this->buscarRemoto($pregunta);
        if ($result === null && $this->indice !== [] && $this->corpus !== []) {
            return self::fusionar($pregunta, $this->corpus, []);
        }
        return $result;
    }

    private function buscarRemoto(string $pregunta): ?array
    {
        try {
            $this->limite = microtime(true) + 8.0;
            $chroma = rtrim(getenv('ZEASYS_CHROMA_URL') ?: 'http://127.0.0.1:8000', '/');
            $ollama = rtrim(getenv('ZEASYS_OLLAMA_URL') ?: 'http://127.0.0.1:11434', '/');
            $coleccionesUrl = $chroma . self::COLLECTION_PATH;
            $colecciones = $this->solicitar($coleccionesUrl);
            if (!is_array($colecciones)) return null;
            $id = null;
            foreach ($colecciones as $coleccion) {
                if (is_array($coleccion) && ($coleccion['name'] ?? null) === ($this->indice['collection'] ?? 'zeasys_cinco_pdf_v1')) {
                    $id = $coleccion['id'] ?? null;
                    break;
                }
            }
            if (!is_string($id) || !preg_match('/\A[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\z/i', $id)) return null;
            if ($this->indice !== [] && $this->corpus === []) return null;
            $respuesta = $this->solicitar($ollama . '/api/embed', [
                'model' => $this->indice['model'] ?? 'all-minilm',
                'input' => ($this->indice['query_prefix'] ?? '') . $pregunta,
                'truncate' => false, 'keep_alive' => '30m', 'options' => ['num_thread' => 4],
            ]);
            $vector = $respuesta['embeddings'][0] ?? null;
            if (!is_array($vector) || count($vector) !== ($this->indice['dimensions'] ?? 384)) return null;
            foreach ($vector as $numero) {
                if ((!is_int($numero) && !is_float($numero)) || !is_finite((float) $numero)) return null;
            }
            $consulta = ['query_embeddings' => [$vector], 'n_results' => 15, 'include' => ['documents', 'metadatas']];
            $permitidos = self::archivosPermitidos($pregunta);
            if ($this->indice !== []) $consulta['where'] = ['source_file' => ['$in' => $permitidos]];
            $resultado = $this->solicitar($coleccionesUrl . '/' . $id . '/query', $consulta);
            $textos = $resultado['documents'][0] ?? null;
            $metadatos = $resultado['metadatas'][0] ?? null;
            if (!is_array($textos) || !is_array($metadatos) || count($textos) !== count($metadatos)) return null;
            if ($this->indice !== []) {
                return self::fusionar($pregunta, $this->corpus, $resultado['ids'][0] ?? [], $permitidos);
            }
            $documentos = [];
            foreach ($textos as $index => $texto) {
                $documentos[] = ['pageContent' => $texto, 'metadata' => $metadatos[$index] ?? null];
            }
            return $documentos;
        } catch (\Throwable $error) {
            // Un fallo de búsqueda nunca debe impedir la conversación principal.
            return null;
        }
    }

    private function leerJson(string $file): array
    {
        if (!is_file($file)) return [];
        $data = json_decode(file_get_contents($file) ?: '', true);
        return is_array($data) ? $data : [];
    }

    public static function archivosPermitidos(string $pregunta): array
    {
        $all = ['inec-espac-resultados-2025.pdf', 'iniap-guia-maiz-amarillo-litoral-2014.pdf', 'iniap-guia-produccion-maiz-sierra-2021.pdf', 'iniap-manual-produccion-maiz-2007.pdf', 'mag-guia-productores-maiz-amarillo-2026.pdf'];
        $q = mb_strtolower($pregunta, 'UTF-8');
        $inec = preg_match('/\b(inec|espac)\b/u', $q) === 1;
        $mag = preg_match('/\bmag\b/u', $q) === 1;
        if ($inec && !$mag) return [$all[0]];
        if ($mag && !$inec) return [$all[4]];
        preg_match_all('/\b20\d{2}\b/', $q, $years);
        $years = array_unique($years[0]);
        if (count($years) === 1 && preg_match('/\b(manual|gu[ií]a|iniap)\b/u', $q)) {
            $named = array_values(array_filter($all, static fn ($file) => str_contains($file, (string) reset($years))));
            if ($named !== []) return $named;
        }
        $sierra = preg_match('/\bsierra\b/u', $q) === 1;
        $litoral = preg_match('/\b(litoral|costa)\b/u', $q) === 1;
        if ($sierra !== $litoral) $all = array_values(array_diff($all, [$sierra ? $all[1] : $all[2]]));
        return $all;
    }

    private static function tokens(string $text): array
    {
        $text = strtr(mb_strtolower($text, 'UTF-8'), ['á'=>'a','é'=>'e','í'=>'i','ó'=>'o','ú'=>'u','ü'=>'u']);
        preg_match_all('/[\p{L}\p{N}]+/u', $text, $matches);
        $stop = array_flip(explode(' ', 'de del la las el los un una unos unas en a al para por que se es son con y o como cual cuales cuanto cuando segun sobre me mi mis tu sus su puede puedo deberia recomienda recomiendan guia manual cultivo maiz iniap'));
        $out = [];
        foreach ($matches[0] as $word) {
            if (isset($stop[$word]) || mb_strlen($word) < 2) continue;
            if (mb_strlen($word) > 5) $word = preg_replace('/(?:es|s)$/u', '', $word);
            $out[] = $word;
        }
        return $out;
    }

    /** BM25 sobre todo el corpus permitido + fusión de rankings + reranking por evidencia y cobertura. */
    public static function fusionar(string $pregunta, array $corpus, array $denseIds, ?array $permitidos = null): array
    {
        $permitidos ??= self::archivosPermitidos($pregunta);
        $terms = array_values(array_unique(self::tokens($pregunta)));
        if ($terms === []) return [];
        $pool = []; $df = []; $total = 0;
        foreach ($corpus as $entry) {
            if (!in_array($entry['metadata']['source_file'] ?? '', $permitidos, true)) continue;
            $tokens = self::tokens(($entry['text'] ?? '') . ' ' . ($entry['metadata']['year'] ?? ''));
            $freq = array_count_values($tokens);
            $pool[$entry['id']] = ['entry'=>$entry, 'freq'=>$freq, 'length'=>count($tokens)];
            $total += count($tokens);
            foreach ($terms as $term) if (isset($freq[$term])) $df[$term] = ($df[$term] ?? 0) + 1;
        }
        $n = count($pool);
        if (!$n) return [];
        $average = max(1, $total/$n); $lexical = []; $coverage = [];
        foreach ($pool as $id=>$doc) {
            $score = 0; $hits = 0;
            foreach ($terms as $term) {
                $tf = $doc['freq'][$term] ?? 0;
                if (!$tf) continue;
                $hits++;
                $idf = log(1 + ($n-($df[$term] ?? 0)+.5)/(($df[$term] ?? 0)+.5));
                $score += $idf*$tf*2.2/($tf+1.2*(.25+.75*$doc['length']/$average));
            }
            if ($score > 0) { $lexical[$id]=$score; $coverage[$id]=$hits/count($terms); }
        }
        if ($lexical === []) return [];
        arsort($lexical); $scores = [];
        foreach (array_slice(array_keys($lexical),0,30) as $rank=>$id) $scores[$id]=1/(60+$rank+1);
        foreach ($denseIds as $rank=>$id) if (isset($pool[$id],$coverage[$id])) $scores[$id]=($scores[$id] ?? 0)+1/(60+$rank+1);
        foreach ($scores as $id=>&$score) {
            $score += .008*$coverage[$id];
            if (($pool[$id]['entry']['metadata']['verified_excerpt'] ?? false) === true) $score += .006;
        }
        unset($score); arsort($scores);
        $selected = []; $pages = [];
        foreach ($scores as $id=>$score) {
            $entry=$pool[$id]['entry']; $meta=$entry['metadata'];
            $page=$meta['source_file'].':'.$meta['page'];
            if (isset($pages[$page])) continue;
            $pages[$page]=true;
            $text=$entry['text'];
            if (($meta['verified_excerpt'] ?? false) === true) {
                // Una tabla y su explicación pueden ser extractos distintos de la misma página.
                $parts=[];
                foreach ($pool as $other) {
                    $candidate=$other['entry']; $m=$candidate['metadata'];
                    if ($m['source_file'] === $meta['source_file'] && $m['page'] === $meta['page'] && ($m['verified_excerpt'] ?? false) === true) $parts[]=$candidate['text'];
                }
                $complete=implode("\n",array_unique($parts));
                if (mb_strlen($complete,'UTF-8')<=1000) $text=$complete;
            }
            $selected[]=['pageContent'=>$text, 'metadata'=>$meta, 'id'=>$id];
            if (count($selected)===3) break;
        }
        return $selected;
    }

    private function solicitar(string $url, ?array $datos = null): ?array
    {
        if ($this->transporte !== null) return ($this->transporte)($url, $datos);
        if (!function_exists('curl_init')) return null;
        $restante = (int) (($this->limite - microtime(true)) * 1000);
        if ($restante <= 0) return null;
        $curl = curl_init($url);
        $opciones = [CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT_MS => min(1000, $restante), CURLOPT_TIMEOUT_MS => $restante];
        if ($datos !== null) {
            $json = json_encode($datos, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if (!is_string($json)) return null;
            $opciones += [CURLOPT_POST => true, CURLOPT_HTTPHEADER => ['Content-Type: application/json'], CURLOPT_POSTFIELDS => $json];
        }
        curl_setopt_array($curl, $opciones);
        $raw = curl_exec($curl);
        $status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
        curl_close($curl);
        if ($status !== 200 || !is_string($raw)) return null;
        $parsed = json_decode($raw, true);
        return is_array($parsed) ? $parsed : null;
    }
}
