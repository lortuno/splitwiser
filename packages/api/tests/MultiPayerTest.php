<?php

declare(strict_types=1);

test('several people can pay one expense', function (): void {
    $app = app();
    [$trip, $p] = tripWith($app, 'Ana', 'Ben', 'Chloé', 'David');
    $all = array_fill_keys(array_values($p), null);

    $expense = $app->expenses->create($trip, expenseInput(10000, $p['Ana'], [$p['Ana'] => 6000, $p['Ben'] => 4000], 'equal', $all));

    assertSame(2, count($expense->paidBy));
    assertSame([$p['Ana'] => 3500, $p['Ben'] => 1500, $p['Chloé'] => -2500, $p['David'] => -2500], netsOf($app->summaries->forTrip($trip)));
});

test('paid amounts must add up to the total', function (): void {
    $app = app();
    [$trip, $p] = tripWith($app, 'Ana', 'Ben');

    $errors = validationErrors(fn () => $app->expenses->create($trip, expenseInput(
        10000, $p['Ana'], [$p['Ana'] => 6000, $p['Ben'] => 3000], 'equal', [$p['Ana'] => null, $p['Ben'] => null],
    )));

    assertSame('sum_mismatch', $errors['paid_by']['code']);
    assertSame('Paid amounts add up to 90,00 € but the expense is 100,00 €.', $errors['paid_by']['message']);
});

test('a payer cannot be listed twice', function (): void {
    $app = app();
    [$trip, $p] = tripWith($app, 'Ana', 'Ben');
    $input = expenseInput(1000, $p['Ana'], [$p['Ana'] => 500], 'equal', [$p['Ana'] => null]);
    $input['paid_by'][] = ['person_id' => $p['Ana'], 'amount_cents' => 500];

    $errors = validationErrors(fn () => $app->expenses->create($trip, $input));

    assertSame('duplicate', $errors['paid_by']['code']);
});

test('missing fields are reported per field', function (): void {
    $app = app();
    [$trip] = tripWith($app, 'Ana');

    $errors = validationErrors(fn () => $app->expenses->create($trip, []));

    assertSame(['name', 'date', 'amount_cents', 'recorded_by', 'paid_by', 'split'], array_keys($errors));
});
