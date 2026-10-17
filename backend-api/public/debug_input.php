<?php
echo "REQUEST_METHOD: " . ($_SERVER['REQUEST_METHOD'] ?? 'N/A') . "\n";
echo "CONTENT_TYPE: " . ($_SERVER['CONTENT_TYPE'] ?? 'N/A') . "\n";
$raw = file_get_contents('php://input');
echo "php://input: " . $raw . "\n";
echo "php://input length: " . strlen($raw) . "\n";
echo "_POST: " . json_encode($_POST) . "\n";
echo "_GET: " . json_encode($_GET) . "\n";
