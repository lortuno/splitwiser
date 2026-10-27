<?php

declare(strict_types=1);

// Tiny test runner: every tests/*Test.php registers closures with test(); exit code 1 on any failure.

use App\Container;
use App\Database\Connection;
use App\Database\Schema;
use App\Service\ValidationException;

require dirname(__DIR__) . '/bootstrap.php';

final class AssertionFailed extends RuntimeException
{
}

/** @var array<string, Closure> $tests */
$tests = [];

function test(string $name, Closure $body): void
{
    $GLOBALS['tests'][$name] = $body;
}

function assertSame(mixed $expected, mixed $actual, string $message = ''): void
{
    if ($expected !== $actual) {
        throw new AssertionFailed(trim($message . "\n  expected: " . var_export($expected, true) . "\n  actual:   " . var_export($actual, true)));
    }
}

function assertTrue(bool $condition, string $message = 'Expected condition to be true.'): void
{
    if (!$condition) {
        throw new AssertionFailed($message);
    }
}

/** Runs $body and returns the validation errors it raised; fails if none were raised. */
function validationErrors(Closure $body): array
{
    try {
        $body();
    } catch (ValidationException $e) {
        return $e->errors;
    }
    throw new AssertionFailed('Expected a ValidationException.');
}

/** A fresh in-memory database with the schema applied. */
function app(): Container
{
    $pdo = Connection::open(':memory:');
    Schema::apply($pdo);

    return new Container($pdo);
}

/**
 * Creates a trip with the given members.
 * @return array{int, array<string, int>} trip id and person ids by name
 */
function tripWith(Container $app, string ...$names): array
{
    $tripId = $app->trips->create('Test trip', '2026-06-01', '2026-06-07');
    $ids = [];
    foreach ($names as $name) {
        $ids[$name] = $app->people->create($name);
        $app->trips->addMember($tripId, $ids[$name]);
    }

    return [$tripId, $ids];
}

/**
 * Builds a POST body.
 * @param array<int, int> $paidBy person id => cents
 * @param array<int, ?int> $between person id => split value
 */
function expenseInput(int $amount, int $recordedBy, array $paidBy, string $type, array $between, string $name = 'Lunch'): array
{
    return [
        'name' => $name,
        'date' => '2026-06-02',
        'amount_cents' => $amount,
        'recorded_by' => $recordedBy,
        'paid_by' => array_map(fn (int $id, int $cents) => ['person_id' => $id, 'amount_cents' => $cents], array_keys($paidBy), $paidBy),
        'split' => [
            'type' => $type,
            'between' => array_map(fn (int $id, ?int $value) => ['person_id' => $id, 'value' => $value], array_keys($between), $between),
        ],
    ];
}

/** @return array<int, int> person id => share cents of an expense */
function sharesOf(App\Dto\Expense|array $expenseOrShares): array
{
    $shares = is_array($expenseOrShares) ? $expenseOrShares : $expenseOrShares->splitBetween;
    $result = [];
    foreach ($shares as $share) {
        $result[$share->personId] = $share->shareCents;
    }

    return $result;
}

/** @return array<int, int> person id => net cents */
function netsOf(App\Dto\TripSummary $summary): array
{
    $result = [];
    foreach ($summary->balances as $balance) {
        $result[$balance->personId] = $balance->netCents;
    }

    return $result;
}

foreach (glob(__DIR__ . '/*Test.php') as $file) {
    require $file;
}

$failed = 0;
foreach ($tests as $name => $body) {
    try {
        $body();
        echo "  ✓ {$name}\n";
    } catch (Throwable $e) {
        $failed++;
        echo "  ✗ {$name}\n    " . str_replace("\n", "\n    ", $e->getMessage()) . "\n";
        if (!$e instanceof AssertionFailed) {
            echo '    at ' . $e->getFile() . ':' . $e->getLine() . "\n";
        }
    }
}

printf("\nPHP: %d passed, %d failed\n", count($tests) - $failed, $failed);
exit($failed === 0 ? 0 : 1);
