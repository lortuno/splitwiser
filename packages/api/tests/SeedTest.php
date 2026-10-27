<?php

declare(strict_types=1);

use App\Database\Seeder;

test('seed has 4 people and 20 expenses over 7 days', function (): void {
    $app = app();
    $trip = $app->seeder()->seed();
    $expenses = $app->expenses->list($trip);

    assertSame(4, count($app->trips->find($trip)->members));
    assertSame(20, count($expenses));
    assertSame(7, count(array_unique(array_map(fn ($e) => $e->date, $expenses))));
});

test('seed covers all split types, multiple payers and non-paying recorders', function (): void {
    $app = app();
    $expenses = $app->expenses->list($app->seeder()->seed());

    $types = array_unique(array_map(fn ($e) => $e->splitType->value, $expenses));
    sort($types);
    assertSame(['equal', 'exact', 'percentage', 'shares'], $types);

    $multiPayer = array_filter($expenses, fn ($e) => count($e->paidBy) > 1);
    assertTrue(count($multiPayer) >= 3, 'At least three expenses with more than one payer.');

    $recordedByNonPayer = array_filter(
        $expenses,
        fn ($e) => !in_array($e->recordedBy->id, array_map(fn ($p) => $p->personId, $e->paidBy), true),
    );
    assertTrue(count($recordedByNonPayer) >= 5, 'At least five expenses recorded by someone who did not pay.');

    $personal = array_filter($expenses, fn ($e) => count($e->splitBetween) === 1);
    assertTrue(count($personal) >= 1, 'At least one personal purchase.');
});

test('seed is consistent: shares and payments add up, balances net to zero', function (): void {
    $app = app();
    $trip = $app->seeder()->seed();
    $summary = $app->summaries->forTrip($trip);

    $expected = array_sum(array_map(fn ($row) => $row[2], Seeder::expenses()));
    assertSame($expected, $summary->totalCents);
    foreach ($app->expenses->list($trip) as $e) {
        assertSame($e->amountCents, array_sum(sharesOf($e)), "Shares of {$e->name}");
        assertSame($e->amountCents, array_sum(array_map(fn ($p) => $p->amountCents, $e->paidBy)), "Payments of {$e->name}");
    }
    assertSame(0, array_sum(netsOf($summary)));
    assertTrue(count($summary->transfers) <= 3, 'Four people need at most three transfers.');
});

test('seed is deterministic', function (): void {
    $a = app();
    $b = app();

    $first = json_encode([$a->expenses->list($a->seeder()->seed()), $a->summaries->forTrip(1)]);
    $second = json_encode([$b->expenses->list($b->seeder()->seed()), $b->summaries->forTrip(1)]);

    assertSame($first, $second);
});

test('seedIfEmpty only seeds an empty database', function (): void {
    $app = app();

    assertTrue($app->seeder()->seedIfEmpty());
    assertTrue(!$app->seeder()->seedIfEmpty());
    assertSame(1, count($app->trips->findAll()));
});
