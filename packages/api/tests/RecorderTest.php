<?php

declare(strict_types=1);

test('the recorder does not have to pay or share', function (): void {
    $app = app();
    [$trip, $p] = tripWith($app, 'Ana', 'Ben', 'Chloé', 'David');

    $expense = $app->expenses->create($trip, expenseInput(
        9000, $p['David'], [$p['Ben'] => 5000, $p['Chloé'] => 4000], 'percentage', [$p['Ana'] => 5000, $p['Ben'] => 3000, $p['Chloé'] => 2000],
    ));
    $summary = $app->summaries->forTrip($trip);

    assertSame('David', $expense->recordedBy->name);
    assertSame([$p['Ana'] => -4500, $p['Ben'] => 2300, $p['Chloé'] => 2200, $p['David'] => 0], netsOf($summary));
});

test('the recorder must be on the trip', function (): void {
    $app = app();
    [$trip, $p] = tripWith($app, 'Ana');
    [, $other] = tripWith($app, 'Zoe');

    $errors = validationErrors(fn () => $app->expenses->create($trip, expenseInput(
        1000, $other['Zoe'], [$p['Ana'] => 1000], 'equal', [$p['Ana'] => null],
    )));

    assertSame('not_a_member', $errors['recorded_by']['code']);
});
