<?php

declare(strict_types=1);

test('a personal purchase creates no debt', function (): void {
    $app = app();
    [$trip, $p] = tripWith($app, 'Ana', 'Ben', 'Chloé');

    $app->expenses->create($trip, expenseInput(2490, $p['Ben'], [$p['Ben'] => 2490], 'equal', [$p['Ben'] => null], 'Souvenir'));
    $summary = $app->summaries->forTrip($trip);

    assertSame(2490, $summary->totalCents);
    assertSame([$p['Ana'] => 0, $p['Ben'] => 0, $p['Chloé'] => 0], netsOf($summary));
    assertSame([], $summary->transfers);
});

test('someone can pay for another person only', function (): void {
    $app = app();
    [$trip, $p] = tripWith($app, 'Ana', 'Ben');

    $app->expenses->create($trip, expenseInput(1500, $p['Ana'], [$p['Ana'] => 1500], 'equal', [$p['Ben'] => null]));
    $summary = $app->summaries->forTrip($trip);

    assertSame([$p['Ana'] => 1500, $p['Ben'] => -1500], netsOf($summary));
    assertSame(1, count($summary->transfers));
    assertSame($p['Ben'], $summary->transfers[0]->from->id);
    assertSame($p['Ana'], $summary->transfers[0]->to->id);
});
