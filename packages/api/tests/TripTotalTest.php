<?php

declare(strict_types=1);

test('trip total is the sum of its expenses only', function (): void {
    $app = app();
    [$trip, $p] = tripWith($app, 'Ana', 'Ben');
    [$otherTrip, $o] = tripWith($app, 'Zoe');
    $both = [$p['Ana'] => null, $p['Ben'] => null];

    $app->expenses->create($trip, expenseInput(1250, $p['Ana'], [$p['Ana'] => 1250], 'equal', $both));
    $app->expenses->create($trip, expenseInput(999, $p['Ben'], [$p['Ben'] => 999], 'equal', $both));
    $app->expenses->create($otherTrip, expenseInput(5000, $o['Zoe'], [$o['Zoe'] => 5000], 'equal', [$o['Zoe'] => null]));

    $summary = $app->summaries->forTrip($trip);
    assertSame(2249, $summary->totalCents);
    assertSame(2, $summary->expenseCount);
    assertSame(0, array_sum(netsOf($summary)));
});

test('an empty trip has a zero total', function (): void {
    $app = app();
    [$trip, $p] = tripWith($app, 'Ana');

    $summary = $app->summaries->forTrip($trip);

    assertSame(0, $summary->totalCents);
    assertSame([$p['Ana'] => 0], netsOf($summary));
});
