<?php

declare(strict_types=1);

// GET /me/debts: "I owe" / "I'm owed" on My groups (epic 2, checks 22-31).

/** @return array{0: int, 1: int, 2: list<string>} totals and "trip: pay|receive name cents" rows of $email */
function debtsOf(App\Container $app, string $email): array
{
    $debts = jsonOf(get($app, '/me/debts', tokenFor($app, $email)));
    $rows = [];
    foreach ($debts['groups'] as $group) {
        foreach ($group['transfers'] as $t) {
            $rows[] = "{$group['trip_id']}: {$t['direction']} {$t['person']['name']} {$t['amount_cents']}";
        }
    }

    return [$debts['owe_cents'], $debts['owed_cents'], $rows];
}

test('every demo account owes and is owed the figures of the seed table', function (): void {
    $app = seededApp();
    $expected = [
        'ana@example.com' => [7290, 0, ['7: pay Chloé 915', '1: pay Ben 6375']],
        'ben@example.com' => [0, 9140, ['1: receive Ana 6375', '1: receive David 2765']],
        'chloe@example.com' => [0, 3622, ['7: receive Ana 915', '1: receive David 2707']],
        'david@example.com' => [5472, 0, ['1: pay Ben 2765', '1: pay Chloé 2707']],
        'eva@example.com' => [0, 0, []],
        'hugo@example.com' => [0, 0, []],
        'jon@example.com' => [0, 666, ['4: receive Kim 333', '4: receive Lea 333']],
        'noah@example.com' => [0, 117283946, ['5: receive Maximiliane Alexandra von Hohenzollern-Sigmaringen 117283946']],
        'olga@example.com' => [0, 5000, ['6: receive Quinn 2000', '6: receive Rosa 2000', '6: receive Sam 1000']],
        'pia@example.com' => [0, 20000, ['8: receive Inés 10000', '8: receive Grandpa 10000']],
    ];
    foreach ($expected as $email => $figures) {
        assertSame($figures, debtsOf($app, $email), $email);
    }
});

test('a group lists its own totals; settled groups are left out', function (): void {
    $app = seededApp();
    $debts = jsonOf(get($app, '/me/debts', tokenFor($app, 'ana@example.com')));

    assertSame([[7, 915, 0], [1, 6375, 0]], array_map(fn ($g) => [$g['trip_id'], $g['owe_cents'], $g['owed_cents']], $debts['groups']));
    assertSame(['trip_id', 'owe_cents', 'owed_cents', 'transfers'], array_keys($debts['groups'][0]));
    assertSame(['direction', 'person', 'amount_cents'], array_keys($debts['groups'][0]['transfers'][0]));
    assertSame(['owe_cents' => 0, 'owed_cents' => 0, 'groups' => []], jsonOf(get($app, '/me/debts', tokenFor($app, 'hugo@example.com'))));
});

test('a paid group counts as settled until it is reopened', function (): void {
    $app = seededApp();
    $ana = tokenFor($app, 'ana@example.com');

    call($app, 'POST', '/trips/7/paid', [], $ana);
    assertSame([6375, 0, ['1: pay Ben 6375']], debtsOf($app, 'ana@example.com'));
    assertSame([0, 2707, ['1: receive David 2707']], debtsOf($app, 'chloe@example.com'));

    call($app, 'POST', '/trips/7/reopen', [], $ana);
    assertSame(7290, debtsOf($app, 'ana@example.com')[0]);
});

test('owing in one group and being owed in another are never netted', function (): void {
    $app = seededApp();
    $ana = tokenFor($app, 'ana@example.com');
    $created = call($app, 'POST', '/trips', ['name' => 'Coffee club', 'people' => [['name' => 'Ben', 'email' => 'ben@example.com']]], $ana);
    $trip = $created->data['trip'];
    [$a, $b] = array_map(fn ($m) => $m->id, $trip->members);
    assertSame(201, call($app, 'POST', "/trips/{$trip->id}/expenses", expenseInput(1000, $a, [$a => 1000], 'equal', [$a => null, $b => null], 'Coffee'), $ana)->status);

    assertSame([7290, 500, ['7: pay Chloé 915', '1: pay Ben 6375', '9: receive Ben 500']], debtsOf($app, 'ana@example.com'));
    assertSame([500, 9140, ['1: receive Ana 6375', '1: receive David 2765', '9: pay Ana 500']], debtsOf($app, 'ben@example.com'));
});

test('a new account owes nothing; the endpoint needs a token', function (): void {
    $app = seededApp();
    $token = signUp($app, 'Yara', 'yara@example.com', 'long-enough-1')->data['token'];

    assertSame(['owe_cents' => 0, 'owed_cents' => 0, 'groups' => []], jsonOf(get($app, '/me/debts', $token)));
    $response = get($app, '/me/debts');
    assertSame([401, 'unauthenticated'], [$response->status, $response->data['error']['code']]);
});
