<?php

declare(strict_types=1);

test('leftover cents of an equal split go to the lowest person ids', function (): void {
    $app = app();
    [$trip, $p] = tripWith($app, 'Ana', 'Ben', 'Chloé', 'David');
    $all = array_fill_keys(array_values($p), null);

    $expense = $app->expenses->create($trip, expenseInput(1003, $p['Ana'], [$p['Ana'] => 1003], 'equal', $all));

    assertSame([$p['Ana'] => 251, $p['Ben'] => 251, $p['Chloé'] => 251, $p['David'] => 250], sharesOf($expense));
});

test('leftover cents go to the largest remainder first', function (): void {
    $app = app();
    [$trip, $p] = tripWith($app, 'Ana', 'Ben', 'Chloé');

    // 13,99 € at 33,33 % / 33,33 % / 33,34 %: floors 466 + 466 + 466 = 1398, the extra cent goes to
    // Chloé whose exact share (466,4266) has the largest remainder, not to Ana (lowest id).
    $expense = $app->expenses->create($trip, expenseInput(1399, $p['Ana'], [$p['Ana'] => 1399], 'percentage', [
        $p['Ana'] => 3333, $p['Ben'] => 3333, $p['Chloé'] => 3334,
    ]));

    assertSame([$p['Ana'] => 466, $p['Ben'] => 466, $p['Chloé'] => 467], sharesOf($expense));
});

test('input order does not change the result', function (): void {
    $app = app();
    [$trip, $p] = tripWith($app, 'Ana', 'Ben', 'Chloé');

    $forward = $app->expenses->preview($trip, expenseInput(1000, $p['Ana'], [$p['Ana'] => 1000], 'shares', [
        $p['Ana'] => 1, $p['Ben'] => 1, $p['Chloé'] => 1,
    ]));
    $backward = $app->expenses->preview($trip, expenseInput(1000, $p['Ana'], [$p['Ana'] => 1000], 'shares', [
        $p['Chloé'] => 1, $p['Ben'] => 1, $p['Ana'] => 1,
    ]));

    assertSame(sharesOf($forward), sharesOf($backward));
    assertSame([$p['Ana'] => 334, $p['Ben'] => 333, $p['Chloé'] => 333], sharesOf($forward));
});

test('shares always add up to the amount, to the cent', function (): void {
    $app = app();
    [$trip, $p] = tripWith($app, 'Ana', 'Ben', 'Chloé', 'David');
    $weights = [$p['Ana'] => 3, $p['Ben'] => 7, $p['Chloé'] => 11, $p['David'] => 13];

    foreach ([1, 2, 3, 7, 99, 101, 1001, 99999, 123457] as $amount) {
        foreach (['equal', 'shares'] as $type) {
            $between = $type === 'equal' ? array_fill_keys(array_keys($weights), null) : $weights;
            $shares = sharesOf($app->expenses->preview($trip, expenseInput($amount, $p['Ana'], [$p['Ana'] => $amount], $type, $between)));
            assertSame($amount, array_sum($shares), "{$type} split of {$amount} cents");
            assertTrue(max($shares) - min($shares) <= ($type === 'equal' ? 1 : $amount), "{$type} split of {$amount} is uneven");
        }
    }
});
