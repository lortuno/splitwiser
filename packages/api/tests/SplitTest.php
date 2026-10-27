<?php

declare(strict_types=1);

test('equal split divides the amount evenly', function (): void {
    $app = app();
    [$trip, $p] = tripWith($app, 'Ana', 'Ben', 'Chloé', 'David');
    $all = array_fill_keys(array_values($p), null);

    $expense = $app->expenses->create($trip, expenseInput(1000, $p['Ana'], [$p['Ana'] => 1000], 'equal', $all));

    assertSame([$p['Ana'] => 250, $p['Ben'] => 250, $p['Chloé'] => 250, $p['David'] => 250], sharesOf($expense));
});

test('exact split stores the given amounts', function (): void {
    $app = app();
    [$trip, $p] = tripWith($app, 'Ana', 'Ben', 'Chloé');

    $expense = $app->expenses->create($trip, expenseInput(4500, $p['Ana'], [$p['Ana'] => 4500], 'exact', [
        $p['Ana'] => 1000, $p['Ben'] => 2000, $p['Chloé'] => 1500,
    ]));

    assertSame([$p['Ana'] => 1000, $p['Ben'] => 2000, $p['Chloé'] => 1500], sharesOf($expense));
});

test('percentage split uses basis points', function (): void {
    $app = app();
    [$trip, $p] = tripWith($app, 'Ana', 'Ben', 'Chloé', 'David');

    $expense = $app->expenses->create($trip, expenseInput(54000, $p['Ana'], [$p['Ana'] => 54000], 'percentage', [
        $p['Ana'] => 3000, $p['Ben'] => 3000, $p['Chloé'] => 2000, $p['David'] => 2000,
    ]));

    assertSame([$p['Ana'] => 16200, $p['Ben'] => 16200, $p['Chloé'] => 10800, $p['David'] => 10800], sharesOf($expense));
});

test('shares split weights people by units', function (): void {
    $app = app();
    [$trip, $p] = tripWith($app, 'Ana', 'Ben', 'Chloé');

    $expense = $app->expenses->create($trip, expenseInput(6000, $p['Ana'], [$p['Ana'] => 6000], 'shares', [
        $p['Ana'] => 1, $p['Ben'] => 2, $p['Chloé'] => 3,
    ]));

    assertSame([$p['Ana'] => 1000, $p['Ben'] => 2000, $p['Chloé'] => 3000], sharesOf($expense));
});

test('exact split must add up to the amount', function (): void {
    $app = app();
    [$trip, $p] = tripWith($app, 'Ana', 'Ben');

    $errors = validationErrors(fn () => $app->expenses->create($trip, expenseInput(1000, $p['Ana'], [$p['Ana'] => 1000], 'exact', [
        $p['Ana'] => 500, $p['Ben'] => 400,
    ])));

    assertSame('sum_mismatch', $errors['split']['code']);
});

test('percentages must add up to 100', function (): void {
    $app = app();
    [$trip, $p] = tripWith($app, 'Ana', 'Ben');

    $errors = validationErrors(fn () => $app->expenses->create($trip, expenseInput(1000, $p['Ana'], [$p['Ana'] => 1000], 'percentage', [
        $p['Ana'] => 5000, $p['Ben'] => 4000,
    ])));

    assertSame('sum_mismatch', $errors['split']['code']);
});

test('invalid split values are reported per person', function (): void {
    $app = app();
    [$trip, $p] = tripWith($app, 'Ana', 'Ben');

    $errors = validationErrors(fn () => $app->expenses->create($trip, expenseInput(1000, $p['Ana'], [$p['Ana'] => 1000], 'shares', [
        $p['Ana'] => 1, $p['Ben'] => 0,
    ])));

    assertSame('invalid_value', $errors["split.{$p['Ben']}"]['code']);
});

test('dry run returns the split without saving', function (): void {
    $app = app();
    [$trip, $p] = tripWith($app, 'Ana', 'Ben', 'Chloé');

    $shares = $app->expenses->preview($trip, expenseInput(10000, $p['Ana'], [$p['Ana'] => 10000], 'equal', [
        $p['Ana'] => null, $p['Ben'] => null, $p['Chloé'] => null,
    ]));

    assertSame([$p['Ana'] => 3334, $p['Ben'] => 3333, $p['Chloé'] => 3333], sharesOf($shares));
    assertSame([], $app->expenses->list($trip));
});
