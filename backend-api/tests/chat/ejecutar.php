<?php
// tests/chat/ejecutar.php — Test runner simple para el dominio Chat (sin PHPUnit).
// Uso: php tests/chat/ejecutar.php

declare(strict_types=1);

require_once __DIR__ . '/../../src/Kernel/AutoloaderPsr4.php';
ZeaSys\Kernel\AutoloaderPsr4::registrar(__DIR__ . '/../../src');

$tests  = [];
$passed = 0;
$failed = 0;

function test(string $name, callable $fn): void
{
    global $tests;
    $tests[] = ['name' => $name, 'fn' => $fn];
}

function assert_equals(mixed $expected, mixed $actual, string $message = ''): void
{
    if ($expected !== $actual) {
        throw new RuntimeException('Assertion failed: ' . $message . '. Expected ' . var_export($expected, true) . ', got ' . var_export($actual, true));
    }
}

function assert_true(bool $condition, string $message = ''): void
{
    if (!$condition) {
        throw new RuntimeException('Assertion failed: ' . $message);
    }
}

function assert_throws(string $exceptionClass, callable $fn, string $message = ''): void
{
    try {
        $fn();
    } catch (Throwable $e) {
        if ($e instanceof $exceptionClass) {
            return;
        }
        throw new RuntimeException('Assertion failed: ' . $message . '. Expected ' . $exceptionClass . ', got ' . get_class($e) . ': ' . $e->getMessage());
    }
    throw new RuntimeException('Assertion failed: ' . $message . '. Expected ' . $exceptionClass . ', but no exception was thrown');
}

function assert_contains(string $needle, string $haystack, string $message = ''): void
{
    if (strpos($haystack, $needle) === false) {
        throw new RuntimeException('Assertion failed: ' . $message . ". '$needle' not found in '$haystack'");
    }
}

require_once __DIR__ . '/GeminiFlowiseTest.php';
require_once __DIR__ . '/MemoriaSesionTest.php';

foreach ($tests as $t) {
    try {
        ($t['fn'])();
        echo "[OK] {$t['name']}\n";
        $passed++;
    } catch (Throwable $e) {
        echo "[FAIL] {$t['name']}: {$e->getMessage()}\n";
        $failed++;
    }
}

echo "\n{$passed} passed, {$failed} failed\n";
exit($failed > 0 ? 1 : 0);
