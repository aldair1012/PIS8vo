<?php
// CLI de evaluación; comparte el reranking con la aplicación, sin sesión ni datos privados.
declare(strict_types=1);
require __DIR__ . '/../backend-api/src/Kernel/AutoloaderPsr4.php';
ZeaSys\Kernel\AutoloaderPsr4::registrar(__DIR__ . '/../backend-api/src');
$data=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);
$corpus=json_decode(file_get_contents($data['corpus_file']),true,512,JSON_THROW_ON_ERROR);
echo json_encode(ZeaSys\Dominios\Chat\Infraestructura\RecuperadorChroma::fusionar($data['question'],$corpus['entries'],$data['dense_ids']),JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
